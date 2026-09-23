# react-router-basics 面试题精选

> 共 15 题，覆盖 A 路由原理 / B 声明式配置 / C 导航与读取 / D 嵌套·Vue 对照四类。

---

## 一、前端路由原理（A 类）

### 1. SPA 前端路由是怎么在不刷新的情况下切换页面的？

**答**：核心是"拦截 URL 变化 → 只重渲染对应组件、不动其它 DOM"。两种实现：① **hash 模式**监听 `hashchange`，URL 的 `#` 后变化不触发请求；② **history 模式**用 HTML5 `pushState/replaceState` 改地址栏 + 监听 `popstate`，URL 更干净。React Router 的 `<BrowserRouter>` 即 history 模式，把 location 存进 context，路径变化时匹配 `<Routes>` 重渲染。history 模式刷新深链需**服务端回退**到 index.html（呼应 vue-router-basics、react-deploy）。

**来源**：MDN — History API / pushState、React Router 文档 — BrowserRouter

### 2. BrowserRouter 和 HashRouter 有何区别？生产为何多用 BrowserRouter？

**答**：`HashRouter` URL 带 `#`（如 `/#/about`），纯前端、对服务端零要求，但难看、锚点语义被占用、SEO 不利。`BrowserRouter` 用真实路径 `/about`，靠 pushState，需服务端把所有路径回退到入口 HTML。生产用 BrowserRouter 是为了干净 URL、SEO、可分享；代价是部署要配 history fallback（nginx `try_files`、静态托管的 SPA 重写）（呼应 10-vite-deploy）。

**来源**：React Router 文档 — HashRouter vs BrowserRouter、MDN — pushState

---

## 二、声明式路由（B 类）

### 3. React Router v6 如何声明路由？和 Vue Router 的配置式有什么思维差异？

**答**：React Router 是**声明式/组件式**：在 JSX 里写 `<Routes><Route path element/></Routes>`，`element` 是一个 React 元素，路由结构和组件树天然融合、可条件生成。Vue Router 是**配置式**：`createRouter({ routes: [{ path, component, children }] })` 集中一份路由表，`<router-view>` 渲染匹配结果。前者"路由即 UI"，后者"路由即数据表"，各有可读性优势（呼应 vue-router-basics）。

**来源**：React Router 文档 — Getting Started、Vue Router 文档 — Getting Started

### 4. `<Route path="/user/:id">` 里的 `:id` 怎么取？query 参数呢？

**答**：`:id` 是路径动态段，目标组件里用 `useParams()` 拿 `{ id }`（对应 Vue `useRoute().params.id`）。查询串 `?tab=x` 用 `useSearchParams()` 读写（比 Vue 的 `route.query` 更"受控"，能直接 setter 改 URL），也可 `useLocation().search` 手动解析。

**来源**：React Router 文档 — useParams、useSearchParams

### 5. `*` 通配路由和 `index` 路由分别解决什么？

**答**：`path="*"` 是兜底通配，放在 `<Routes>` 末尾匹配前面都没命中的路径，用作 404 页。`<Route index>` 匹配其父路径本身（父 `/dashboard` 无子段时渲染 index 内容），相当于"默认子路由"，避免 `/dashboard` 下 `Outlet` 空白。二者都是"缺省占位"，一个用于全局未匹配、一个用于嵌套默认（呼应 vue-router-basics 第四节）。

**来源**：React Router 文档 — index routes、Splat routes

---

## 三、导航与读取（C 类）

### 6. Link、NavLink、useNavigate 三者用途区别？

**答**：`<Link to>` 声明式导航，客户端跳转不刷新（替代 `<a>`）。`<NavLink>` 在 Link 基础上提供**激活态**——`className`/`style` 接收 `({isActive,isPending})`，用于当前菜单高亮。`useNavigate()` 是**编程式**跳转：`navigate('/x')`、`navigate(-1)` 后退、`navigate('/x',{state:{...}}}` 带 state，用于事件回调/登录后跳转（对应 Vue `router.push`）。

**来源**：React Router 文档 — Link、NavLink、useNavigate

### 7. 如何给下一个路由页传"不体现在 URL 里"的数据？

**答**：用 `navigate(path, { state: data })`，接收方 `useLocation().state` 读取。它存进 history.state，不进 URL。注意：① 刷新后仍在（存在 history.state），但用户**直接粘链接/新标签打开**没有该 state，要做兜底；② 大小受浏览器 history.state 限制，别塞大数据；③ 需要可分享/可收藏的数据应放 URL（params/search），不宜用 state。

**来源**：React Router 文档 — useLocation / state、MDN — history.state

### 8. 路由参数变了（如从 /user/1 到 /user/2）组件默认会重新挂载吗？要注意什么？

**答**：默认**不会**重新挂载——同一 `<Route>` 命中，只是 `useParams` 变了，React Router 复用同一组件实例（state 保留）。所以"根据 id 取数据"必须监听 id 变化重新请求：把 `id` 放进 `useEffect` 依赖，或用 data router 的 loader（呼应 react-useeffect 依赖、react-router-data）。忘记这点是"切换用户看到的还是上一个数据"的经典 bug。

**来源**：React Router 文档 — useParams、Remix — 重新加载数据

---

## 四、嵌套与 Vue 对照（D 类）

### 9. React Router 的嵌套路由怎么做？Outlet 是什么？

