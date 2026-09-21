# L2 课后作业 —— 模板、事件与样式

> 覆盖本阶段三关：svelte-template、svelte-events、svelte-styling。先找 bug 练眼，再手写练手，最后场景与简答练表达。代码按 Svelte 5 runes 写法。

---

## 一、读代码找 Bug（10 小题）

1. ```svelte
   {#each list as item}
     <li key={item.id}>{item.text}</li>
   {/each}
   ```
   这写法把 React 习惯带进来了，Svelte 里 key 应该怎么写？
2. ```svelte
   {#each list as item, i}
     <li>{item.text}</li>
   {/each}
   ```
   列表支持"在最前面插入一条 + 每行有本地输入框"，不加 key 会出什么问题？
3. ```svelte
   <button onclick={remove(user.id)}>删</button>
   ```
   行为不对在哪？两种修法？
4. ```svelte
   <form onsubmit={submit}>...</form>
   ```
   点提交后页面刷新了，为什么？用修饰符怎么改？
5. ```svelte
   <p>{user.bio}</p>
   ```
   `user.bio` 是一段可信的富文本 HTML，结果标签被当成文字显示了，怎么正确渲染？要额外注意什么？
6. ```svelte
   <div class:box={true} class="extra">x</div>
   ```
   同时写 `class:box` 和 `class="extra"`，最终 class 会怎样？`class:` 用在组件上还有效吗？
7. ```svelte
   <style>
     .card .third-party { color: red; }
   </style>
   ```
   想让 `.third-party`（来自第三方组件）命中却无效，为什么？怎么改？
8. ```svelte
   <input value={name} on:input={(e) => name = e.target.value} />
   ```
   手写受控更新太啰嗦，Svelte 更简洁的写法是什么？
9. ```svelte
   <canvas bind:this={cv}></canvas>
   <script>let cv; console.log(cv);</script>
   ```
   打印出来是 `undefined`，为什么？什么时候才有值？
10. ```svelte
    {@const total = items.reduce((a,b)=>a+b,0)}
    ```
    写在 `{#if}` 外面直接放模板顶层报错，为什么？`{@const}` 应放在哪？

---

## 二、手写编程（5 题）

1. 用 `{#each ... (id)}` 渲染一个 todo 列表，带 `{:else}` 空态，点击可删除；说明为什么这里必须用 keyed each。
2. 用 `{#await}` 渲染一个 `fetchUsers()` 的 Promise：pending 显示"加载中"、成功渲染列表、失败显示错误信息。
3. 封装 `Icon.svelte`：接收 `onclick` prop 并透传到内部 `<button>`，让父组件能 `<Icon onclick={...}/>` 绑定点击。
4. 用 `style:--size={px}` 把组件的 `$state` 数值传给 CSS，写一个大小随滑块变化的圆点。
5. 写一个搜索输入：用 `bind:value` 绑定，再配合事件修饰符 `|once` 绑定一个"首次聚焦埋点"处理函数。

---

## 三、场景题（1 题）

你 review 同事的 Svelte 组件，发现：① 列表用索引当 key 且每行有输入框；② 用 `onclick={doThing(id)}` 直接调用；③ 把全局 reset 写进组件 `<style>`；④ 富文本用 `{@html}` 直插用户评论未消毒。逐条指出问题、结合"keyed each 复用、渲染即执行、编译期作用域、XSS"解释后果并给修法。

---

## 四、简答题（3 题）

1. Svelte 的 `<style>` 作用域是怎么实现的？为什么说它"零运行时"？未用到的规则会怎样？
2. `on:click` 与 `onclick={...}` 有何异同？什么时候必须用 `on:` 形式？
3. `{#await}` 解决了什么样板问题？对比 Vue 的 `<Suspense>` 与 React 手动管理 loading/error。

---

## 五、挑战题 🏆

写一张不超过 200 字的 **模板/事件/样式速查卡**：把 `{#if}/{#each}/{#await}/{#key}/{@const}/{@html}/{@debug}` 各配一句用途；`|preventDefault / |stopPropagation / |once / |capture / |self / |trusted / |passive` 各配一句语义；`:global()`、`style:--x={v}`、`class:x` 各配一句。并解释：为什么 Svelte 作用域样式能删除未用规则、而运行时方案不能。
