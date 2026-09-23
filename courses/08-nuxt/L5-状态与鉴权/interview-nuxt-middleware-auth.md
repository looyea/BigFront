# nuxt-middleware-auth 面试题（15 题）

## A. 基础认知

### 1. Nuxt 里有哪几种"中间件"？各自职责？
**答**：两种，别混。①route middleware（`middleware/*.ts`）关心"能不能去这个页面"，在 SSR 首屏跑一次、客户端每次导航再跑，可用 `useRoute()`、`navigateTo()`、`abortNavigation()`；②server middleware（`server/middleware/*.ts`）是 Nitro 的 HTTP 切面，对每个进入服务端的请求执行，能拿到 event（cookie/header），职责是解析身份挂到 `event.context`。前者是体验层，后者是安全层的入口。与 Next 的 `middleware.ts`（Edge、每请求）相比，Nuxt 的 route middleware 更偏前端语义。

**来源**：《Nuxt 两种中间件辨析》、《Nitro 请求生命周期》

### 2. 怎么写一个 per-route 鉴权中间件？
**答**：`defineNuxtRouteMiddleware((to) => { if (!logged.value) return navigateTo('/login?redirect=' + encodeURIComponent(to.fullPath)) })`，文件名即中间件名（自动导入），页面里 `definePageMeta({ middleware: 'auth' })`，可传数组串行执行。返回跳转即中断后续；想停在原地用 `abortNavigation()`。执行时机在 resolve 路由之后、页面 setup 之前，因此可以在其中 await 数据（但要克制）。

**来源**：《Nuxt 路由中间件指南》、《definePageMeta 编译宏》

### 3. 全局中间件和 per-route 的区别与风险？
**答**：文件名 `xxx.global.ts`（或导出 `global: true`）即全站每跳执行，无需在页面声明。风险有三：一是它对所有路由生效，包括你不想管的，写重了全站变慢；二是里面 throw 异常会波及静态与登录页本身；三是容易变成"什么都往里塞"的垃圾场。实践：全局只做极轻量且确实全站一致的判断（如维护模式开关、埋点），鉴权尽量 per-route 显式声明，可读性和可运维性都更好。

**来源**：《全局中间件的滥用》、《Nuxt 中间件执行顺序》

## B. 对比与辨析

### 4. route middleware 与 server middleware 的分工怎么划？
**答**：一句话：**route 管"看得见"，server 管"拿得到"**。route middleware 负责未登录时不给看页面、把用户引导到登录页并带回原目标；server middleware 负责"每个请求先证明你是谁"（解析 session 挂 context），业务 handler 再做"能不能干这件事"的 401/403 判定。若只有 route 层，直接 curl API 就绕过；若只有 server 层，用户会看到一堆报错页面而不是被引导登录。两层互补，不是替代。

**来源**：《前后端拦截的分工》、《鉴权责任矩阵》

### 5. 与 Next.js 的 middleware 相比，Nuxt 的方案优缺点？
**答**：Next 的 `middleware.ts` 运行在 Edge，对每个请求（含静态）执行，天然是服务端门禁，且没有"客户端中间件"概念，配合 RSC 在 layout/page 里再判一次，链路更硬。优点是安全边界清晰；缺点是做重活受限（Edge API 面窄、不能连任意数据库），且客户端导航不会重跑，页面数据切换仍需服务端组件参与。Nuxt 的 route middleware 让前端体验更连贯（可拿 store、可做乐观跳转），server 侧用 Nitro 完整 Node 能力；风险是团队容易误把它当安全层。总体上 Next 的模型更难写错，Nuxt 的模型更灵活但依赖纪律（呼应 nuxt-middleware-auth 第 4 节）。

**来源**：《Next 与 Nuxt 鉴权模型对比》、《Edge Middleware 的能与不能》

## C. 实战场景

### 6. 如何设计"登录后回到原页面"，同时避免开放重定向？
**答**：跳转时把 `to.fullPath` 编码进 `redirect` query，登录成功后由**服务端**（或统一的工具函数）校验：必须以 `/` 开头、不含 `//`、不含协议、不在站外，命中白名单才 `navigateTo`，否则回默认首页。更严格的做法是服务端存 `returnTo`（session 或短期 cookie），URL 上只带一个不透明 id，彻底消除可猜测参数。同类逻辑还要覆盖：登录接口返回的跳转地址不接受客户端传入的绝对 URL。

**来源**：《开放重定向的成因与防御》、《returnTo 设计》

