# next-middleware-auth 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点 Next 鉴权与中间件高频面经，中文重述。

---

## A. 运行时与能力

**1. middleware 为什么跑在 Edge 而不是 Node？这带来哪些硬限制？**
**来源**：知乎《边缘中间件的取舍》；InfoQ（Vercel Edge Network 机制文）
位置决定属性：在渲染与路由之前、离用户最近的网关层做快速判断（redirect/rewrite/头操作），毫秒预算+海量并发要求零 I/O 重活。硬限制：无 Node API（fs/net/多数原生 addon）、CPU 时间片小、不能查关系库（要 KV/JWK 类无状态材料）。设计启示：**middleware 的判断必须只依赖请求本身携带的信息**（呼应 next-middleware-auth 第一、四节）。

**2. middleware、NextConfig 的 redirects/headers/rewrites、Route Handler 三层都能做跳转/改写，分工依据是什么？**
**来源**：CSDN《Next 重写的三个入口》
静态规则（老 301、全局安全头）→ next.config（构建期进路由表、零运行时代码）；带运行时判断（cookie/UA/实验分桶）→ middleware；带业务逻辑（权限、数据）→ 渲染层/Handler。顺序也是执行顺序：config → middleware → 渲染。这题等价于 Express"静态 vs 中间件 vs 控制器"的分层观（呼应 exp-server、express 中间件次序）。

**3. middleware 抛异常/超时，请求会怎样？怎么防？**
**来源**：SegmentFault《中间件挂掉的爆炸半径》
异常时 Next 返回 500，整站所有匹配路径一起倒——它是最宽的单点。防护：函数体最外层 try 兜底放行（fail-open 还是 fail-closed 按业务定并写进注释）、外部依赖只允许超时预算内的轻操作、matcher 尽量小。加分：说明"fail-open 让未登录也进页面，但第 2/3 层仍会拦"的纵深信心（呼应 next-middleware-auth 第二节、node-config 的容错设计）。

---

## B. 会话与方案

**4. JWT session 与 database session 在 Next 全栈里的完整对比？**
**来源**：掘金《Auth.js 两种 session 的架构后果》
JWT：edge 可验、零查库、登出难（黑名单/短 exp+刷新补偿）、体积顶 header；DB：即时吊销、要适配器查询（middleware 层只能验"会话存在"粗筛或配 KV）、读写多一跳。折中：JWT+版本号 claim（改密时 bump，服务端比对）（呼应 exp-auth 的 JWT 黑名单段、node-https-tls 的信任载体）。

**5. 'httpOnly cookie + JWT' 和 localStorage + Authorization 头，Next 场景为何几乎总选前者？**
**来源**：知乎《token 存放位置决定攻防面》
① SSR/RSC 在服务端渲染时必须拿到身份——头方案对服务端渲染期不存在，cookie 随每个文档请求自动到达；② XSS 爆炸半径小（httpOnly）；③ 代价：要 sameSite/CSRF 意识。一句话：**框架把部分执行搬到服务器后，凭证必须在传输层自动可达**（呼应 node-http 的 Cookie 原语、mp-login 的 session 管理对照）。

**6. OAuth 回调为什么必须在 Node 运行时完成而不能放 edge middleware？**
**来源**：CSDN《Auth.js 架构：callbacks in Node》
换 code 要带 client_secret 的 HTTPS 出站（部分平台 edge 限制 fetch/密钥管理方式不同）、要写会话 cookie 的复杂时序、可能持久化账号——这些是业务层动作。正确分工：middleware 只**验会话+改道**，回调端点在常规服务端。答题框架：**边缘做判断，中心做事务**（呼应 next-route-handlers 第五节 runtime 选择）。

---

## C. 攻防实战

**7. 内部系统：middleware 检查'有 cookie'就放行，渗透测试怎么打穿？**
**来源**：InfoQ《一次 Next 内网系统红队复盘》
伪造/复用 cookie 直取（验签缺失时）、绕过 UI 直接 POST Action 端点、利用无 owner 校验的接口越权读他人数据、历史缓存页回看（登出后）。逐条对应：验签而非存在性、第 3 层数据校验、敏感页 no-store。本题标准姿势：以纵深模型逐层讲失守点（呼应 next-middleware-auth 第二、五节）。

**8. i18n 前缀协商放 middleware 还是放 layout？两种方案的 SEO 与性能账？**
**来源**：掘金《next-intl 的路由策略之争》
middleware：首字节即定 locale（307 redirect 或 rewrite），无闪烁、爬虫拿到正确前缀 URL；layout 内检测：省一跳但可能"先渲染再纠偏"与重复内容风险。结论：协商 redirect 在 middleware、渲染期读段参数 [locale] 定稿——两阶段各司其职（呼应 next-dynamic 面试 10、vue-router-guard-lazy 的守卫时机对照）。

**9. 灰度发布场景：middleware rewrite 到 /beta 后，页面缓存会串吗？需要注意什么？**
**来源**：SegmentFault《rewrite 与缓存键的暗坑》
会——rewrite 后的渲染按**目标 URL** 生成 payload/缓存，若再叠加 CDN 按原始 URL 缓存，两者错配会互相喂脸。措施：变体响应带 Vary/自定义缓存键、或强制变体 no-store、发布前 curl 双 UA 对比。这题考"URL≠缓存键"的底层认知（呼应 next-revalidate、node-deploy-perf）。

---

## D. 架构综合

