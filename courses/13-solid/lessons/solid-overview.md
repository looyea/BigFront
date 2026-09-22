# Solid 是什么：细粒度响应式 + 编译期 JSX、无虚拟 DOM

> 目标：建立 Solid 的两条支柱心智——**signal 细粒度响应式**（更新只精准命中真正依赖它的那一个订阅者，而非重跑组件）与**编译期把 JSX 拆成命令式 DOM 操作**（组件挂载时执行一次、之后默认不再执行）；把这套与 React 的"重执行整函数 + diff"、Svelte 的"编译器消灭 runtime"三方对照清楚，说清何时该选 Solid、何时不该（呼应 svelte-overview、react-render-model、solid-signals）

## 一、一句话抓住 Solid

Solid 常被称为"长得像 React 的 Svelte"，但这话只对一半。更准的说法是：**Solid = 保留 JSX 写作体验 + 细粒度响应式内核 + 编译期把视图拆成一次性 DOM 命令**。它同时借了两家的东西——API 形态像 React（`createSignal` 而非 `$state`、JSX 而非模板），运行时理念像 Svelte（编译优化、没有虚拟 DOM 常驻 diff）。

两条支柱撑起整个框架：

1. **细粒度响应式（fine-grained reactivity）**：状态是 signal，读 signal 的"订阅者"（effect、memo、DOM 绑定）被自动登记；写 signal 时，**只有真正读了它的那些订阅者**被通知。改一个属性，就只更新那一个属性对应的文本节点/attribute，不牵连其它。
2. **编译期 JSX**：`.jsx` 里的组件经 Babel/SWC 编译后，JSX 模板被拆成"建 DOM 的命令 + 把某些节点用 effect 绑到 signal"。于是**组件函数只在挂载时执行一次**，返回的是真实 DOM 节点；后续更新由细粒度订阅直接打补丁，**没有第二次渲染**。

## 二、"无虚拟 DOM"到底省掉了什么

React 的更新模型（05-react）：状态变 → **重新执行整个组件函数** → 产出新的虚拟 DOM 树 → 与上棵树 diff → 把差异打到真实 DOM。即便你只改了一个数字，函数体也整个又跑了一遍，虚拟树也整个重建又比对了一遍。

Solid 没有这两步：

- 不**重跑组件**：组件是"搭建一次性结构"的工厂，跑完就把该订阅的地方交给响应式系统；
- 不建**虚拟树**、不 diff：改 `count` 只让绑定了 `count()` 的那个文本节点更新，官方文档的原话是"in Solid, updates are made to the targeted attribute... In contrast, React would re-execute an entire component for a change in the single attribute"。

省下的是**常驻的 diff 开销与整组件重渲染的连带成本**——这也是 Solid 在 JS Framework Benchmark 一类榜单长期靠前的根因。

## 三、"组件只执行一次"意味着什么

这是最需要完成心智切换的一点，后面每一关都会反复兑现它：

- `props` 不是"每次渲染传入的新快照"，而是**惰性 getter**：你在函数里读 `props.x` 拿当下值，解构它则脱离响应（`const { x } = props` 会定格）。
- 函数体里的 `if`/`map`/普通表达式**只跑一次**——所以"条件渲染/列表"不能靠 JS 原生 `&&`/`.map` 表达（那只在首次执行求值），要用 Solid 的**控制流组件** `<Show>`/`<For>`（L3）。
- 副作用不靠"每次渲染后跑"的 `useEffect` 语义，而是 `createEffect`（依赖变化才重跑）与 `onMount`（挂载一次），见 L2。
- 想"随状态重算"，正确姿势是**派生**：`createMemo`（L2）或直接内联表达式（Solid 会自动追踪），而不是重渲组件。

一句话：在 React 里你思考"这次渲染长成啥样"，在 Solid 里你思考"哪一小块数据变了、谁订阅了它"。

## 四、三方对照：React / Svelte / Solid

| 维度 | React | Svelte 5 | Solid |
| --- | --- | --- | --- |
| 写作形态 | JSX | 自有模板 + runes | JSX |
| 响应式内核 | 无内置，靠重渲 | runes（$state/$derived/$effect）signals | createSignal/Memo/Effect signals |
| 更新方式 | 重跑组件 + vdom diff | 编译器生成精确更新 | 细粒度订阅直接打 DOM 补丁 |
| 组件重执行 | 每次都重跑 | 不重跑（编译期消灭） | **不重跑（只执行一次）** |
| 运行时体积 | 有（react-dom 常驻） | 极小 | 小（细粒度 runtime，无 diff） |
| 列表/条件 | `.map`/`&&` 天然 | `{#each}`/`{#if}` | **需 `<For>`/`<Show>`** |

Svelte 和 Solid 是"编译器派"的两条分支：**都真细粒度、都不重渲组件**；差别在 Svelte 用自有模板语法把编译器权力拉满（几乎不留 runtime），Solid **保留标准 JSX**、运行时留一个很轻的 signal 图 reconciler（呼应 11-svelte 的 svelte-overview、10-vite 的编译时 vs 运行时框架之辨）。React 是"运行时派"代表，靠虚拟 DOM 换来了"随便写、状态驱动重渲"的简单心智，代价是连带 diff。

## 五、何时选 Solid（以及何时别）

**适合**：对**运行时性能/包体**极敏感、交互密集但列表/表单结构可预期的应用（仪表盘、编辑器、高频更新 UI）；团队喜欢 React 式 JSX 但不想为 vdom 买单；愿意接受"执行一次、显式管理追踪"这套心智。

**要掂量**：生态与人力储备不如 React/Vue 厚；招聘/上手有学习曲线（细粒度心智、控制流组件、追踪丢失的坑很多来自 React 惯性，L9 专讲迁移）；大量"每次渲染即重算"的现成 React 组件直接搬过来语义会变。框架收益 < 迁移/学习成本时，留在 React 优化是正解——决策框架分高下，站队表态分低下（呼应 kit-overview 的框架选型四问）。

## 六、自检清单

1. 用两句话说清 Solid 的两条支柱，各自"省掉了 React 的哪一步"。
2. "组件只执行一次"会带来哪三个直接后果（提示：props 读取方式、条件/列表渲染、副作用语义）？为什么这决定了你必须用 `<Show>`/`<For>` 而不是 `&&`/`.map`？
3. 官方文档如何用"targeted attribute vs re-execute entire component"对比 Solid 与 React？举一个改单个数字的例子说明各自发生什么。
4. Svelte 与 Solid 同属编译派，二者最主要的差别是什么（模板语法 vs 保留 JSX / runtime 有无）？React 属于哪一派、靠什么换来了简单心智？
5. 给出一个"该上 Solid"和一个"劝你别折腾"的真实场景，并用"收益 vs 迁移成本"讲清判断依据。

🚀 下一关：solid-signals——把第一根支柱落到 API 上：`createSignal` 的 getter/setter 元组、为什么读值要写 `count()`、什么写法会悄悄丢失响应。
