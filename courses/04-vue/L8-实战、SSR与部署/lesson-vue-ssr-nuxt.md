# SSR 原理与 Nuxt 概念

> 目标：SPA 首屏白屏、SEO 不友好时，需要**服务端渲染（SSR）**。本课讲清：为什么要 SSR、服务端渲染 + **hydration 水合**的完整流程、**同构数据获取**、SSR 的关键纪律（**每请求新实例**、`onMounted` 只在客户端跑、别在服务端碰 `window`/`document`）、`createSSRApp` 与服务端 entry，以及 **Nuxt 3** 如何在 Vue 之上用约定（文件路由、自动导入、`useFetch`/服务端路由规则）把 SSR 变简单（呼应 vue-project-architecture 的"避免过度全局化"、vue-pinia-advanced 的 SSR 水合、08-nuxt 课程包）。

---

## 一、为什么要 SSR

CSR（纯 SPA）的问题：首屏要下载 JS → 执行 → 再请求数据 → 渲染，**白屏久**、**爬虫看到的是空壳**（社交分享无预览、搜索收录差）。SSR 在服务器把首屏 HTML 直接吐出来：

- ✅ 首屏更快（HTML 直出，先看到内容）；
- ✅ SEO 友好（爬虫拿到完整 DOM）；
- ❌ 服务器成本、复杂度上升；交互仍靠客户端 JS（所以 SSR ≠ 无 JS）。

---

## 二、渲染 + hydration（水合）两步走

```
请求 → 服务端执行组件 render → 生成 HTML 字符串 → 连同「初始状态」注入 → 发给浏览器
浏览器：先显示服务端 HTML（有内容）→ 加载 JS → Vue 接管：把已有 DOM「水合」成响应式组件
```
- **hydration**：客户端 Vue **不重建** DOM，而是复用服务端产出的 DOM，绑定事件、建立响应式；
- **要求两端渲染结果一致**——否则报 hydration mismatch（文本/属性/节点不匹配），常见诱因是服务端与客户端数据/时间不同、`v-if` 条件依赖浏览器 API。

---

## 三、同构数据获取（关键）

服务端要拿到数据才能渲染 HTML，客户端水合时**不该再请求一次**。做法：组件声明"取数"逻辑，两端跑同一份，服务端把结果塞进 `window.__INITIAL_STATE__` 供客户端复用：

```js
// setup 里（SSR 感知）
const { data } = await useFetch('/api/list');   // Nuxt：SSR 取一次、水合自动复用
// 裸 Vue：onServerPrefetch + pinia 存状态，序列化为 payload
```
- 裸 Vue 用 `onServerPrefetch` 钩子（呼应 vue-lifecycle 的 SSR 钩子）；
- Pinia 的状态在服务端**每请求新建实例**、渲染后序列化、客户端 hydrate（呼应 vue-pinia-advanced SSR 节）。

---

## 四、SSR 纪律：最容易翻车的三条

1. **每请求新实例**：`createSSRApp`、`createPinia`、`createRouter` 都要在"每次请求"的工厂里 new，绝不能用模块级单例——否则 A 用户的状态泄漏给 B 用户（呼应 vue-project-architecture 第七节、node 的每请求隔离）。
2. **`onMounted`/DOM 只在客户端跑**：服务端没有浏览器，`onBeforeMount`/`mounted` 不执行；要碰 `window`/`document`/`localStorage` 的逻辑放 `onMounted` 或 `if (import.meta.client)` / `if (typeof window !== 'undefined')` 守卫。
3. **别在服务端引入浏览器 only 的库到顶层**：需动态 import 或 `<ClientOnly>` 包裹（Nuxt）。

---

## 五、裸 Vue SSR vs Nuxt

手写 SSR 要自己搭：服务端 entry、`renderToString`、`manifest`、流式渲染、状态序列化……门槛高。
**Nuxt 3** 把这层全包了，你只写 Vue，享受：
- **约定式文件路由**：`pages/*.vue` 自动生成路由（呼应 vue-router-basics）；
- **自动导入**：composables/components 不用手写 import（呼应 vue-composables）；
- **`useFetch`/`useAsyncData`**：SSR 感知、自动去重与水合复用；
- **服务端引擎**：`server/api/*`（Nitro，基于 H3，呼应 09-express/exp 的中间件模型）、可部署到 Node/edge/静态；
- `ssr: false` 一键退回 SPA、`routeRules` 里 prerender/swr 混合渲染。

本项目 **08-nuxt 课程包**会系统展开 Nuxt，本课重在把"为什么/水合/纪律"讲透。

---

## 六、`createSSRApp` 与两端 entry

```
client entry (entry-client.js)：createSSRApp(App) → 挂载到服务端注水的 #app（走水合）
server entry (entry-server.js)：每请求 createApp() 工厂 → renderToString → 返回 HTML + 状态
```
Vue 提供 `createSSRApp`（用水合而非纯客户端渲染）。进阶还有**流式渲染** `renderToWebStream`（首字节更快）与 server components（生态演进）。理解原理即可，日常更推荐直接用 Nuxt 承接 SSR。

---

## 七、自检清单

- [ ] SSR 解决了 CSR 的哪两个痛点？代价是什么？
- [ ] hydration 到底在做什么？为什么会 mismatch？
- [ ] 为什么"每请求新实例"是 SSR 铁律？违反会怎样？
- [ ] `onMounted` 在服务端会跑吗？要碰 window 该放哪？
- [ ] Nuxt 相比裸 Vue SSR 帮你省了哪些事？

---

## 🚀 部署预告

- "每请求新实例""状态序列化/水合"承接 **vue-pinia-advanced** 与 **vue-project-architecture** 的反过度全局化；文件路由/自动导入/服务端 API 见 **08-nuxt**；服务端模型（H3/Nitro）与 **09-express** 中间件同构；
- SSR 产出的是"服务器渲染 HTML + 客户端 hydrate JS"，而纯 SPA 的产物如何**构建与部署**（vite build、base、Nginx 回退、缓存 hash、CDN）是最后一关——**vue-deploy**（呼应 10-vite-deploy、node-deploy-perf）。

下一关进入 **vue-deploy**：`vite build` 产物、`base`、history 路由的 Nginx `try_files` 回退、`VITE_` 环境变量、静态资源 hash 缓存与 CDN、gzip、SPA vs SSG 与首屏优化。
