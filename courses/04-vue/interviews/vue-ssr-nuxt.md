# vue-ssr-nuxt 面试题精选

> 共 12 题，覆盖 A 动机与流程 / B 水合与数据 / C 纪律与陷阱 / D Nuxt 与选型类。

## 一、动机与流程（A 类）

### 1. 什么情况下你会给一个 Vue 项目上 SSR？收益和代价分别是什么？
收益：首屏更快（HTML 直出）、SEO/分享预览友好（爬虫拿到完整 DOM）、弱网下先见内容。代价：服务器成本与运维、代码要遵循"每请求隔离/两端一致"的心智、构建链路更复杂。内容型/营销型/对首屏和收录敏感的上 SSR；纯内网后台 SPA 往往不值当（呼应 vue-ssr-nuxt 第一、五节）。
**来源**：Nuxt 文档 — 什么是 Nuxt / SSR 动机、web.dev — 渲染模式

### 2. 描述一次 SSR 请求到页面可交互的完整流程。
服务端跑组件 render 生成 HTML 字符串 + 注入初始状态 → 返回 HTML → 浏览器先绘制（有内容但不可交互）→ 下载并执行客户端 JS → `createSSRApp` 对已有 DOM 做 hydration，绑定事件、建立响应式 → 页面可交互（TTI）。
**来源**：Vue.js 官方文档 — SSR 水合、Nuxt 渲染流程

### 3. SSR 之后还需要客户端 JS 吗？为什么？
需要。SSR 只负责把首屏 HTML 直出，交互（点击、路由切换、响应式更新）仍靠客户端 Vue 水合后接管。想彻底无 JS 是另一条路（静态/岛屿架构），别把 SSR 误解成"服务端渲染完就完了"（呼应 vue-ssr-nuxt 第一节）。
**来源**：Vue SSR Guide、Islands Architecture 概念

## 二、水合与数据（B 类）

### 4. hydration mismatch 是什么？怎么产生、怎么排查修复？
客户端首次渲染结果与服务端 HTML 不一致，Vue 报 warning 并可能整体重建该子树。诱因：两端数据/时间/随机不同、条件依赖 `window`、非法 HTML 嵌套被浏览器改写。排查：看 warning 定位节点。修复：确保两端一致——初始状态由服务端序列化下发、客户端读取复用，把浏览器相关逻辑挪到 `onMounted`（呼应 vue-ssr-nuxt 第二、四节）。
**来源**：Vue.js 官方文档 — 水合与 mismatch、Nuxt hydration 指南

### 5. 同构数据获取如何做到"服务端取一次、客户端不重复请求"？
组件的取数在服务端执行后，把结果连同渲染状态序列化进 HTML（如 `window.__NUXT__`/`__INITIAL_STATE__`），客户端水合时优先读这份注入的初始状态而非再发请求。Nuxt 的 `useFetch`/`useAsyncData` 内置此机制并自动按 key 去重（呼应 vue-ssr-nuxt 第三节）。
**来源**：Nuxt 文档 — useFetch / payload 复用、Pinia SSR 状态序列化

### 6. 裸 Vue 里 `onServerPrefetch` 起什么作用？
它是在 SSR 服务端渲染**之前**等待异步数据的钩子：在里面 `await` 把数据灌进 store/组件状态，`renderToString` 时才有数据可渲染。对应水合阶段该状态被序列化下发（呼应 vue-ssr-nuxt 第三节、vue-lifecycle 的 SSR 钩子）。
**来源**：Vue.js 官方文档 — onServerPrefetch

## 三、纪律与陷阱（C 类）

### 7. 为什么 SSR 里模块级单例（顶层 new 的 pinia/app）会造成严重 bug？
服务端进程处理多个并发请求，模块级单例在所有请求间共享，A 请求写入的用户态会泄漏给 B 请求，且水合状态错乱。必须用**每请求工厂**：`createApp()` 函数每次请求 new 一套 app/pinia/router（呼应 vue-ssr-nuxt 第四节、vue-project-architecture 第七节、node 每请求隔离）。
**来源**：Vue SSR Guide — 代码的跨请求状态污染、Node 请求隔离

### 8. `onMounted` 在服务端会执行吗？`setup` 呢？这决定了什么写法？
`setup`（及 `beforeCreate`/`created` 对应阶段）两端都跑，所以别在里面直接碰 `window`；`onMounted`/DOM 相关**只在客户端**跑。要访问浏览器 API 就放 `onMounted` 或 `import.meta.client` 守卫（呼应 vue-ssr-nuxt 第四节、vue-lifecycle SSR 注意）。
**来源**：Vue.js 官方文档 — 生命周期与 SSR、Nuxt 客户端/服务端判断

### 9. 服务端把仅客户端可用（如某些富文本/地图组件）如何处理？
用 Nuxt `<ClientOnly>` 包裹、或动态 `import()`、或在 `onMounted` 里初始化；避免在服务端 render 阶段访问 DOM/浏览器库导致报错。这类"仅客户端"渲染不参与水合首屏（呼应 vue-async-suspense、vue-ssr-nuxt 第四节）。
**来源**：Nuxt 文档 — ClientOnly、Vue 动态组件 SSR

## 四、Nuxt 与选型（D 类）

### 10. Nuxt 3 的约定式路由和自动导入分别省了什么？和裸 Vue 有何差异？
`pages/*.vue` 文件结构即路由（含嵌套/动态），无需手写 routes 数组（呼应 vue-router-basics）；`composables/`、`components/` 目录下的自动全局可用，无需逐个 import（呼应 vue-composables）。裸 Vue 都要显式写、显式 import。
**来源**：Nuxt 文档 — 文件系统集成、自动导入 auto-imports

### 11. SSR、SSG、ISR/混合渲染怎么选？
SSR：每次请求服务器渲染，适合高度动态、个性化。SSG（预渲染）：构建时出静态 HTML，适合内容稳定、极致首屏与低成本。ISR/SWR/混合（Nuxt routeRules prerender/swr）：按路由分别选静态/缓存/实时。选型看内容更新频率与个性化程度（呼应 vue-deploy SPA vs SSG、10-vite-deploy）。
**来源**：Nuxt routeRules / 渲染模式、Jamstack 渲染策略

### 12. Nitro/H3 服务端引擎和 Express 有什么异同？
同：都是 Node 侧 HTTP 中间件模型（请求→handler→响应），能写 REST 接口（呼应 09-express）。异：Nitro 跨平台（Node/edge/静态/Serverless 一份代码多目标），H3 是更轻的 web 框架并带事件/拦截器风格 API，`server/api/*` 文件即路由。概念可迁移，实现与部署目标不同。
**来源**：Nitro 文档、H3 文档、Express vs 现代 Node 框架
