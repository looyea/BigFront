# 同构持久态：useCookie、会话设计与 JWT 之辨

## 1. 为什么"持久态"在 SSR 框架里是个独立难题

上一关的边界留在这里：useState 与 Pinia 都只活一次请求/一次导航。要让"刷新还在、关掉浏览器还在、**服务端渲染时也能读到**"，在浏览器侧只有两条路——Cookie 与 Web Storage。而对 Nuxt 这种同构应用，**只有 Cookie 能被服务端拿到**：

| 载体 | 浏览器自动带上 | SSR 阶段服务端可读 | 容量 | 可被 JS 读 |
|---|---|---|---|---|
| Cookie | ✅（随请求头） | ✅（`getCookie(event)`） | ~4KB | 视 httpOnly |
| localStorage | ❌ | ❌ | ~5MB | ✅ |
| IndexedDB | ❌ | ❌ | 大 | ✅ |
| 内存/URL query | ❌（query 在 URL 里可读） | 部分 | — | — |

这就是"登录态必须放 Cookie"的根本理由，不是习惯问题：**SSR 首屏就要知道你是谁**，否则服务端只能渲染未登录版本，然后客户端再改一遍——白屏闪烁、SEO 打到未登录页、hydration mismatch（呼应 nuxt-hydration）。

## 2. useCookie：一个 API 两种身份

```ts
// composables/useTheme.ts
export const useTheme = () =>
  useCookie<string>('theme', {
    default: () => 'light',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  });
```

`useCookie` 的巧妙在于**同一行代码在两侧做不同的事**：

- 服务端：从 `event` 的请求头解析值；给 `.value` 赋值则通过 `setCookie` 往响应头写 `Set-Cookie`；
- 客户端：读写 `document.cookie`；
- 值默认走 **JSON 序列化**（`unserialize`/`serialize` 可覆盖），所以存字符串要写 `default: () => 'light'` 而不是 `default: 'light'`——传裸值是官方文档点名的高频坑，不传函数会导致所有用户共享同一初值（Nuxt 3.10 起会告警）。

三个必须知道的行为差异：

1. **响应式是"写侧同步、读侧被动"**：别的标签页改了 cookie，本页不会自动更新；`watch` 只在当前 app 内的赋值时触发。
2. **服务端写 cookie 不会让本次请求后续代码看到新值**——它写的是响应头。想让新登录态立刻生效，必须导航/刷新（这是"登录成功但不跳转就 401"的经典成因）。
3. **`httpOnly: true` 时客户端分支永远读不到值**（`document.cookie` 看不见），此时 useCookie 只在服务端有意义，前端要用它得配合一次服务端下发。

## 3. 删除、过期与作用域

```ts
const token = useCookie('token');
token.value = null;            // 过期删除（写 maxAge=0 / expires 过去）
clearCookie('token', { path: '/' });  // Nuxt 3.x 显式清除
```

要点：cookie 的**身份是 `域名 + 名称 + path` 三元组**，删除时 path 必须与写入时一致，否则"删了但还在"。跨子域共享（`a.example.com` 与 `www.example.com` 同一登录态）要写 `domain: '.example.com'`，但这会让所有子域都能收到，安全性下降，且 `httpOnly` 与 `domain` 组合需后端统一签发。

`Secure` 在生产必须开（仅 HTTPS 传输）；`sameSite` 的三档：

- `strict`：从任何外部站点跳来都不带 cookie——最安全但"从微信链接点进 App 就没登录态"；
- `lax`（推荐默认）：顶层 GET 导航带上，跨站 POST/iframe/XHR 不带——天然挡住大部分 CSRF；
- `none`：必须同时 `Secure`，只给"第三方嵌入"或前后端分离跨域调用场景。

## 4. 会话模型选型：三种主流方案

```
① Cookie-Session（服务端存）    Set-Cookie: sid=abc（httpOnly）  +  服务端 store 查表
② JWT Cookie                    Set-Cookie: token=eyJ...（httpOnly） + 不查库
③ Session 存库 + Token 存 Cookie ①②的折中，业内最常见
```

