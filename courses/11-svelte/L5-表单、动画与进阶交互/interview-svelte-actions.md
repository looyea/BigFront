# svelte-actions 面试题精选

> 共 12 题，覆盖 A 契约与时机 / B 实战模式 / C 边界与陷阱 / D 对照与设计。

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