**10. 公司已有 Java 后端 + JWT，Next 只做前端门户。鉴权体系怎么接最顺？**
**来源**：知乎《BFF 模式下的会话桥接》
登录仍打后端换 JWT → 经一个 BFF 端点（或 Next handler）换成 **httpOnly cookie**（同域），此后 middleware/页面/Action 统一以 cookie 内 token 为准，出站到 Java 时再塞回 Authorization——cookie 面向渲染管线、头面向上游，桥接层一次翻译。反面：浏览器直存 JWT 再手工塞头给 RSC 用（服务端渲染期拿不到）。加分：refresh 旋转与登出的双端协调（呼应 exp-auth、next-route-handlers BFF 三用途）。

**11. 设计'团队空间'权限（owner/admin/member + 每资源可覆写）在 Next 的落点？**
**来源**：CSDN《复杂 RBAC 与全栈框架结合》
middleware 只门是否存在会话；页面层解 membership（unstable_cache 键 uid+team，revalidate 30s）出导航裁剪；数据层每条 Action/查询带 teamId 归属条件 + policy 函数（纯函数可单测，L7）。显式声明：**框架不提供 RBAC，纵深模型只提供挂载点**（呼应 next-server-actions 模板第 3 层、exp-auth 的 ACL 段）。

**12. Auth.js 库本身要退役/不维护了（社区曾发生），你的迁移成本评估？**
**来源**：InfoQ《供应链依赖与 Auth.js 风波观察》
拆三层评估：① provider 适配（OAuth 流程）——标准化高，可换 Lucia/自建 OAuth 直连；② session 载体（JWT+cookie）——本就自己代码，迁移轻；③ middleware/页面/Action 对 `auth()` 的调用面——统计单点封装（lib/auth.ts re-export）决定痛感。教训回写军规：**对框架级依赖保持"自有封装层"**（呼应 react-architecture 依赖隔离、mp-framework 选型论）。

---

## 补充（新专题 13-15）

**13.  会话 cookie 的 HttpOnly/SameSite/Secure/Path 四个属性，在 Next 登录态设计里各自防什么？**
**来源**：OWASP 会话管理速查；InfoQ《Cookie 属性并不枯燥》
HttpOnly：JS 读不到——防 XSS 直接偷 token（但防不了"带着 cookie 发请求"的 CSRF，两者互补不是二选一）；SameSite=Lax：跨站发起的顶层导航外不带 cookie——防 CSRF 主流形态（表单 POST/子资源），完全禁第三方上下文用 Strict，需要嵌入自身跳转回来再放宽；Secure：只在 HTTPS 发送——防明文链路截获与降级注入（Lax/Strict 不要求 Secure，但生产应全上；跨站携带才必须 Secure+SameSite=None）；Path=/：限制"哪些请求带 cookie"，防无关低信任子域读取，但防不住同域 XSS（那靠 HttpOnly+隔离）。Next 落地：middleware 与 Set-Cookie 保持一致策略；session cookie 别放 NEXT_PUBLIC 明文；配合 Origin 校验 + Action 幂等令牌补 CSRF 最后一步。加分句：说得出"Lax 为什么防不住同域 XSS 发起的请求、Secure 为什么单独不够"这组交叉关系。

**14.  Auth.js 的 JWT 策略与数据库 Session 策略怎么选？edge middleware 校验怎么做才不拖垮首字节？**
**来源**：Auth.js 官方 Sessions 文档；SegmentFault《JWT vs 会话表：登出那一秒的差别》
本质差异是"吊销即时性 vs 就近验证"：JWT 策略自包含、middleware/边缘可本地验签（快、无 DB 往返），但登出/封号要等 TTL 或用短期 token+轮换缓解，"权限变更生效"有窗口；DB 策略每次查会话表（服务端）可即时吊销，但 Edge middleware 连不上/不该连 DB——通行做法：middleware 只验 JWT 信封（会话令牌本身是签名的、里面带 session id），RSC/Action 层拿 id 查会话表做真校验（缓存层容忍几秒），兼顾吊销即时与边缘速度。首字节保护：验签用 jose+Web Crypto 纯 CPU 操作、JWKS 缓存；绝不在 middleware 里查库或 fetch 外部鉴权服务（冷启动 + 延迟叠加会让每请求多一跳）；把"必须现算权限"的少数敏感操作放 Action 层带服务端缓存。加分句：能说出"登出后还能用多久"这个量化视角（JWT=TTL 窗口，DB=缓存 TTL）即高分。

**15.  公开站 + 会员区 + 管理后台共存时，middleware matcher 与渲染策略你会怎么整体设计？**
**来源**：Next.js 官方 middleware matcher 文档；知乎《一个应用三种信任域的鉴权分层》
matcher 设计：/api 与资源路径先排除（负向断言挡 _next/static、favicon、图片），公开区不进鉴权分支（matcher 只圈 /account、/admin、/api/mutations 等受护前缀），避免"全站 middleware 每请求查会话"；三域三策略：公开=静态/ISR+壳级实验性动态（不查身份，个性化用客户端岛）；会员=强制动态 SSR 或 PPR+动态壳（layout 层查 session，缺则 redirect 带 callbackUrl）+ Action 层再校验（防直达）；后台=独立子域/路径前缀 + 更强会话（短 TTL+二次因素）+ 路由组 (admin) 单独 layout 单独鉴权壳 + 审计日志。防串味：三种信任域用不同 cookie name/path 隔离、后台会话不复用前台令牌；middleware 里后台前缀再加 IP 白名单/地理粗限只是纵深一层不是全部。渲染策略与鉴权在这里会交汇：会员页因 cookies() 天然动态，别指望缓存——要缓存的是数据片段（tag）而非整页。加分句："matcher 圈多大、鉴权就查多狠、缓存就剩多少"三句话串起三门课。
