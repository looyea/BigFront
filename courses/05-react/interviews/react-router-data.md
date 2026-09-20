# react-router-data 面试题精选

> 共 12 题，覆盖 A Data Router 动机 / B loader / C action 与写后重取 / D 守卫·React Query·Vue 对照四类。

---

## 一、Data Router 动机（A 类）

### 1. React Router v6.4 的 Data Router 解决了什么痛点？

**答**：传统 SPA 在组件里 `useEffect(fetch)`：先渲染空壳→异步填→易竞态、加载态散落、参数变化要手动重取、无法"数据就绪再进入"。Data Router 把数据读写从组件上移到**路由声明**：`loader` 进路由前取数、`action` 处理写、`errorElement`/pending 态标准化，且路由参数变化自动重跑 loader、写后自动重取。思想上接近服务端框架（Remix/Next）的"路由即数据边界"（呼应 react-effect-patterns、react-router-basics 第 8 题）。

**来源**：React Router 文档 — Loading Data、Actions、Remix 设计文档

### 2. createBrowserRouter 和以前的 `<BrowserRouter>` 用法有什么不同？

**答**：旧写法 `<BrowserRouter>` + JSX 里 `<Routes>`，纯声明式导航、数据在组件里。`createBrowserRouter(routes)` 用**配置数组**定义每条路由的 `loader/action/errorElement`，再 `<RouterProvider router={router}/>` 挂载。它把"数据/错误/待处理态"纳入路由能力。二者可共存（组件式 `<Routes>` 也能用 hooks 取数，但拿不到 loader/action 的路由级数据管线）。

**来源**：React Router 文档 — createBrowserRouter、RouterProvider

---

## 二、loader（B 类）

### 3. loader 的签名和参数是什么？返回值给谁？

**答**：`loader({ request, params, context })`。`request` 是标准 Request（可读 url/headers/method），`params` 是路径动态段（如 `:id`），`context` 是 `RouterProvider` 传入的静态上下文。返回值会序列化后经 `useLoaderData()` 提供给该路由组件；多个嵌套路由的 loader 结果会合并（用 `useMatches`/按层级取）。可 `throw redirect()`/`throw new Response()` 提前中断（呼应 react-router-data 第二、三节）。

**来源**：React Router 文档 — Loader function、useLoaderData

### 4. 路由参数变化时 loader 会自动重跑吗？和组件式取数比省了什么？

**答**：会。`/user/1`→`/user/2` 命中同一路由但 `params.id` 变了，Data Router 自动重新执行 loader 并更新 `useLoaderData`。省去手写 `useEffect(() => fetch(id), [id])` 及其竞态/取消处理，从根上避免"切了 id 还显示旧数据"（呼应 react-effect-patterns 竞态治理）。

**来源**：React Router 文档 — Dynamic segments & loaders

### 5. useLoaderData 和 useFetcher 有什么区别？

**答**：`useLoaderData` 读**当前路由**（及嵌套）loader 的结果，随导航生命周期走。`useFetcher` 是一个"旁路"请求器：在不改变当前 URL、不离开本页的情况下发起 load/submit 并拿状态（`fetcher.data`、`fetcher.state`），适合局部增量刷新、行内表单、后台预取。二者都是"数据在路由层/框架层管理"，组件不直接 fetch。

**来源**：React Router 文档 — useFetcher、useLoaderData

---

## 三、action 与写后重取（C 类）

### 6. action 什么时候触发？如何和表单配合？

**答**：当有导航"提交"到某路由（`<Form method="post">`、`useFetcher().submit`、`<Link submit>`）时触发对应 `action({ request, params })`。`<Form>` 拦截默认提交、走 action，`await request.formData()` 读字段（呼应 react-forms React 19 一节）。action 返回的数据用 `useActionData()` 在组件里读（常放校验错误）。提交中状态用 `useNavigation().state === 'submitting'`。

**来源**：React Router 文档 — Actions、Form、useActionData

### 7. "提交表单后列表要刷新"在 Data Router 里怎么天然实现？

