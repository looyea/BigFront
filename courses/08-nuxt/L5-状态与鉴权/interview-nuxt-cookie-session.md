# nuxt-cookie-session 面试题（15 题）

## A. 基础认知

### 1. 同构应用里为什么登录态推荐放 Cookie？
**答**：因为 SSR 阶段服务端要识别用户，而浏览器只会自动把 Cookie 放进请求头送到服务器——localStorage/IndexedDB 在 Node 侧根本不存在，服务端只能渲染未登录版本，客户端再纠正会造成首屏闪烁、SEO 打到登录页、hydration mismatch。此外 Cookie 支持 httpOnly（JS 读不到，防 XSS 偷取）、支持过期与域名作用域控制、能被 CDN/网关层统一识别。对 Nuxt 而言 `useCookie` 一套 API 双端可用，把它变成了默认选择。

**来源**：《SSR 与登录态载体选择》、《Cookie 在同构架构中的不可替代性》

### 2. useCookie 在服务端和客户端的行为差异？
**答**：服务端从 event 的请求头解析出值；给 `.value` 赋值等价于 `setCookie(event,...)` 写响应头，因此**同一次请求内后续代码读不到新值**，要等下一次导航。客户端直接读写 document.cookie，赋值即刻本地可见。另两点：`default` 必须是工厂函数（裸值有跨请求共享风险）；`httpOnly` cookie 在客户端分支永远读不到。值默认 JSON 序列化，可用 serialize/unserialize 改成裸字符串以兼容后端签发的 cookie。

**来源**：《useCookie 全参数详解》、《Nuxt Cookie 的三种坑》

### 3. 解释 httpOnly / Secure / SameSite / Path / Domain / Max-Age 各自作用。
**答**：httpOnly 禁止 JS 读取（防 XSS 窃取身份）；Secure 只在 HTTPS 下传输（防中间人明文嗅探）；SameSite 控制跨站请求是否携带（strict 全不带、lax 顶层 GET 带、none 全带但必须 Secure，主要防 CSRF）；Path/Domain 决定作用范围，也是"这条 cookie 的身份"的一部分——删除时两者必须匹配；Max-Age（相对秒数，持久 cookie）与 Expires（绝对时间）控制生命周期，不写则变成会话 cookie，关浏览器即消失。生产最小安全组合是 `httpOnly + Secure + SameSite=Lax + Path=/`。

**来源**：《Cookie 属性与浏览器行为》、《OWASP Cookie 配置指南》

### 4. 什么是会话固定（session fixation）？如何防？
**答**：攻击者先取得一个有效 sid（例如诱导用户点带旧 sid 的链接），等用户用这个 sid 登录后，攻击者手里的 sid 就是已登录会话。防御三条：①登录成功必须**重新生成** sid，绝不复用已有值；②登录前下发的临时 sid 与登录后的是不同记录（旧记录销毁）；③绑定辅助指纹（用户代理变化即失效、IP 突变要求二次验证）并设置合理空闲超时。这些都在服务端做，前端无法兜底。

**来源**：《会话固定与防御》、《登录后重建会话的最佳实践》

## B. 对比与辨析

### 5. Session 与 JWT 怎么选？
**答**：核心取舍是"可吊销 vs 无状态"。Session 服务端存表，删记录立刻失效，成本低（Redis 亚毫秒），但水平扩展要共享存储；JWT 自包含、验签不吃 IO、天然适合多服务互信与无状态扩容，但到期前无法作废（黑名单方案等于把状态又搬回服务端）、体积大、误把敏感数据写进 payload 会被任何持有者解码。实践结论：给浏览器的人类用户用 session 或"session 存库 + cookie 放短 id"；给机器（服务间、开放 API、移动端长期凭据）用 JWT，并配短 access token + refresh 轮换。

**来源**：《JWT vs Session 的真相》、《Token 体系设计》

### 6. 为什么"前端存 localStorage token"在 SSR 项目里是双重失败？
**答**：一败在功能：服务端读不到，首屏必然未登录，等于放弃了 SSR 的意义；二败在安全：localStorage 对 XSS 完全无防护，脚本一行 `localStorage.token` 就把长期凭据带走，且这类 token 往往没有过期约束。补法是：身份进 httpOnly cookie，需要给 API 传的地方由服务端注入或代理，前端代码根本不接触凭据明文（呼应 nuxt-server-routes 的 BFF 模式）。

**来源**：《Token 存哪儿》、《前端凭据存储的安全边界》

