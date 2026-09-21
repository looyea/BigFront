# svelte-events 面试题精选

> 共 12 题，覆盖 A 绑定写法 / B 修饰符 / C 自定义与转发 / D 对照与实践。

## 一、绑定写法（A 类）

### 1. `on:click` 和 `onclick={...}` 有什么区别？推荐哪种？
`on:click` 是传统事件指令；`onclick={...}` 是 Svelte 5 把 DOM 事件当作**小写属性 prop** 传给元素，二者对元素都可用。需要**修饰符**只能用 `on:click|...` 指令；纯绑事件或做 prop 转发时，小写属性更符合"一切皆 props"心智（呼应 svelte-events 第一节）。
**来源**：Svelte 5 官方博客 — attributes as props / events

### 2. `<button onclick={doThing(id)}>` 有什么问题？
这会在**渲染时立即执行** `doThing(id)` 并把返回值当 handler（常见 bug）。应包一层箭头函数 `onclick={() => doThing(id)}`，或传函数引用（呼应 svelte-events 第二节、react-jsx 找 bug）。
**来源**：React/Svelte 事件处理通用陷阱

### 3. 事件处理函数能拿到什么参数？
默认拿到原生 `Event` 对象（`event.target`、`event.currentTarget` 等）；额外参数通过内联闭包传入。回调 prop（`onXxx`）则拿到你调用时传的任意参数，而非 Event（呼应 svelte-events 第二节）。
**来源**：Svelte 官方文档 — 事件对象

## 二、修饰符（B 类）

### 4. 列出常用事件修饰符及其作用。
`preventDefault`（阻止默认）、`stopPropagation`（停冒泡）、`stopImmediatePropagation`、`passive`（不会 preventDefault，提性能）、`capture`（捕获阶段）、`self`（仅目标为自身）、`trusted`（仅真实用户操作）、`once`（一次后解绑），用 `|` 链式组合（呼应 svelte-events 第三节）。
**来源**：Svelte 官方文档 — event modifiers

### 5. 表单里阻止默认提交，现代写法有几种？
指令式：`on:submit|preventDefault={submit}`；或属性式自己调：`onsubmit={(e) => { e.preventDefault(); submit(); }}`。前者更简洁，后者便于传参/组合（呼应 svelte-events 第三、四节）。
**来源**：Svelte 官方 — 表单与事件

### 6. `passive` 修饰符为什么能提升滚动性能？
声明监听器不会调用 `preventDefault`，浏览器无需等待 JS 决定是否拦截就能立即滚动，避免主线程阻塞造成的卡顿（同 Chrome 被动监听器优化，呼应 svelte-events 第三节）。
**来源**：MDN — addEventListener passive、Chrome 输入延迟文档

## 三、自定义与转发（C 类）

### 7. Svelte 5 里还需要 `createEventDispatcher` 吗？
不需要（属 legacy）。新代码用**回调 prop**：父把 `onsubmit` 等函数传下去，子组件在合适时机 `onsubmit?.(payload)` 调用，类型清晰、无字符串事件名、可组合（呼应 svelte-events 第四节、svelte-props 第三节）。
**来源**：Svelte 官方 — createEventDispatcher 迁移建议

### 8. 如何把原生事件从封装组件转发出去？
把事件属性当 prop 接收再挂到内部元素：`let { onclick } = $props(); <button {onclick}>`，父组件就能 `<MyBtn onclick={...}/>`。也可用 `...$$restProps` 批量透传（呼应 svelte-events 第四节、svelte-spread-rest）。
**来源**：Svelte 官方 — event forwarding / spread

### 9. `<svelte:window>`/`<svelte:document>` 解决什么？
在内置"全局元素"上直接绑事件（如 `onkeydown`、`onresize`、`onclick`），由组件生命周期管理监听器的增删，避免手动 `addEventListener` 忘了 `removeEventListener` 泄漏（呼应 svelte-events 第五节、svelte-lifecycle）。
**来源**：Svelte 官方文档 — <svelte:window>、<svelte:document>

## 四、对照与实践（D 类）

### 10. 和 React、Vue 的事件绑定对照，差异点在哪？
React：`onClick={fn}`，合成事件、需 `e.preventDefault()`；Vue：`@click="fn"` + `.prevent/.stop` 修饰符；Svelte：`on:click`/`onclick` + `|preventDefault` 修饰符，且事件即 prop。三者修饰符思路（Svelte/Vue）几乎一致（呼应 svelte-events 第三节、vue-events）。
**来源**：React/Vue/Svelte 官方事件文档对照

### 11. 事件处理里闭包读到"旧的 `$state`"吗？
不会。`$state` 是信号、按引用读取当前值，处理函数运行期读到的是最新值——不存在 React `useState` 那种"闭包捕获旧快照"的经典坑（那需要函数式更新）。这是信号式响应式的优势（呼应 svelte-reactive-runes、react-usestate）。
**来源**：Svelte 信号模型 / React 陈旧闭包对照

### 12. 什么时候用 `on:` 指令，什么时候用回调 prop？
绑**原生 DOM 事件**到元素用 `on:xxx` 或小写 `onxxx` 属性；做**组件间通信**（子→父）用回调 prop `onXxx`。别把两者混为一谈：小写 `onclick` 是 DOM 事件、大写 `onClick`/`onsubmit` 多为自定义约定（呼应 svelte-events 第一节、svelte-props）。
**来源**：Svelte 官方 — events vs props 约定
