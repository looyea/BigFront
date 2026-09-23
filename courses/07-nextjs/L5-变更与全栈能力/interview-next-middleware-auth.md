# next-middleware-auth 面试题（12 题）

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
