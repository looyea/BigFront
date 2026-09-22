# solid-error-boundary 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) ErrorBoundary 到底捕获哪些错误？给官方划的能力边界。
**来源**：捕获范围题的转述。

捕获其子树：① **渲染 JSX 时**抛的错；② **更新响应式计算**（memo/effect/绑定）时抛的错；③ 经同一渲染/更新流冒泡出来的**响应式异步原语**错误。范围之外的（见下题）不接。本质是它接管"由 Solid 驱动的渲染/更新"里上抛的错误，机制沿 Owner 树的 `context[ERROR]` 链找处理器。

### 2. (B) 在 `onClick` 里 `throw new Error()`，外层 ErrorBoundary 为什么没反应？
**来源**：事件错误不被捕获题的转述。

因为事件处理器**不在 Solid 的渲染/更新流里**——它是浏览器回调，错误沿浏览器调用栈抛，不经过 Owner 的 ERROR 上下文。同类还有裸 `setTimeout`/`Promise.then`/第三方异步回调里抛的错。要处理：处理器内部自己 try/catch，或挂 `window.onerror`/`unhandledrejection` 全局兜底。

### 3. (A) 函数式 fallback `(err, reset) => JSX` 里 reset 做什么？适合什么错误？
**来源**：reset 语义题的转述。

`reset()` 清空当前错误状态并**重新渲染 children**。适合**瞬时/可恢复**错误：网络抖一下、某次请求 500——用户点"重试"就重新执行子树、再取一次可能就成功。若错误是确定性的（代码 bug），重试会再崩，就该给别的降级而非 reset。

### 4. (A) 一个边界的 fallback 渲染时又抛错，会发生什么？怎么利用这点？
**来源**：多级降级题的转述。

fallback 自己抛的新错由**更外层的 ErrorBoundary** 捕获（错误继续沿 Owner 树上抛）。据此做多级降级：内层边界给"重试"UI，内层连 fallback 都崩了，外层边界兜"回首页/静态兜底页"。

### 5. (C) createResource 失败时，`resource.error` 与 ErrorBoundary 捕获是二选一吗？
**来源**：错误双通道题的转述。

不是，是两条互补路径。`resource.error`（+进入 `errored` 态）让你在 JSX 里判它、做**温和内联提示**（"加载失败，点此重试"），不必惊动边界。而当失败**经由 Suspense/渲染读取冒泡**时会抛给 ErrorBoundary。官方 tip 建议预计出错就包边界；最佳实践：`user.error` 内联提示 + ErrorBoundary 兜没预判到的抛错，双保险。

### 6. (D) 同时要"加载兜底 + 错误兜底"，Suspense 和 ErrorBoundary 谁包谁、为什么？
**来源**：边界嵌套顺序题的转述。

**ErrorBoundary 在外、包住了 Suspense（及其内容）**。因为错误从子树冒泡是向外走的，边界要在外层才接得到内层渲染/更新抛出的错；若把 ErrorBoundary 放 Suspense 内层，外层子树冒泡的错它接不住。外层管错、内层管加载，各一层最清晰。

### 7. (A) ErrorBoundary 底层用哪些 API 实现？命令式捕获该用什么？
**来源**：catchError 机制题的转述。

靠 `catchError(fn, onError)` + Owner 的 `context[ERROR]` 槽：`onError` 收到错误后"设一个 signal 把边界翻到 fallback 态"，`reset` 把该 signal 清回。命令式做捕获就用 `catchError`；想给错误附上"发生在哪个组件"等诊断信息，用 `modifyFailure` 包装/改写后再抛。

### 8. (B) 边界包了一整个列表，某一行渲染抛错，结果是整列表都变 fallback。想让"只有坏的那行塌"怎么办？
**来源**：边界粒度题的转述。

把 ErrorBoundary 下沉到**行粒度**：在 `<For>` 的每个 item 渲染里各包一层 `<ErrorBoundary fallback={<坏行占位/>}>`。这样只抛错那一行降级、其余行照常——代价是每行一个边界节点。用错粒度（一个巨大外层边界）会让"局部错误"升级成"整块崩塌"。

### 9. (C) 和 React 的 Error Boundary 相比，Solid 的有何异同？
**来源**：跨框架错误边界对比题的转述。

相同：都只接"渲染/更新期"错误、都不接事件/异步回调错误、都支持多级嵌套降级。不同：React 的 class-only `componentDidCatch`、函数组件要靠库（react-error-boundary）；Solid 的 `<ErrorBoundary>` 就是**现成组件**，`fallback` 直接给 `(err,reset)`。而且 Solid 里错误"沿 Owner 树而非组件重渲"传播，边界与 Suspense/资源读取的联动更直接。

### 10. (D) 设计：一个页面顶部导航、中间主内容（异步）、侧边推荐（异步），要求互不影响、任一崩只塌那块、还能各自重试。怎么摆边界？
**来源**：分区降级设计题的转述。

主内容与侧边各用一个 `<ErrorBoundary fallback={(e,reset)=><PanelError onRetry={reset}/>}>` 分区独立包（互不牵连），各自内配就近 `<Suspense>` 管加载；导航若无异步可不包或用更外层总边界兜。resource 失败优先各块内判 `x.error` 做温和提示，边界只兜未预判抛错。这样三块崩/加载互不干扰、可分别重试。

### 11. (B) 有人在 `createResource` 的 fetcher 里 await 之后手动 throw，说"这样就能被外层点击事件的边界接住"，哪里错了？
**来源**：异步抛错路径误解题的转述。

fetcher 里抛的错让 resource 进 `errored`（`resource.error`），只有当它**经 Suspense/渲染被读取冒泡**时才走到 ErrorBoundary——它压根和"点击事件的边界"无关，事件错误根本不被边界接（见第 2 题）。想让一次操作的失败上抛给边界，得让这次失败发生在**渲染/更新流**里（如 resource 读取），事件里的失败要就地 catch。

### 12. (C) 生产里除了 ErrorBoundary，还应配哪些错误兜底，才覆盖它接不到的那部分？
**来源**：错误兜底全景题的转述。

ErrorBoundary 覆盖不到"事件处理器、游离异步、未处理 Promise 拒绝"。生产要补：① `window.addEventListener('error')` 与 `unhandledrejection` 全局兜网 + 上报；② fetcher/副作用里对可预期失败主动 `try/catch` 转成 `resource.error`/返回错误态；③ SolidStart 服务端错误处理（L8）。三者与 ErrorBoundary 合起来才是完整错误防线。

🚀 实操请去做 L5 作业：复现事件错不被捕、reset 重试、多级降级、边界包 Suspense、行粒度边界五道题。
