# kit-security-headers 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SvelteKit 内置的 CSRF 防护具体挡什么、怎么挡？
**来源**：CSRF 机制必考题的转述。

对 **POST/PUT/PATCH/DELETE 的表单提交**校验请求 `origin` 头是否等于服务端 origin，不匹配返回 403。范围锁定这几种方法与 urlencoded/multipart/text-plain 这类**跨站能自动发出、不需 CORS 预检**的 Content-Type；GET 语义安全、JSON 跨站要过预检，都不在列。它**只在生产生效**，dev 不检查。配合 cookie 的 sameSite=lax 构成双层。

### 2. (A) csp 的 mode: 'hash' | 'nonce' | 'auto' 分别在干什么？
**来源**：CSP 配置高频题的转述。

CSP 限制资源可加载来源以压制 XSS；Kit 会为**自己生成的**内联 style/script 自动补凭据。`nonce`=每请求随机数、脚本带 `nonce-xxx` 才执行；`hash`=对固定内联内容算哈希放行；`auto`=**动态渲染页用 nonce、预渲染页用 hash**。手写进 app.html 的脚本用占位符 `%sveltekit.nonce%` 拿 nonce。

### 3. (A) directives 与 reportOnly 的区别？上线 CSP 的正确节奏？
**来源**：CSP 灰度实践题的转述。

`directives` 进真正的 `Content-Security-Policy` 头（会拦截）；`reportOnly` 进 `Content-Security-Policy-Report-Only`（只上报不拦），且必须配 `report-uri`/`report-to` 才有处收报告。正确节奏：先只上 reportOnly 灰度、看哪些资源被误伤，收敛指令后再转正式 directives，避免一刀切把站点 JS 全掐死。

### 4. (B) 开了 CSP 后 Svelte 过渡动画全失效，为什么？怎么解？
**来源**：CSP 与框架特性冲突的真实坑转述。

多数 `svelte/transition` 靠运行时注入**内联 `<style>`** 工作，被严格 `style-src` 拦掉。解法：要么**不指定 style-src**（留给默认），要么给 style-src 加 `'unsafe-inline'`（对 style 相对可接受，脚本绝不行）。这是"上 CSP 前先盘点框架依赖内联样式"的典型教训。

### 5. (B) 预渲染页上线后发现 CSP 的 frame-ancestors 没生效，可能被点击劫持，为什么？
**来源**：meta-CSP 局限排障题的转述。

预渲染（静态）页的 CSP 通过 `<meta http-equiv>` 下发，而 **frame-ancestors、report-uri、sandbox 三个指令在 meta 里被浏览器忽略**。要防点击劫持必须走**真正的响应头**——在托管层/CDN 或改用动态渲染，用 handle 设 `Content-Security-Policy` 头。这是静态化与安全头交集最易漏的点。

### 6. (C) csrf.checkOrigin 和 trustedOrigins 是什么关系？迁移要注意什么？
**来源**：CSRF 配置演进对比题的转述。

`checkOrigin: false`（全局关闭 origin 检查）**已 deprecated**，新 API 是 `trustedOrigins: [...]`——填**含协议的完整 origin**（如 `https://payment-gateway.com`）只放行特定可信第三方对本站的跨站表单；`['*']` 等价于全信任但不推荐。迁移要点：别再用"一刀切关掉"，改精确白名单，缩小信任面。

### 7. (C) Kit 的 CSRF 防护和 Next/纯 Express 的做法比，差异在哪？
**来源**：跨框架 CSRF 策略横向题的转述。

Kit **默认开启 origin 检查、零配置**，与 httpOnly+lax cookie 协同；Express 需自己上 csurf 类中间件 + token 校验，Next 无内置、常靠 middleware 自校 origin 或 SameOrigin cookie 手工挡。Kit 的优势是"安全默认 + 声明式白名单 trustedOrigins"，代价是跨站集成（第三方表单/回调）时要显式配白名单，否则生产 403 一头雾水。

### 8. (A) {@html} 与默认插值 {value} 的安全差异？svelte:element 有什么额外风险？
**来源**：XSS 攻击面辨析题的转述。

