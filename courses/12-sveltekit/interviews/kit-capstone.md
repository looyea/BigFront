# kit-capstone 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (D) 给一个全栈 Kit 毕业项目做上线前评审，你的 checklist 分几块？
**来源**：生产就绪评审总纲题的转述。

按数据流分七块：① 路由族（动态/可选/rest 段、布局组、error 边界）；② load 编排（server/universal 分工、序列化字段最小化、depends/invalidate）；③ 表单 action（POST、303/ fail、enhance）；④ 鉴权与 hooks（handle 全站中间件、locals 唯一可信、双层守卫、cookie/CSP/CSRF）；⑤ 类型与测试（generated types、纯函数 load、Playwright e2e）；⑥ 构建部署（选对 adapter、env 四象限、preview 复现）；⑦ 性能安全监控（Lighthouse、泄露审计、handleError 上报、版本对齐）。

### 2. (A) 为什么"客户端 `$page.data` 不能作为授权依据"？正确守卫放哪？
**来源**：客户端鉴权反模式题的转述。

`$page.data`/`$page.state` 是喂给 UI 的**乐观视图**，跑在用户浏览器、可被篡改，只决定"显示什么"、不决定"能不能拿"。真正的授权必须在**服务端**：`handle` 里据 cookie/session 置 `locals.user`，再在 `+page.server.js`/`+layout.server.js` 对敏感数据/路由二次校验，越权就 `redirect`/`error`。UI 门 + 服务端门缺一不可。

### 3. (B) load 里 return 了一个 `Map`/函数/类实例，页面直接 500，为什么？怎么改？
**来源**：devalue 序列化事故题的转述。

load 返回值要**序列化进 HTML**（供水合复用），Kit 用 `devalue`——它支持比 JSON 更多的类型，但**函数、活体类实例、某些内置对象**不可序列化，抛错即 500。改法：只返回纯数据结构（普通对象/数组/原始值/Date/顶层可 devalue 的类型），把行为放回组件、把集合转成数组。

### 4. (C) Kit 端点与 Next Route Handler 的缓存模型差异，评审时你要出示什么证据？
**来源**：跨框架缓存模型对比题的转述。

Kit 的 `+server.js` 端点**没有任何自动缓存**——响应头你说了算，要缓存就显式设 `Cache-Control`/`ETag` 交给 CDN/edge。Next 的 Route Handler/`fetch` 有各自的默认缓存与 revalidate 语义（更隐式）。证据：贴出你为某只读端点**主动**加 `Cache-Control` + 在边缘验证命中的 Network 头，并说明"为什么这里需要/不需要缓存"。

### 5. (A) 表单写操作的完整正确链路是什么？成功、校验失败各怎么收尾？
**来源**：form action 生命周期题的转述。

`<form method="POST">` 命中 `+page.server.js` 的 `actions`（**仅 POST**，具名用 `?/name`）。**成功**：`redirect(303, '/elsewhere')`（Post/Redirect/Get，防刷新重复提交）；**校验失败**：`fail(400, { fieldErrors, ... })` 回填、**密码字段不回显**。action 跑完 Kit 会自动重跑当前页 load，利用这点刷新数据；渐进增强用 `enhance` 让无 JS 也能提交。

### 6. (B) 你把某个动态页设了 prerender，上线后用户 A 的数据出现在用户 B 的静态页里。复盘。
**来源**：误预渲染数据串页事故题的转述。

含 per-user 数据的页**不能 prerender**——它在构建期被渲成一份静态 HTML 发给所有人（或把构建期那次请求的 data 固化）。修：对动态路由设 `export const prerender = false`（或靠 `cookies.set`/非幂等 `fetch`/`$env/dynamic` 自动禁用 prerender）；要"静态壳 + 动态数据"就用 `csr`/客户端 load 拉数据，而非把数据烘进静态 HTML。

### 7. (D) 生产报一批 500，你怎么在 5 分钟内定位到"哪个路由、哪次发布、哪一层"？
**来源**：事故定位与可观测性题的转述。

靠上线前就打好的日志：`handleError` 对未预期错误打**结构化**日志（带 `url`、`route.id`、`locals` 摘要、`VERSION`+构建元数据）并上报 Sentry 类平台；按 `route.id`/发布版本聚合即知哪个路由哪批发布；用 `resolve` 内/外区分"页面错误边界 vs 致命 500"，用 `Server-Timing` 判慢在后端还是 SSR。前提：expected 错误不进上报、避免噪音。

### 8. (C) 对照你做过的 Next/Nuxt 毕业项目，Kit 版要额外证明哪三点差异？
**来源**：跨栈毕业项目互评题的转述。

① **数据边界纪律**：能指出每个字段"在哪个 load 取、序列化进哪、几时失效"，而非靠框架隐式缓存；② **无隐式缓存**：主动说明端点/页面缓存策略是你显式加的（Kit 不自动缓存）；③ **渐进增强默认性**：至少一条"禁用 JS 仍可完成"的核心流程作加分证据（action + enhance 是 Kit 一等公民）。

### 9. (B) 密钥还是被打进了浏览器 bundle 或 HTML，给出 Kit 里所有可能的泄露路径。
**来源**：环境变量泄露排坑题的转述。

① 从 `$env/static/public`（或误标 public）导出机密——public 会进客户端 bundle；② 在 **universal load** 里读 `$env/*/private` 或把密钥 `return` 进 load 结果——它被序列化进 HTML；③ 客户端代码 import 了 `$lib/server`（应被构建期拦截，若绕过即泄露）。防线：机密只走 `$env/static|dynamic/private`、只在 server 侧用、load 只返回渲染必需字段。

### 10. (A) 部署选型：adapter-node / 平台 serverless / adapter-static 分别什么情况选？
**来源**：adapter 选型题的转述。

自托管/传统 Node 部署、要长驻进程与流式 → `adapter-node`。上 Vercel/Netlify/Cloudflare、要按路由边缘/serverless、弹性伸缩 → 对应平台 adapter（注意某些 serverless 会缓冲流式响应）。内容几乎全静态、可 prerender（营销站/文档）→ `adapter-static`（SSG）。选型前用 `build && preview` 复现、核对目标平台对 `ReadableStream`/`platform` 对象的支持。

### 11. (D) 给一个多国 SEO 站点做架构，把路由/i18n/性能/部署串成一条链。
**来源**：综合架构设计题的转述。

`[[lang]]` 可选段承载 locale + `src/params` matcher 限语言码（提优先级）；`handle` 做协商、对无前缀 URL 用 `redirect` 规范化（别用 reroute 静默改写，会让 `page.url` 与实际地址脱钩、hreflang 失配）；universal load 取文案经 `setContext`/`getContext` 下发；出 `hreflang`/`x-default`/canonical；图片 `enhanced-img`、字体在 handle 补 preload、边缘部署 + CDN + HTTP/2。每环都能回指到具体关卡机制。

### 12. (B) 你只允许保留三条"上线前必过"的硬门禁，选哪三条、为什么它们最致命？
**来源**：发布门禁取舍题的转述。

① **无密钥泄露**：扫 bundle/HTML 确认 `$env/*/private`、`$lib/server` 未被客户端引用、load 不返回机密——安全不可回滚；② **鉴权走服务端**：敏感页在 `.server` load 二次守卫，堵住越权读数据——直接对应真实漏洞；③ **preview 下 SSR/水合无致命错误**（resolve 外不抛、hydration 无非确定性值、build 产物 Lighthouse 达线）——保证不是"dev 正常 prod 白屏"。其余可迭代，这三条一崩就是事故。
