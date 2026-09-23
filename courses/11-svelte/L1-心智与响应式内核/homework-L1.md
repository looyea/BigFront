# L1 课后作业 —— 心智与响应式内核

> 覆盖本阶段三关：svelte-overview、svelte-reactive-runes、svelte-props。先找 bug 练眼，再手写练手，最后场景与简答练表达。所有代码按 Svelte 5 runes 写法。

---

## 一、读代码找 Bug（10 小题）

1. ```svelte
   <script>
     const count = $state(0);
   </script>
   <button onclick={() => count++}>{count}</button>
   ```
   这里有两个问题，分别是什么？怎么改？
2. ```svelte
   <script>
     let user = $state({ name: 'Ada' });
     function rename() { user = { ...user }; user.name = 'Bob'; }
   </script>
   ```
   对 `$state` 深响应理解有误的地方在哪？最简改法？
3. ```svelte
   <script>
     let { title } = $props();
     title = title.toUpperCase();
   </script>
   ```
   给 prop 赋值违反了什么规则？要展示"大写标题"的正确写法？
4. ```svelte
   <script>
     let n = $state(0);
     $effect(() => { n = n + 1; });
   </script>
   ```
   运行会怎样？为什么？给出两种修法。
5. ```svelte
   <script>
     let list = $state.raw([1, 2, 3]);
     function add(x) { list.push(x); }
   </script>
   ```
   `add(4)` 后视图没更新，为什么？两种修法？
6. ```svelte
   <Child bind:value={name} />
   ```
   子组件里写的是 `let { value } = $props();`，绑定为何不生效？
7. ```svelte
   <script>
     const sum = $derived.by(() => { nums = nums.map((x) => x); return nums.reduce((a, b) => a + b, 0); });
   </script>
   ```
   在派生里做赋值/副作用有什么问题？派生应满足什么？
8. 有人在纯 `utils.js`（非 `.svelte.js`）里写 `let x = $state(0)` 报错，为什么？两种正确落点？
9. ```svelte
   <button onClick={handler}>x</button>
   ```
   在 Svelte 5 里 `onClick` 与 `on:click`、`onclick` 三者关系与推荐写法？
10. 组件把父传来的 `items` 用 `$effect` 同步进本地 `$state`，出现"晚一帧"的问题。用 props 只读 + 免镜像原则解释并给改法。

---

## 二、手写编程（5 题）

1. 写一个计数器组件：`$state` 保存 count，按钮 +1/-1，用 `$derived` 显示"count 是否为偶数"，用 `$effect` 把 `document.title` 同步为 count。
2. 写 `Button.svelte`：用 `$props()` 接收 `variant = 'primary'`（默认值）、`disabled`，并把标签之间的内容用 `{@render children?.()}` 渲染出来。
3. 用 `$state` + `$effect` 实现搜索框**防抖 300ms**：input 变化后延迟触发 `doSearch`，effect 返回清理函数取消上一次的定时器。
4. 写一个可双向绑定的 `NameInput.svelte`（`let { value = $bindable('') } = $props();`），并在父组件用 `bind:value` 绑定到父的 `$state`，双向验证。
5. 用 `counter.svelte.js` 模块导出一个共享计数器（`$state` + getter + `inc()`），在两个组件里都调用它，证明状态是共享的（引 L4 全局态）。

---

## 三、场景题（1 题）

你 review 同事的 Svelte 5 组件，发现：① 用 `$effect` 把一个 `$state` 列表映射成"过滤后的列表"；② 直接 `props.user.name = 'x'` 修改传入对象；③ 用 `createEventDispatcher` 往父传提交事件；④ 在 `.js`（非 `.svelte.js`）里写 `$state`。请逐条指出问题、结合"派生 vs 副作用、props 只读、回调 prop、模块 runes 落点"解释后果并给修法。

---

## 四、简答题（3 题）

1. 说清"Svelte 是编译器、产物无虚拟 DOM"与 React/Vue 运行时 diff 的区别，并各举一句更新机制。
2. `$state` 与 `$state.raw` 的响应粒度差异是什么？分别给一个适用场景。
3. 单向数据流下，子组件"改父数据"有哪两条正路？各自怎么写？

---

## 五、挑战题 🏆

写一张不超过 200 字的 **runes 速查卡**：为 `$state` / `$state.raw` / `$derived` / `$derived.by` / `$effect` / `$props` / `$bindable` / `$inspect` 各配"一句用途 + 一个最容易踩的坑"，并补一句总结："Svelte 5 的依赖是怎么被自动收集的（读决定、写传播）"。要求能解释：为什么 `$effect` 里给自己读到的 `$state` 赋值会循环、为什么解构 props 仍然响应。
