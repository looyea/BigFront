# 终战项目：全栈应用生产毕业清单

> 目标：不再讲新机制，而是把 L1→L9 拧成一张能对着打勾的**上线验收 checklist**——从路由族设计、load 编排、表单 action、鉴权与 hooks、adapter 部署、到性能与安全审计、监控日志，逐段给出"合格线"和"最常见的翻车点"；并对照 07-nextjs / 08-nuxt 毕业项目的互评维度，说明 Kit 版应额外证明什么（呼应 svelte-deploy、next-capstone、nuxt-capstone）

这一关的用法：拿它当你 Kit 毕业项目的**评审表**。每一节先列"要做的事"，再给"合格判据"和"典型红灯"。逐条打勾全绿，才叫生产就绪。

## 一、路由族设计（对应 L1/L2）

- **判据**：URL 结构反映信息架构——动态段用 `[id]`、可选段 `[[lang]]`、兜底 `[...path]` 各司其职；布局边界用 `(group)` 与 `+layout@` 重置划清，不让侧栏/导航在详情页意外继承；每层 `+error.svelte` 边界放到位。
- **红灯**：把 rest `[...rest]` 和可选段混在最外层导致 `params` 收窄失效；靠"套很多层 layout"硬凑而非用布局组；`+page@` 根重置忘了写导致全站共用一个 layout。
- **收尾自检**：`matcher` 是否给语言/数字段限了字符集（既防脏 URL 又提优先级，L2）；跨子域/外链是否 `rel="external"` 避免被误当客户端导航（L2/L7）。

## 二、load 编排（对应 L3）

- **判据**：**数据职责分清 server / universal**——需要密钥、内网、DB 的一律 `+page.server.js`；要跨端复用、给客户端预加载用的放 universal；同名 `+page.js` + `+page.server.js` 用 `data` 透传而非重复取。`return` 里只放渲染必需字段（它会**序列化进 HTML**，是泄露面，L8）。
- **合格线**：显式 `depends`/`invalidate` 管理失效，不靠"整页刷"；`parent()` 用对继承；`cookies`/`locals` 只在 server 侧读；`+server.js` 端点**导出即路由**、`Response.json()` 统一出口。
- **红灯**：universal load 里塞 `process.env.SECRET`（打包进 HTML）；在浏览器 load 里对同一资源打三次串行请求（该合进 server load 一次 join，见 kit-performance）；`load` 返回值塞进不可 `devalue` 序列化的东西（函数、`Map`、类实例）直接 500。

## 三、表单与 action（对应 L4）

- **判据**：写操作走 **form action（只支持 POST）**、成功用 `redirect(303)` 跳出、失败用 `fail(400, data)` 回填；渐进增强用 `enhance` 保证 JS 未加载时也能提交；乐观 UI 在 `pending`/`update` 上做。
- **合格线**：`fail` 状态码在 400–599；密码字段不回显（`deserialize` 时清）；action 跑完自动重跑当前页 load（利用这点刷新数据，别手动再取）。
- **红灯**：用 GET 表单提交 action（不支持）；具名 action 与 default 混用搞混 `?/name` 寻址；在 action 里 `catch` 掉了 `redirect`/`error` 抛出（用 `isRedirect`/`isHttpError` 重抛，L4/L8）。

## 四、鉴权与 hooks（对应 L5）

- **判据**：`handle` 里做**全站中间件**（鉴权、日志、CSP、i18n 协商），**每请求必跑**、别把守卫写进单个 load 漏掉端点；`locals.user` 作为唯一可信身份源、在 `resolve` 前置好；敏感路由在 `+page.server.js`/`+layout.server.js` 二次守卫（客户端 `$page.data` 是乐观视图、**不可作为授权依据**）。
- **合格线**：`reroute`/`transport` 保持纯函数幂等（不改地址栏、不塞副作用）；cookie 设 `httpOnly`+`secure`+`sameSite=lax`+明确 `path`；CSRF 依赖 `checkOrigin`（已 deprecated）时迁到 `trustedOrigins`；登出走"清 cookie + 失效缓存 + 跳登录"三件套。
- **红灯**：`resolve` **之外**抛错（致命 500）；CSP `mode: 'auto'` 却手写了 `frame-ancestors`（meta 模式忽略它）；用 `event.url` 判内外网授权（可被伪造头绕过）。

