# 安全响应头与内置防线：CSP、CSRF 与开放重定向

> 目标：把 Kit 替你默认装好的安全防线盘一遍——CSP 三模式（hash/nonce/auto）与 %sveltekit.nonce%、内置 CSRF origin 检查的适用范围与 checkOrigin→trustedOrigins 迁移、开放重定向白名单、{@html}/svelte:element/$page.url 的 XSS 面，以及"配置不够就用 handle 自己卷"的兜底（呼应 exp-security-headers、next-middleware 的安全头收口）

## 一、CSRF：Kit 默认已在挡，先搞清它挡到哪

L4 说过"同名 action 跨站提交挡不住"——那 Kit 到底防了什么？**内置的 origin 检查**（`kit.csrf`），专治**跨站表单提交**：

- 检查时机：对 **POST、PUT、PATCH、DELETE** 的**表单提交**，校验请求的 `origin` 头是否等于服务端 origin；不匹配返回 403（"Cross-site POST form submissions are forbidden" 那句）。
- 为什么只盯这三种 + 表单：GET 按 HTTP 语义应是安全的（幂等无副作用）；而 `application/x-www-form-urlencoded`/`multipart/form-data`/`text/plain` 这几种 Content-Type 是**跨站表单能自动发出去**的（不需要 CORS 预检）——正是 CSRF 的主战场。JSON 提交跨站必须过 CORS 预检，本就另一道闸。
- ⚠️ **只在生产生效**，本地开发不检查——所以别在 dev 里调 CSRF 逻辑，务必 build 后验。
- 配置迁移：老写法 `csrf: { checkOrigin: false }` 已 **deprecated**，新 API 是 `csrf: { trustedOrigins: [...] }`——填**含协议的完整 origin**（如 `https://payment-gateway.com`）放行特定第三方的跨站表单；`trustedOrigins: ['*']` 信任一切（等价旧 checkOrigin:false，官方明令"generally not recommended"）。
- 该关的时机：真需要接第三方支付/回调用**表单 POST** 打进来时，把它的精确 origin 加进 trustedOrigins，而不是全局关掉。

`sameSite: 'lax'`（cookies 默认）是**第一层** CSRF 防御（跨站子资源/POST 不带 cookie），origin 检查是**第二层**，两道都要，别互相顶替。

## 二、CSP：Content-Security-Policy，Kit 的三档模式

CSP 通过限制"资源能从哪些源加载"来压制 XSS。`svelte.config.js` 的 `kit.csp`：

```ts
kit: {
  csp: {
    mode: 'auto',                       // 'hash' | 'nonce' | 'auto'
    directives: { 'script-src': ['self'] },
    reportOnly: { 'script-src': ['self'], 'report-uri': ['/'] }  // 观察模式，只报不拦
  }
}
```

- **directives vs reportOnly**：前者进真正的 `Content-Security-Policy` 头（拦截），后者进 `Content-Security-Policy-Report-Only`（只上报不拦）——上线前先 reportOnly 灰度观察误伤，再转正式。reportOnly 必须配 `report-uri` 或 `report-to` 才有处收报告。
- **mode 三档**：Kit 会为你**自己生成的**内联 style/script 自动补 nonce 或 hash——
  - `'nonce'`：每次请求发一个新随机数，脚本带 `nonce-xxx` 才允许执行；
  - `'hash'`：对固定的内联内容算哈希放行；
  - `'auto'`（默认取舍）：**动态渲染页用 nonce、预渲染页用 hash**——因为预渲染页 HTML 是构建期定死的，没法每请求换 nonce（"用 nonce 配预渲染页不安全且被禁止"）。
- **app.html 手写脚本的 nonce**：占位符 `%sveltekit.nonce%`——`<script nonce="%sveltekit.nonce%">…</script>`。
- **预渲染页的坑**：静态化时 CSP 通过 `<meta http-equiv>` 下发，而**`frame-ancestors`、`report-uri`、`sandbox` 三个指令在 meta 里会被浏览器忽略**——要靠这些就得走响应头（动态页或自己托管配头）。
- **Svelte 过渡的坑**：多数 `svelte/transition` 靠生成内联 `<style>` 工作；用了它们要么**别指定 `style-src`**、要么加 `unsafe-inline`——否则动画全被 CSP 掐死。
- **兜底**：`kit.csp` 这层配置不够灵活时，官方明说"用 handle hook 自己卷 CSP"（在 handle 里 `response.headers.set('Content-Security-Policy', ...)`，按需给不同路由发不同头）。

