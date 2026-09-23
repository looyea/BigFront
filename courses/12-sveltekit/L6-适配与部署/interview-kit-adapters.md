# kit-adapters 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SvelteKit 里 adapter 扮演什么角色？为什么需要它而不是直接产出可部署物？
**来源**：部署体系开场题的转述。

`vite build` 产出的是与平台无关的**中间形态**（客户端 bundle、服务端 bundle、路由 manifest）。adapter 是 build 末尾运行的插件，把这份中间产物"落地"成特定部署目标要的样子——静态文件树、standalone Node server、或某云的 serverless/edge 产物。抽象出来的价值：同一份源码换一行 adapter 配置即换落地形态，业务代码零改动。

### 2. (A) adapter-static / adapter-node / 平台适配器三者的本质区别？
**来源**：三适配器横向题的转述。

选型轴是"有无常驻进程 × 要不要线上 SSR"。adapter-static：全预渲染成静态文件，无线上 SSR（或靠 fallback 退化 SPA）；adapter-node：产出自包含 Node 服务器，`node build` 起常驻进程做动态 SSR + 托管资源；平台适配器（vercel/netlify/cloudflare）：把 SSR 编译成各家 serverless function / edge。

### 3. (A) adapter-static 有哪两条文档点名的硬前置？
**来源**：SSG 配置基础题的转述。

①根 layout `export const prerender = true`（让整站尽量静态化）；②`ssr` 不能是 false——否则预渲染只会存一个空壳页而非完整内容。另外 `trailingSlash` 要匹配宿主行为（宿主不把 `/a` 当 `/a.html` 就设 `'always'` 产出 `a/index.html`）。

### 4. (B) 设了 fallback 后首页却被打斗/冲突，官方为什么建议 fallback 用 200.html 而非 index.html？
**来源**：SPA 模式命名冲突排坑题的转述。

fallback 是"没被预渲染到的 URL"的兜底入口页。首页 `/` 通常**已被预渲染成 index.html**，若 fallback 也叫 index.html 会与之冲突。用 200.html（或平台约定名，如 Netlify 的 404.html 做 SPA）避开冲突。且官方明确 fallback 有大的性能/SEO 负面影响，只在"包进移动 app"等特定场景推荐。

### 5. (B) 项目有登录表单（action），能用 adapter-static 纯静态部署吗？
**来源**：action 与 SSG 冲突实战题的转述。

不能纯静态。带 form actions 的页**必须能接收服务器处理 POST**，死文件做不到，故这类页无法预渲染。出路：①用 adapter-node/平台适配器做混合渲染，动态页线上 SSR；②若坚持 static，则把该页留在 fallback SPA 里用客户端 fetch 提交（放弃 action 渐进增强）。

### 6. (B) 从 adapter-auto 切到专用 adapter 的典型触发点是什么？
**来源**：零配置边界题的转述。

adapter-auto 探测平台自动转发、方便上传即部署，但平台特定选项给不满。触发切换：需要 Vercel 逐路由 edge/serverless 分区、Netlify 函数配置、Cloudflare KV/env、或产物目录/压缩等精细控制时——换成专用 adapter 手写 options。口诀"demo 用 auto，上线用专配"。

### 7. (C) `prerender=true` 与 `prerender='auto'` 对 SSR manifest 的影响差异？
**来源**：三态预渲染对比题的转述。

`true` 把路由从动态 SSR manifest **排除**——只能以静态文件存在，若因故没被爬虫渲染到就会 404/报错而非回退 SSR。`'auto'` **既产文件又留在 manifest**——命中文件就发文件，没预渲染到的（如长尾 slug）回落服务器现渲。适合"烧热门、动态兜底长尾"。

### 8. (C) adapter-node 和 adapter-static 在"静态资源由谁托管"上的分工差异？
**来源**：托管职责对比题的转述。

