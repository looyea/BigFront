# kit-internals 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 说清 `vite build` 在 SvelteKit 里的两个阶段，各自产出什么？
**来源**：Kit 构建流程高频题的转述。

第一阶段 Vite 生成优化生产构建：server 端（`.server.js`/hooks 服务端部分）、browser 端（universal load、组件、客户端运行时）、以及 service worker（若有），**预渲染也在此阶段执行**。第二阶段 adapter 接手第 1 阶段产物，按目标平台改装（Node 出可运行目录、Vercel/Cloudflare 出分发结构）。所以"dev 好使、build 崩"多半落在这两阶段的差异上。

### 2. (A) SvelteKit 构建期会"跑一遍"你的路由文件，这带来什么坑、如何防？
**来源**：`building` 标志专题题的转述。

为了分析路由（谁 prerender、依赖哪些块），Vite 阶段会加载并执行 `+page/+layout(.server).js` 及其 import。顶层的连库/网络/文件副作用会在**构建机**上跑，CI 无依赖就崩、或误连生产库。防护：凡不该构建期执行的都包进 `if (!building)`（`import { building } from '$app/environment'`），预渲染期 `building` 同样为真。

### 3. (A) 适配器拿到的核心 `Server` 类有哪几个方法？"SSR 的 render()"到底在哪被触发？
**来源**：@sveltejs/kit Server 契约题的转述。

`new Server(manifest: SSRManifest)` 注入路由清单；`init(options)` 进程启动调一次（连库/预热，对应一次性异步）；`respond(request, options): Promise<Response>` 每请求调一次——**这就是 SSR 的总入口/点火位点**。适配器无非把 `respond` 接到各平台 request handler 上。你写的 handle/load/render 全发生在一次 `respond` 内部。

### 4. (A) 构建期生成的服务端 manifest 大致登记了哪四类东西？
**来源**：manifest 结构题的转述。

① **nodes**：每个路由段的 page/layout 及其 `.server` 变体、各自 load、prerender/ssr/csr 配置（按需 lazy import 的模块引用）；② **matchers**：`src/params` 里 match 函数与 `[param=matcher]` 绑定；③ **路由匹配表**：URL 模式（可选段/rest/matcher）编成排序候选，运行时按"越具体越优先"命中 `route.id`；④ **版本与资源清单**：文件 hash、modulepreload 依赖、prerendered 路径、`VERSION`。本质是把磁盘文件树编译成内存索引。

### 5. (B) 一次页面请求 `respond` 的完整流水线画一下，并指出 handle 里 resolve 内/外抛错分别走哪条路。
**来源**：请求生命周期白板题的转述。

构造 `RequestEvent` → 进 `handle` → 调 `resolve(event, opts)` → resolve 内：匹配路由 → 逐层跑 `load`（server 喂 universal、`parent()` 向下传）→ 拿聚合 data 做 SSR 渲染成 HTML → 回 `Response`。**resolve 之外抛错=致命**，按 `Accept` 头回 JSON 或 `src/error.html`、不经页面错误边界；**resolve 之内**的预期 `error()`/`redirect()` 沿 `isHttpError`/`isRedirect` 冒泡，未预期错误进 `handleError`。

### 6. (B) 很多人给 `resolve` 包一层 try/catch 兜底，为什么这是反模式？
**来源**：中间件吞控制流事故题的转述。

`redirect()`/`error()` 靠抛出带标记对象实现控制流，`resolve` 正常也会返回带重定向/错误状态的 Response。若你在 `handle` 里 `try { resolve } catch { 返回降级 }`，就把框架的控制流信号当异常咽了——重定向失灵、错误页不出现。正确：别包；确需兜底只 catch 真意外，用 `isRedirect`/`isHttpError` 判出后原样重抛。

### 7. (C) 首屏像 MPA、站内跳转像 SPA——这句话在 Kit 里如何被机制支撑？
**来源**：Kit 渲染模型辨析题的转述。

首屏：`respond` 走完整 SSR 直出真 HTML（利于 SEO/首屏）。站内 `<a>` 点击：客户端拦截，只发目标路由的**数据请求**、按需 lazy import 缺的 chunk、**只重渲变化的路由段**、更新 history/滚动/`page` 状态，不重载文档。两套都复用同一份 manifest 和同一批 load，因此比纯 SPA（首屏空壳再拉数据）和纯 MPA（每跳刷新）都更省。

