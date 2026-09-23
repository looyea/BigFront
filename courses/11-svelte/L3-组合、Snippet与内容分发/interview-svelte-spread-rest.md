# svelte-spread-rest 面试题精选

> 共 15 题，覆盖 A 内置 props / B 透传与合并 / C 响应式与类型 / D 跨框架对照。

## 一、内置 props 对象（A 类）

### 1. `$props()`、`$$props`、`$$restProps` 三者区别？
`$props()` 是 rune，返回**你解构声明**的 props（公开接口）；`$$props` 是父传来的**全部** props；`$$restProps` = 全部 − 已声明。解构过的 prop 会从 `$$restProps` 里消失（呼应 svelte-spread-rest 第一、四节）。
**来源**：Svelte 官方文档 — Special props ($$props / $$restProps)

### 2. `$$slots` 呢？为什么 Svelte 5 里见不到了？
`$$slots` 是 Svelte 4 判断插槽是否传入的对象；Svelte 5 中 snippet 就是普通 prop，`header != null` / `{#if header}` 即可判断，`$$slots` 随 slot 体系一起进入历史（呼应 svelte-snippet-children 第三节）。
**来源**：Svelte 5 迁移指南 — snippets replace slots

## 二、透传与合并（B 类）

### 3. 封装一个 Button 把多余属性透传给原生 `<button>`，怎么写？
`<script>let { variant='primary', children } = $props();</script>` + `<button class={variant} {...$$restProps}>{@render children?.()}</button>`。父传的 `disabled`、`aria-*`、`onclick` 都未声明 → 进 rest → spread 到原生元素（呼应 svelte-spread-rest 第一节）。
**来源**：Svelte 官方文档 — spread attributes

### 4. 父传 class、内部也有 class，Svelte 会自动合并吗？
**不会**。显式 `class` 写在 spread 之后会整体覆盖 spread 里的 class。惯用解：把 `$$restProps.class` 拆出来拼进内部 class（`class="ui-button {variant} {extraClass}"`），或从 spread 中剔除 class 后单独处理（呼应 svelte-spread-rest 第三节）。
**来源**：Svelte 组件库源码通行写法（class 合并）

### 5. spread 的属性顺序有什么语义？
**后写覆盖先写**：`<input type="text" {...rest} />` 允许外部覆盖默认 type；`<input {...rest} type="search" />` 则内部强制。利用顺序可做"默认值 ← 用户覆盖"或"不可协商属性"（呼应 svelte-spread-rest 第二节）。
**来源**：Svelte 官方文档 — spread 求值顺序

### 6. 事件监听器会被 `$$restProps` 带走吗？想拦截怎么办？
Svelte 5 事件就是小写属性（`onclick`），未声明的随 rest 一起透传。要拦截需在 `$props()` 里**解构出该事件**（它就不再进 restProps），内部包装后手动 `onclick={handleClick}` 挂上（呼应 svelte-spread-rest 第四节）。
**来源**：Svelte 5 官方博客 — 事件即 props

## 三、响应式与类型（C 类）

### 7. `$$restProps` 是响应式的吗？父改属性会怎样？
是——props 本身是经 getter 的活对象，父变更属性后，依赖 `$$restProps` 的 spread/表达式会更新。但注意别把它当"快照"解构进普通变量后再期待逐字段粒度（呼应 svelte-props 第三节、svelte-reactive-runes 第二节）。
**来源**：Svelte 官方文档 — props 响应性

### 8. TypeScript 下 rest props 的类型怎么处理？
`$$restProps` 类型宽泛（`Record<string, any>` 风格），取 `$$restProps.class` 需窄化断言；组件公开接口用 `$props<{...}>()` 泛型声明，透传部分可用 `svelte/elements` 的 `HTMLButtonAttributes` 交叉类型补齐（呼应 svelte-styling 第六节、L7）。
**来源**：Svelte 官方文档 — TypeScript 与 $$restProps

### 9. spread 到**组件**和 spread 到**元素**有区别吗？
有：`<Comp {...obj}/>` 把 obj 全部作为 props 传给组件（遵循组件自己的 $props 声明，多余进它的 $$restProps）；`<div {...obj}/>` 则按 DOM 属性/事件规则落到元素上。透传链中两类 spread 常配合出现（呼应 svelte-spread-rest 第二节）。
**来源**：Svelte 官方文档 — spread on components vs elements

## 四、跨框架对照（D 类）

### 10. 和 Vue 的 fallthrough attributes 相比，两种设计的利弊？
Vue **自动**把未声明属性（含监听器）落到子组件**根元素**，`inheritAttrs:false` 可关——封装省心但落点隐式；Svelte 全手动 spread——多写一行，但"属性去了哪、和谁合并"在模板里一目了然，多级转发也更可控（呼应 svelte-spread-rest 第六节、vue-component-basics）。
**来源**：Vue/Svelte 官方文档设计对照

### 11. React 的 `<Comp {...props}/>` 与 Svelte spread 有何异同？
机制同款（对象展开、后者覆盖前者）。差异在语义底座：React 每次渲染重新执行整个函数，props 是普通对象快照；Svelte 的 `{...$$restProps}` 编译成属性级更新，只 patch 变化的那个 DOM 属性（呼应 svelte-overview 第二节、react-conditional-render）。
**来源**：Svelte 编译器行为 + React 官方 JSX spread 文档对照