adapter-static 产物纯文件，**托管完全交给任意静态服务器/CDN**。adapter-node 的 Node server **同时负责动态 SSR 与托管预渲染 HTML + `_app/immutable/**` 资源**，生产常自带 precompress 产物；要 TLS/压缩/负载均衡再放反代后。前者"Kit 不管服务器"，后者"Kit 就是服务器"。

### 9. (C) 与 Next、Nuxt 的部署模型比，Kit 的 adapter 机制有什么独特之处？
**来源**：跨框架部署横向题的转述。

Next 靠 `output: 'export'` 出静态、`standalone` 出 Node、平台自动识别；Nuxt 靠 nitro preset。Kit 的特点是把"落地形态"做成**可插拔 adapter 接口**（统一 `Adapter` 类型 + build 钩子），社区能给任意平台写 adapter，且**页面级 prerender/ssr/csr 开关与 adapter 正交**——同一 adapter 内可按路由自由混合静态/SSR/SPA，组合维度更细。

### 10. (D) 为"文档站（全静态）+ 内部后台（需登录态动态）"设计 adapter 与开关组合。
**来源**：混合站点架构设计题的转述。

选 adapter-node 或平台适配器（因为有动态后台，不能纯 static）。文档区：根或 `docs/` layout 设 `prerender=true` 全静态化 + entry generator 枚举侧栏 slug；后台区 `(admin)/+layout.server.js` 设 `prerender=false` 走 SSR + L5 鉴权。静态托管与 SSR 由同一 server 兼顾，配 ORIGIN 防 action 跨站误伤。

### 11. (D) 要把站包进 Capacitor/混合 App（纯前端），选哪个 adapter、配哪些项？
**来源**：移动壳 SPA 化情景题的转述。

adapter-static + `fallback`（App 内无服务器、所有路由回落入口壳）+ 根 layout `ssr=false`（转纯 CSR，接受 SEO 损失）。关 `strict` 或确保所有可达路由都进 fallback。代价是放弃 SSR 收益，官方视为"特定场景（裹进移动 app）"才这么做。注意这已不是"静态站"而是"用静态文件分发的 SPA"。

### 12. (D) precompress 在 adapter-static 默认 false、在 adapter-node 默认 true，为什么取向相反？
**来源**：默认值设计动机辨析题的转述。

adapter-node 是**你自己跑的 Node 服务**，预压缩 `.br/.gz` 直接由 server/反代按需 serve、省运行时 CPU，故默认开。adapter-static 产物丢给**第三方静态托管/CDN**，人家多半自带压缩或不支持你上传的 `.br/.gz` 映射，默认关避免产一堆可能用不上的文件。默认值反映的是"谁消费这份产物"。

🚀 **下一组**：L6 课后作业——adapter 选型与落地形态的综合复盘。

---

## 补充（新专题 13-15）

### 13.  adapter-static + fallback 做成 SPA 时，404 语义怎么处理才算正确？ 

 fallback 页是任意未命中路由的兜底 HTML，HTTP 状态天然是 200，需在客户端路由里自行渲染 404 视图并理解爬虫会收到 200 软 404；SEO 站应放弃 SPA 模式或配服务端状态码映射。 

**来源**： https://github.com/sveltejs/kit/tree/main/packages/adapter-static 

### 14.  从 adapter-auto 切到 adapter-node，构建与运行入口会发生哪些可见变化？ 

 产物从平台适配壳变为固定的 build/（env.mjs、handler.js、client、server）；启动命令 node build，端口/前缀由 env 注入；需自管进程、日志、TLS 与反代，这是便利到可控的交换。 

**来源**： https://svelte.dev/docs/kit/adapter-node 

### 15.  文档站（全静态）+ 内部后台（登录态动态）同仓库，adapter 与路由怎么切？ 

 单 Kit 项目混合两种渲染形态：(docs) 组全部 prerender=true 静态输出，(admin) 组 ssr 动态；adapter 取部署目标能力上界（有服务器用 node，纯托管则 docs 预渲染+admin 平台函数），避免双仓库同步地狱。 

**来源**： https://svelte.dev/docs/kit/page-options 
