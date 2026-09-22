# 解剖整车：manifest、Server 与 resolve 流水线

> 目标：把前八关所有"为什么会这样"的机制债一次还清——`vite build` 的两阶段产物里那份 manifest 到底装了什么、`@sveltejs/kit` 的 `Server` 类（`constructor(manifest)` / `init` / `respond`）在适配器里的调用位点、一次请求如何穿 `handle → resolve →（匹配路由 → 跑 load → SSR render）` 的流水线、客户端导航为何本质是"拉数据 + 局部重渲"而非整页刷新（呼应 svelte-compiler-architecture 编译器分层、svelte-sveltekit-bridge 引桥题的终极兑现）

## 一、build 的两阶段：先 Vite 编译，再 adapter 改装

`npm run build`（即 `vite build`）在 Kit 里其实是**两个阶段**串行：

1. **Vite 生产构建**：把三份代码各自打优化产物——**server 端**（`+page.server.js`、`+layout.server.js`、`+server.js`、hooks 里服务端那部分）、**browser 端**（`+page.js`/`+layout.js` 的 universal load、组件、`$app/*` 客户端运行时）、以及**service worker**（若你有 `src/service-worker.js`）。**prerender（预渲染）就在这一阶段执行**——静态路由在这一步就被渲成 `.html` 落盘，运行时不再进 handle。
2. **adapter 改装**：`svelte.config.js` 里配的 adapter（`adapter-node`/`adapter-vercel`/`adapter-cloudflare`…）接手第 1 阶段的产物，按目标平台重新组织（Node 生成可 `node build` 的目录、Vercel/Cloudflare 生成分发结构 + 路由规则）。

关键心法：**dev 与 build 走的是两套东西**。dev 没有真正的 manifest、SSR 靠 Vite SSR runtime 现算；很多"dev 正常 build 出问题"的事故（环境变量、`building` 分支、动态 import 被静态分析），根子都在这两阶段的差异上。做性能/排障前，永远先 `vite build && vite preview` 复现，别拿 dev 的数当准。

## 二、构建期会"跑一遍"你的 load 文件：building 守卫

第 1 阶段里，SvelteKit 为了分析路由（谁 prerender、谁有 server load、依赖哪些块），会**加载并执行**你的 `+page/+layout(.server).js`（连同它们 import 的东西）。这意味着顶层代码在**构建机**上就会跑一次：

```js
import { building } from '$app/environment';
import { initialiseDatabase } from '$lib/server/database';

// 构建期 building === true，跳过连库这类副作用
if (!building) {
  initialiseDatabase();
}

export function load() { /* ... */ }
```

忘加 `building` 守卫的后果：CI 构建机上没有数据库/网络，顶层 `new Client()`、`fetch()` 直接让 `vite build` 崩掉，或构建期偷偷连了生产库。**"任何不该在构建期执行的代码，都要包进 `if (!building)`"** 是 Kit 的铁律（预渲染期同样 `building` 为真，见下）。

## 三、manifest：把"路由表 + 组件 + load"编成一张索引

第 1 阶段的产物之一，是一份服务端 **manifest**（适配器可用 `generateManifest({ relativePath, routes })` 生成）。它不是给人读的源码，而是构建期把整个 `src/routes` 目录树**编译成的数据结构**，大致登记了：

- **nodes（节点表）**：每个路由段对应的 `+page`/`+layout`/其 `.server` 变体、各自的 `load`、`prerender`/`ssr`/`csr` 等配置的引用（按需 lazy import 的模块 id）。
- **matchers（参数匹配器）**：`src/params/*.js` 里 `match` 函数与 `[param=matcher]` 的绑定，供路由匹配时收窄/校验。
- **路由匹配表**：把 URL 模式（含可选段 `[[lang]]`、rest `[...rest]`、matcher 段）编成排序好的候选，运行时按 L2 那套"越具体越优先"的规则命中一个 `route.id`。
- **版本与资源清单**：文件 hash、`modulepreload` 依赖、prerendered 路径集合、`VERSION` 常量等。

一句话：**磁盘上的文件树 → 内存里的可索引对象**。SSR 服务器不需要"扫目录"，它只认这份 manifest。

## 四、Server 类与 respond：render() 到底在哪被调

这是"SSR 时 `render()` 的调用位点"引桥题的正面回答。适配器拿到的核心 API 是 `@sveltejs/kit` 导出的 **`Server`** 类：

```js
import { Server } from '@sveltejs/kit';

const server = new Server(manifest);   // 用第 3 节那份 SSRManifest 初始化
await server.init({ env: process.env }); // 一次性异步初始化（读 $env/static、跑 setAdapter 等）

export async function fetch(request) {   // 每个请求
  return server.respond(request, {       // ← SSR 的总入口，返回一个 Response
    platform,
    getClientAddress: () => { /* ... */ }
  });
}
```