### 7. 用户登录成功、cookie 也下发了，但页面仍显示未登录，为什么？
**答**：因为服务端 `setCookie` 写的是**响应头**，本次请求上下文里的输入 cookie 没变，且前端 store 里的身份是 SSR 阶段算好的旧值（呼应 nuxt-cookie-session 第 2 节）。正确流程：登录接口成功 → 客户端跳转（或 `clearNuxtData('me')` 后重新拉 /api/me）→ 新一次导航请求带上 cookie → 服务端重新解析身份渲染。若用 SPA 式"就地刷新状态"，必须显式重新执行 `useAuthSession().refresh()` 并让 useState 更新，同时保证 payload 数据被覆盖。

**来源**：《登录后状态不同步的三类成因》、《clearNuxtData 与 refresh 用法》

### 8. 后台系统里"管理员菜单只对 admin 可见"，怎么实现才不留洞？
**答**：三处同时做。①数据源：`/api/me` 返回 roles，服务端渲染时进 payload，菜单渲染按 roles 过滤（体验层）；②路由：`middleware/admin.ts` 判 role，非 admin `abortNavigation()` 或跳 403 页；③接口：所有 `/api/admin/**` handler 调 `requireRole(event,'admin')`，数据层查询带 tenant/owner 条件。三处独立成立，任何一处被绕过都不会泄露数据。禁止的做法：把权限判定写成前端常量表（可改）、或只靠菜单隐藏。

**来源**：《RBAC 在 SSR 项目里的落地》、《前端角色可见性设计》

### 9. 上线后发现页面切换偶发白屏 200ms，怀疑中间件，怎么定位与优化？
**答**：定位：`nuxt app hooks` 计时（`page:loading:start`/`page:loading:end`，呼应 nuxt-lifecycle）、浏览器 Performance 面板看 Network 是否串行请求、把中间件体临时清空做 A/B。常见成因与对策：①全局中间件里 await 外部 API → 改成 SSR 预取 + useState 缓存或用 `useFetch` 的 key 去重；②每个页面都 await `/api/me` 且无缓存 → 用 payload 复用（首次之后 refresh 只在显式动作时做）；③中间件里做重计算/大量 `import` 拉进主 chunk → 拆异步；④命中了 `navigateTo` 后又触发第二次导航（重定向环）→ 检查 redirect 判定条件。

**来源**：《导航性能排查方法》、《中间件里的隐藏网络请求》

## D. 深度追问

### 10. 为什么说"只靠前端鉴权的方案连漏洞都不算，只是缺陷"？请给出你的评审口径。
**答**：因为浏览器是完全由攻击者控制的运行时：路由守卫可跳过、JS 可改写、`__NUXT__` 可编辑、请求可直接构造。前端判定不产生任何不可绕过性，所以它不能作为安全控制评审项。我的口径是：任何权限要求，必须能在服务端代码里指出"哪一行拒绝了这个请求"；如果找不到这一行，这条需求就是未实现。前端只做两件事——少展示不该展示的、以及给出友好引导。补充底线：数据层查询必须带 owner 维度（第三层），否则 handler 漏判就是全量泄露。

**来源**：《安全评审的最小充分条件》、《零信任与前端职责》

### 11. 会话过期发生在用户填表的中途，怎么设计体验与安全兼得的方案？
**答**：安全侧保持短 access/空闲超时，不因体验放宽。体验侧：①客户端 401 统一拦截，弹"请重新验证"对话框而不是直接跳转，表单内容先存本地（sessionStorage/draft）；②重新验证成功后重放提交（带幂等键防重复下单）；③可选静默续期：用 refresh token 在 401 时换票再重试一次，且并发 401 只触发一次刷新（防刷新风暴，呼应 nuxt-cookie-session 第 7 题）；④超时前主动提示续期。要点是所有逻辑都以"服务端仍是唯一裁判"为前提。

**来源**：《会话过期的用户体验设计》、《静默续期与幂等重放》

### 12. 如果要给 SSR 页面做"未登录直接返回 302 到登录页"（而不是渲染后再跳），怎么实现？价值是什么？
**答**：在**页面级的服务端环节**做：`definePageMeta({ middleware: 'auth' })` 中的中间件在 SSR 首屏阶段也会执行，此时 `return navigateTo('/login', { redirectCode: 302 })`（外部跳转/SEO 场景）配合 `ssr: true` 会让服务端返回重定向而非 HTML；也可以在 server middleware 里对页面路径显式重定向。价值：①避免把受保护 HTML 与 payload 发给未授权方（缓存、爬虫、浏览器历史都是泄露面）；②搜索引擎不会收录登录墙内容；③少一次无意义的水合与请求。注意与"HTML 缓存安全线"配套：这类页面绝不能进 swr/prerender 缓存（呼应 nuxt-render-modes、nuxt-server-routes 的 getKey 设计）。