## 三、XSS 面：{@html}、svelte:element、以及反射进页面的 URL

Svelte 默认对 `{变量}` **转义**，这是你的基线防线。真正的 XSS 敞口来自你**主动关掉它**的地方：
- **`{@html expr}`**：直接注入 HTML 的逃生舱——只喂**你信任的**内容（自己渲染的 markdown 等）；用户提交的 HTML 必须先经 DOMPurify 之类净化，绝不裸 `{@html userInput}`。
- **`<svelte:element this={expr}>`** 与动态属性/`href`：元素名、`javascript:` 协议的 href、`src` 都可能是执行向量；动态标签/属性值要白名单校验（别把用户给的字符串直接当标签名或 `href`）。
- **把 `$page.url` 反射进 DOM**：查询串、hash 里可藏 `<img onerror=...>` 之类；若你把它 `{@html}` 进页面或拼进未转义属性就是自伤——`encodeURI`/转义/干脆只用 `{text}` 插值。
- **`dangerouslySetInnerHTML` 心态对齐**：写过 React 的把这当成同一个红灯——`{@html}` 就是 Svelte 版，规则一致。

## 四、开放重定向与"验证再跳"三连

L4 挑战题的 `redirect(303, url)` 用 `$page.url`/查询串里的 next 直跳，是**开放重定向**漏洞（`?next=https://evil.tld` 把登录用户送到钓鱼站）。加固三件套：
1. **路径必须 `/` 开头**（挡住协议绝对 URL）；
2. **不含 `//`**（挡住 `//evil.tld` 这种协议相对 URL 跳到别域）；
3. （更严）**host 白名单**——`new URL(loc, 'https://example.com').host === 'example.com'` 反解校验。

```ts
function safeRedirect(loc: string | null): string | void {
  if (loc && loc.startsWith('/') && !loc.includes('//')) return loc;
  // 或严格版：new URL(loc, 'https://x').host === 本站
}
```
配合 redirect 状态码语义（L4）与"303 把 POST 转 GET 防重放"，登录跳转才算闭环。`trustedOrigins` 管的是"谁能对我发表单"，开放重定向管的是"我把用户跳去哪"——两个方向，别混。

## 五、其余该顺手配的头（handle 里一次补齐）

Kit 不替你自动发但生产必备，集中在 handle 的 resolve 之后 `response.headers.set`：`Strict-Transport-Security`（HSTS 强绑 HTTPS）、`X-Content-Type-Options: nosniff`（禁 MIME 嗅探）、`X-Frame-Options`/CSP `frame-ancestors`（防点击劫持，注意 frame-ancestors 预渲染 meta 无效见上）、`Referrer-Policy`。原则：**能走配置（csp/csrf）的走配置，配置表达不了的用 handle 卷头**——但记得 Response.redirect 等不可变头要先 clone。

## N、自检清单

1. Kit 内置 CSRF 检查作用于哪些方法与哪种提交？为什么"只在生产生效"？checkOrigin 与 trustedOrigins 什么关系？
2. CSP 的 mode=auto 为什么对动态页用 nonce、对预渲染页用 hash？预渲染页走 meta 时哪三个指令会失效？
3. {@html} 与 svelte:element 各自怎么变成 XSS 入口？默认插值为什么是安全的？
4. 写出一个挡住 `//evil.tld` 的 safeRedirect，并解释它和 trustedOrigins 各管哪个方向。
5. 哪些安全头 Kit 不自动发、要在 handle 补？为什么改 Response.redirect 的头要先 clone？

🚀 **下一站 L6**：kit-adapters——一份代码的 N 种落地形态，adapter-static/node/平台的产物差异与 fallback 纯 CSR 模式。
