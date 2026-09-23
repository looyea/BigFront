# svelte-spread-rest 面试题精选

> 共 12 题，覆盖 A 内置 props / B 透传与合并 / C 响应式与类型 / D 跨框架对照。

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
