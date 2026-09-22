# kit-auth-session 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SvelteKit 服务端 event.cookies 的安全默认值？为什么这样设计？
**来源**：鉴权基础必考题的转述。

`httpOnly` 与 `secure` 默认 **true**（`http://localhost` 下 secure 例外为 false，方便本地 http 调试），`sameSite` 默认 **lax**，且**必须显式传 path**。设计取向是"默认即安全档"：会话令牌天然 JS 读不到（挡 XSS 窃取）、只走 HTTPS、跨站 POST 不带 cookie（抗 CSRF）；要放开必须你明写，避免手滑。

### 2. (A) 画出 Kit 标准登录态链路：cookie → handle → locals → layout → 组件。
**来源**：全链路数据流高频题的转述。

handle 每条请求 `cookies.get('sessionid')` 换出 user 挂到 `event.locals.user`；`+layout.server.js` 的 load 读 `locals.user`、**裁剪成公开字段**返回，借"layout 数据向整个子树可见"广播给所有页面；组件从 data 拿 `user` 渲染。App.Locals 提供类型。要点：身份重建只在服务端做，客户端不碰原始令牌。

### 3. (A) 为什么鉴权要放 handle 而不是（只）放 load？
**来源**：中间件 vs 数据层职责对比题的转述。

handle **每条请求、动作之前必跑、无缓存**；load 有依赖追踪与缓存粘性（params/url 没变可能跳过）。把"是否登录"这种横切关注点放 load，会遇到"某些导航路径根本没触发那道 load 就漏判"。正确姿势：handle 认人塞 locals，路由层据 locals 做资源级准入，二者互补。

### 4. (B) 用户从 /admin/a 点 /admin/b，明明 session 已过期却没被拦，为什么？
**来源**：layout 缓存鉴权漏判的真实事故转述。

/admin 的鉴权写在 `+layout.server.js`。同 layout 下子页切换时 layout 的 params 未变，layout load **不重跑**，复用了上次"已放行"的缓存结果。修法：逐路由准入下沉到各 `+page.server.js`（进页必跑），或在 handle 里按路径前缀强制校验——不要把 layout 当唯一守卫。

### 5. (B) 登录 action 里 set 了会话 cookie，紧接着想读回用户信息，能读到吗？
**来源**：同请求 cookie 读写时机题的转述。

能。`cookies.set` 既把 Set-Cookie 加到响应头、又让**本次请求内**的 `cookies.get` 立即读到新值。所以登录 action 里 set 完可当场用，无需等下一次请求。但注意：handle 建的 `event.locals.user` 是本次进来时算的旧值，若要下游 load 看到新身份仍须手动刷新 locals。

### 6. (B) 用 localStorage 存 JWT 和 httpOnly cookie 存会话，Kit 项目怎么选？
**来源**：令牌存放权衡经典题在 Kit 语境的转述。

localStorage 里的 token JS 可读 → XSS 一次即可被打包带走，且要手动加 Authorization 头、自管 CSRF。Kit 倾向 **httpOnly + sameSite=lax cookie + 服务端会话**：XSS 偷不到 cookie、CSRF 由内置 origin 检查 + lax 兜底。代价是仍需防开放重定向与做好登出。纯 SPA 才更偏向 token；SSR 全栈选 cookie 会话更省心。

### 7. (A) 前端根据 role 隐藏了"删除"按钮，端点就安全了吗？乐观鉴权错在哪？
**来源**：乐观 UI 与安全边界辨析题的转述。

不安全。隐藏按钮只是**体验层**；curl 直接打 `/api/items/1` DELETE 照样到达。真正的门禁必须是服务端 action/端点/load 里的 `error(403)`。权限判据也不能取自 `$page.url`/params（客户端可篡改），必须回服务端查"当前 user 是否有权操作该资源"。乐观可以让 UI 先动，但授权不乐观。

### 8. (C) getRequestEvent() 解决什么痛点？它在哪些环境要特别小心？
**来源**：请求上下文透传进阶题的转述。

它让你在没有 event 形参的深层 server 函数/`$lib/server` 仓储里就近拿到当前请求 event（读 cookies/locals），免去把 event 一层层往下传。风险：依赖 AsyncLocalStorage，在**不支持它的环境（部分 edge runtime）必须同步调用**，跨 `await` 之后上下文可能已丢；且它只让写代码更省，不改变"locals 由 handle 填充"的本质。

### 9. (C) 登出要做哪几件事才干净？为什么删了 cookie 还可能"看着没退出"？
**来源**：会话终止完整性题的转述。

三件套：①`cookies.delete('sessionid', { path: '/' })`（path 必须与 set 时一致，否则删不掉）；②服务端销毁该会话记录；③若 handle 建过 `event.locals.user`，手动置 null——因为 action 后页面重渲染时 load 会重跑但 handle 不重跑，locals 仍是旧值。只做①会出现"下次请求前当前页仍显示已登录"。

### 10. (C) 和 Next/Express 的鉴权落点比，Kit 的 locals 机制独特在哪？
**来源**：跨框架鉴权模型对比题的转述。

Express 靠 `req.user = ...` 在中间件挂到可变 request 上；Next（App Router）无统一请求级容器，多在 layout/page 的 server 端或 middleware 里各自查。Kit 的 `event.locals` 是框架**规定类型（App.Locals）、贯穿 handle→load→endpoint 的官方请求总线**，天然把"识别身份"与"消费身份"分层，且 SSR 数据序列化契约（devalue）统一，避免把整只 user 泄漏进 HTML——裁剪字段是被显式提醒的纪律。

### 11. (D) 设计一个"整站登录墙 + 少数公开页"的 handle 鉴权方案。
**来源**：全站门禁情景设计题的转述。

handle 里维护白名单前缀（`/login`、`/`、静态资源、`/api/auth/*`）放行；其余路径 `if (!event.locals.user) return redirect(307, '/login?next=' + encodeURIComponent(event.url.pathname))`（页面）或按 Accept 头返回 `error(401)`（fetch）。next 参数落地时务必走 safeRedirect 白名单防开放重定向。粒度更细的角色授权交给各 page server load。

### 12. (D) 要给 layout 下的所有页面自动带上"当前用户 + 主题 + 功能开关"，如何既共享又不泄露敏感数据、又不每页重复查？
**来源**：布局级数据编排设计题的转述。

`+layout.server.js` 一处 load：从 locals 取裁剪 user、组合服务端读到的 theme/featureFlags 返回，全站子树免费可见。敏感字段（passwordHash、内部 id 映射）留在服务端不进返回值。避免每页重复查：把跨页稳定的数据放 layout；页面独有数据放 page load。注意 layout 的缓存粘性——时效性强的准入判断仍放 page/端点，别指望 layout 每次导航都重算。

🚀 **下一组**：L5 课后作业——会话链路与鉴权落点的综合复盘。
