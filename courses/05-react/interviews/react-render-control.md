# react-render-control 面试题精选

> 共 12 题，覆盖 A 条件渲染 / B 显隐与 null / C ErrorBoundary / D Suspense·Vue 对照四类。

---

## 一、条件渲染（A 类）

### 1. React 有哪几种条件渲染方式？为什么没有 v-if？

**答**：① 三元 `cond ? <A/> : <B/>`；② 逻辑与 `cond && <A/>`；③ early return（组件内 `if (!x) return <Loading/>`）；④ 把元素存进变量再按条件插入；⑤ 独立子组件里自己判断。React 没有 `v-if` 指令，因为它是"UI 即 JS"——直接用语言的控制流表达式即可，不需要模板 DSL（呼应 react-jsx、vue-conditional-list）。

**来源**：React 官方文档 — Conditional Rendering、Vue 官方文档 — v-if

### 2. `{count && <List/>}` 有什么经典坑？

**答**：当 `count` 为 `0` 时，`0 && ...` 短路返回 `0`，而 `0` 是 React 会**渲染出来的合法值**，于是页面凭空多出一个 "0"。修法：`count > 0 && <List/>`、`!!count && <List/>`，或直接三元。（`false`/`null`/`undefined` 不会被渲染，唯独 `0` 会，呼应 react-jsx 第五节。）

**来源**：React 官方文档 — Conditional Rendering、0 is a valid renderable child

### 3. 组件返回 null 表示什么？调用方还会渲染吗？

**答**：返回 `null` 表示这个组件"渲染 Nothing"——该位置不产生任何 DOM、子树被卸载（内部 state 丢弃、副作用 cleanup）。父组件仍会渲染，只是这个子节点为空。常用于"某子组件自己决定要不要显示"，把显隐逻辑内聚到组件内部。

**来源**：React 官方文档 — Rendering Nothing

---

## 二、显隐：v-if vs v-show 的 React 版（B 类）

### 4. React 里如何实现 Vue 的 v-show（保留 DOM 只切换显示）？

**答**：React 无内置指令，靠 **CSS**：`style={{ display: hidden ? 'none' : 'block' }}` 或切换 className。此时组件**依然被渲染**，其 state、ref、副作用都保留，只是视觉上隐藏。而 `cond ? <X/> : null` 是销毁重建，等价 v-if。选哪个取决于"隐藏时是否要保留状态/避免重建开销"。

**来源**：Vue 官方文档 — v-if vs v-show、React 官方文档 — Conditional Rendering

### 5. v-if 式（卸载重建）和 v-show 式（CSS 隐藏）分别在什么时候更合适？

**答**：切换**不频繁、切换间条件树内有开销大的挂载/副作用、或隐藏时不需要保留状态** → 用卸载重建（省运行时、释放内存）；切换**非常频繁、需要保留内部状态/表单输入/滚动位置/动画** → 用 CSS 隐藏。待办列表的展开行、编辑器面板等常保留状态用 CSS；权限完全不可见的模块用卸载。

**来源**：Vue 官方文档 — v-if vs v-show、React 官方文档 — Conditional Rendering

---

## 三、ErrorBoundary（C 类）

### 6. ErrorBoundary 是什么？它能捕获哪些错误、捕获不到哪些？

**答**：ErrorBoundary 是包裹子树、捕获其**渲染期间**抛出的错误并展示降级 UI 的组件。能捕获：子组件 render、构造函数、生命周期里的错误。**捕获不到**：① 事件处理器里的错误（用 try/catch）；② 异步代码（setTimeout/Promise）；③ 服务端渲染；④ ErrorBoundary **自身**抛出的错误（由上层 Boundary 处理）。必须实现 `static getDerivedStateFromError`（渲染降级）或 `componentDidCatch`（上报）之一。

**来源**：React 官方文档 — Error Boundaries、componentDidCatch

### 7. 为什么 ErrorBoundary 只能是类组件，没有对应的 Hook？

**答**：因为捕获渲染错误依赖两个**只在类组件存在**的钩子：`static getDerivedStateFromError` 和 `componentDidCatch`，React 尚未提供等价的 Hook（如社区曾讨论 `useErrorBoundary` 但未进核心）。目前实践：写一个通用 ErrorBoundary 类组件包住路由/大区块，或用 `react-error-boundary` 库。

**来源**：React 官方文档 — Error Boundaries、react-error-boundary

### 8. 生产项目里 ErrorBoundary 应该放在哪些层级？

**答**：分层兜底。① 应用根：最后一个 Boundary，崩溃时显示"刷新/错误页"；② 路由级：配合 React Router 的 `errorElement`，某个页面崩了只影响该页；③ 关键独立区块（评论、推荐位）各包一个，一处坏不拖垮整页。原则是"以可恢复的最小业务单元为边界"，并统一在 `componentDidCatch` 里上报监控（呼应 react-router-data）。

**来源**：React 官方文档 — Where to put Error Boundaries、React Router errorElement

---

## 四、Suspense 与 Vue 对照（D 类）

### 9. `<Suspense>` 解决什么问题？和 ErrorBoundary 是什么关系？

**答**：Suspense 声明式处理"子树还没准备好"：渲染 `fallback`，就绪后自动替换，用于代码分割（`lazy`）和数据挂起。关系上二者互补且常嵌套：Suspense 管**加载中**，ErrorBoundary 管**出错**——典型是 `<ErrorBoundary><Suspense fallback>…</Suspense></ErrorBoundary>`，一个组件既可能有 loading 也可能有 error（呼应 react-effect-patterns 异步三态）。

**来源**：React 官方文档 — Suspense、React.lazy、Canary: Suspense for data

### 10. React.lazy 配合 Suspense 有什么限制？

**答**：① `lazy` 只做**默认导出**的动态 import；② 首次挂起会**卸载并重挂载**子树，需保证 state 不丢（把 state 提到 Suspense 之上）；③ SSR 下数据流边界更复杂，常配合 streaming；④ 应放在**路由/大边界**而非每个小组件，否则 loading 闪烁。可用 `Suspense` 嵌套实现分层渐进加载。

**来源**：React 官方文档 — React.lazy、Caveats、Suspense boundary placement

### 11. Vue 的 `<Suspense>`/`onErrorCaptured` 与 React 的对应物异同？

**答**：加载态：Vue 有实验性 `<Suspense>` + 异步组件 `defineAsyncComponent`，React 用 `<Suspense>` + `React.lazy`，理念几乎一致（fallback 占位）。错误态：Vue 用**组合式钩子 `onErrorCaptured`**（函数组件即可捕获子组件错误、可拦截上抛），React 只能靠**类组件 ErrorBoundary**——这是当前函数式能力上的一个明显差异（呼应 vue-async-suspense、vue-lifecycle）。

**来源**：Vue 官方文档 — Suspense、Error Handling onErrorCaptured、React 官方文档 — Error Boundaries

### 12. 一个既在异步加载又可能失败的组件，你会怎么组织它的渲染？

**答**：把三态（loading / error / success）显式建模，而不是散落 if。方案一：组件内部用 `status` 状态 + 条件渲染（early return loading、error 时渲染错误块）。方案二：交给 Suspense + ErrorBoundary 边界声明式处理——数据层 throw promise 触发 Suspense fallback、throw error 触发 ErrorBoundary fallback，组件本体只写"成功时"的样子，最干净。关键是别让"缺一个态"导致白屏或卡 spinner（呼应 react-data-fetching、react-effect-patterns）。

**来源**：React 官方文档 — Suspense / Error Boundaries、Dan Abramov — Suspense for Data Fetching
