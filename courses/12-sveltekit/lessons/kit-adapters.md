# adapters：一份代码的 N 种落地形态

> 目标：建立"构建产物形态由 adapter 决定"的心智——adapter-static / adapter-node / 平台适配器各自吐出什么、fallback 页如何把站点降级成 SPA、prerender+ssr 开关如何反过来决定 adapter 选型、adapter-auto 的边界与零配置约定（呼应 svelte-deploy、next-deploy、nuxt-deploy 的"同一应用多部署目标"主题）

## 一、adapter 到底是什么、什么时候跑

SvelteKit 的 `vite build` 产出的是**中间形态**（客户端 bundle + 服务端 bundle + manifest），并不直接对应任何平台。adapter 是**在 build 末尾运行的小插件**，把这份中间产物"落地"成某个部署目标需要的样子——`svelte.config.js` 里 `kit.adapter: adapter({...})` 指定，运行 `vite build` 时执行。一句话记牢选型轴：**有没有常驻 Node 进程、要不要 SSR 动态页**，决定你选哪个 adapter。

三大类：
- **adapter-static**：纯静态文件（SSG），无线上 SSR；
- **adapter-node**：一个可 `node build` 起立的 standalone HTTP 服务器；
- **平台适配器**（adapter-vercel / adapter-netlify / adapter-cloudflare / adapter-…）：把 SSR 编译成各家的 serverless function / edge / worker。

## 二、adapter-static：把整站烧成一堆文件

用途："你的整个 app 都适合预渲染"时的终极形态——产物是任意静态服务器都能吐的一堆 HTML/JS/CSS。装 `@sveltejs/adapter-static`，配置项（都有默认值）：

| 选项 | 默认 | 作用 |
|---|---|---|
| `pages` | `'build'` | 预渲染页面写出去目录 |
| `assets` | 同 `pages` | 静态资源（static 内容 + 客户端 JS/CSS）目录，通常与 pages 同 |
| `fallback` | `undefined` | **SPA 模式关键**：为"没被预渲染到的 URL"生成的兜底入口页文件名 |
| `precompress` | `false` | 生成 `.br`/`.gz` 预压缩文件 |
| `strict` | `true` | 校验"要么全部页/端点都预渲染了、要么设了 fallback"，防漏发不可访问的部分 |

**两条硬前置**（文档原文点名）：
1. **根 layout 加 `export const prerender = true`**——告诉预渲染器整站都要静态化（用 fallback 的 SPA 模式可不必全预渲染，但应尽可能多预渲染以缓解性能/SEO 损失）。
2. **`ssr` 不能是 false**——否则预渲染只会存一个**空壳页**而非完整渲染内容。
- 还有 `trailingSlash` 要对齐宿主：宿主不会把 `/a` 渲染成 `/a.html` 的话，得设 `trailingSlash: 'always'` 生成 `/a/index.html`。
- GitHub Pages 特例：repo 名 ≠ `user.github.io` 时要配 `kit.paths.base`，并生成 `404.html` 作 fallback。

## 三、fallback 与纯 CSR：把站点降级成 SPA

`fallback`（常见 `200.html`，官方建议**避开 `index.html`** 免与预渲染首页冲突）一旦设置，未预渲染的 URL 都回落到这个空壳 HTML，由客户端 JS 接管路由——这就是 **SPA 模式**。但文档语气很硬：**"This option has large negative performance and SEO impacts"**，只在特定场景（如把站点包进移动端 app）推荐。想真走 SPA，往往还得配 `ssr = false`（见下），两者别混为一谈：**fallback 是"服务器找不到文件时给谁"，`ssr=false` 是"这一页压根不在服务端渲染"**。

组合矩阵记三格：
- **SSG（全静态）**：adapter-static + `prerender=true` + ssr 保持 true（不关）。
- **SPA（纯客户端）**：adapter-static + `fallback` + 根 layout `ssr = false`——产物是空壳 + JS，等于老式 SPA，牺牲 SSR 收益。
- **混合**：用别的 adapter（node/平台）+ 逐路由 `prerender` 开关，静态页烧成文件、动态页线上 SSR。