### 7. 双 token（access + refresh）机制解决什么？怎么落地？
**答**：解决"access token 要短命以降低泄露窗口，但用户不该频繁重登"的矛盾。access 存活几分钟、随请求头/cookie 带；refresh 存活数周、只在刷新接口用，且**必须 httpOnly + 单独 Path（如 /api/auth）+ 更严 SameSite**，把它的作用面限定在"换票"这一件事。刷新要做轮换（旧的 refresh 用过即作废）与并发去重（多请求同时 401 只触发一次刷新，其余排队），否则会出现刷新风暴与"旧票被复用即撤销全部"的自杀式登出。

**来源**：《Refresh Token 轮换设计》、《401 并发与静默续期》

## C. 实战场景

### 8. 线上出现"部分用户登录后偶发回到登录页"，如何排查？
**答**：按数据链路分五段：①看响应头是否真的带出 Set-Cookie（被反向代理吃掉或 `secure` 与 HTTP 访问冲突就不落盘）；②看多实例是否共享 session 存储——内存 store 在负载不均衡时就是"命中有、命中无"的偶发；③看是否有请求打到未带 cookie 的路径（path/domain 不一致、跨子域未配 domain）；④看浏览器侧：第三方 cookie 拦截、Safari ITP、无痕模式会限制写盘；⑤看时钟与超时——多实例服务器时间漂移会误判过期。经验上"偶发"三个字第一顺位永远指向没有共享存储。

**来源**：《登录态丢失排查手册》、《Session 共享与粘性会话》

### 9. 想让 SSR 首屏就显示深色主题，不出现浅色闪烁，怎么做？
**答**：主题偏好存在 cookie（`useCookie` 可被服务端读到），在 `nuxt.config.ts` 的 `app.head.script` 注入一段**内联同步脚本**，在 Vue 挂载前从 document.cookie 解析并给 `<html>` 打 `data-theme`/class；服务端渲染时同样从 cookie 读值，把属性写到 `<html>` 上，两侧一致就不 mismatch。切勿在 onMounted 或 app 插件里改（那时首帧已绘制）。这与 nuxt-runtime-config 的"构建期默认值 + 运行期用户覆盖"是同一分层思路。

**来源**：《无闪烁主题切换》、《SSR 首帧样式一致性》

### 10. 前后端分离跨域部署（前端 nuxt.example.com，API api.example.com）时登录态怎么处理？
**答**：三条路：①同根域 + `Domain=.example.com` 让 cookie 覆盖两端，配 `SameSite=Lax`（顶层导航仍可用）——最省事；②真跨域则 cookie 需 `SameSite=None; Secure`，且 XHR 必须 `credentials: 'include'`，后端 `Access-Control-Allow-Credentials: true` 并把 Origin 精确白名单（不能用 `*`）；此时 CSRF 完全依赖 Origin 校验与自定义头，风险抬升；③最优：用 Nuxt 的 Nitro 做 BFF，前端只请求同域 `/api/**`，服务端持凭据转发（呼应 nuxt-server-routes 第 3 节），跨域与 cookie 问题在浏览器侧消失。

**来源**：《跨域身份传递方案对比》、《BFF 模式的实践》

## D. 深度追问

### 11. cookie 只有 4KB，业务却想放很多用户信息，怎么设计？
**答**：cookie 里只放**不透明 sid**（几十字节），用户信息一律服务端存或按需接口拉。SSR 首屏需要展示用户昵称/头像时，由服务端用 sid 查出后放进 payload（public 部分）或 `useFetch('/api/me')` 的返回值，而不是塞进 cookie。这同时解决三个问题：体积上限、敏感信息暴露（cookie 明文对所有子域与每次请求都可见）、以及"改了资料要等多久生效"。设计原则：cookie 是**指针**，不是**数据容器**。

**来源**：《Cookie 体积限制与数据分层》、《为什么 cookie 里只应该有 id》

### 12. 从安全工程角度，说说"前端鉴权"的价值与边界。
**答**：价值全在体验与成本：未登录时不渲染敏感 UI、不发无意义请求、给用户明确引导，以及把明显越流的探测挡在门外减少服务端压力。边界是它**没有任何安全效力**——浏览器是攻击者完全控制的运行时，路由守卫、隐藏按钮、`__NUXT__` 里的状态都能被绕过或伪造。所以正确的架构是"前端拦是门面，服务端 middleware 是门禁，数据层校验是底线"三层各自独立成立（呼应 nuxt-middleware-auth、next-middleware-auth 与 exp-auth）。任何只在前端成立的权限，评审时应直接判为缺陷。