- `constructor(manifest: SSRManifest)`：把 manifest 注入，服务器由此"认识"你所有路由。
- `init(options)`：**进程启动时调一次**（对应 L5 里 init 的一次性异步语义：连库、预热）。
- `respond(request: Request, options): Promise<Response>`：**每个请求调一次**，这是你整个服务端中间件 + load + 渲染的收敛点。适配器无非是把这个 `respond` 接到各平台的 request handler 上（Node 的 `http.createServer`、Edge 的 `fetch`、Vercel function…）。

所以你写的 `handle`、`load`、SSR，全都发生在 `server.respond()` 这一次调用内部——它才是"引擎的点火位置"。

## 五、一次 respond 的流水线：handle → resolve → 匹配 → load → render

`respond` 内部对**页面请求**（非 `+server.js` 端点）的执行序，把前几关串成一条线：

1. **构造 `RequestEvent`**：包 `request`、`url`、`route`、`params`、`cookies`、`locals`、`platform`、`fetch` 等（L5/L3）。
2. **进 `handle`钩子**：你写的中间件在此跑；真正推进流程靠调 `resolve(event, opts)`。**`resolve` 之外抛错 = 致命**（L8 事故手册），`resolve` 之内才是渲染管线。
3. **`resolve` 内部 = 匹配路由**：用 manifest 的 matchers/排序表把 URL 归到一个 `route.id`。
4. **跑 `load` 层**：先 `+layout.server.js` → `+layout.js` → … 逐层，`server load` 结果喂给同名 `universal load`，再沿 `parent()` 向下游传（L3）。这一步产出各层的 `data`，端点/表单 action 也在匹配后分派（L1/L4）。
5. **SSR render**：拿聚合后的 `data` 在**服务端**把组件树渲成 HTML 字符串，注入 `+page` 数据（序列化进页面，供客户端水合复用——这也解释了 L8 里"load 返回值会进 HTML"的泄露面）。
6. **回 `Response`**：`resolve` 把渲好的 HTML（含 `<div id="svelte-anchors">`、序列化 data、`modulepreload` 头）包成 `Response`，`handle` 可再改头/改体后返回；错误/重定向沿 `isHttpError`/`isRedirect` 冒泡到 `handleError`（L4/L8）。

## 六、客户端导航 = 拉数据 + 局部重渲，不是整页 reload

首次访问走上面的完整 SSR；但点 `<a>` 触发的**客户端导航**是另一条轻量路径（L2/L3 已埋，这里收口）：

- 拦截点击 → `beforeNavigate` → 用 `?_data=<route.id>` 之类的**数据请求**只拉目标路由的 `load` 结果（`format: 'data'`），**不再重取整份 HTML**。
- 按需 lazy import 目标路由**缺的那几个 chunk**（新页面的组件），配合 `<link rel="modulepreload">`/`preloadCode` 提前预热（L2/L7）。
- **只重渲发生变化的路由段**：复用了的 layout 不动，只有 `+page`（或 params 变了要重跑的层）重渲；`navigating` 状态、`willUnload` 守门在此期间生效（L7）。
- 更新 `history`、恢复滚动、`page` store/state 变化触发 `$app/state` 的 runes 更新。

所以"Kit 是 MPA 还是 SPA"是个假问题：**首屏像 MPA（真 SSR HTML），站内跳转像 SPA（load + 局部重渲）**——两套都用同一份 manifest、同一批 load 函数，这正是它比纯 SPA（首屏空壳 JS 再拉数据，见 kit-performance 瀑布）和纯 MPA（每跳刷新）都更优的结构性原因。

## 七、自检清单

1. `vite build` 的两阶段分别产出什么？prerender 发生在哪一阶段、为什么 build 机会执行你的 load 文件、`building` 守卫防的是什么事故？
2. 服务端 manifest 大致登记了哪四类东西（nodes / matchers / 路由匹配表 / 版本资源清单）？它把"磁盘文件树"变成了什么？
3. 写出 `Server` 类的三个方法签名，指出 `server.respond(request)` 与 `init` 各自的调用频次，并说清"SSR 的 `render()` 调用位点"到底在哪一层内部。
4. 画出一条"页面请求 respond"的完整流水线：`handle → resolve →（匹配 → 逐层 load → SSR render）→ Response`，并说明 `resolve` 内 / 外抛错分别走哪条错误路径。
5. 用一句话说清"客户端导航 = 拉数据 + 局部重渲"：它靠什么只拉目标路由数据、只重渲变化的段？为什么这使 Kit 首屏像 MPA、站内像 SPA？

🚀 下一关：kit-performance——机制吃透后，用它算一笔性能账：TTFB、水合成本与 bundle 账该怎么量、怎么砍。
