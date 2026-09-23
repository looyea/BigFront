# svelte-actions 面试题精选

> 共 15 题，覆盖 A 契约与时机 / B 实战模式 / C 边界与陷阱 / D 对照与设计。

## 一、契约与时机（A 类）

### 1. 什么是 action？给出函数契约。
`use:x={param}` 让元素在**插入 DOM 后**立即调用函数 `x(node, param)`；返回对象可含 `update(newParam)` 与 `destroy()`。它是"元素级生命周期"的最小抽象——把可复用的 DOM 行为焊在模板上（呼应 svelte-actions 第一节）。
**来源**：Svelte 官方文档 — Actions

### 2. action 和 $effect 的执行时机差别？
`$effect` 在状态变化后的 flush 阶段跑、不保证节点已在文档（可能还在构建中）、由**数据**驱动；action 保证拿到**已挂载的真实节点**、由**元素存在性**驱动。测量尺寸、聚焦、挂第三方库都该用 action（呼应 svelte-reactive-runes $effect 节）。
**来源**：Svelte 官方文档 — action 与 effect 时机

### 3. action 参数变化时发生什么？
编译器检测到 `param` 表达式变化 → 若返回过 `update`，以新参数调用它；action 函数本身**不会重跑**、监听不会重挂。所以 update 里要自己处理"旧参数派生物"的替换（呼应 svelte-actions 第一、三节）。
**来源**：Svelte 官方文档 — action update

## 二、实战模式（B 类）

### 4. 手写 click-outside。
document 上（捕获阶段更佳）加 click 监听，`!node.contains(e.target)` 时回调；`destroy` 里移除。要点：捕获阶段 `true` 能先于元素自身 remove 生效；弹层+触发按钮同帧点击的经典误判要在回调里比对 target 或延迟绑定（呼应 svelte-actions 第三节）。
**来源**：Svelte 官方文档 action 示例；社区高频实现

### 5. 下拉菜单"点击外部关闭"你会用 action、还是 on:click window？
两者都可行，action 胜在**可复用+自动清理**（多菜单无样板）；一次性页面用 `bind:this` + onMount document 监听也行但难复用。团队级出现两次以上 → 抽 action（呼应 svelte-component-composition 第六节复用判据）。
**来源**：Svelte 组件库（Skeleton/melt-ui）源码惯例

### 6. 曝光埋点（元素进入视口触发一次）怎么用 action 实现？
action 内建 `IntersectionObserver`，`isIntersecting` 时执行回调并 `disconnect()`；`destroy` 里再兜底 disconnect。对比 hooks 方案（ref+effect+cleanup），action 一个函数全含（呼应 svelte-actions 第三节 expose 例）。
**来源**：MDN — IntersectionObserver；action 惯用法

## 三、边界与陷阱（C 类）

### 7. action 能用在组件标签上吗？为什么这样设计？
不能（编译错误）。action 的语义是"对**这个 DOM 元素**做命令式操作"，组件没有确定的根元素语义（多根/fragment），强行落到第一个元素会造成隐式困惑。需要时：组件内部元素自己用，或把 action 函数作 prop 传入（呼应 svelte-actions 第四节）。
**来源**：Svelte 官方文档 — actions 限元素

### 8. 同一个元素上多个 action 的执行顺序？和 bind/事件混有冲突吗？
按书写顺序初始化、逆序销毁（官方约定顺序执行）；多个 action 改**同一 DOM 属性**会互踩——同一属性只归一个所有者（模板绑定或某 action）。事件名重复（都 addEventListener click）则都能触发，注意别双绑逻辑（呼应 svelte-actions 第四节）。
**来源**：Svelte 官方文档 — 多 action 顺序语义

### 9. action 里能读写 $state 吗？SSR 呢？
能（action 函数是普通闭包，回调里读 `$state` 建立依赖、写它触发更新），但**别在 action 里用状态驱动渲染**——渲染归模板。SSR 阶段 action 根本不执行（无 DOM），所有 `window/document` 访问天然安全地留在函数体内，模块顶层仍别摸浏览器全局（呼应 svelte-actions 第四节、svelte-global-state 第四节）。
**来源**：Svelte 官方文档 — action 与 runes 交互

### 10. bind:this 与 action 都要拿节点，怎么分工？
`bind:this` 拿引用给**组件自己**用（调 focus()、读尺寸）；action 封装**可复用的行为**（带监听/observer/清理）。行为只有本组件用→bind:this 足够；跨组件复用→抽 action（呼应 svelte-template 第六节）。
**来源**：Svelte 官方文档 + 社区惯例

## 四、对照与设计（D 类）

### 11. action 与 Vue 自定义指令的逐项对比？
契约同构：`use:x`≈`v-x`、参数更新 `update(p)`≈`updated(el, binding)`、清理 `destroy()`≈`unmounted(el)`；Vue 还多一个 `created`（Svelte 无需要）。差异在绑定值语义：Vue 指令值是表达式响应式传入 binding，Svelte 是普通实参快照；Vue 指令可全局/局部注册，Svelte 就是 import 函数（呼应 svelte-actions 第五节）。
**来源**：Vue/Svelte 官方文档对照

