# Svelte 是什么：编译器 vs 运行时框架

> 目标：建立 Svelte 的第一性心智——它**不是**在浏览器里跑一个框架去 diff，而是个**编译器**：`.svelte` 文件在构建时被翻译成直接操作 DOM 的 vanilla JS，产物里没有虚拟 DOM、没有 reconcile 循环。再理解 Svelte 5 的 **runes（`$state`/`$derived`/`$effect`/`$props`）** 相对 Svelte 4 及更早（响应式赋值、`$:`、store `$` 前缀）到底改了什么、为什么改。（呼应 vue-reactivity-theory、react-render-model、10-vite 编译期转换）

---

## 一、一句话：Svelte 是编译器，不是运行时框架

React / Vue 是**运行时库**：你的组件被打进 bundle，浏览器里真的跑着 React/Vue 的引擎，数据变了就重新执行组件、生成新的虚拟 DOM、diff、再打补丁到真实 DOM（呼应 react-render-model、vue-reactivity-theory）。

Svelte 走另一条路：

```svelte
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>点击了 {count} 次</button>
```

构建时 Svelte 编译器把上面这段编译成**接近手写的 JS**：初始化时 `createElement` 建好节点、`count` 变化时**直接** `textContent = count` 改那一处文本。没有虚拟 DOM、没有"重新执行组件"、没有 diff 整棵树的开销。

| 维度 | React / Vue（运行时派） | Svelte（编译器派） |
|---|---|---|
| 框架代码是否进 bundle | 是（react-dom / vue runtime） | 基本不进（编译成等价 DOM 操作） |
| 更新机制 | 重新渲染 → 虚拟 DOM diff → 打补丁 | 编译期算好依赖 → 精确改对应 DOM |
| 心智 | 声明式 UI + 框架托管 | 声明式写法 + 编译器"替你手写 DOM" |
| bundle 体积（小应用） | 有框架基础开销 | 通常更小 |
| 生态/SSR/工具 | 极庞大 | 精简，全栈靠 SvelteKit（见 12-sveltekit） |

> 关键：Svelte 的"魔法"发生在**编译期**，和 Vue SFC 编译器、Vite 的 transform 是同一类思想——把更高层的写法在构建时降级成高效命令式代码（呼应 vue-sfc-compiler-macros、10-vite）。

---

## 二、一个 `.svelte` 文件长什么样

`.svelte` 文件 = 脚本 + 标记 + 样式三段（顺序可换，样式可选）：

```svelte
<script lang="ts">
  // 顶层就是组件的"逻辑"，不需要 export default / setup 包裹
  let name = $state('Svelte');
</script>

<!-- 标记里用 {表达式} 插值 -->
<h1>Hello {name}!</h1>

<!-- 样式默认作用域到本组件 -->
<style>
  h1 { color: #ff3e00; }
</style>
```

与 Vue SFC 的 `<script setup>` 模板很像，但**没有响应式 API 要 import**——`$state` 这类 rune 是**编译器认识的关键字**，直接写即可。

---

## 三、Svelte 5 的核心变化：runes

Svelte 4 及更早，响应式是**隐式**的，靠三条"约定"：

1. **响应式赋值**：顶层 `let count = 0;` 后 `count += 1` 会触发更新（只对"顶层变量整体重新赋值"有效，改 `obj.x` 不触发）。
2. **`$:` 声明**：`$: double = count * 2;` 类似"自动重算"的派生。
3. **store 的 `$` 前缀**：`$writable` 自动订阅。

问题：太依赖"编译器魔法"，边界模糊、大对象/跨文件难推理、纯 `.js` 里用不了响应式。

**Svelte 5 用 runes 把它显式化**——一套 `$` 开头、编译器识别的"特殊函数"：

| rune | 作用 | 对应旧写法 | 对照 React / Vue |
|---|---|---|---|
| `$state(x)` | 声明可响应状态 | `let x` 响应式赋值 | `ref()` / `useState` |
| `$derived(x)` | 声明派生值 | `$: y = x*2` | `computed()` / `useMemo` |
| `$effect(() => {})` | 声明副作用 | `$: { ... }` | `watchEffect` / `useEffect` |
| `$props()` | 声明组件输入 | `export let a` | props 定义 |
| `$bindable()` | 可双向绑定的 prop | `bind:` 专用 | `v-model` / 受控回调 |
| `$inspect(...)` | 调试观测状态 | — | 自制的 watch 日志 |

```svelte
<script>
  let count = $state(0);            // 状态
  const parity = $derived(count % 2 === 0); // 派生：读了才自动追踪依赖
  $effect(() => { document.title = `${count}`; }); // 副作用
</script>
```

> 心智切换：从"改了什么编译器猜"→"你自己用 `$state` 标了什么，依赖就精确追什么"。runes 底层是**信号（signal）** 系统，和 Vue 的 ref/computed、Solid 的 signals 同源（13-solid 会更彻底地走这条路）。

---

## 四、runes 不只在组件里：`.svelte.js` / `.svelte.ts`

以前响应式被锁在 `.svelte` 文件里。Svelte 5 允许在**普通模块**里用 runes（文件后缀写成 `.svelte.js`/`.svelte.ts` 告诉编译器"这里可以用 rune"）：

```js
// counter.svelte.js  —— 一个可跨组件共享的状态模块
export function createCounter() {
  let count = $state(0);
  return {
    get count() { return count; },
    inc() { count += 1; },
  };
}
```

这是 Svelte 5 做**全局状态管理**的新姿势（详见 L4 svelte-global-state、svelte-stores）。

---

## 五、什么时候选 Svelte

- 适合：中小型交互应用、追求小体积与低心智负担、喜欢"写普通 JS"、新项目（Svelte 5 API 已稳定）。
- 需权衡：生态与招人规模不如 React/Vue；全栈/SSR 要走 SvelteKit（本包先讲纯 Svelte，路由/SSR/表单端点在 12-sveltekit）；老教程多是 Svelte 4 写法，注意与 runes 区分。

---

## 六、自检清单

- [ ] 能说清"Svelte 是编译器、产物无虚拟 DOM"与 React/Vue 运行时 diff 的区别。
- [ ] 能默写 `$state` / `$derived` / `$effect` 各解决什么，并映射到 Vue 的 ref/computed/watchEffect。
- [ ] 知道 Svelte 4 的 `$:` 与响应式赋值在 Svelte 5 里被 runes 取代。
- [ ] 知道 `.svelte.js` 模块里也能用 runes，是共享状态的基础。
- [ ] 清楚本包讲纯 Svelte，SSR/路由/全栈留给 12-sveltekit。

---

🚀 **下一关**：`svelte-reactive-runes` 把 `$state`/`$derived`/`$effect` 三件套彻底讲透——包括深响应、`$state.raw`、惰性求值与 effect 清理。
