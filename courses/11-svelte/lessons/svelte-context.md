# Context 依赖注入

> 目标：掌握 `setContext` / `getContext` 这对跨层级通信原语——props 一层层传太累（drilling）、全局又太重时，context 是中间档。理解它的"初始化期一次性注入、非响应式外壳 + 响应式内核"语义，并对照 Vue 的 provide/inject、React 的 Context。（呼应 svelte-component-composition 第四节选型阶梯、react-context、vue-component-basics）

---

## 一、一对函数：祖先 set，后代 get

```svelte
<!-- Ancestor.svelte -->
<script>
  import { setContext } from 'svelte';
  let { children } = $props();
  const theme = $state({ color: 'dark', radius: 8 });
  setContext('theme', theme);          // 注入
</script>
<div class="app">{@render children?.()}</div>
```

```svelte
<!-- 任意深度的后代 -->
<script>
  import { getContext } from 'svelte';
  const theme = getContext('theme');    // 取用,跨层无 drilling
</script>
<div class="card" style="border-radius:{theme.radius}px">颜色：{theme.color}</div>
```

两条铁律：

1. **必须在组件初始化期（`<script>` 同步代码）调用**——不能放 `onMount`、不能放事件回调里再 `getContext`（拿不到/报错）。祖先的 `setContext` 必须**先于**后代初始化发生（模板上自然是祖先包后代）。
2. **context 本身不是响应式的**：`setContext('theme', {color:'dark'})` 传一个普通对象，之后不会自动更新。响应性来自你传进去的东西——传 **$state/$derived 对象**，它的字段就是活的（上面例子 `theme.color` 变化，所有读到它的后代更新）。

---

## 二、key 的选择：字符串 vs Symbol/对象

字符串 key 是全局命名空间——两个第三方组件都用了 `'theme'` 就互相踩。业界标准做法是**导出一个唯一对象或 Symbol 作 key**：

```js
// theme.js
export const THEME_KEY = Symbol('theme');
```

```svelte
<script>
  import { THEME_KEY } from './theme.js';
  setContext(THEME_KEY, theme);        // 祖先
</script>
```

```svelte
<script>
  import { THEME_KEY } from './theme.js';
  const theme = getContext(THEME_KEY, fallback);   // 第二参:取不到时的默认值
</script>
```

TypeScript 圈的经典模式是封装一个 `createContext` 辅助函数（Svelte 官方示例风格）：一个 `.svelte.ts` 里同时提供 `set(key, value)` / `get(key)` 包装，类型一处声明、消费端零断言（呼应 L7 svelte-typescript）。

---

## 三、典型场景一：表单字段组

`Form` 提供"注册+校验"上下文，`Input` 后代自动接入，无需用户手连：

```svelte
<!-- Form.svelte -->
<script>
  import { setContext } from 'svelte';
  let { children, onsubmit } = $props();
  const fields = new Map();
  const values = $state({});
  const validate = () => [...fields.values()].every(f => f.check());
  setContext('form', {
    register: (name, check) => fields.set(name, { check }),
    values,                       // $state 对象:响应式内核
    validate,
  });
</script>
<form onsubmit={(e) => { e.preventDefault(); if (validate()) onsubmit(values); }}>
  {@render children?.()}
</form>
```

```svelte
<!-- FormInput.svelte(任意深处) -->
<script>
  import { getContext } from 'svelte';
  let { name } = $props();
  const form = getContext('form');
  let el;
  form.register(name, () => el.checkValidity());
</script>
<input bind:this={el} name={name} bind:value={form.values[name]} />
```

同样的注册模式就是 L3 挑战题里 `<Tabs.List>` 路线的内核（子组件 getContext 后向父"报到"）。

---

## 四、典型场景二：主题/多语言等"环境量"

主题、locale、权限位这类"组件树环境"用 context 最顺：顶层 App `setContext`，深处任何组件 `getContext` 读。要"可切换"，就传 `$state` 对象或再给一个 `setTheme()` 方法——context 值不换、对象内部字段换，所有读者跟着更新（第一节铁律 2 的正解用法）。

---

## 五、和 Vue / React 的对照

| 维度 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| API | setContext / getContext | provide / inject | createContext + Provider/useContext |
| 调用时机 | 仅初始化期 | setup 期 | 任意(值变=重渲染) |
| 更新机制 | 传 $state 对象,字段级信号更新 | 传 ref/reactive,.value 变即更新 | value 引用变,**整棵子树重渲染** |
| key 冲突 | Symbol 自行规避 | 字符串/Symbol | 对象天然唯一 |
| 取不到时 | `getContext(k, fallback)` | `inject(k, def)` | undefined(或默认 context) |

React Context 的"Provider value 一变全部消费组件重渲染"在 Svelte 里不存在——信号直达真正读了那个字段的最小更新集合（呼应 svelte-overview 第二节细粒度更新）。

---

## 六、边界与反模式

- **context 穿透不了"独立挂载"的组件**：`mount()` 出来的、Portal 外的组件不在这棵模板树上，get 不到。
- **别拿 context 当全局总线**：组件树内的环境量才用它；跨页面/持久状态属于 svelte-global-state / store（下一课）。
- **别传"快照"**：`setContext('data', $state.get()?)` 之类把值拷出去=失去响应式；传**持有 $state 字段的对象**。
- context 查找沿模板树向上；同名多层 set，就近者胜（与 React 嵌套 Provider 同语义）。

---

## 七、自检清单

- [ ] 会背两条铁律：初始化期同步调用；context 非响应式、响应性靠 $state 内核。
- [ ] 会用 Symbol/导出对象作 key,`getContext(k, fallback)` 给默认值。
- [ ] 能写出"表单字段组"注册模式。
- [ ] 说得出 Svelte context 与 React Context 在更新粒度上的差别。
- [ ] 知道独立 mount 的组件拿不到 context。

---

🚀 **下一关**：`svelte-stores`——runes 时代之前 Svelte 的全局状态主角：`writable` / `readable` / `derived` 与 `$` 自动订阅，以及"今天还需要 store 吗"的官方答案。