### 12. 什么情况下应该**避免**无脑 `{...$$restProps}`？
① 组件根不止一个元素、透传落点不明时——应显式命名 prop；② rest 里混着只有内部才该处理的事件需要拦截包装时；③ 想收敛公共 API、给使用者清晰类型契约时（rest 是"匿名大口"）。接口越显式越好，rest 用于"真·透传装饰器"场景（呼应 svelte-spread-rest 第五节）。
**来源**：组件库设计实践（API 显式化原则）

---

## 补充（新专题 13-15）

### 13.  $props()、$$props、$$restProps 三者定位分别是什么？Svelte 5 迁移中它们的角色变化？

三者定位：① $props()（rune，新）——在 .svelte 里读组件 props 的正规入口，返回 live 对象、可解构、解构即响应，取代 Svelte 4 的 export let；② $$props（保留的双美元符魔法）——包含所有当前 props 的对象（含已声明的），主要用于"需要整体快照/遍历所有属性"的少数场景；③ $$restProps——不含已声明 props 的剩余属性集，专为"透传给元素"设计。迁移角色变化：Svelte 4 时代用 export let 声明 + $$props/$$restProps 处理透传；Svelte 5 声明改 $props() 解构，但 $$restProps 仍是透传主力（rest 语义没变），而 $$slots（插槽判断）被"snippet 就是 prop"取代消失（对应既有 $$slots 去哪了题）。双美元符 vs rune 的心智：$$ 前缀是"编译器注入的特殊值"（非响应式 rune），$props() 是响应式原语——两者不是新旧对立而是职责不同（透传集合用 $$restProps、读具体 prop 用 $props）。加分句：能区分"rune（$ 前缀，参与响应式系统）与双美元符魔法值（$$ 前缀，编译器注入的辅助对象）"这两族——Svelte 5 没有把 $$restProps 也 rune 化，正是因为"剩余属性集合"不需要 signal 语义，这个保留说明官方对"响应式 vs 静态辅助"的边界划得很清（对应 spread-rest 关使用建议题）。

**来源**：Svelte 5 runes props 文档；$$props/$$restProps 现状；迁移指南

### 14.  spread 到元素与 spread 到组件行为有何不同？属性顺序与 class/事件的合并语义讲清楚。

spread 到元素：剩余属性直接落到 DOM 元素（aria/data/role/type 等），未知属性透传无障碍。spread 到组件：把属性作为 props 传给子组件（子用 $props 接收），等价于逐个 <Child a={x}>——rest 转发到子时走子的 props 契约。顺序语义：{...obj} 与其前后的显式属性按"书写顺序后者覆盖前者"合并（<div {...$$restProps} class=own> 会覆盖父传的 class，反之 <div class=own {...$$restProps}> 让父 class 覆盖内部）。class 特例：Svelte 对 class 有特殊合并——父传的 class 与组件内部 class 自动共存（不像其他属性那样覆盖），因为 class 常需并存；style 也逐属性合并（自定义属性/各 CSS 属性不互相抹掉）。事件：onclick 在 rest 里会随 spread 绑上，你要拦截就显式声明（quiz 已考，这里补机制：显式 onclick 覆盖 spread 带的、或反之按顺序）。加分句：能讲清"class/style 是合并、其余是覆盖"这一非对称规则——这是 Svelte 对"最常用于并存的两个属性"做的体贴特例，也是封装组件时"父 class 加不上/被吞"困惑的答案（对应既有"class 自动合并吗""spread 顺序语义"两题）。

**来源**：Svelte spread 文档；class 合并特殊处理；属性优先级

### 15.  什么情况下应该避免无脑 {...$$restProps} 全量透传？

该克制的场景：① 组件对某些属性有内部语义——全量 spread 会让父传的同名属性覆盖你的关键绑定（如你把 onClick 用于内部逻辑，又被 rest 里父的 onClick 覆盖，或反之意外吞了父意图）；② 多根元素/需要分发到不同内部元素——rest 只能 spread 到一个元素，把"可能包含 title/aria/占位"的属性一股脑给外层，可能挂错节点（应显式挑选转发给对应内部元素）；③ 会破坏内部结构的属性——如父传 children/某个你已用于 slot 的 snippet，再 spread 会重复渲染；④ 安全——不加甄别地把外部属性 spread 可能引入不期望的 inline handler/事件（对外部来源数据要白名单）。改进做法：显式挑选式转发（destructure 出你要的、rest 里剩下的再过滤）、对事件属性单独处理、复杂透传用"渲染 props/受控元素 API（headless）"把最终 DOM 交回调用方决定。加分句：全量透传是"省事的默认"，成熟的组件库对"哪些属性允许落到哪个节点"是白名单式的——把"闭着眼 spread"升级为"有选择地转发"，是能上生产的设计系统与玩具组件的分界（对应既有"什么时候应避免无脑 spread"题的展开）。

**来源**：组件 API 设计；rest 透传反模式；可访问性与事件冲突
