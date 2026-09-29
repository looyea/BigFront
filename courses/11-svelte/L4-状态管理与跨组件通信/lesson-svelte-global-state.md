# 全局状态：.svelte.js 模块 + runes

> 目标：Svelte 5 时代做"全局 store"的标准姿势——**一个 `.svelte.js` 模块导出含 runes 的对象/函数，谁 import 谁响应**。本课覆盖：模块单例语义、类/工厂两种组织法、localStorage 持久化封装、HMR 状态保命、以及 SSR 下的跨请求泄漏陷阱与对策。（呼应 svelte-reactive-runes 第五节、svelte-stores 第四节、02-typescript）

---

## 一、最小可用全局态：模块即 store

`.svelte.js` 里可以用 runes（呼应 svelte-reactive-runes 第五节），而 ES 模块天然单例——两件事拼起来就是全局状态：

```js
// cart.svelte.js
// 目的：模块即 store—.svelte.js 能用 runes + ES 模块天然单例，拼起来就是全局态
export const cart = {
  items: $state([]),   // ✅ 模块级信号，谁 import 谁响应
  total: $derived.by(() => cart.items.reduce((s, i) => s + i.price * i.qty, 0)),   // ✅ 自动追 items
  add(product, qty = 1) {
    const hit = cart.items.find((i) => i.id === product.id);   // ✅ 应用：提供改变状态的方法
    if (hit) hit.qty += qty;
    else cart.items.push({ ...product, qty });   // ✅ 深响应，push 直接触发更新
  },
  clear() { cart.items = []; },
};
// ❌ 文件后缀不写 .svelte.js 而用普通 .js → 编译器不容许 rune，$state 直接报错
```

```svelte
<!-- 任意组件,无 props、无 context、无订阅语法 -->
<script>
  // 目的：谁 import 谁响应—读进模板即建信号依赖，一处 add 所有相关组件精准更新
  import { cart } from './cart.svelte.js';
</script>
<p>共 {cart.items.length} 种,￥{cart.total}</p>   {/* ✅ 模板读到 items/total 就订阅 */}
<button onclick={() => cart.add({ id: 'p1', price: 19.9 })}>加购</button>   {/* ✅ 调用方法改状态 */}
```

没有 `$` 前缀、没有 Provider——**`cart.items` 读进模板即建立信号依赖**，任何一处 `add`，所有读到相关字段的组件精准更新。这就是 Svelte 5 的"内置 Pinia"（对比 Pinia：defineStore + storeToRefs vs 一个普通对象）。

---

## 二、工厂函数形态（可测试、可多实例）

对象字面量够用，但更工程化的是 **composable 工厂**（与 React 自定义 Hook 同构，呼应 react-custom-hooks）：

```js
// counter.svelte.js
// 目的：工厂函数形态（composable）—可测试、可多实例，与 React 自定义 Hook 同构
export function createCounter(initial = 0) {
  let count = $state(initial);   // ✅ 每次调用新一份，单测互不污染
  return {
    get count() { return count; },   // ✅ getter 读时才登记依赖
    inc: () => count++,
    reset: () => (count = initial),
  };
}
export const globalCounter = createCounter(0);   // ✅ 要全局就导出一份单例
// ❌ 把可变 count 直接暴露而不包 getter → 外部拿到的是固定值，读不到后续变化
```

好处：① 单测时 `createCounter()` 各自新建、互不污染；② SSR 下可按请求新建（第四节）；③ 一个模块可以同时导出"全局单例"与"局部工厂"。

---

## 三、持久化：$effect 写回

```js
// settings.svelte.js
// 目的：localStorage 持久化—读初始值放初始化代码，写回放 $effect副作用
const saved = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('settings') ?? '{}') : {};   // ✅ 先判环境防 SSR 无 localStorage
export const settings = {
  theme: $state(saved.theme ?? 'auto'),
  fontSize: $state(saved.fontSize ?? 14),
};
$effect(() => {
  // ✅ 字段变时写回；模块顶层允许 $effect，随首次求值注册
  localStorage.setItem('settings', JSON.stringify({ theme: settings.theme, fontSize: settings.fontSize }));
});
// ❌ 不判 typeof localStorage 直接读 → 上 SSR 服务端无此全局，报 ReferenceError: localStorage is not defined
```

要点：`$effect` 在模块顶层是允许的（`.svelte.js` 中随首次求值注册，之后每次相关字段变化都执行）；写回是**副作用**所以放 `$effect`，读初始值放初始化代码。想要防抖/字段过滤，就 `import { debounce } from 'lodash-es'` 包一层——逻辑全在纯 JS 里，不需要任何库的 persist 插件（对比 Pinia 的 pinia-plugin-persistedstate，呼应 vue-state-patterns）。

---

## 四、两个"全局态原罪"：HMR 与 SSR

**① Vite HMR 状态清零**：改一下 `cart.svelte.js`，模块热替换、单例重建，页面里购物车没了。保命法是把单例挂到 `import.meta.hot.data`（呼应 10-vite 的 HMR 原理）：

```js
// 目的：把单例挂到 import.meta.hot.data，防 HMR 热替换时模块重建导致状态清零
const persisted = import.meta.hot?.data.cart;   // ✅ 热替换前先取旧单例
export const cart = persisted ?? { items: $state([]) /* ... */ };   // ✅ 有则复用，无则新建
if (import.meta.hot) import.meta.hot.data.cart = cart;   // ✅ 存回供下次热更
// ❌ 不做这步→改一下 cart.svelte.js，模块热替换、单例重建，页面里购物车数据没了
```

**② SSR 跨请求泄漏（最重要）**：Node 服务端模块只执行一次，**所有用户的请求共享同一份 `$state`**——A 用户的购物车会被 B 用户看见。对策分三档：

| 档位 | 做法 | 适用 |
|---|---|---|
| 不用全局 | 状态留在组件里，数据靠 load 函数下发 | 默认选择（SvelteKit 页面态） |
| 请求级实例 | 工厂函数 + 每请求 `createCart()`，靠 context 传 | 需要跨组件共享的单页态 |
| 序列化回传 | devalue 把服务端初始态注入、客户端水合（12-sveltekit 专讲） | 需要 SSR 首屏带数据 |

一句话背给面试官："**runes 全局模块只属于客户端单页语义；上 SSR，模块级可变单例就是漏洞。**"（store 同理，呼应 svelte-stores 第四节坑 3。）

---

## 五、什么时候用什么（全课汇总表）

| 状态范围 | 首选 |
|---|---|
| 组件私有 | `let x = $state()`（组件内） |
| 父子两三层内 | props / `$bindable` / 状态提升 |
| 组件树环境量(主题/表单组) | context（上一课） |
| 真全局 + 纯客户端(登录态、购物车、toast) | **本课 `.svelte.js` 模块** |
| 异步流数据源 | readable store |
| SSR 页面数据 | SvelteKit `load` + `$app/state` |

---

## 六、自检清单

- [ ] 能默写 `cart.svelte.js` 模块单例模式,并说清"为什么 import 了就响应"。
- [ ] 会工厂函数形态及其可测试性优势。
- [ ] 会用 `$effect` 做 localStorage 写回,知道读/写各在哪。
- [ ] 会 `import.meta.hot.data` 防 HMR 清零。
- [ ] 能一句话讲清 SSR 跨请求泄漏的原因与三档对策。

---

🚀 **下一站 L5**：`svelte-forms`——form 元素增强 action、controlled/uncontrolled 双模式、校验与错误呈现,把 L1-L4 的零件组装成真实表单。