默认 `{value}` 自动转义，是基线防线；`{@html expr}` 直接注入 HTML 不转义，只能喂**受信**内容，用户提交的 HTML 必须先经 DOMPurify 净化。`<svelte:element this={tag}>` 的动态标签名、以及动态 `href`/`src`（`javascript:`、异常协议）都是执行向量——标签/属性值要走白名单，别把用户字符串直接当标签名或链接。

### 9. (B) 把 $page.url.query.next 直接渲染/跳转会引来哪些安全问题？
**来源**：URL 反射与开放重定向组合题的转述。

两处雷：①**开放重定向**——`?next=https://evil.tld` 或 `//evil.tld` 把登录用户跳去钓鱼站；②**反射型 XSS**——若把该值 `{@html}` 进 DOM 或拼进未转义属性，query 里可藏脚本。防御：渲染用默认 `{}` 转义；跳转用 safeRedirect（`/` 开头且不含 `//`，或 host 白名单）。

### 10. (D) 写出防开放重定向的 safeRedirect，并说明它挡不住什么。
**来源**：登录跳转安全加固情景题的转述。

`function safeRedirect(loc){ return loc && loc.startsWith('/') && !loc.includes('//') ? loc : '/'; }`——挡协议绝对 URL 与协议相对 URL（`//evil`）；更严用 `new URL(loc,'https://x').host===本站`。它**只保证"跳站内"**，不校验"用户是否有权看该目标页"；也不解决 CSRF（那是"谁能对我发请求"，方向相反）。

### 11. (D) 生产里除 CSP/CSRF 外还会补哪些安全头？在 Kit 哪里补？
**来源**：安全头清单实战题的转述。

在 handle 的 `resolve` 之后对 response 补：`Strict-Transport-Security`（HSTS）、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、点击劫持用 CSP `frame-ancestors`（或 X-Frame-Options）。原则：能用 `kit.csp`/`kit.csrf` 配置表达的就别手写，配置表达不了的才在 handle 卷头；改 Response.redirect 之类不可变头先 `clone()`。

### 12. (D) 给一个既预渲染营销页、又有动态 App 页的站设计 CSP/CSRF 落地方案。
**来源**：混合渲染安全策略设计题的转述。

CSP mode 用 `auto`：动态 App 页吃 nonce、预渲染营销页吃 hash；营销页要 frame-ancestors/报表就别靠 meta，在静态托管层配**响应头**。CSRF 保持默认开启，若接第三方支付表单回调，把对方精确 origin 加进 `trustedOrigins` 而非全局关。上线前 reportOnly 灰度看误伤。两类页共用同一 handle 安全头织入，按 `event.url.pathname` 前缀差异化。

🚀 **下一组**：L5 课后作业——安全头、CSRF/CSP 与鉴权落点的综合复盘。

---

## 补充（新专题 13-15）

### 13.  为什么预渲染页下发 CSP 要用 meta 标签而 header 方案不可行？带来什么限制？ 

 预渲染产物是静态文件，无法按请求改响应头，Kit 把 CSP 写进 <meta http-equiv>；限制：meta 不支持 frame-ancestors/report-uri 等指令，且 report-only 策略无法覆盖预渲染页。 

**来源**： https://svelte.dev/docs/kit/configuration#csp 

### 14.  开放重定向的防御清单：next 参数还有哪些绕过姿势？ 

 协议相对 //evil.com、反斜杠混清、编码差异、@ 伪造（https://good@evil）都需拦；正解是 new URL(next, origin) 后比对 host 相等且仅放行同源相对路径。 

**来源**： https://owasp.org/www-project-web-security-testing-guide/ ； https://svelte.dev/docs/kit/errors 

### 15.  除 CSP/CSRF，生产响应还应补哪些安全头？在 Kit 哪里统一加？ 

 X-Content-Type-Options、Referrer-Policy、Permissions-Policy、严格场景的 COOP/COEP/COOP、HSTS；统一在 handle 拿到 resolve 的 Response 后 setHeader 再返回，CSP 基线交给 kit.csp 配置。 

**来源**： https://svelte.dev/docs/kit/hooks#Server-hooks-handle ； https://developer.mozilla.org/docs/Glossary/CSRF 
