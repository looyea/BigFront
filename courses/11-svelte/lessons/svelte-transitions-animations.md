# Transition 与 Animation

> 目标：不装任何动画库搞定进出场——`transition:` 指令与内置过渡（fade/slide/scale/fly）、`in:`/`out:` 分离、列表 morph（crossfade/`animate:flip`）、自定义过渡函数、`class:` 驱动 CSS 动画，以及 prefers-reduced-motion。对照 Vue 的 `<Transition>`/`<TransitionGroup>` 与 React 生态（Framer Motion）。（呼应 svelte-template 条件块、05-react 动画话题）

---

## 一、transition 指令：元素进出场的官方答案

```svelte
<script>
  import { fade, slide, fly } from 'svelte/transition';
  let open = $state(true);
</script>

<button onclick={() => open = !open}>切换</button>
{#if open}
  <div transition:fade="{{ duration: 300 }}">进出场</div>
  <div transition:slide>面板展开</div>
  <div transition:fly="{{ y: 20, duration: 250, delay: 50 }}">上浮进场</div>
{/if}
```

三个心智点：

1. 过渡挂在**条件块/each 块里的元素**上——`{#if}` 翻 false 时元素**不会立刻消失**，播完出场动画才移除（这正是 Vue `<Transition>` 包裹的指令化写法，呼应 vue 过渡动画）。
2. 内置五件套：`fade`、`fly`、`slide`、`scale`、`blur`；参数都是 `{ duration, delay, easing }` + 各自专属项（fly 的 x/y、scale 的 start）。
3. `in:` 与 `out:` 可拆开用不同过渡：

```svelte
<p in:fly="{{ y: -10 }}" out:fade="{{ duration: 150 }}">进场上浮,出场淡出</p>
```

- `local` 修饰符：`transition:slide|local`——只对本元素显隐做过渡，不再给**内部新插入的子元素**播进场。
- 组件级关闭首次进场动画：`<Comp intro={false}/>` 语境下父可用 `{#if ... transition:local}` 组合控制。

---

## 二、列表动画：crossfade 与 flip

**flip**——`{#each}` 顺序变了，让每个 item **物理位移**到新位置：

```svelte
<script>
  import { flip } from 'svelte/animate';
  let todos = $state([...]);   // 排序/增删后顺序变化
</script>
{#each todos as todo (todo.id)}
  <li animate:flip="{{ duration: 200 }}">{todo.text}</li>
{/each}
```

名字来自 **FLIP** 四步：First 记旧位 → Last 量新位 → Invert 用 transform 把元素"假移"回旧位 → Play 播放归零。Vue 的 `<TransitionGroup>` 开 `move` 是同一原理（呼应 vue 过渡动画）。

**crossfade**——两个容器间迁移元素时"旧位置淡出 + 新位置淡入"无缝衔接（收件箱→已归档动画）：

```svelte
<script>
  import { crossfade } from 'svelte/transition';
  const [send, receive] = crossfade({ duration: 300, fallback: fade });
</script>
<ul>
  {#each todos as todo (todo.id)}
    <li in:receive="{{ key: todo.id }}" out:send="{{ key: todo.id }}">{todo.text}</li>
  {/each}
</ul>
```

`key` 一致的 out 元素与 in 元素由 crossfade 配对morph（React 圈要上 framer-motion 的 `layoutId` 才能做同一件事）。

---

## 三、自定义过渡：一个返回描述对象的函数

过渡函数的契约：`(node, params) => { delay, duration, easing, css, tick? }`：

```js
// 打字机:逐字显现
export function typewriter(node, { speed = 1 } = {}) {
  const text = node.textContent;
  const duration = text.length / (speed * 0.01);
  return {
    delay: 0,
    duration,
    tick: (t) => {
      const i = Math.round(text.length * t);
      node.textContent = text.slice(0, i);
    },
  };
}
```

```svelte
<p transition:typewriter>逐字出现</p>
```

- 只给 `css` → 交给 CSS 插值（`css: t => \`opacity:${t}; transform: scale(${t})\``）；要**改内容/测量 DOM** 就上 `tick`。
- 缓动函数库：`import { elasticOut, bounce } from 'svelte/easing'`，`easing: elasticOut`（自己写也行，`t => f(t)`）。
- 过渡函数是普通 JS——可放包里发布复用，这就是 Svelte 动画生态"零依赖"的底气（对照 Vue：过渡写进 `<Transition>` 的 CSS 类名约定）。

---

## 四、class: 指令：CSS 动画/长驻效果的开关

进场之外，"抖动/呼吸/高亮脉冲"这类**循环或一次性 CSS 动画**用 `class:` 更轻（呼应 svelte-styling）：

```svelte
<script>
  let shake = $state(false);
</script>
<div class:shake onanimationend={() => shake = false}>
  <button onclick={() => shake = true}>错误!</button>
</div>
<style>
  .shake { animation: shake 0.4s; }
  @keyframes shake { 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
</style>
```

`use:animate`（内置 action）与"把过渡函数当 action 用"能对**已存在**的元素跑过渡（不依赖显隐），见下一课 actions。

---

## 五、无障碍与性能红线

- **尊重减少动效偏好**：自定义过渡里查 `matchMedia('(prefers-reduced-motion: reduce)')` 时把 duration 归零；CSS 侧用 `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }`。
- 动画只用 `transform`/`opacity`（合成器层），别动 `top/left/height`——`slide` 内部动了 height，所以大列表慎用，优先 `fly/fade`。
- 播完即走：过渡结束元素会被真正移除，**state 也随之销毁**（呼应 svelte-component-composition 第五节 `{#if}` 卸载语义），要保数据先提升到父。
- 列表过渡必须配 **keyed each**（`(item) => item.id`），flip/crossfade 全凭 key 认人（呼应 svelte-template 第二节）。

---

## 六、三框架动画方案对照

| 需求 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 进出场 | `transition:` 指令 | `<Transition>` + 类名 | 条件渲染 + 库 |
| 列表位移 | `animate:flip` | `<TransitionGroup>` move | framer-motion layout |
| 跨容器 morph | crossfade | `<Transition>` teleport 手搓 | framer-motion layoutId |
| JS 逐帧 | 过渡函数 tick | 钩子 (@enter等) | useEffect/rAF |
| 首次 SSR 防闪 | `intro={false}` 选项 | appear 反向控制 | hydration 后手动 |

---

## 七、自检清单

- [ ] 会 transition:fade/slide/fly + in:/out: 拆分 + local 修饰。
- [ ] 说得出 FLIP 四步与 keyed each 的依赖关系。
- [ ] 能写出带 tick 的自定义过渡函数。
- [ ] 知道动画只用 transform/opacity 与 reduced-motion 处理。
- [ ] 出场动画播完才卸载组件,状态保留要提前提升。

---

🚀 **下一关**：`svelte-actions`——`use:xxx` 把"行为"焊到 DOM 元素上：内置 focus/blur/mount/animate 与自定义 click-outside、tooltip，对照 Vue 自定义指令。
