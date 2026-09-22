# 会话与鉴权：cookies、session 模式与授权收口

> 目标：把上一关的 handle/locals/cookies 三块拼成可上线的鉴权机器——cookies API 的安全默认值与 path 强制、"登录态放 handle 塞 locals、layout 共享"的标准模式、逐路由 +page.server.js 授权 vs 中间件拦截的取舍、乐观 UI 与服务端真相的边界（呼应 exp-session-jwt 的会话 vs令牌之争、nuxt-server-routes 的服务端收口）

## 一、cookies：Kit 给的这把枪，默认就是安全档

服务端 `event.cookies`（RequestEvent 家族成员，**只在 server 侧有**——L3 讲过 universal load 没有 cookies API）三件套 `get/set/delete`，外加 `serialize`（只生成 Set-Cookie 头字符串、不应用）。它的默认值是**防呆设计**，背下这张表：

| 选项 | 默认 | 含义 |
|---|---|---|
| `httpOnly` | **true** | JS 读不到 → 挡住 XSS 偷 cookie。要客户端可读必须显式关掉 |
| `secure` | **true**（但 `http://localhost` 下是 false） | 只走 HTTPS 传输 |
| `sameSite` | **`lax`** | 跨站导航的 GET 带、跨站 POST/子资源不带 → 天然抗一部分 CSRF |
| `path` | **无默认，必传** | 官方强制你显式写 `path: '/'`（全应用可见）或相对路径/`''`（仅当前路径及子路径） |

三条实战纪律：
1. **会话令牌一律 httpOnly**——前端 JS 永远不该能读到你的 sessionid；能在 `document.cookie` 里看到登录态的实现都是漏的。JWT 放不放 httpOnly 是 exp-session-jwt 之争的延续：放 cookie+httpOnly 挡 XSS 却要考虑 CSRF，放 localStorage 反过来——Kit 的默认答案倾向"httpOnly cookie + 服务端会话/Lax"。
2. **set 后立即 get 得到**：`cookies.set` 既写响应头、又让**本次请求**内 `cookies.get` 读到新值（L4 面试第 4 题的机制底座）。
3. **path 不匹配 = 删不掉/看不到**：`cookies.delete` 的 path 必须和当初 set 的一致，否则"删了还在"。

## 二、标准模式：handle 认令牌、locals 挂身份、layout 分发

L5 前两关合流的经典三件套：

```ts
// src/hooks.server.js —— 每条请求把 cookie 换成 user 挂上 locals
export const handle = async ({ event, resolve }) => {
  const sessionid = event.cookies.get('sessionid');
  event.locals.user = sessionid ? await getUserFromSession(sessionid) : null;
  return resolve(event);
};
```
```ts
// src/routes/+layout.server.js —— 全站登录态一次性下发给所有页面
export const load = ({ locals }) => ({ user: locals.user ? { id: locals.user.id, name: locals.user.name } : null });
```
```ts
// src/app.d.ts —— 给 locals 与页面数据上类型
declare global {
  namespace App { interface Locals { user: import('$lib/server/types').User | null } }
}
```

为什么是这套：handle 保证**每条请求、每个动作之前**都重建 locals（服务端真相），layout load 把 user **向整个子树广播**（L3 的"layout 数据向所有子 layout/page 可见"）——组件里直接 `data.user` 用，无需每个页面各查一次。⚠️ 但 layout 下发的是**裁剪后的公开字段**（别把 passwordHash 塞进 data，它会被序列化进 HTML）。

## 三、授权落点：中间件"认人"、页面级"准入"，别用 layout load 当守卫