## 四、adapter-node：standalone 服务器

产物是 `build/` 里一个**自包含 Node 服务器**，`node build` 即起（默认 `0.0.0.0:3000`）。跑起来需要三样：`build/` 输出目录、项目 `package.json`、生产依赖（`npm ci --omit dev` 生成）。哪些进 bundle、哪些留 external 由你在 `package.json` 放 `devDependencies`（被 Rollup 打进）还是 `dependencies`（外部化）控制。

adapter 生成**两个文件**：`index.js`（起服务器）与 `handler.js`（导出一个能挂到 Express/Connect/Polka/`http.createServer` 上的 handler）。要**自定义服务器**就 import handler.js，自己加 `/healthcheck` 之类路由再 `app.use(handler)`——细节与环境变量清单留到 L6 收官的 kit-deploy-node。默认 server 自带**优雅停机**（SIGTERM/SIGINT：拒新连接 → 等 idle 完成 → `SHUTDOWN_TIMEOUT` 秒后强关剩余），并发 `sveltekit:shutdown` 事件供你关 DB。

## 五、prerender/ssr 如何反过来决定 adapter 选型

方向是**双向**的：选 adapter 决定"产物形态上限"，而页面上的 `prerender`/`ssr` 开关决定"这份产物能不能真用"。几个必踩的因果：
- 想用 **adapter-static**：页面**必须可预渲染**——`prerender=true` 且 ssr≠false；**带 action 的页不能预渲染**（需要服务器处理 POST），所以有表单提交的页要么走动态 adapter、要么留在 fallback SPA。
- **`prerender=true` 的页会从动态 SSR manifest 里排除**（server/serverless 更小）；想"预渲染热门、长尾仍动态"用第三态 `prerender='auto'`（既进文件也留在 manifest）。
- 访问 `url.searchParams` 在预渲染期**被禁止**（只能浏览器端用，如 onMount）——因为静态页没有"当前查询串"。
- 预渲染写文件系统：**目录/文件同名冲突**（`foo/+server.js` 与 `foo/bar/+server.js`）会炸——端点建议带扩展名（`foo.json/`），页面靠写 `foo/index.html` 规避。

## 六、adapter-auto 的边界：零配置不是无配置

新项目默认 `@sveltejs/adapter-auto`：它**探测当前部署平台**（Vercel/Netlify/Cloudflare 等）自动转发给对应适配器，帮你"上传即部署"。但它是**便利默认、非生产最优**：
- 探测不到平台时基本等于没落地；
- 平台特定选项（Vercel 的 edge/serverless 分区、Netlify 函数设置）它给不满——需要精确控制时**换成对应专用 adapter 手写 options**；
- 部分平台有真正的零配置优化（如 Vercel 对 adapter-static 会自动配好），此时**省略 adapter 选项**让专用适配器给最优配置，反而比强行 auto 更好。
口诀：**demo 用 auto，上线用专配**。

## N、自检清单

1. adapter 在构建流程的哪一步运行？"有无常驻 Node 进程 / 要不要动态 SSR"两问如何唯一导向 static/node/平台三选一？
2. adapter-static 的两条硬前置是什么？为什么 `ssr=false` 会毁掉静态化的意义？
3. fallback 和 `ssr=false` 分别解决什么、别混？给出"包进移动 app 的纯 SPA"最小配置组合。
4. 为什么"带 action 的页不能预渲染"？`prerender='auto'` 的适用场景？
5. adapter-auto 的边界在哪？举一个"该从 auto 换成专用 adapter 手写配置"的具体理由。

🚀 下一关：kit-prerender-static——预渲染的粒度控制：爬虫发现机制、entries 与 entry generator、origins 边界、动态内容混合预渲染与静态资源缓存头账本。
