# svelte-template 面试题精选

> 共 15 题，覆盖 A 控制块 / B 列表与 key / C 异步与工具标签 / D 编译与对照。

## 一、控制块（A 类）

### 1. Svelte 模板有哪几种控制块？各自作用？
`{#if}/{:else if}/{:else}` 条件；`{#each}/{:else}` 列表（空态用 `{:else}`）；`{#await}/{:then}/{:catch}` 对 Promise 建模；`{#key}` 按值变化重建。它们都是**块级标签**、由编译器转成条件/循环 DOM 逻辑（呼应 svelte-template 二~五节）。
**来源**：Svelte 官方文档 — Template syntax、if/each/await/key

### 2. `{#if}` 和 React 的 `cond && <A/>` 相比有什么好处？
`{#if}` 是显式块，不会像 `&&` 那样把左侧的 `0`/`''`/`false` 意外渲染到页面；语义更接近 Vue `v-if`，可读性也更好（呼应 svelte-template 第二节、react-jsx）。
**来源**：Svelte 官方模板语法对照社区讨论

### 3. 模板 `{ }` 里能写语句吗？为什么？
不能，只能写**表达式**。因为插值要产出一个值写进文本节点；`if`/循环这类语句用专门的 `{#if}`/`{#each}` 块表达，编译器据此生成结构。这点与 JSX 的 `{}`（也是表达式）一致（呼应 react-jsx、svelte-template 第一节）。
**来源**：Svelte 官方 — Expressions、JSX in Depth

## 二、列表与 key（B 类）

### 4. keyed each `{#each list as item (item.id)}` 为什么重要？
括号里的 key 告诉编译器"哪条数据对应哪个 DOM"。插入/删除/排序时它只**移动**已有节点、复用正确的 DOM 与局部状态；不写 key 则退化到按索引，容易串状态（呼应 react-lists-keys、svelte-template 第三节）。
**来源**：Svelte 官方文档 — keyed each blocks

### 5. 用索引当 key 会出什么问题？和 React 一样吗？
本质相同：头部插入/删除或重排时，索引对应的元素变了，导致 DOM 复用错乱、输入框内容/动画/局部状态"串到别的行"。React 与 Svelte 都建议用稳定唯一 id 作 key（呼应 svelte-template 第三节、react-lists-keys）。
**来源**：React/Svelte 官方关于 index-as-key 的告诫

### 6. `{#each}` 能对对象用吗？怎么写？
可以：`{#each Object.entries(map) as [k, v] (k)}`；Svelte 也支持对象解构 `as { id, name }` 与索引 `as item, i`（呼应 svelte-template 第三节）。
**来源**：Svelte 官方文档 — each 解构与对象

## 三、异步与工具标签（C 类）

### 7. `{#await}` 相比手动写 loading/error 有什么优势？
把"pending / then / catch"三态收敛进一个语法块，直接对 Promise 求值，省去自建 `isLoading`/`error` 状态与 try/catch 样板。等价于把 Vue `<Suspense>` + 手动错误处理内建化（呼应 svelte-template 第四节、vue-effect/async-suspense）。
**来源**：Svelte 官方文档 — await blocks

### 8. `{@const}`、`{#key}`、`{@debug}` 分别什么时候用？
`{@const}`：块内派生局部常量（如每行算个小计），不外泄到脚本作用域；`{#key}`：值变化时销毁重建内部（强制重置组件/重播动画）；`{@debug}`：开发期打印响应式值，构建时移除（呼应 svelte-template 第五节、`$inspect`）。
**来源**：Svelte 官方文档 — const/key/debug 标签

### 9. `{@html}` 的风险与替代？
`{@html}` 按原始 HTML 插入，**不转义**，插入不可信内容会 XSS。替代：优先用文本插值 `{x}`（自动转义）；确需富文本时先在服务端/用 DOMPurify 之类消毒（呼应 react-jsx 自动转义、svelte-template 第一节）。
**来源**：Svelte 官方文档 — html 标签与 XSS 警告

## 四、编译与对照（D 类）

### 10. `bind:this` 拿到的引用什么时候可用？会触发渲染吗？
组件挂载后（`onMount`/`$effect` 首次运行时）才有值，之前是 `undefined`；它只是保存引用，**改变它不触发响应式更新**（呼应 svelte-template 第六节、react-refs、vue-refs-expose）。
**来源**：Svelte 官方文档 — bind:this

### 11. 这些模板块最终被编译成什么？
编译成命令式 JS：条件块生成创建/销毁节点的逻辑、each 生成带 key 的 diff 化列表维护、await 生成 `.then/.catch` 订阅；运行时无虚拟 DOM 参与（呼应 svelte-overview 第一节、svelte-compiler-architecture）。
**来源**：Svelte 编译器输出（svelte.dev/repl 编译产物）

