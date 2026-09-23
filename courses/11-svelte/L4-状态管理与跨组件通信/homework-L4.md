# L4 作业：跨组件状态

> 范围：svelte-context / svelte-stores / svelte-global-state。五段式：读代码找 Bug + 手写 + 场景 + 简答 + 挑战。

## 一、读代码找 Bug（每题 10 分）

1. ```svelte
   <script>
     import { getContext } from 'svelte';
     onMount(() => { const form = getContext('form'); });
   </script>
   ```
   运行时报错或拿不到值。getContext 的时机规则是什么？

2. ```svelte
   <script>
     import { setContext } from 'svelte';
     let theme = { color: 'dark' };
     setContext('theme', theme);
     function toggle() { theme = { color: theme.color === 'dark' ? 'light' : 'dark' }; }
   </script>
   ```
   点击 toggle 后，读取 context 的后代纹丝不动。为什么？怎么修？

3. ```js
   export const toastQ = writable([]);
   ```
   同事在 `.svelte` 组件里写 `$toastQ = [...$toastQ, msg]` 报编译错误。给出两种合法写法。

4. ```svelte
   <script>
     const undo = writableStack();     // 自定义 store
     $: first = undo.value;            // 想响应式读内部字段
   </script>
   ```
   把 store 当普通对象读 `.value` 拿不到更新。store 的正确读法是什么？

5. ```js
   // clock.svelte.js
   export const now = $state(Date.now());
   setInterval(() => now = Date.now(), 1000);
   ```
   编译报错。`$state` 声明在对象属性之外时，重新赋值哪里有问题？（提示：let 与顶层）

6. ```js
   // server entry
   export const user = $state({ name: '' });
   ```
   SvelteKit SSR 下出现"A 用户看到了 B 用户的名字"。根因是什么？

7. ```svelte
   <script>
     import { derived } from 'svelte/store';
     const double = derived(count, (c) => c * 2);
     double.set(10);
   </script>
   ```
   抛 "Store does not have a set method"。想要"写 double 回 count"该怎么改？

8. ```js
   import { get } from 'svelte/store';
   export const tokenStore = writable(get(localStorage.getItem('t')));
   ```
   启动即崩/永远空。指出两处问题（get 用错对象、SSR 无 localStorage）。

9. 开发环境改了一行 `cart.svelte.js`，页面购物车清零。这是 bug 吗？给出保留状态的官方机制写法。

10. ```svelte
    <script>
      const storeA = writable(0);
      storeA.subscribe(v => console.log(v));  // 从不调用 unsubscribe
    </script>
    ```
    组件反复挂载后内存持续增长。对比 `$storeA` 写法说明自动清理差在哪。

## 二、手写编程题（共 5 题）

1. 写 `theme.svelte.js`：`theme` 含 `$state` 的 `mode` 字段、`$derived` 的 `isDark`、`toggle()`；两个不相关组件分别显示与切换，验证"import 即响应"。
2. 给上一题加持久化：初始化读 localStorage、`$effect` 写回，并处理"服务端没有 localStorage"的环境判断。
3. 用 context 实现 `Tabs`：`Tabs.svelte` setContext 一个含 `current`（$state）与 `register(tab)` 的对象；`TabPanel.svelte` getContext 注册并在 `{#if current === id}` 时渲染（完成 L3 挑战题的 context 路线）。
4. 写一个 `createUndo(initial)` 自定义 store（runes 版，非 svelte/store）：`get value`、`set(v)`、`undo()`；内部用数组存历史。附一个 vitest 可测性说明（工厂 vs 单例）。
5. 用 `readable` 包一个 WebSocket 流：启动函数里 connect、返回清理里 close；组件 `$ws.lastMessage` 显示。写完后评估：这个场景换成 `.svelte.js` + `$state` 实现，启动/清理生命周期该挂在哪？

## 三、场景设计题（1 题）

评审架构并给出重构方案：
> 某后台系统所有状态（当前用户、侧栏折叠、每页表格筛选、全局通知）都塞进一个 `app.svelte.js` 巨型单例；表格筛选被组件直接 `app.tables[3].page = 5` 修改；部署到 SvelteKit SSR 后偶发"看到别人的通知"。
请从 领域拆分 / 写收口 / SSR 隔离 三个角度出方案。

## 四、简答题（每题 3 分×3）

1. context、props、全局模块三者的选型判据各用一句话说明。
2. 为什么 `$state` 字段能跨文件响应，而普通对象不能？（信号依赖角度）
3. Svelte 5 项目里什么情况下你仍然会选 store？给两个理由。

## 五、挑战题（🏆 附加 20 分）

实现 `createResizable(key)`（`.svelte.js`）：面板宽度 `$state` + localStorage 持久化 + `import.meta.hot.data` 防 HMR 清零 + 监听 `storage` 事件实现"多标签页同步拖拽宽度"。写一段注释说明：如果这个项目要 SSR，你会把这个模块降级成什么形态（工厂+context），并画出改造前后对比。