| 维度 | ①服务端 session | ②JWT |
|---|---|---|
| 注销/踢人 | 立即（删记录） | 难（要靠黑名单，等于回到①） |
| 每次请求成本 | 一次存储查询（Redis 亚毫秒） | 验签（CPU，无 IO） |
| 水平扩展 | 需共享存储 | 天然无状态 |
| 体积 | 一个短 id | 1~2KB，放进请求头/日志都贵 |
| 泄露后果 | 窃取 id 期间有效，可服务端吊销 | 到期前无解 |
| 适合 | 后台、电商、需要强管控 | 三方 API、微服务互信、公开 scope |

**结论**：给浏览器用的登录态优先 ①/③（能吊销）；给机器用的接口凭据用 ②（无状态、可校验 scope）。"JWT 更先进"是伪命题，它是不同的取舍。

## 5. 服务端怎么读写：Nitro 侧原生 API

```ts
// server/api/login.post.ts
export default defineEventHandler(async (event) => {
  const { account, password } = await readBody(event);
  const user = await db.verify(account, password);      // 呼应 exp-validation 的时序安全
  if (!user) throw createError({ statusCode: 401, message: '账号或密码错误' });

  const sid = await createSession(user.id);             // 写存储，返回随机 id
  setCookie(event, 'sid', sid, {
    httpOnly: true, sameSite: 'lax', secure: true,
    path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true, name: user.name };                 // 绝不返回密码/salt
});
```

`server/middleware/auth.ts` 里用 `getCookie(event, 'sid')` 查会话并 `event.context.user = ...`，下游 handler 直接取用——**注意 nuxt-server-routes 第 5 节的教训：middleware 要放行登录与健康检查路径，否则用户永远进不来**。

## 6. CSRF、XSS 与三条硬规则

- **XSS 偷身份**：只有 `httpOnly` 能真正阻止脚本读取会话 cookie（呼应 exp-security）。前端存 token 到 localStorage 的 SPA 方案在 XSS 面前裸奔，还额外丢掉了 SSR 可读性——Nuxt 项目没有理由这么做。
- **CSRF 冒用身份**：浏览器自动带 cookie，恶意站点可以借用户身份发请求。防线：`sameSite=lax/strict` + 状态变更接口校验 Origin/Referer + （高风险操作）二次确认。若用 `sameSite=none`，必须加自定义头 + 双提交 token。
- **不要把敏感信息写进非 httpOnly cookie**：任何 JS 能读的 cookie 都会被浏览器插件、XSS 一起打包带走；也不要写进 payload（public runtimeConfig）当作会话。

三条硬规则：**身份放 cookie 且 httpOnly；会话要能在服务端吊销；权限判断不信前端任何东西。**

## 7. 与 Next / Express 的对照

| | Nuxt | Next.js | Express |
|---|---|---|---|
| 读写 cookie | `useCookie`（双端同 API） | 客户端库 + `cookies()`（服务端，async） | `cookie-parser` / `res.cookie` |
| session | 无内置，`nitro-session`/`lucia` 等模块 | 自己接或用平台 | `express-session`（标配） |
| SSR 读身份 | ✅ 自动在 request 上下文 | ✅ 但需 await | — |
| middleware 拦截 | route middleware / server middleware | `middleware.ts`（Edge） | 函数链 |

09-express 里我们手写过 session store 与 cookie 签名，Nuxt 只是把这层做成了约定；理解了 `signed`、`maxAge`、store 过期回收，这里就不需要重新学一遍。

## 8. 自检清单

- [ ] 登录态是否在 cookie 且 `httpOnly + Secure + SameSite=Lax`？
- [ ] useCookie 的 `default` 传的是函数还是裸值？
- [ ] 是否误把 token 存 localStorage（SSR 读不到 + XSS 风险）？
- [ ] 服务端写 cookie 后是否安排了刷新/导航（本次请求读不到新值）？
- [ ] 删除 cookie 时 path/domain 与写入时一致吗？
- [ ] 会话能不能被服务端立即吊销（JWT 是否有登出黑名单）？
- [ ] 状态变更接口是否校验 Origin/防 CSRF？
- [ ] 响应体里有没有把 password/salt 带出去？

## 9. 🚀 部署预告

身份能存能读了，但"每一页都记得写 if (!user) 跳转"是不可维护的。下一关 **nuxt-middleware-auth**：route middleware 与全局中间件的执行时机、服务端与客户端各拦一次的意义，以及"前端拦好看、后端拦保命"的三层纵深如何落到代码结构上。