## 五、类型 / 测试 / 构建部署（对应 L6/L8 + adapter）

- **类型**：`kit.config` 开 generated types，`.svelte-kit/tsconfig.json` 被 extends，`./$types` 里 `PageData`/`Params` 自动收窄；`app.d.ts` 补 `App.Locals/Error/PageData/Platform` 且**删掉末尾的 `export {}`**。
- **测试**：load/action 写成**可单测的纯函数**（依赖入参而非模块级 import）；`vi.mock('$app/*')` 隔离运行时；`$env/dynamic` 比 static 好注入；e2e 用 Playwright 跑 `build && preview`（4173）覆盖 SSR+水合全链路。
- **部署**：选对 adapter（`adapter-node` 自托管 / `adapter-vercel`/`cloudflare` serverless 或 edge / `adapter-static` SSG）；确认目标环境能力（Lambda 会不会缓冲掉 `ReadableStream`，见 L7）；`vite build && vite preview` **本地复现生产**再发；env 走 `$env/static|dynamic` 的 `public|private` 四象限，别把私密切成 public 打进 bundle。

## 六、性能与安全终检（对应 kit-performance + L8）

- **性能账（在 preview 上跑 Lighthouse）**：LCP/INP/CLS 达线；确认没破坏 Kit 开箱九优化（尤其数据内联、请求合并）；图片走 `enhanced-img`、字体在 `handle` 里补预加载、无致命瀑布；HTTP/2 已开、前后端同机房或上边缘。
- **安全审计**：`$lib/server`、`$env/*/private` 未被客户端 import（构建期应拦）；load 返回值/HTML 里不泄露密钥；hydration 无非确定性值；错误页不吐堆栈；开放重定向有 `safeRedirect`。

## 七、监控与日志（毕业项目的"运营态"）

- **判据**：`handleError` 里对**未预期错误**打结构化日志并上报（Sentry 类），带 `url`、`route.id`、`locals` 摘要；`expected` 错误不进上报避免噪音；`Server-Timing`/OpenTelemetry 埋后端慢点；`VERSION` 常量 + 构建元数据，让线上报错能对齐到发布批次。
- **合格线**：能回答"昨天那波 500 是哪个路由、哪次发布、慢在哪一层"。
- **红灯**：`handleError` 只 `console.log` 到容器标准输出且无采样/去重，事故时被日志淹没或触发配额；无健康检查端点区分 liveness/readiness。

## 八、对照 07/08 毕业项目的互评维度

与 Next.js（App Router）、Nuxt 3 毕业项目互评时，Kit 版应**额外证明**三点差异，别拿别家标准套：

1. **数据边界纪律**：Next 的 RSC/缓存"玄学"在 Kit 里对应的是**明确的 server/universal load 分工 + devalue 序列化契约**——评审要你能指出每个字段"在哪个 load 取、序列化进哪、几时失效"。
2. **无隐式缓存**：Kit 端点**没有自动缓存**（L7），Next  Route Handler 有 fetch cache 默认值——Kit 项目要你能主动说"我为什么不需要 / 我在哪用 CDN+`Cache-Control` 显式加"。
3. **渐进增强的默认性**：action 的 `enhance` 让"没 JS 也能提交表单"是 Kit 一等公民——毕业项目里应至少有一条**禁用 JS 仍可完成**的核心流程作为加分证据。

## 九、自检清单

1. 用这张清单给你的毕业项目当前状态**逐节打分**（路由/load/action/鉴权/部署/性能安全/监控），哪一节最弱、下一步补什么？
2. "客户端 `$page.data` 不能作为授权依据"——请给一个具体越权反例，并写出正确的双层守卫放哪两个文件。
3. load 返回值"序列化进 HTML"为什么既是性能优化（数据内联）又是安全隐患？你如何在"够用字段"和"别漏 key"之间划线？
4. 你的项目在 preview 跑 Lighthouse，LCP/INP/CLS 分别被什么拖累？对应本清单哪一节的手段？
5. 与一个等价 Next 项目相比，你的 Kit 版在"缓存模型"和"渐进增强"两点上能出示什么 Next 版拿不出的证据？

🚀 恭喜抵达 12-sveltekit 终点站。下一步：把这九节清单变成你真实毕业项目的 PR 评审表，逐条签字上线。