**答**：把子 `<Route>` 写在父 `<Route>` 内部，父 `element` 渲染公共外壳（如侧边栏 + `<Outlet/>`）。`<Outlet/>` 是"当前匹配子路由的渲染插槽"，父路径 `/dashboard` 渲染外壳、`/dashboard/settings` 在外壳的 Outlet 处填 Settings。`useOutlet()` 可编程获取当前 outlet 元素。等价于 Vue Router 的 `children` + `<router-view>`（呼应 vue-router-nested-dynamic）。

**来源**：React Router 文档 — Outlet / Nested Routing、Vue Router — Nested Routes

### 10. React Router 里"路由守卫/鉴权重定向"怎么实现（对比 Vue 的 beforeEach）？

**答**：Vue 有全局 `beforeEach` 守卫。React Router 没有等价的集中全局钩子（组件式路由），常规做法是写一个**包裹组件** `<RequireAuth>`：内部读登录态，未登录则 `return <Navigate to="/login" replace state={{from:location}}/>`，否则渲染 `<Outlet/>`/children。把敏感路由包一层即可。声明式、可组合，是 React 的"用组件表达控制流"风格（呼应 react-context 提供登录态、vue-router-guard-lazy）。

**来源**：React Router 文档 — Protected routes / Navigate、Vue Router — Navigation Guards

### 11. 路由懒加载（代码分割）在 React Router 里怎么写？

**答**：`const About = React.lazy(() => import('./About'))`，再用 `<Suspense fallback={<Loading/>}>` 包住 `<Routes>`（或放到布局的 Outlet 外层）。首屏不下载未访问页面的 chunk（呼应 react-render-control、10-vite 动态 import）。Vue 里对应 `component: () => import('...')` + Suspense，原理一致：动态 import 交给打包器切分。

**来源**：React Router 文档 — Code splitting、React 官方文档 — React.lazy

### 12. 从 Vue Router 迁到 React Router，你最需要注意的三个心智差异是什么？

**答**：① **配置式 → 声明式**：路由写在 JSX `<Route>` 树里、可条件生成，而非一份 `routes` 数组；② **没有全局 beforeEach**：鉴权/守卫改用包裹组件 + `<Navigate>`，逻辑组件化；③ **读信息用 hooks 而非 `this.$route`**：`useParams/useLocation/useNavigate/useSearchParams` 分散在组件里取，且要注意"同路由换参数不重挂载"需自行依赖参数重新取数。弄懂这三点，Vue Router 的经验几乎可平移（呼应 vue-router-basics）。

**来源**：React Router 文档 — Getting Started、Vue Router 文档对比

---

## 补充（新专题 13-15）

### 13.  useParams 与 useLocation().state 传数据的本质差异？为什么刷新后 location.state 会丢、哪些数据绝不能只放 state？

useParams 来自 URL 路径段，是「可分享、可收藏、刷新不丢、后退可恢复」的一等公民——凡「重新访问该 URL 应看到同样页面」的数据（资源 id、页码、筛选）必须进 path/param 或 query。useLocation().state 走的是 history 条目里的 state（pushState 携带、不进 URL），适合「一次性、不该出现在地址栏」的上下文（如从列表带去的来源标记、跨页传递的草稿）。坑：① 刷新时浏览器会用当前 history 条目重载，state 可能保留但也依赖实现与用户路径，绝不能把它当可靠存储；② 分享链接不带 state；③ 直达/新标签页 state 为 null 必须有兜底。判据一句话：URL 是真相的就进 params/query，只是导航上下文的才进 state，且代码要容忍 state 缺失。

**来源**：React Router useLocation/state 与 History 的 pushState 语义；MDN Session History API 持久化限制。

### 14.  React Router 的两种声明方式（JSX `<Routes>` 组件式 vs config 路由数组）怎么选？嵌套布局如何共享？

JSX 式（`<Routes><Route .../></Routes>`）直观、就近声明、适合路由不太多或想边写边看结构的 app，但无法在 React 树之外访问路由表。config 数组式（v6.4+ 配合 createBrowserRouter 或 data router）把路由集中成数据，便于：全局 layout 路由（`element:<Layout/>, children:[...]` 子路由渲染进父的 <Outlet/>）、代码分割集中声明、以及在应用启动/鉴权层遍历。嵌套共享靠「父路由放布局组件 + <Outlet/> 出口」，父组件保持挂载、子路由变化只换出口内容——这跟 Vue Router 的 children+<RouterView> 完全同构。选型：用了 Data Router（loader/action）基本就走 config 式，因为 data API 需要路由对象。

**来源**：React Router 路由概念（声明式 JSX vs 路由对象/嵌套与 Outlet）官方文档。

### 15.  从 Vue Router 迁到 React Router，最容易踩的三个心智差异是什么？

① 声明载体：Vue 是集中配置数组 + 命名路由，React 传统是 JSX 元素树（v6.4 后又有 config 式 data router），别把 Vue 的 routes:[{path,component}] 直接搬。② 守卫模型：Vue 有全局 beforeEach/beforeEnter 三档导航守卫，React Router 没有等价的「导航守卫钩子」——鉴权靠「包裹组件渲染 <Navigate/>」或（Data Router）loader 里 return redirect，把「拦截」从「事件钩子」变成「渲染/数据产物」。③ 参数与查询：Vue 的 route.params/route.query 在一个响应式对象上，React 拆成 useParams（路径段）+ useSearchParams（查询串）两个 Hook，且解引用非响应式快照——组件复用时同前一课 params 变化要监听/靠 loader 重跑，不会自动重置组件。理解这三条，迁移里的「为什么我的写法不生效」基本都有解。

**来源**：Vue Router 导航守卫 vs React Router loader/声明式重定向的对照；两者参数 API 差异。
