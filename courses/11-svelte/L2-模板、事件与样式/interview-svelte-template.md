# svelte-template 面试题精选

> 共 12 题，覆盖 A 控制块 / B 列表与 key / C 异步与工具标签 / D 编译与对照。

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
