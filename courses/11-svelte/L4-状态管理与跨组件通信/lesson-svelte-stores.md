# Stores：writable / readable / derived

> 目标：掌握 Svelte 经典全局状态方案 store 的四件套——`writable`、`readable`、`derived`、`get`，`$` 前缀自动订阅语法与销毁时机；更重要的是回答面试官必问的一句："**Svelte 5 有了 runes，还要 store 吗？**"（呼应 svelte-reactive-runes、svelte-global-state、vue-state-patterns）

---

## 一、store 是什么：一个带 subscribe 方法的对象

store 不是语言特性，只是一个实现了可订阅接口的**普通对象**：

```js
// stores.js
import { writable, readable, derived, get } from 'svelte/store';

export const count = writable(0);                    // 可读写
export const now  = readable(Date.now(), (set) => {  // 只在有订阅者时启动
  const t = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(t);                     // 清理函数
});
export const isEven = derived(count, (c) => c % 2 === 0);  // 派生
```

组件里用 **`$` 前缀**自动订阅/退订：

```svelte
<script>
  import { count, now, isEven } from './stores.js';
</script>

<p>{$count} / {$isEven ? '偶' : '奇'} / {$now}</p>
<button onclick={() => count.update((c) => c + 1)}>+1</button>
```

- `$count` 是编译器魔法：顶部隐式 `count.subscribe(v => count = v)`，**组件销毁自动退订**。
- API：`set(v)` 直接设值、`update(fn)` 函数式改值；`readable` 的第二参是"启动/清理"函数（惰性）。
- `get(store)`：**组件外**（工具函数、事件回调、SSR 初始化）一次性取值，不留订阅。

---

## 二、derived 的高级形态

```js
// 多输入
const total = derived([price, qty], ([p, q]) => p * q);

// 可写 derived：给 set 映射回上游
const celsius = writable(25);
const fahrenheit = derived({
  get: (set) => celsius.subscribe((c) => set(c * 9 / 5 + 32)),
  set: (v, get) => get(celsius).set((v - 32) * 5 / 9),
});
```

派生是**惰性**的：没人订阅 `$total` 时，上游变了也不算——与 `$derived` 的按需求值思路殊途同归（呼应 svelte-reactive-runes 第二节）。

---

## 三、runes 时代 store 的定位（面试必答）

Svelte 官方口径：**runes 是新的默认，store 不再推荐作为首选**。对比：

| 维度 | runes（$state/$derived + .svelte.js 模块） | store |
|---|---|---|
| 粒度 | 信号级、任意变量 | 整对象订阅 |
| 异步流（WS/SSE/定时器源） | 要手写订阅管理 | readable 的启动/清理天然合适 |
| 组件外读写 | 普通函数即可（见下一课） | `get()` / `set()` 随处可用 |
| 生态/迁移代码 | Svelte 5 新写 | Svelte 4 存量、多数状态库 |
| 混用 | `$state` 里放 store 值是**雷区** | 组件里跨用需 `toStore`/`fromStore` 桥 |

**今天仍该用 store 的场景**：① 数据源本身是异步流（WebSocket 转 store 广播全家）；② 维护 Svelte 4 存量代码；③ 需要"命令式一次性读全局"的脚本层。其余场景 → runes 模块（下一课）。

混用桥（Svelte 5 提供）：

```js
import { toStore, fromStore } from 'svelte/store';
const count$ = toStore(count, get);      // $state → store(给老组件)
const count2 = fromStore(count$);        // store → $state(给新代码)
```

---

## 四、三个经典坑

1. **`$` 变量不能赋值**：`$count = 5` 编译错误，要 `count.set(5)`——`$x` 是订阅镜像，不是本体。
2. **解构订阅即断链**：`const { subscribe } = writable(0)` 没麻烦，但把 store 塞进 `$state` 再用会丢失其响应语义（对象代理干扰 subscribe 调用），混合时保持 store 在 `$state` **外面**。
3. **SSR 泄漏**：模块级 `writable` 在服务端是**跨请求单例**——A 用户写过的值 B 用户能读到。SvelteKit 场景要么组件内 `mount` 期创建，要么走下一课的全局态隔离方案（呼应 svelte-global-state 第四节、12-sveltekit）。

---

## 五、对照 Vue/React 状态库

| 概念 | Svelte store | Pinia/Vuex | Zustand |
|---|---|---|---|
| 可写单元 | writable | state+actions | create 的 store |
| 派生 | derived | getter | selector |
| 订阅语法 | `$x` 编译器魔法 | 组合式 ref | useStore 钩子 |
| 组件外访问 | get() | 同上 | getState() |

Svelte 的 `$` 前缀是三家里最"去样板化"的订阅语法，但 Zustand 们靠"引用变更 + selector"、Svelte 靠"编译器 + 清理函数"——思路上 store ≈ "手动的最小 zustand"，runes ≈ "内置的 Pinia"（呼应 vue-state-patterns、react-custom-hooks）。

---

## 六、自检清单

- [ ] 会写 writable/readable(带清理)/derived(多输入、可写)并说清 `$` 自动订阅与退订时机。
- [ ] 知道 `get()` 用于组件外一次取值。
- [ ] 能回答"runes 之后 store 的地位"并说出三个仍适用场景。
- [ ] 会 `toStore` / `fromStore` 桥。
- [ ] 记住 `$x` 不可赋值、store 别塞进 `$state`、模块级 store 的 SSR 泄漏。

---

🚀 **下一关**：`svelte-global-state`——不用 store、不用 context：一个 `.svelte.js` 模块 + runes 就是 Svelte 5 的"官方 Pinia"，含持久化封装与 SSR 单例陷阱。
