# 生命周期：从钩子到 Effect

> 目标：把"组件的一生"对齐到 Svelte 5——初始化→构建→挂载→更新→销毁五阶段各发生了什么；`onMount` 为什么还留着而 `onDestroy`/`beforeUpdate`/`afterUpdate` 为什么被 `$effect` 清理取代；`tick()` 与 `flushSync` 的时机地图；SSR 阶段的生命周期差异。对照 Vue 四钩子与 React effect 双相（呼应 svelte-reactivity-internals、vue-lifecycle、react-useeffect）。

---

## 一、五阶段时机地图

```
① 初始化(同步)     <script> 体执行:runes 建立、context set/get、props 就位
        ↓
② 构建 DOM         编译器生成的 create() 搭好节点树(还没进文档)
        ↓
③ 挂载             节点插入文档 → action 执行 → onMount 回调 → $effect 首跑
        ↓  (state 变化)
④ 更新             微任务 flush:$effect.pre → DOM patch → $effect
        ↓ (条件块翻假/父销毁/keyed 重建)
⑤ 销毁             $effect 清理函数 → action destroy → 节点移除
```

三个记忆锚点：

- **onMount 与 $effect 首跑都在挂载之后**，拿得到真 DOM（`bind:this` 在 onMount 里已赋值，呼应 svelte-template 第六节）。
- `$effect` **初始只跑一次**、之后随依赖重跑——它同时是 Vue 的 `watchEffect` + `onMounted` + `onUpdated` + `onUnmounted(清理)` 合体（呼应 vue-lifecycle）。
- **销毁没有专用钩子的必要**：清理就是 `$effect` 返回的函数，"注册+清理"写在同一处，天生不容易漏（React 用户熟悉，Vue 要 onUnmounted 另起一钩）。

---

## 二、Svelte 5 的取舍：留下谁、退休谁

| Svelte 4 及以前 | Svelte 5 归宿 | 理由 |
|---|---|---|
| `onMount(fn)` | **保留**（`svelte` 导入） | 只在挂载跑一次的"一次性逻辑"仍直观 |
| `onDestroy(fn)` | 退休 → `$effect` 清理 | 清理与依赖应同源声明 |
| `beforeUpdate` | 退休 → `$effect.pre` | DOM 更新前的观测点 |
| `afterUpdate` | 退休 → `$effect` | DOM 更新后的副作用点 |

legacy 模式仍可用旧钩子（L10 迁移课细讲），新代码一律 runes。对照：Vue3 显式给了 `onMounted/onUpdated/onUnmounted` 全家桶——概念对齐,只是 Svelte 把它们折叠进了"一个 effect + 它的清理"（呼应 vue-lifecycle）。

```svelte
<script>
  import { onMount } from 'svelte';
  let el;
  onMount(() => { el.focus(); });                 // 一次性:聚焦

  $effect(() => {                                 // 挂载后执行;依赖变化重跑前与销毁时都走清理
    const ro = new ResizeObserver((e) => { ... });
    ro.observe(el);
    return () => ro.disconnect();                 // 重跑前&销毁时都清理
  });
</script>
<div bind:this={el}>…</div>
```

---

## 三、tick 与 flushSync：手动拨动时钟

**默认节奏**是微任务 flush：写 state 后立刻读 DOM，读到的还是**旧的**。两种打破方式：

```js
import { tick, flushSync } from 'svelte';

count++;
await tick();          // 等本次 flush 完成、DOM 已更新(异步,可 await)
console.log(el.scrollHeight);

count++;
flushSync(() => {});   // 同步强制执行挂起的 DOM 更新(下一行就能量)
```

选择：**默认永远不需要它们**；只有"量刚改完的 DOM"这类同步测量才动用，且 `flushSync` 滥用会把批处理优势丢掉（对照 React 同名 API、Vue `nextTick`，呼应 svelte-reactivity-internals 第二节）。

---

## 四、SSR 下的生命周期：只活第①阶段

服务端渲染没有 DOM：`onMount`、`$effect`、action **统统不执行**——只有 `<script>` 同步体跑了（建信号、算 `$derived`）。推论：

- 顶层直接摸 `window/localStorage` 的写法会让 SSR 崩；要摸就放 `onMount`/事件里（呼应 svelte-global-state 第三节环境判断）。
- 服务端拿数据不要 onMount-fetch（浏览器要二次请求）——SvelteKit 的 `load` 才是正解（12-sveltekit；对照 Next getServerSideProps、Nuxt useFetch，呼应 react-data-fetching、vue-ssr-nuxt）。
- 首屏进场动画在水合后不播是**特性**（intro 被跳过），补播方案见 svelte-actions 第二节。

---

## 五、"重挂载"也是生命周期：三种触发

状态丢失类 bug 九成出在这里——销毁=一切归零：

1. `{#if}` 翻假再翻真 → 组件全新实例（要保状态把 state 提升到不被销毁的父层，呼应 svelte-component-composition 第五节）。
2. keyed each 换 key / `{#key expr}` → 销毁重建（重置表单的正解）。
3. 路由组件复用/销毁策略（SvelteKit 里换页默认保留同名组件实例——到 12 包细讲）。

调试技巧：销毁时打点——`$effect(() => () => console.log('bye'));`（永远跑清理）。

---

## 六、自检清单

- [ ] 能默写五阶段时机地图,标出 action/onMount/$effect/清理各在哪个点。
- [ ] 说得出 onDestroy/beforeUpdate/afterUpdate 退休后的 runes 替身。
- [ ] 知道默认微任务节奏,会 tick/flushSync 且知道别滥用。
- [ ] 清楚 SSR 只有第①阶段,onMount-fetch 反模式与 load 正解的预告。
- [ ] 能列举三种"重挂载"触发器并解释状态丢失链。

---

🚀 **下一关**：`svelte-performance`——有了编译器红利还查什么性能？大列表、深层 $state、effect 泛滥、包体积与测量工具链。
