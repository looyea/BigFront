# svelte-props 面试题精选

> 共 12 题，覆盖 A 声明与只读 / B 通信（上传/双向）/ C 内容与透传 / D 对照与最佳实践。

## 一、声明与只读（A 类）

### 1. Svelte 5 如何声明 props？和 Svelte 4 的 `export let` 有何区别？
用 `let { a = 默认值, b } = $props();`。区别：Svelte 4 的 `export let` 把变量"暴露为可写入口"、语义含糊；`$props()` 显式声明输入、集中解构、天然给默认值，且配合 runes 只读规则更清晰（呼应 svelte-props 第一节、svelte-overview 第四节）。
**来源**：Svelte 官方文档 — $props

### 2. 为什么 props 是只读的？想在子组件里改怎么办？
遵循**单向数据流**：数据由父向下单向流动，子擅自改会让来源不可追踪。要本地可变，显式拷进状态：`let local = $state(prop)`；要影响父，用回调或 `bind:`（呼应 svelte-props 第二节、react-component）。
**来源**：Svelte 官方文档 — props 只读、one-way data flow

### 3. 解构出来的 prop 变量，父组件更新后子组件还会响应吗？为什么？
会。编译器把每个 prop 处理成 **getter**，解构得到的是"响应式读取"，不是取一次快照；父改 `a`，子读 `a` 的地方会更新。但**不能对它赋值**（只读）（呼应 svelte-props 第一、二节）。
**来源**：Svelte 官方文档 — 解构 props 与响应性

## 二、通信：上传与双向（B 类）

### 4. 子组件如何向父传数据？`createEventDispatcher` 还用吗？
Svelte 5 推荐**回调 prop**：父传函数 `onXxx`，子组件 `onXxx?.(payload)` 调用。`createEventDispatcher` 属 legacy，新代码不再需要（呼应 svelte-props 第三节、react-component props 回调）。
**来源**：Svelte 官方文档 — createEventDispatcher 迁移到 props

### 5. `$bindable()` 是怎么实现双向绑定的？
子组件把某 prop 写成 `let { value = $bindable() } = $props();`，即"允许父用 `bind:value` 把它绑到父的响应式状态"。子组件内改 `value` 会回写父。没标 `$bindable` 的 prop 只能父→子（呼应 svelte-props 第四节）。
**来源**：Svelte 官方文档 — $bindable

### 6. `$bindable` 双向和 Vue 的 `v-model`、React 受控组件有何异同？
目标一致：让表单/组件的值父子同步。Vue 用 `v-model`（糖：`:modelValue`+`update:modelValue`）；React 靠"受控 `value` + `onChange`"手写；Svelte 用 `$bindable()` prop + `bind:` 指令，语法最接近"直接绑定变量"。三者都保持单一数据源（呼应 vue v-model、react-forms）。
**来源**：跨框架双向绑定对照（社区/官方）

## 三、内容与透传（C 类）

### 7. Svelte 5 里 children 怎么传进来、怎么渲染？和 `<slot>` 什么关系？
`children` 现在是一个 **snippet prop**：`let { children } = $props();` 后用 `{@render children?.()}` 渲染。它取代了 Svelte 4 的 `<slot>`，并支持**带参数、多个、命名**的 snippet，比 slot 更强（呼应 svelte-props 第五节、L3 svelte-snippet-children）。
**来源**：Svelte 官方文档 — Snippets、children

### 8. 未声明的多余属性怎么透传到根元素？
用解构 rest：`let { size, ...restProps } = $props();` 再 `<div {...restProps}>`（或 `$$restProps` 的等价）。常用于封装组件把未知属性转发给内部元素（呼应 L3 svelte-spread-rest、vue fallthrough attrs）。
**来源**：Svelte 官方文档 — $$props / $$restProps、spread

## 四、对照与最佳实践（D 类）

### 9. props 很多/深层对象时，性能上要注意什么？
props 是 getter，读到才建立依赖，未读不影响；但把大对象作为单个 prop 传递会牵动所有读取处。最佳实践：**细粒度传原始值**、必要时传回调而非整对象、配合 `$derived` 局部化更新范围（呼应 svelte-performance）。
**来源**：Svelte 性能与响应式粒度（官方/社区）

### 10. 事件类 prop（如 `onclick`）和自定义回调（`onsubmit`）有什么区别？
小写 `onxxx`（`onclick`/`oninput`）是**原生事件属性**，Svelte 5 里可直接当 prop 传给元素/组件、拿到的是 Event 对象；自定义 `onXxx`（大写驼峰）是你**约定的回调函数 prop**，参数自定。前者走 DOM 事件、后者是纯函数调用（呼应 svelte-events、svelte-props 第三节）。
**来源**：Svelte 官方文档 — Events 作为 props

### 11. 用 TypeScript 时 props 类型怎么给？
在 runes 下常见写法：`let { a, b }: { a: string; b?: number } = $props();`，或用接口/`interface Props` 注解解构结果；配合 `svelte-check` 与 IDE 校验（呼应 L7 svelte-typescript、02-typescript）。
**来源**：Svelte 官方文档 — TypeScript、props 类型

### 12. 为什么不建议用 `$effect` 去"同步 props 到本地 state"？
多数情况下直接把 prop 用于渲染即可，无需镜像到本地 `$state`；用 effect 同步会产生额外一轮渲染与"陈旧一帧"。只有确需"以 prop 为初值的独立可编辑副本"时才在初始化处 `$state(prop)`，而非用 effect 持续拷（呼应 svelte-reactive-runes 第九题、react 反模式）。
**来源**：Svelte 官方文档 — you shouldn't need an effect to sync props