**来源**：《零信任下的前端与后端职责》、《鉴权三层模型》

---

## 补充（新专题 13-15）

### 13.  用 Nuxt 设计一套完整的会话体系：cookie 属性、存储、旋转、吊销、并发刷新，逐项给决定和理由。

逐项给账：① 载体——session cookie 存 httpOnly cookie（JS 读不到=XSS 降权），名字带前缀可管理（sid_app）；② 属性——Secure 无条件、SameSite=Lax 默认（回跳/嵌入特例单独评审）、Path=/、HttpOnly，会话 cookie 不给 Expires（关浏览器即死是特性）；③ 存储——服务端 Redis：key=session id、value={userId, 设备指纹, 权限快照, 最后活动时间}，TTL=空闲超时+绝对上限双轨（绝对上限防长期盗用）；④ 旋转——登录成功与权限变更时换新 sid（防会话固定），旧 sid 短窗口双活保当前操作不断；⑤ 吊销——登出删 Redis key；改密/风控触发按 userId 批量删（"踢下线"能力是选型服务端 session 的核心理由）；⑥ 并发刷新——空闲临期时滑动续期，多标签同刷用"刷新加锁/新 token 写回旧 sid 的 304 式协议"避免互相踩——细节在 middleware-auth 的 401 单飞题展开。⑦ Nuxt 落点：解析 cookie→event.context.user 放 server middleware，登出清场走 nuxt-state 那套清单，前后端同仓让这条链没有跨域 CORS 税。

**来源**：OWASP Session Management Cheat Sheet；Nuxt 官方 useCookie 文档

### 14.  前后端分离跨子域部署（app.example.com 与 api.example.com）时，cookie 方案要改哪些地方？有没有更好的路？

先纠概念：example.com 与 api.example.com 是"同站不同源"（site 相同），SameSite=Lax/Strict 仍可用——真正跨站（a.com 调 b.com）才要 None+Secure 且直面第三方 cookie 封禁（Safari ITP、Chrome 逐步限制），这是要尽量避免的局。同站跨子域的配置账：① cookie Domain=.example.com 收窄使用（能共享的只有全局会话，别拿它当默认——子域越权面扩大）；② CORS 开 credentials:true+精确 Origin 白名单（不能 *），预检请求量要计入性能；③ CSRF 面变大：SameSite 仍在但跨子域 XSS 互相传染，状态变更接口仍要 token 校验。更好的路两条：同域反代（app.example.com/api → 后端，cookie 回归第一方零 CORS，运维给力的首选）；或干脆"前端域不发会话、API 域发+网关代理解析"（BFF 收口，呼应 nuxt-server-routes）。跨站嵌 iframe 的登录态（第三方支付页里嵌自家页）：ITP 基本判死，用"弹出到顶层完成操作再回跳"替代嵌入。收口句：先争取"同站"，再优化"同源"，跨站是最后且要计维护成本的手段。

**来源**：MDN Same-site 定义；SegmentFault《跨域 cookie 的四条死路与一条活路》

### 15.  从安全工程角度 review"前端自己判断登录态"的方案：哪些判断可以前端做、哪些必须服务端说了算、边界怎么画？

原则一句话：前端判断=体验层，服务端判断=安全层，任何"只有前端判"的门都不算门。前端可做的三件（各自纯体验理由）：① 路由守卫决定"跳不跳登录页"（少一次白屏，服务端会拒绝≠不用友好引导）；② 菜单/按钮按角色显隐（信息降噪，admin 链接给普通用户看只增加困惑与探测面）；③ 表单预校验（减少注定 403 的提交）。必须服务端做的：身份解析（cookie→user 每请求做，不信任何客户端传来的身份声明）、权限判定（数据查询永远带 owner/tenant 条件，"前端看不见"不是隔离）、限流与吊销（会话删了前端还显示登录=正常现象，操作自然 401 收敛）。画边界的方法：威胁建模问"攻击者能改客户端什么"（改 JS、改 localStorage、重放请求、扒 cookie），凡攻击路径能绕过的检查全部降级为 UX。文案规矩：内部文档别写"前端已鉴权"，写"前端已做可见性控制，服务端鉴权在 X 层"——措辞就是边界。

**来源**：OWASP ASVS 访问控制章节；知乎《前端鉴权的三个合法用途与一个非法幻想》