### 12. 与 Vue 模板指令相比，Svelte 模板的取舍是什么？
Vue 用指令（`v-if`/`v-for`/`:key`）贴在元素上、更贴近 HTML；Svelte 用 `{#块}` 把结构显式包裹、逻辑与标记分区更清晰。两者都被编译成 render/DOM 逻辑，心智可互相映射（呼应 vue-template-syntax、svelte-template 第七节）。
**来源**：Svelte/Vue 模板语法对照（官方文档）

---

## 补充（新专题 13-15）

### 13.  {#each} 的 keyed 与 unkeyed 在 diff 策略与 DOM 复用上差别是什么？为什么列表动画强依赖 key？

unkeyed：Svelte 默认按位置索引复用 DOM——中间删一行会导致从删除点起所有后续行的 DOM 被"就地改写"（复用错的节点、状态跟着错位），且 transition/animate 拿不到"元素身份"无从计算 FLIP。keyed（each list as item (item.id)）：给每项稳定身份，diff 时按 key 匹配节点，仅移动/增删真正变化的节点（对应 performance 关"无 key 删一行发生什么"题）。动画强依赖 key：animate:flip 与 transition 的进出场必须知道"哪个 DOM 对应哪个数据项"才能"保留这个节点并补间"，没 key 时项身份不明 → flip 无法定位前后位置（对应 transitions 关"flip 工作前提"题）。key 选取铁律：必须稳定唯一且与数据绑定（用 id 不用 index——用 index 等于退回 unkeyed 语义，既有题的"索引当 key 最典型问题"即此）。加分句：能说出"keyed 不只影响正确性还影响性能（复用 vs 重建 DOM 的成本）与可访问性（焦点/滚动位置在错乱复用下会跳）"——把 key 从"React 要求我们加的东西"理解成"给编译器身份合同"，是编译器系框架的心智门槛。

**来源**：Svelte each 块 keyed 文档；animate:flip 与 key 依赖；template 关既有"索引当 key 问题"深化

### 14.  {#await}/{:then}/{:catch} 相比手写 loading/error 状态好在哪？它的边界与常见误用？

优势：把"一个 promise 的三态"内聚成一个模板块——pending/fulfilled/rejected 各写各的 UI，无需在 script 里维护 loading/error/data 三变量 + try/catch + 竞态守卫；模板即状态机，可读性高（对应既有"await 相比手动 loading/error"题）。边界与误用：① await 块不会自动处理竞态——若 promise 来源是响应式表达式，快速切换会并发多个 promise，旧 promise 后到可能覆盖新的（需要在数据层取消/去重，模板层不解决）；② 它不跨组件传递"挂起"（不像 React Suspense 能冒泡到上层 boundary），是局部块；③ SSR 下 await 的 pending 分支参与服务端渲染语义（水合期与 promise 的交互需谨慎，呼应 ssr-hydration 关）；④ {:catch} 里裸 error 直显有信息泄露风险（对应 error-boundary 关"生产不直显 error"题）。加分句：await 块适合"组件自己发起的一次性异步渲染"，不适合做全局数据获取骨架（那是 Kit 的 load + streaming 层）——把"局部异步 UI 糖"与"数据加载架构"分清，才不会拿 await 块去解决本该在 load 解决的问题。

**来源**：Svelte await 块文档；promise 渲染最佳实践；与 Suspense 对比讨论

### 15.  {@html} 的风险、{@debug} 的用途、bind:this 的时机，这三块"逃生舱"分别在什么边界内使用？

{@html}：插入原始 HTML 字符串，绕过 Svelte 的文本转义——风险即 XSS（任何用户可控/外部来源内容直接 {@html} 就是注入通道；既有 {@html} 风险与替代题）。安全用法：内容已经过服务端/可信库净化（DOMPurify/sanitize-html）且明确是富文本渲染需求，替代方案优先考虑"结构化的组件渲染"（markdown→AST→组件）而非丢字符串。{@debug}：模板里的 console.log（打印块作用域变量），开发期定位模板局部状态的临时工具，生产无副作用但应随代码清理（与 $inspect 互补：$inspect 管 state、{@debug} 管模板作用域，呼应 reactive-runes 关 $inspect 题）。bind:this：拿元素/组件实例引用——时机边界：元素级 bind:this 在挂载后可用（SSR 期为 null，对应既有"引用何时可用"题），组件级 bind:this 拿实例方法（Svelte 5 里"命令式调用子方法"的正规替代是导出函数/回调而非实例，呼应 component-composition 关），滥用 bind:this 手动操作 DOM 往往说明你缺一个 action 或 transition。加分句：三者共同标签是"绕过声明式的口子"——{@html} 绕过转义、{@debug} 绕过纯表达式、bind:this 绕过状态驱动 DOM；合理但不优先，用之前先问"有没有声明式方案"。

**来源**：Svelte {@html} 与 XSS；{@debug} 与 $inspect 对照；bind:this 生命周期文档
