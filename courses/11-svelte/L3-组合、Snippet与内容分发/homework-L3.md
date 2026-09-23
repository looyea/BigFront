# L3 作业：组合、Snippet 与内容分发

> 范围：svelte-snippet-children / svelte-component-composition / svelte-spread-rest。满分 100 + 挑战 20。

## 一、读代码找 Bug（每题 10 分，共 100 分之内占 10 分×10）

指出每段代码的**一处关键问题**并给出修复。

1. ```svelte
   <script>let { header } = $props();</script>
   <div class="modal">{@render header()}</div>
   ```
   父组件有时不传 header，控制台报 "@render cannot render undefined"。

2. ```svelte
   <script>
     let slots = $state({});
     import { headerSnippet } from './parts.svelte.js';
     slots.header = headerSnippet;
   </script>
   ```
   想把 snippet 存进 $state 共享——两处不成立（提示：snippet 的存放边界 + .svelte.js 导出）。

3. ```svelte
   <Card>
     <p>正文</p>
   </Card>
   {#snippet header()}<h1>标题</h1>{/snippet}
   ```
   父组件想给 Card 传 header snippet，但页面上永远不显示标题。为什么？

4. ```svelte
   <script>let { size } = $props();</script>
   <div class="wrap"><span {...$$restProps}>x</span></div>
   ```
   使用方 `<Comp disabled>`，期望 disabled 落在 `.wrap` 上，实际落在了内部 `<span>`。rest props 出错了吗？问题出在哪？

5. ```svelte
   <button class="ui-btn" {...$$restProps}>ok</button>
   ```
   外部传 `class="danger"` 后，`ui-btn` 样式整个消失了。解释原因并给出最小修复。

6. ```svelte
   <script>
     {#if ready}
       export function boot() {}
     {/if}
   </script>
   ```
   编译直接报错。export function 有什么位置限制？

7. ```svelte
   <script>
     import Player from './Player.svelte';
     let p;
     p.play();
   </script>
   <Player bind:this={p} />
   ```
   运行时报 "Cannot read properties of undefined"。为什么？怎么改最稳？

8. ```svelte
   {#snippet row(item)}<li>{item}</li>{/snippet}
   <ul>{@render row}</ul>
   ```
   编译告警/渲染异常。`{@render}` 的表达式要求是什么？

9. ```svelte
   <script>import menuItem from './MenuItem.svelte';</script>
   <menuItem />
   ```
   渲染结果是一个未知的原生元素而不是组件。为什么？

10. ```svelte
    <script>let { onclick } = $props();</script>
    <button {...$$restProps}>go</button>
    ```
    父传的 `onclick` 失效了。为什么？怎么修？

## 二、手写编程题（共 5 题，评分看完成度）

1. 写 `Card.svelte`：支持 `title` 数据 prop、默认 `children`、可选具名 `footer` snippet；footer 未传时不渲染包装 `<div class="card-footer">`。
2. 写 `Table.svelte` + 使用方：Table 接收 `rows`、`cols` 与名为 `cell(row, col)` 的 snippet prop；使用方对 `price` 列渲染 ￥ 格式化、其余列渲染原文（作用域 snippet 实战）。
3. 封装 `Input.svelte`：内部固定 `class="ui-input"`，把其余一切属性/事件透传给原生 `<input>`，且外部传入的 `class` 与内部类**共存**。
4. 写 `Video.svelte`（`export function play/pause/seek(t)`）+ 父组件三个按钮命令式控制（`bind:this`），并处理实例未挂载的判空。
5. 用动态 `import()` 懒加载 `HeavyChart.svelte`：点击"显示报表"后才加载并渲染，加载中显示骨架（提示：`{#await}` 或标志位 + 顶层 await）。

## 三、场景设计题（1 题）

评审下面组件库片段的**设计问题**并给出重构方案：
> `Modal.svelte` 用 `$effect` 把 `open` prop 镜像进本地 `isVisible`；`<slot>` 风格要求父组件用字符串事件名 `on:confirm`（Svelte 5 环境）；根元素有两个（遮罩 + 面板），无条件 `{...$$restProps}` 只 spread 到了遮罩；组件内把 `children` snippet 存进 `$state` 数组以便"缓存"。
请逐条指出为什么不对，并给出 Svelte 5 的正确接口设计。

## 四、简答题（每题 3 分×3，超出部分折入总分）

1. 画出/列出 Svelte 5 组件接口"三通道"，各给一行代码示例。
2. `$props()`、`$$props`、`$$restProps` 三者的口径差异是什么？解构一个 prop 之后它会出现在哪里、消失在哪里？
3. snippet 与 Vue slot 的本质区别（从"是不是 prop"与"作用域归属"两个角度说）。

## 五、挑战题（🏆 附加 20 分）

用本关知识实现一个 `Tabs` 复合组件：`<Tabs items={['a','b']}>{#snippet panel(item)}...{/snippet}</Tabs>`——面板内容由父传入的 `panel` snippet 决定、当前选中态在 Tabs 内部 `$state` 管理、并通过 `$bindable` 支持 `bind:value` 受控用法。写完后思考：如果再做 `<Tabs.List>` 子组件路线（context 注册），接口体验有何不同？
