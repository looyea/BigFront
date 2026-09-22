# solid-overview 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 用一句话概括 Solid 的更新模型，并说明它和 React 的根本分野。
**来源**：Solid vs React 渲染模型高频开场题的转述。

Solid 是"细粒度响应式 + 编译期 JSX"：状态是 signal，谁读了谁订阅，写时只通知那些订阅者，直接打对应 DOM 补丁；组件挂载时执行一次、之后不重跑。React 是"运行时派"：状态变就重执行整个组件函数、重建虚拟 DOM 再 diff。根本分野在于**有没有'整组件重渲染 + vdom diff'这一层**——Solid 把它删了，代价是你要显式尊重"执行一次、按读订阅"的心智。

### 2. (A) 既然都没有虚拟 DOM，Solid 和 Svelte 有何区别？
**来源**：编译派内部对比题的转述。

两者都是编译器派、都真细粒度、都不重渲组件。差别：Svelte 用**自有模板语法**把编译器权力拉满、产物里几乎不留框架 runtime；Solid **保留标准 JSX**，运行时仍有一个很轻的 signal 依赖图 reconciler。选型常落在"愿不愿意接受自有模板（Svelte） vs 想留住 JSX/React 式写作（Solid）"上（呼应 svelte-overview、10-vite 编译时 vs 运行时框架）。

### 3. (B) 面试官写 `const { title } = props;` 然后期望 title 随父组件更新，为什么不灵？
**来源**：Solid props 解构陷阱题的转述。

Solid 组件只执行一次，`props` 是**惰性 getter 对象**：`props.title` 每次读拿当下值，但解构 `const { title }` 是在首跑时取了个**定格快照**。要响应就别解构、直接读 `props.title`，或用 `createMemo` 暴露派生值（呼应 solid-signals 的"丢失响应"一节）。

### 4. (C) "组件只执行一次"会颠覆 React 工程师的哪三个习惯？
**来源**：React→Solid 心智迁移题的转述。

① 别指望"改 state 整个函数重跑"——想要随状态重算得靠 memo/内联读；② 别用 `&&`/`.map` 做条件与列表（那只在首跑求值），要用 `<Show>`/`<For>`；③ 别把 `useEffect` 那套"每次渲染后跑"搬来——Solid 的 `createEffect` 只在依赖真变时跑、且不用于派生。核心从"这次渲染长啥样"切到"哪块数据变了、谁订阅了它"。

### 5. (A) 官方说"React 为一个属性变化重跑整个组件"，在真实大型列表里这为什么贵？Solid 又贵在哪？
**来源**：性能权衡深度题的转述。

React：一个 item 内部字段变，若没 memo/虚拟列表，父列表组件函数连同 map 整段重跑、生成大量 vnode 再 diff——O(整列表) 的 JS 开销。Solid：只更新那个字段对应的文本节点，O(1)。但 Solid 也非免费：它的成本转移到**建响应式图的订阅**与心智——大量细粒度 signal/memo 本身占内存，写不好会过度订阅；且组件不重跑意味着"命令式初始化逻辑"要靠 effect 管理。二者是"运行时 diff 成本"与"订阅管理成本"的取舍。

### 6. (D) 产品要你在 React/Svelte/Solid 间给一个内部中台的选型建议，你怎么答？
**来源**：框架选型决策题的转述。

先看约束：中台重表单/表格/高频局部更新、且团队已熟 React → Solid 的 JSX 亲和 + 细粒度对表格友好，值得试点；若要大量现成 React 生态组件（复杂编辑器/图表）→ 迁移成本压过收益，留 React 优化更稳；团队小、要上手快生态全 → 别选最小众的 Solid。落到"收益 vs 迁移/学习成本"三问（呼应 kit-overview 框架选型四问），给可回退的试点方案而非一步到位。

### 7. (C) Solid 保留了 JSX，那它对 JSX 做了什么"手脚"？
**来源**：JSX 编译去向题的转述。

普通 JSX 在 React 里每次渲染都被编译成 `createElement` 调用重建元素；Solid 用 Babel/SWC 插件把 JSX **一次性**编译成"创建真实 DOM 的命令 + 把其中会变的插值/属性包成小型 effect 绑到 signal"。所以模板里的 `count` 只在首跑建节点、之后 `setCount` 只驱动那个绑定 effect 更新文本节点，不重建元素（呼应 solid-effect-tracking、L9 internals）。

### 8. (B) 新人把 React 的 `<ul>{items.map(i=><li key=...>{i}</li>)}</ul>` 原样搬进 Solid，说"能跑但列表不更新"，为什么？
**来源**：map 与 For 差异题的转述。

组件只执行一次，`items.map(...)` 在首跑时按当时的 items 建了一批 DOM，之后 items 这个 signal 变了也**没人重跑这段 map**，所以列表冻结。要用 `<For each={items()}>`——它把"数组变化→增删/移动 DOM、复用节点"的协调逻辑封成了响应式控制流组件（呼应 solid-control-flow）。

### 9. (A) 为什么 Solid 不需要 `key` 也能高效更新列表？`<For>` 到底"记忆"了什么？
**来源**：keyed 控制流原理题的转述。

Solid 的 `<For>` 本就是 **keyed**：它为每个 item 记录其对应的 DOM 与回调作用域，item 恒等（引用相等）时直接复用那一份、不重跑 row 组件——这源自细粒度：改某个 item 只更新它自己。它"记忆"的是 每个数据项 → 已建 DOM/effect 的映射。和 React `key` 的差别：React 的 key 是给 vdom diff 提示复用，Solid 是天生按引用协调、无整树 diff（呼应 solid-control-flow、react-lists-keys）。

### 10. (D) 如何向非前端同事解释"信号(signal)"，并说明它在 Solid UI 里更新到什么粒度？
**来源**：概念外化表达题的转述。

比喻：signal 像"一个会广播自己变化给关注者的变量"——你读它，就等于'订阅'了它；你改它，只有订阅过它的东西被通知。粒度：更新到**具体的那个绑定**——比如某个文本节点、某个 class、某个属性，而不是"某个组件"。这也是为什么 Solid 里一个计数器只改一个数字、不会牵动同页面的别的东西。

### 11. (C) 有人说"Solid 性能一定碾压 React"，你作为工程师怎么严谨回应？
**来源**：性能论断去魅题的转述。

基准里 Solid 常胜（无 vdom、真细粒度），但"一定碾压"不严谨：① 很多业务的瓶颈在**数据获取/渲染量/主线程 IO**，不在框架 diff；② Solid 的收益要求你**写对细粒度**（乱建大 store、在循环里塞 signal、过度订阅会把优势吃掉）；③ React 有 memo/虚拟列表/编译器(RSC/React Compiler)等追平手段，生态优化空间大。正确表述：**同等信息量与用心程度下，Solid 的运行时地板更低、更少踩坑式退化**。

### 12. (B) 团队从 React 迁 Solid，代码 review 时你最该盯的三类"React-ism 残留"是什么？
**来源**：迁移评审清单题的转述。

① 把 signal 当 state 用：`const v = count()` 到处取快照、或解构 props → 丢失响应；② 用 `&&`/`.map` 做条件/列表（应 `<Show>`/`<For>`）、用 effect 做派生（应 memo）；③ 照搬 `useEffect` 依赖数组心智与"每次渲染后跑"预期，忽略 Solid 的同步按读追踪与异步追不到（`setTimeout`/await 里读）。建议配 ESLint 规则与一页"React→Solid 对照表"降低回退（呼应 react-to-solid-migration）。