**答**：action 成功返回后，Router 会**自动重新运行受影响路由的 loader**（默认重跑当前及父/匹配路由），列表 loader 拿到最新数据，无需手动 refetch 或跳刷新。这正是"写后失效重取"的框架级答案，避免了旧写法里"改完数据列表还是旧的"。需要更细粒度控制时配合客户端缓存库（React Query）做定向 invalidate（呼应 react-data-fetching）。

**来源**：React Router 文档 — After an action / revalidation、Revalidation

### 8. redirect 和 <Navigate> 有何区别？分别用在哪？

**答**：`redirect(to)` 用于 **loader/action 内部**（非渲染上下文），可 `return redirect()`（action 里跳转）或 `throw redirect()`（loader 里做守卫中断），它构造一个 Response。`<Navigate to>` 是**组件渲染时**返回的元素，用于 JSX 条件里（如未登录组件返回 `<Navigate>`）。Data Router 优先在 loader/action 用 redirect，能"数据都没取就挡下"，更早（呼应 react-router-basics 第 10 题）。

**来源**：React Router 文档 — redirect、Navigate

---

## 四、守卫、React Query 与 Vue 对照（D 类）

### 9. Data Router 如何做路由级鉴权守卫？对比 Vue 的 beforeEach。

**答**：在受保护路由的 `loader`/`action` 里读会话，未授权就 `throw redirect('/login')` 或 `throw new Response('Forbidden',{status:403})`（后者落到 errorElement）。Vue Router 用全局/独享 `beforeEach` 守卫集中判断再 `next('/login')`。差异：React Router 是**每条路由自带 loader**、就近守卫，无单一全局钩子；优点是可同时取数+鉴权、SSR 友好，缺点是不如 beforeEach "一处统管"直观。也可叠加 `<RequireAuth>` 包裹组件双保险（呼应 vue-router-guard-lazy）。

**来源**：React Router 文档 — Protected routes、Vue Router — Navigation Guards

### 10. 有 Data Router 的 loader 了，还需要 React Query 吗？

**答**：看需求。loader 适合"进入路由就要、随路由生命周期"的数据；但它**不管跨路由的客户端缓存/去重/失效/后台重取/分页无限滚动**。当多个组件共享同一份服务端数据、需要缓存命中、乐观更新、失效策略时，React Query（`useQuery`）仍更合适。二者可结合：loader 里预取写进 Query 缓存，组件用 useQuery 消费（呼应 react-data-fetching、react-state-mgmt"服务端状态 vs 客户端状态"）。

**来源**：React Router 文档 — Data strategies、TanStack Query 文档

### 11. loader 返回的数据要注意什么（序列化/大对象/函数）？

**答**：SSR 下 loader 返回值会被序列化成 JSON 传给客户端，**函数、Date、Map、class 实例等不可序列化**会丢失或报错——要么返回纯数据、要么用框架提供的 `defer`/序列化约定处理。别把不可序列化对象或整块敏感数据（密钥）塞进会下发到客户端的 loader。纯 SPA 无此限制但仍应避免把大对象到处透传。

**来源**：React Router 文档 — Serialization / defer、Remix — Loader data

### 12. 从 Vue 生态（Pinia + vue-router 手动取数）迁到 React Data Router，你会怎么设计数据流？

**答**：区分三类状态：① **路由级服务端数据**→ 交给 loader/React Query（进页面取、写后重取/失效），不再放组件 useEffect；② **真正跨页的客户端全局态**（主题、登录用户、购物车）→ Context/Zustand 这类 store（对应 Pinia，呼应 react-state-mgmt）；③ **局部 UI 态**→ 就近 useState。要点：把"服务端缓存"和"客户端状态"分开，别用一个大 store 手动缓存接口数据。这样 Vue 里 Pinia 手填接口的活，在 React 交给 Query/loader，Pinia 只保留真正的全局客户端态。

**来源**：React 官方文档 — Managing State、TanStack Query — Server vs Client state、Vue/Pinia 文档对照