这是本关最容易答错的取舍。三层各有分工：
- **handle（中间件）**：负责**识别身份**（cookie→user→locals），也能做粗粒度全局闸（如"非 /api 一律放行、/api 无 user 直接 401"）——它每请求必跑、无缓存。
- **各 +page.server.js（页面级）**：负责**该页准入**——`if (!locals.user?.admin) error(403)` 或 `redirect(307, '/login')`。页面级 load 在你导航进该页时**一定跑**（不像 layout 那样因 params 不变而跳过），所以逐路由守卫放这里最可靠。
- **别用 +layout.server.js 当唯一守卫**：L4 面试题第 7 题的坑在此复现——从 /admin/a 去 /admin/b，layout 的 params 没变、layout load **不重跑**，旧鉴权结果被缓存复用，session 恰好中途过期就漏了。layout 适合"广播身份"，不适合"逐页裁决"。

组合口径（官方鉴权指导的精神）：**横切关注点（是否登录、CSRF、rate-limit）在 handle；资源级授权（能不能看这条记录）在 server load/action**。要"整个 /admin 子树都要 admin"，也别只写 layout——在子树每个 page 或用 `(admin)` group 的统一 +page.server 逻辑，或 handle 里按 `url.pathname.startsWith('/admin')` 拦。

redirect 与"两种进入方式"要分叉（L4 挑战题埋的线）：页面导航给 `redirect`，fetch/AJAX 型请求（Accept: application/json）给 `error(401)` 而非 3xx——JSON 客户端不跟重定向语义。

## 四、乐观 UI 与服务端真相

客户端"点了先当成功、后台再提交"是 enhance/action 的天然能力（先渲染 form 成功态），但鉴权**不能乐观**：
- **权限判据只认服务端**——把 user.role 塞进 `$app/state` 让组件自己 `if (user.admin)` 决定显不显示"删除"按钮，是**体验层**；真正的门禁必须是 action/load 里的服务端 `error(403)`。隐藏按钮 ≠ 保护端点（curl 照样打）。
- **url/params 不可单独作权限判据**——官方 JSDoc 反复警告：remote/reroute 语境下 `url`、`params` 都是"客户端可操纵的请求数据"，`/admin/:id` 里的 id 不能当作"用户有权访问 id"的证据，必须回服务端查授权关系。
- **乐观写要能回滚**：enhance 回调里失败要撤回 UI；服务端校验/授权失败靠 fail/error 把真相传回。乐观是糖，服务端真相是药。

## 五、会话生命周期：登出、过期与 getRequestEvent 便利

- **登出**：`cookies.delete('sessionid', { path: '/' })` + 销毁服务端会话 +（若 handle 建过 locals）**手动 `event.locals.user = null`**（L4 两件套）。
- **过期**：cookie 设 `maxAge`/`expires`，但服务端会话也要有 TTL——只信 cookie 过期时间等于把钥匙挂在门上。
- **`getRequestEvent()`**（`$app/server`，2.20+）：在没有 event 参数的地方（深层 server 函数、`$lib/server` 里的 repository）取当前请求 event，从而就近读 cookies/locals，免去层层透传 event。红线复述：**无 AsyncLocalStorage 的环境（如某些 edge runtime）必须同步调用**，跨 await 之后可能拿不到。这功能是"把鉴权收口下沉到服务层"的胶水。

## N、自检清单

1. 默写 cookies 四选项默认值，解释为什么 `secure` 在 localhost 特例为 false、path 为什么强制。
2. handle→locals→+layout.server 三件套各自职责？为什么下发给页面的 user 要裁剪字段？
3. 逐路由授权为什么优先 +page.server.js 而非 +layout.server.js？用"params 不变则 layout load 不重跑"论证。
4. "隐藏管理员按钮"和"保护管理端点"分别在哪一层？为什么 url.params 不能单独作权限判据？
5. getRequestEvent 解决什么透传痛点？它的使用红线是什么？

🚀 下一关：kit-security-headers——安全清单收官：CSP 三模式与 nonce、Kit 内置 CSRF origin 检查（checkOrigin→trustedOrigins）、开放重定向白名单、$page.url 的 XSS 面与 cookie 安全属性全景。