### 8. (C) Kit 的客户端导航与 Next App Router 的软导航，心智差异点在哪？
**来源**：跨框架渲染管线对比题的转述。

Kit 显式分"数据（load）"与"渲染（组件）"两层：软导航拉的是 `load` 产出的**序列化 data**（`?_data`），再局部重渲；缓存以"保守失效 + 显式 depends/invalidate"为准，无隐式 fetch 缓存。Next RSC 则把"哪些是 Server Component、哪些进客户端"混在组件树与 Router Cache 里，缓存语义更隐式。Kit 的优势是数据边界可预测，代价是要自己管缓存头。

### 9. (D) 你要给团队讲清"为什么不能用 dev 的性能数据下结论"，给三点机制理由。
**来源**：性能测试环境辨析题的转述。

① dev 无真 manifest、SSR 走 Vite 即时编译，代码分割/合并未到位；② dev 不压缩、不 hash，资源体积与缓存行为失真；③ 预渲染、`building` 分支、静态 import 分析只在 build 阶段生效。结论必须在 `vite build && vite preview` 上做（并注意 preview 跑在 Node、adapter 的 `platform` 对象不适用）。

### 10. (A) `?_data` 数据请求与首次 HTML 请求，服务端执行有哪些相同与不同？
**来源**：数据端点复用题的转述。

相同：都跑同一套 `load`（server→universal、parent 传递、cookies/locals 一致），走同一 handle/resolve 管线。不同：`?_data`（含 `format: 'data'`）只需返回**序列化后的 load 数据**，不必渲整棵组件树成 HTML；而首次请求要 SSR 出完整文档并内联 data。这也是"数据边界与渲染解耦"的体现。

### 11. (B) 线上偶发：改了个 server load 后，客户端导航拿不到新数据，但强刷正常。从机制角度排查。
**来源**：客户端导航缓存排坑题的转述。

强刷走完整 SSR 所以拿到新值；软导航靠 `load` 是否被重跑判定。若该 load 只依赖了未纳入失效 key 的东西（如直接读 `event.url.searchParams` 却没 `depends`、或用了被保守失效跳过的缓存），软导航就复用旧 data。查：给依赖的 URL/参数补 `depends` 或在 mutation 后 `invalidate` 对应 key；确认 prerender/缓存头没把它钉死。

### 12. (D) 设计一个"能向面试官讲 5 分钟"的 Kit 内部机制心智图，你会分几层？
**来源**：综合架构表达题的转述。

分四层讲最稳：① **构建层**（Vite 两阶段 + adapter + manifest/building 守卫）；② **服务层**（Server.respond、RequestEvent、handle/resolve 洋葱、reroute/transport）；③ **数据层**（server/universal load、序列化进 HTML、depends/invalidate 失效）；④ **客户端层**（水合、软导航=拉数据+局部重渲、preload 与 navaing state）。每层各挂 1 个已知坑（致命抛错 / 吞控制流 / 数据泄露 / 水合失配），既显深度又连得起。

---

## 补充（新专题 13-15）

### 13.  一次页面请求从 respond 到 HTML 输出的完整流水线，讲给面试官。 

 HTTP 适配→handle 洋葱→reroute/路由匹配→并行执行各层 load（fetch 带缓存与凭证）→SSR 渲染流式输出（数据内联+槽位占位）→慢 Promise resolve 后续写。 

**来源**： https://svelte.dev/docs/kit/faq#what-actually-is-a-server 

### 14.  为什么 dev 的性能数据不能对生产下结论？至少三条机制差异。 

 dev 走 Vite 按需转换未压缩、无代码分割优化、SSR 模块热更常驻、bundle 体积与 tree-shaking 缺席、HMR runtime 额外开销；至少要在 preview 或 CI 构建产物上测。 

**来源**： https://svelte.dev/docs/kit/faq#why-is-my-build-slower-than-my-dev-server 

### 15.  改了 universal load 后客户端导航偶发旧行为，从模块图与版本机制解释并给方案。 

 客户端持有旧 chunk 的模块图，version 变更未被轮询捕获则继续用旧 load；方案：缩短 pollInterval/关键路由导航后强制 check、静态产物缓存头区分 HTML 与 chunk、发布走原子 manifest 切换。 

**来源**： https://svelte.dev/docs/kit/configuration#version 