**来源**：《SSR 阶段的 302 与鉴权前置》、《受保护页面与爬虫收录》

---

## 补充（新专题 13-15）

### 13.  设计"登录后回到原页面"且防开放重定向的完整方案，Nuxt 里每一环写在哪？

链路四环：① 拦截点——route middleware 判未登录，return navigateTo({ path: 『/login』, query: { redirect: to.fullPath } })，SSR 下它自然变 302（爬虫与分享链路也正确）；② 参数卫生——redirect 只接受"站内相对路径"：以单斜杠开头且 // 开头出局（防协议相对 //evil.com），解析后 pathname 白名单（排除 /login 自身防循环、/admin 按角色二次判），存 query 前 encode、读出后校验，两步都要；③ 登录成功——服务端回带"校验过的 redirect"或用 session 里存的原路径（防篡改更强），navigateTo 目标；④ 形态分叉——客户端发起的 API 401 不走页面跳转：拦截器记下原请求、弹层登录后重放（fetch 层与 route 层两套"回原处"别互相冒用）。验收用例：深链未登录进入→登录后落在深链；/login?redirect=//evil.com→落首页并告警日志（有人探测开放重定向要看得见）；带角标的循环检测。加分句：把"回原页面"做对顺带解决了登录态过期后的重登归位——同一套 redirect 卫生复用到两处。

**来源**：OWASP Unvalidated Redirects；Nuxt 官方 route middleware 示例

### 14.  后台系统"管理员菜单只对 admin 可见+可访问"，把可见性、导航、数据三层权限各自落在哪？

三层各自的正确落点与反模式：① 可见性层（菜单/按钮显隐）——数据源是登录时服务端下发的权限集合（不是前端写死角色表），存 store/Pinia 进 payload 首屏就有；反模式=把权限逻辑埋组件 v-if 深处，审计无从下手，正解是 usePermission(code) 组合式统一出口；② 导航层（能不能进路由）——definePageMeta({ roles: 『admin』 }) 自定义 meta + 全局 route middleware 读 meta 判定，声明与页面同文件（colocation）、集中判定不散写；反模式=每个页面 setup 里手写 if(role)，必漏新页面；③ 数据层（拿到的是什么）——所有查询带 owner/tenant/role 维度 WHERE（server/services 层注入，handler 忘传即报错），admin 与普通用户走不同接口或不同投影（字段级权限服务端裁）。三层关系要明说：第①层可被忽略、第②层可被直连 URL 测出、第③层才是最后防线——渗透测试视角逐层攻一遍是上线前流程。权限变更的实时性：角色调整不重登怎么生效？权限进 session 快照的要有 TTL 重取， revoke 敏感的走"关键操作二次校验"而非依赖菜单。

**来源**：Nuxt definePageMeta 自定义字段；InfoQ《前端权限三层模型的工程化》

### 15.  route middleware 写成 async 后不小心"卡住"导致页面切着切着白屏 200ms+，中间件的性能与可观测纪律怎么定？

成因归类：① middleware 里 await 了慢接口（鉴权查询无缓存、每导航一次串行打后端）；② 客户端导航也会跑 route middleware——SSR 时"顺手取一下"的逻辑到了端上变成导航阻塞；③ 全局中间件叠加过多（每个几十毫秒凑成肉眼可见）；④ navigateTo/redirect 链式弹跳（A→B 的 middleware 又跳 C）。纪律：middleware 里只放"决策必需的轻量判定"——权限快照在登录时取好存 store，导航时纯内存比对（>5ms 就算重）；确需服务端确认的走"乐观导航+失败回退"（先进后校验、403 再弹回）而非阻塞 await；每条 middleware 打点计时（page:loading:start/finish 差值拆分到中间件粒度，上报带路由名）——白屏类反馈直接看分位数归因；全局中间件数量设上限评审（超过阈值必须合并或改 per-route）。e2e 加一条"导航耗时预算"用例（关键路径 <Xms），性能退化进 CI 而不是用户投诉。收口句：middleware 是导航路径上的同步决策点，"往里塞 await 取数"等于把路由层降级成 BFF。

**来源**：掘金《一个 await 挂住全站导航》；Nuxt 官方 middleware 注意事项
