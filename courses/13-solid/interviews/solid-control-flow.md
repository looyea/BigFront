# solid-control-flow 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 为什么 Solid 不能像 React 那样用 `.map` 和 `&&` 渲染会变的数据？
**来源**：一次性 JSX 求值题的转述。

组件只执行一次，JSX 里的 `{items().map(...)}`、`{cond && <X/>}` 也只在组件执行那瞬求值一次，产出一个固定结果；之后 `items`/`cond` 变化没有谁去重算这段。控制流组件 `<For>/<Show>` 内部各建 `createMemo`，在 `each`/`when` 变化时做**最小 DOM 协调**，才是"会变"的正解。

### 2. (A) `<For>` 底层是什么？它"记忆"了什么、什么情况下才重建某行 DOM？
**来源**：For/mapArray keyed 题的转述。

`<For>` 调 `mapArray`（keyed 协调），整体包在 `createMemo` 里，`each` 变了才惰性比对。它为**每个 item 身份**建立响应式并记住 item→DOM 的映射：**只有 item 引用（身份）变化才重挂那块 DOM**；纯增删/重排只移动已有节点、更新 index 访问器，不重建。这就是"改一行不刷全表"的机制。

### 3. (C) `<For>` 和 `<Index>` 的回调参数为什么"正好相反"？分别何时用？
**来源**：keyed vs 位置式对比题的转述。

`<For>`：`(item, index)` —— item 是**值**、index 是**访问器**(`index()`)，按身份绑定；`<Index>`：`(item, index)` —— item 是**访问器**(`item()`)、index 是**静态数字**，按位置绑定。有稳定 id、会重排/含输入框（要保 DOM 状态）用 `<For>`；纯按下标、item 是原始值或无稳定 id 用 `<Index>`。

### 4. (B) 一个列表每行有可编辑输入框，用户频繁重排，用 `<Index>` 出现"编辑内容串位"，为什么？
**来源**：Index 位置绑定错乱排坑题的转述。

`<Index>` 位置即身份：交换两行时**DOM/owner 留在原位、只更新 item 访问器指向新值**，输入框里用户已输入的、未同步到数据的内容就会"看起来跑到别的行"。含局部 DOM 状态（焦点、未提交输入）的可重排列表应改用 `<For>`（keyed 把 DOM 锁到 item 身份，重排时整块 DOM 跟着搬）。

### 5. (A) `<Show when={x}>{v => ...}</Show>` 非 keyed 和 `keyed` 两种回调形态的区别？
**来源**：Show 收窄与 keyed 题的转述。

非 keyed：回调收到**收窄后的 accessor**（`v()`），条件转假后再读它会**抛错**，节点不因此重建——v1.7 为 TS 类型收窄引入。keyed：回调收到**值本身**，且 `when` 每次变成新值就**重建** children。要"值变即重画"用 keyed，要"类型安全窄化且不重建"用非 keyed 回调。

### 6. (B) `<Show when={arr().length}>` 想"空数组才显示占位"，逻辑对吗？怎么改更清晰？
**来源**：when 真值语义排坑题的转述。

`when` 判 truthy：空数组 `length` 为 0（falsy）时反而显示 children、非空显示 fallback，容易写反。更清晰：`<Show when={arr().length===0} fallback={<List/>}><Empty/></Show>`，或直接 `<Show when={arr().length>0} fallback={<Empty/>}><List/></Show>`。要点：`when` 是布尔条件不是"数量"。

### 7. (A) `<Switch>`/`<Match>` 比嵌套三元强在哪？fallback 何时用？
**来源**：多分支控制流题的转述。

`<Switch>` 渲染**第一个 `when` 为真的 `<Match>`**，都不真用 `fallback`。相比一长串 `a?x:b?y:...` 三元：可读、每个分支各自惰性建订阅、不会"一次求值全展开"，也便于加/删分支。多状态机（loading/error/empty/ok）首选它。

### 8. (C) React 用 `key` 解决列表重排身份问题，Solid `<For>` 的 keyed 和它是一回事吗？
**来源**：跨框架 key 语义对比题的转述。

目标类似（稳定身份→DOM），机制不同：React 的 `key` 是 diff 算法提示，组件仍整体重渲、靠 key 复用元素；Solid `<For>` 的 keyed 是**运行时真的把 item 身份映射到一块持久 DOM/computation**，身份不变就不重建、也不重跑渲染函数。Solid 无需你手写 key——它以数组元素的**引用**为身份（要稳定身份就别每次造新对象）。

### 9. (B) 用 `<For each={list}>` 时每次过滤都传新数组，会不会全表重建？怎么避免无谓重建？
**来源**：identity 稳定性题的转述。

`<For>` 以**元素引用**为身份：只要过滤/映射尽量**复用同一批 item 对象**（filter 返回的是原对象引用，天然复用），增删/重排只移动节点、重建真正新增/移除的项。要避免的是"每次 `.map` 造一堆全新对象"——那会让 keyed 认为是新身份、全量重挂。配合 `createMemo` 缓存派生数组，只在源变化时产出。

### 10. (D) 场景：聊天列表，新消息高频 append、偶尔撤回中间一条、每条是组件有本地动画状态。选 For 还是 Index？怎么组织？
**来源**：高频增删列表设计题的转述。

用 `<For>`（keyed）：消息有稳定 id、每条要保留自己的 DOM/动画，append 只在末尾挂新节点、撤回中间条只摘那一条，其余不动。数据用 signal 存数组或 store，配合在稳定对象引用上更新；避免每次 new 整条消息对象。列表根用 `<For each={messages()} fallback={<Loading/>}>`。

### 11. (A) `<Suspense>`/`<ErrorBoundary>` 算不算控制流组件？它们和 For/Show 有什么共同点？
**来源**：控制流家族定位题的转述。

算同族。官方源码里 Show/Switch/ErrorBoundary 与 For/Index 一起构成"JSX 控制流标签"，都用 Owner/响应式机制把 UI 形状组合出来：`<Show>` 管真假、`<For>` 管集合、`<Suspense>` 管"资源 pending 时显示 fallback"、`<ErrorBoundary>` 管"后代抛错时显示 fallback"。共同点是**声明式、按响应式状态增删/替换子树**，而非命令式操作 DOM。

### 12. (C) 把一段 React `{cond ? <A/> : <B/>}` 和 `list.map(...)` 迁到 Solid，正确落地是什么？
**来源**：迁移改写题的转述。

条件：`{cond ? <A/> : <B/>}`（若 cond 会变）改成 `<Show when={cond()} fallback={<B/>}><A/></Show>` 或 `<Switch>`；列表：`list.map(...)` 改 `<For each={list()}>`，注意 Solid 不需要 `key`（以引用为身份）。若数据确为常量、永不变，`.map`/三元保留也无妨——区别只在"会不会变"。核心是把"会变"的分支/集合交给控制流组件建立订阅（呼应 react-to-solid-migration）。

🚀 实操请去做 L3 作业：复现 .map 冻结、Index 位置串位、Show keyed/非 keyed、For 身份稳定四条线。
