# svelte-events 面试题精选

> 共 15 题，覆盖 A 绑定写法 / B 修饰符 / C 自定义与转发 / D 对照与实践。

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

---

## 补充（新专题 13-15）

### 13.  Svelte 5 还需要 createEventDispatcher 吗？子传父的"事件"用回调 prop 还是 dispatch，取舍是什么？

现状：Svelte 5 官方把"子向父传事件"的推荐转向回调 prop（父传 onsubmit={fn}/ontoggle={fn} 给子，子直接调用），createEventDispatcher 不再鼓励（既有题"子传父推荐做法"）。为什么：dispatch 走 CustomEvent + DOM 事件冒泡，类型弱（detail 是 any）、父要知道事件名字符串、且与 Svelte 5 "props 是接口"的统一模型冲突；回调 prop 是普通函数、可 TS 标注、父一眼看清接口。取舍：回调 prop 适合"组件对使用者暴露的语义事件"（可类型化、显式）；仍要 DOM CustomEvent 冒泡的场景（穿透多层未知祖先、Web Component 外部监听、第三方靠 addEventListener 接）才用 dispatch 或直接操作元素事件。原生事件转发：把子组件收到的原生事件转发给父用回调（onclick={parentOnclick}）或 spread。加分句：这题的高分是"看清事件模型的分层"——原生 DOM 事件（addEventListener 那套）与组件语义事件（回调 prop）是两层，dispatch 尴尬地想同时当两层；Svelte 5 让你显式选择：语义事件走回调、DOM 事件走原生 prop，边界反而清晰（对应 events 关"何时用 on: 何时用回调"既有题）。

**来源**：Svelte 5 移除/弱化 createEventDispatcher 的迁移说明；callback props 模式；既有"子传父推荐做法"深化

### 14.  事件处理里闭包会读到"旧的 $state"吗？Svelte 5 的 state 读写模型如何影响 handler 里的值？

关键差异：Svelte 5 的 $state 变量"读取即拿最新值"（不是 React 那样每次渲染快照一个值）——因为编译器把 count 的读取编成 signal.get()，无论何时在 handler 里读 count 都是当前值，不存在 React 的"stale closure"陷阱（既有题"闭包读到旧 state 吗"答案是"不会，除非用了 untrack/快照"）。对比 React：函数组件每次渲染重新创建 handler、捕获当次快照，异步回调读到旧值要靠 ref/依赖数组修正——这是 React 新手最大坑之一，Svelte 用"信号而非快照"模型直接消掉。但仍有注意：① 若你把 $state 的值一次性赋给普通变量再在闭包用，那是快照（要"反应式跟随"必须每次读原 signal）；② untrack 内读的是"不订阅但仍是当时值"；③ 事件里的 e.target.value 是 DOM 值不是 state（bind 与否决定同步方向）。加分句：能把"为什么 Svelte 没有 stale closure"讲成"因为它不是快照模型而是引用模型（handler 里的 count 是一条到 signal 的活引用）"，就抓住了响应式框架最根本的两种心智模型分野——这比记 API 重要得多。

**来源**：Svelte 5 state 信号语义；runes 与闭包；既有"闭包读旧 state"题深化

### 15.  全局键盘快捷键系统（?弹帮助、Esc关弹层、组合键），在 Svelte 里用 <svelte:window>、action 还是 effect 做？

三选一分析：① <svelte:window onkeydown={fn}> ——组件在时全局挂监听、卸载自动解绑，适合"这个组件负责快捷键"的简单场景（既有 svelte:window keydown 题）；② action（use:hotkeys） ——把"注册/注销 keydown + 解析组合键 + 焦点判断"封装成可复用到任意节点的 action，是"DOM 行为复用"的正解（既有 action 关"曝光/点击外部"题同类）；③ $effect 手动 addEventListener + cleanup ——可行但把生命周期管理交给 effect 的 cleanup，比 action 更啰嗦、复用性差。推荐分层：跨页面通用的快捷键（Cmd+K、Esc）做成 action 或一个集中式 store + 单窗口监听（避免每个组件各挂一个 keydown 打架）；组件局部的用 svelte:window 条件绑定。工程细节：注册在 window 的 keydown 要处理"焦点在输入框时不劫持单键"（e.target 判断）、修饰键标准化（e.metaKey||e.ctrlKey 跨平台）、优先级与消费（stopPropagation 防多处理）。加分句：这题真考"全局监听的归属管理"——N 个组件各 addEventListener keydown 是性能与正确性双雷区（触发顺序、重复响应），成熟方案是"一个窗口级路由器 + 注册表（action/context 注册自己的快捷键）"，把散点收敛成一处调度（对应 special-elements 关同名设计题的体系化）。

**来源**：svelte:window 事件文档；action 复用 DOM 逻辑；既有"全局快捷键系统"设计题落地
