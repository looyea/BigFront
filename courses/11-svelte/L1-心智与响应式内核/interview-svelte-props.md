# svelte-props 面试题精选

> 共 15 题，覆盖 A 声明与只读 / B 通信（上传/双向）/ C 内容与透传 / D 对照与最佳实践。

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

---

## 补充（新专题 13-15）

### 13.  Svelte 5 的 props 是"单次同步"还是"响应式持续"？$bindable 双向在编译器层如何实现？

响应式模型：$props() 返回的是"live 对象"，解构出的变量在父更新对应 prop 时会被编译器同步刷新（不是只在初始化拿一次）——这是相对 Svelte 4 的关键改进（4 里解构会断链、要 export let + $: 或 rest）。$bindable 的实现：子组件把某 prop 声明为 $bindable()，父用 bind:x={state} 绑定；子内部对该变量赋值时，编译器生成的 setter 会回写父的 state（形成"父传值 + 子可回写"的双向）——本质是父把自己的 signal 访问器交给子，子写的是父的 signal。与 Vue v-model 对比：Vue 用 modelValue prop + update:modelValue 事件（显式一对），Svelte 的 bind: 是"同一变量的两端"（更贴近"共享 state"模型）；React 无内置双向，必手动 value+onChange（最显式）。工程红线：不要用 $effect 把 props 同步进本地 state（既有题的"不建议同步 props"），需要"以 prop 为初始值再本地可改"就用"受控/非受控二选一"或用 key 重置（{#key}）——$effect 同步会造成本地编辑被父覆盖的竞态。加分句：双向绑定看着省代码但把"数据流方向"变模糊，团队里应约定"默认单向、显式 bindable 才双向"，否则调试时找不出是谁改了谁（这是所有框架双向绑定的通病，不是 Svelte 特有）。

**来源**：Svelte 5 $bindable 文档；runes props 响应式设计；$effect 与 props 同步反模式讨论

### 14.  props 很多且含深层对象时，Svelte 的性能与心智要注意什么？

性能面：① 深对象 prop 会被 $state 深代理包裹（若作为响应式消费），大对象代理成本随访问深度上升——纯展示的只读大数据考虑 $state.raw 或干脆不做响应式（只在引用变化时更新，呼应 props 关"props 很多/深层对象性能"既有题）；② 解构 live 对象是浅响应——嵌套字段访问要经过代理，"传整个 config 对象只用两个字段"会让无关字段变化也参与依赖，宜拆细粒度 prop 或在子内 $derived 精确取用。心智面：③ props 是只读契约（要子改父用回调/bindable），把"我要改它"的字段设计成事件或 bindable 而非偷偷本地改；④ children/snippet 通道与 props 通道的选型——静态内容用 children、要回传数据给父决定渲染用带参 snippet（对应 props 关"三通道"既有题）。反模式：用一个巨型 props 对象承载整个页面状态（等于关掉细粒度响应，退化成"什么都重渲染"）——Svelte 的优势恰在细粒度，prop 拆得合理才能享受。加分句：prop 设计的质量在"变更频率与相关性"——同一 prop 里的字段应"一起变、一起读"，把不同变化节奏的字段塞一个对象是性能与可读性的双重税。

**来源**：Svelte props 性能讨论；fine-grained reactivity 与深代理成本；snippet children 文档

### 15.  未声明的额外属性透传（rest props 到根元素）在封装组件时怎么用？事件类 prop 与回调类 prop 的边界？

透传机制：Svelte 5 里"未在 $props() 声明"的属性不会自动消失，可用 rest 收集（let { children, ...rest } = $props()）再 {...rest} spread 到根元素，或 Svelte 的残余属性行为把未知属性透传（对应 spread-rest 关整组题）——封装 Button/Input 时这是"不把 aria-*/data-* 吞掉"的关键（可访问性属性必须能透到真实控件）。事件类 vs 回调类：onclick={fn} 是原生事件 prop（会真的 addEventListener 到根 DOM，且能被 rest 透传/被 spread 覆盖），而 onCustomEvent={fn} 之类"自定义回调 prop"不是 DOM 事件、只是普通函数属性（子手动调用）——两者都写 on 开头但语义完全不同（onclick 走 DOM 事件路径、onSubmit 走你自定义调用），混淆会导致"以为挂了其实没挂"。设计约定：封装组件对外接口要么用原生事件名（走 DOM）、要么明确文档"这是回调 prop 非事件"；混合时用 rest 透传原生事件 + 显式声明回调。加分句：这道题的隐藏考点是"封装组件的属性完整性"——一个好的 UI 原语必须让父能无障碍地塞进 aria/role/data/原生事件，否则下游要么包一层 div（破坏布局）要么放弃（可访问性债），这在设计系统里是硬指标。

**来源**：Svelte 5 spread / $$restProps 文档；事件 prop onclick 语义；可访问性透传实践