### 12. 为什么说 "action ≈ DOM 行为复用，hook ≈ 状态逻辑复用"？给一个两者配合的例子。
hooks（React/Vue 组合式/Svelte runes 函数）复用的是**响应式状态+派生**（usePagination：page/total/next）；action 复用的是**节点上的命令式挂摘**（observer/监听/库实例）。典型配合：tooltip 组件内部用 runes 管 `visible` 状态（内容可交互），对外用 `use:tooltip` action 焊在任意元素上触发——行为与状态各归各位（呼应 react-custom-hooks、svelte-global-state 第二节）。
**来源**：Headless UI/Radix 组件设计思想平移

---

## 补充（新专题 13-15）

### 13.  action 与 $effect 都能碰 DOM，执行时机与适用边界分别是什么？

时机：action 在节点"被创建并插入 DOM 时"调用（拿到 node 引用那一刻），其 update 随参数、destroy 随节点移除；$effect 在组件 state 变化后的 flush 阶段跑（DOM 已更新，但作用域是"响应式依赖"而非"某个 DOM 节点的生命周期"）。适用边界：① 行为"绑定在某个 DOM 元素上、随其生灭、需要持有该节点引用做原生 DOM 操作/第三方库初始化"→ action（tooltip、longpress、点击外部、把图表库挂到某 div——对应"曝光/点击外部"既有题）；② 逻辑是"响应式数据变了要跑副作用（同步到任意地方）"→ $effect。关键差异：action 的"依赖"是它服务的 DOM 节点（元素没了自动 destroy），$effect 的"依赖"是它读到的 signal（数据不变不重跑）。加分句：一个记忆锚——"action 回答『这个元素发生了 DOM 级的事』，$effect 回答『这些数据变了做点事』"；当一个需求既有节点生命周期又有响应式数据时，常见模式是 action 管节点、内部读写 $state（既有"action 里能读写 $state 吗"答案是能），两者不是竞争是分层。

**来源**：Svelte actions 文档；$effect 时机；action vs effect 选型

### 14.  为什么说 action ≈ DOM 行为复用、而 hooks 是逻辑复用？action 与 Vue 自定义指令的逐项对比。

定位：action 把"对某个 DOM 元素施加的可复用行为"封装成一个函数（click-outside、draggable、tooltip、自动聚焦），跨组件复用同一套"元素级行为"——这是 DOM 行为复用。React hooks 是"有状态逻辑复用"（可在任意组件用、管的是渲染与 state），不专属于某个 DOM 节点，碰 DOM 要靠 ref——两者抽象层级不同（既有"action 与 hooks 定位差异"题）。与 Vue 指令逐项对比：Vue 指令 v-xxx 有钩子（created/mounted/updated/unmounted 等更多档位），Svelte action 只有"调用 + update + destroy"三段（更精简，update 对应 Vue 的 updated）；Vue 指令可全局注册、作用域广（也能操作组件级），Svelte action 就是普通函数（import 即用，和组件注册哲学一致，对应 composition 关"无全局注册"）；传参 Vue 用 value/arg/modifiers、Svelte 用第二参对象 + update。加分句：把三者放一条轴——"距离 DOM 的远近 × 是否可复用"：action/Vue 指令都是"贴着元素生命周期"的 DOM 行为抽象，React hooks 是"贴着组件渲染"的逻辑抽象；Svelte 里 DOM 行为用 action、逻辑用 runes+函数组合，职责分离得比"用 useEffect 兼顾两者"更清晰（呼应既有"action 与 Vue 指令逐项对比"题）。

**来源**：Svelte action 设计；Vue 自定义指令（mounted/updated/unmounted）对照；行为复用模式

### 15.  同一元素上多个 action、以及 action 与 bind/事件的执行顺序与协作坑，怎么理清？

执行顺序：同一元素多个 action 按"书写顺序"依次调用（初始化序），destroy 通常逆序或按实现约定——依赖彼此初始化先后时要警惕（尽量让 action 相互独立）。与 bind:this：两者都能拿节点——action 在节点就绪即以参拿到（最早、最自然），bind:this 在挂载后才有值（既有"bind:this 与 action 都要拿节点怎么分工"题）：需要"元素一存在就跑这段 DOM 逻辑"用 action，需要"组件里持有引用供后续命令式使用"用 bind:this。与事件：action 内部常 addEventListener（click-outside 就是挂 document click），注意与模板上的 on:click 不冲突但要注意捕获/冒泡阶段（action 里用 capture 可抢在元素自身 handler 前）。参数坑：longpress(node, cb) 里父换了 cb 函数，若不实现 update，action 拿的还是旧 cb（闭包捕获初始化那次）——要 update 里重新绑定（既有"父换了回调"题）。加分句：action 的坑几乎都是"生命周期与捕获"问题——它只在挂载那一次拿到 node 与初始 params，后续变化要么靠 update 要么靠自己订阅 $state；把 action 想成"一个针对该节点的迷你组件（有 create/update/destroy）"就能预判所有时序，而不是把它当一次性函数调用。

**来源**：Svelte action 顺序；bind:this 与 action 拿节点分工；事件与 action 交互
