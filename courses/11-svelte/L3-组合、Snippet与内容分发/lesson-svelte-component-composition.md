# 组件组合与实例交互

> 目标：把"组合优于继承"落到 Svelte 写法上——组件的导入与嵌套、通过 **prop 传数据 / 回调传事件 / snippet 传模板** 的三通道接口设计、用 `export function` 暴露实例方法配合 `bind:this` 命令式调用、动态 `import()` 懒加载组件、以及状态的"提升与下放"。对照 React 组合模式与 Vue 组件通信全景。（呼应 react-composition、vue-component-basics、svelte-props、svelte-snippet-children）

---

## 一、组件就是文件：导入即组合

Svelte 没有全局注册、没有 `components: {}` 选项——**ES import 就是注册**：

```svelte
<script>
  import Navbar from './Navbar.svelte';
  import Sidebar from './Sidebar.svelte';
</script>

<Navbar />
<div class="layout">
  <Sidebar items={menu} />
  <main>主体内容（需要时可用 children/snippet 传入）</main>
</div>
```

- 组件名必须**大写开头**（编译器用它区分组件与小写原生元素，呼应 svelte-events 大小写陷阱）。
- 递归/自引用：直接 `import Self from './ThisFile.svelte'`（Svelte 5 已用标准 import 取代 `<svelte:self>`）。

---

## 二、设计组件接口：三种"往下传"的东西

一个组件的公开接口 = `$props()` 声明的一切。Svelte 5 里往下传的就三类：

| 传什么 | 用什么 | 方向 |
|---|---|---|
| 数据 | 普通 prop（只读）/ `$bindable` 双向 | 父 → 子 |
| 事件 | 回调 prop `onXxx` | 子 → 父 |
| 模板 | snippet prop / `children` | 父 → 子（子在何时何地渲染都行） |

```svelte
<!-- ListBox.svelte：三通道齐全的典型接口 -->
<script>
  let { items, empty = '暂无数据', format, onSelect } = $props();
</script>

{#if items.length}
  <ul>
    {#each items as item (item.id)}
      <li onclick={() => onSelect?.(item)}>
        {#if format}
          {@render format(item)}
        {:else}
          {item.name}
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p>{empty}</p>
{/if}
```

`format` 是父传入的 snippet（渲染策略下放）、`onSelect` 是回调（事件上报）、其余是数据——这就是 Svelte 5 版的"render props + 受控 + 插槽"组合拳（呼应 react-composition 的组合优于继承）。

---

## 三、状态提升：谁拥有 state？

规则与 React/Vue 完全一致：**共享给多个组件的状态，提升到它们最近公共父**；子组件通过 props 收、通过回调/`bind:` 还（呼应 react-composition 提升状态、vue-state-patterns）：

```svelte
<!-- Parent.svelte：state 在父，两个孩子一个显示一个修改 -->
<script>
  let count = $state(0);
</script>
<Display {count} />
<Controls bind:count />      <!-- Controls 内 value=$bindable()，见 svelte-props 第四节 -->
```

跨层级太深、到处提升很烦时 → 用 **context**（L4 svelte-context）或**全局状态模块**（L4 svelte-global-state），而不是急着上 store。

---

## 四、暴露实例方法：`export function` + `bind:this`

有时"命令式调一下子组件"比 props 更自然（focus、play、open 动画、reset 表单）。Svelte 允许组件 `<script>` 里 `export function`，父拿实例引用调用：

```svelte
<!-- Video.svelte -->
<script>
  let el;
  export function play() { el?.play(); }
  export function pause() { el?.pause(); }
</script>
<video bind:this={el} src="/a.mp4" />
```

```svelte
<!-- 父 -->
<script>
  import Video from './Video.svelte';
  let player;
</script>
<Video bind:this={player} />
<button onclick={() => player?.play()}>播放</button>
```

- 实例引用**挂载后才非空**，调用处要判空（在 `onMount`/事件里调用天然安全，呼应 svelte-template 第六节 `bind:this`）。
- 这是逃生舱不是主通道：能用 `$bindable`/props 表达的"状态"别走命令式方法（对照 React imperative handle/useImperativeHandle）。

---

## 五、懒加载与条件渲染

- **切走即销毁**：`{#if show}<Heavy/>{/if}` 是真正的挂载/销毁；`{#key}` 可强制重建（呼应 svelte-template 第五节）。
- **动态 import 懒加载**（代码分割，Vite 自动分包，呼应 10-vite）：

```svelte
<script>
  const Chart = (await import('./Chart.svelte')).default; // 顶层 await（编译器支持）
</script>
{#await import('./Chart.svelte') then mod}<mod.default />{/await}
```

更常见的做法是放进 `{#await}` 或用路由级分割（SvelteKit 里是页面级自动分包，见 12-sveltekit）。

---

## 六、组合反模式速查

| 反模式 | 为什么糟 | 正解 |
|---|---|---|
| 用 `$effect` 同步 props 到本地 state | 多一帧陈旧、循环风险 | 直接读 prop；要初值就 `$state(prop)`（呼应 svelte-props 十二题） |
| 什么都塞进全局 store | 依赖不显式、难测 | props 传递 → 深了才 context → 真全局才共享模块 |
| 事件名层层 `$emit` 转发（Vue 惯性） | Svelte 5 无 emit | 回调 prop 逐层上传，或 context 提供函数 |
| 命令式方法满天飞 | 绕过响应式、难推理 | 状态走 props/`bind:`，只有"动作"才 export function |
| class 继承组件 | Svelte 无继承体系 | snippet + 回调 + 组合（本节二） |

---

## 七、自检清单

- [ ] 知道组件即 import、名必须大写开头、递归用自引用 import。
- [ ] 能背出三通道接口设计：数据 prop / 回调 onXxx / snippet 模板。
- [ ] 会做状态提升，`bind:` 对应 `$bindable` prop。
- [ ] 会用 `export function` + `bind:this` 暴露命令式方法，并知判空与"逃生舱"定位。
- [ ] 会 `{#if}` 真卸载与动态 `import()` 懒加载做代码分割。

---

🚀 **下一关**：`svelte-spread-rest`——封装组件时把没声明的属性一网兜走：`$$props` / `$$restProps` 与 spread 透传、class/style 合并，对照 Vue 的 fallthrough attributes 与 React 的 `{...props}`。
