# runes 内核：$state / $derived / $effect

> 目标：把 Svelte 5 响应式三件套讲透——`$state` 的**深响应**与 `$state.raw`、`$derived` 的**惰性求值**与 `$derived.by`、`$effect` 的**自动依赖收集 + 清理函数 + 运行时机**。建立"信号（signal）"心智：谁读谁订阅、谁写谁通知。逐条对照 Vue 的 ref/computed/watchEffect 与 React 的 useState/useMemo/useEffect。（呼应 vue-reactivity-theory、vue-computed-watch、react-usestate、react-useeffect、svelte-overview）

---

## 一、`$state`：可变状态，默认深响应

```svelte
<script>
  let count = $state(0);              // 基本类型
  let user  = $state({ name: 'Ada', tags: ['a'] }); // 对象/数组：深层也响应
</script>

<button onclick={() => count++}>{count}</button>
<button onclick={() => user.name = 'Bob'}>{user.name}</button>
<button onclick={() => user.tags.push('b')}>{user.tags.length}</button>
```

- **直接改就行**：`count++`、`user.name = ...`、`user.tags.push(...)` 都能触发更新——`$state` 将对象/数组包成**深度响应式代理**（和 Vue 的 `reactive` 一致；区别于 React 必须"整体替换 + 不可变"）。
- 对比 Svelte 4：旧版改 `obj.x` **不触发**、必须 `obj = obj` 重新赋值；runes 解决了这个最大的坑（呼应 svelte-overview 第三节）。

**`$state.raw`：只换引用、不做深代理**。适合大对象/immutable 数据/不需要深层追踪的场合，性能更好、语义更像 React：

```js
let points = $state.raw([{ x: 1 }, { x: 2 }]); // 内部元素不追踪
points = [...points, { x: 3 }];                 // ✅ 整体替换才触发
// points.push({x:4});                           // ❌ 不会触发更新
```

> 选择：**需要改对象内部属性/数组元素 → `$state`**；**用不可变方式整体替换、或存大对象 → `$state.raw`**（呼应 react-usestate 不可变心智）。

**`$state` 只能用于 `let`/`var`**，不能用于 `const` 或对象字面量属性；class 里也能用（字段加 `$state`），用于把状态封装成服务（见 L4）。

---

## 二、`$derived`：会自己追踪依赖的派生值

```svelte
<script>
  let nums = $state([1, 2, 3]);
  const sum   = $derived(nums.reduce((a, b) => a + b, 0)); // 声明式
  const double = (n) => n * 2;                              // 普通函数，非响应
</script>
```

- `$derived(表达式)`：编译器把表达式里读到的 `$state` 自动登记为依赖，依赖变则重算。等价于 Vue `computed`、React `useMemo`，但**无需手写依赖数组**。
- **惰性求值**：`$derived` 只在"被读取时"才计算，且带缓存——模板没用它就不算。这点和 Vue `computed` 相同、和 React `useMemo`（每次渲染都可能重算/需依赖）不同。
- 逻辑复杂时用 `$derived.by`（可写多条语句、能显式调用函数）：

```js
const stats = $derived.by(() => {
  const total = nums.reduce((a, b) => a + b, 0);
  return { total, avg: total / nums.length, max: Math.max(...nums) };
});
```

- ⚠️ `$derived` 里**不要写副作用**（不 `$state` 赋值、不发请求）；有副作用是 `$effect` 的活。派生应当是"纯计算"。

---

## 三、`$effect`：副作用，自动追踪 + 可清理

```svelte
<script>
  let query = $state('');
  $effect(() => {
    const id = setTimeout(() => console.log('搜索', query), 300);
    return () => clearTimeout(id);   // ← 清理函数：下次运行前 / 组件销毁时执行
  });
</script>
```

`$effect` 的四条要点：

1. **自动依赖收集**：回调里读到的 `$state`/`$derived` 都是依赖，变了就在**DOM 更新后**重跑。
2. **初始也会跑一次**（建立依赖），别指望它只在"变化时"跑。
3. **返回清理函数**：等价 React `useEffect` 的 return、Vue `onCleanup`。定时器/订阅/事件监听都在这里释放。
4. **运行时机是 flush 之后**：effect 在状态变化引起的 DOM 更新后执行，且同一批更新里多个 effect 会**批处理**，避免中间态。

**用 `untrack` 排除依赖**（只想读但不想被追踪时）：

```js
import { untrack } from 'svelte';
$effect(() => {
  untrack(() => console.log(ignoreMe.value)); // ignoreMe 变化不会重跑本 effect
});
```

> `$effect` 是"逃生舱"，不是默认选项。能用 `$derived` 表达的用派生；纯为了同步外部系统（第三方库、localStorage、焦点）才用 `$effect`（呼应 react-effect-patterns "何时不用 effect"）。

---

## 四、执行模型：谁是"读"、谁是"写"

Svelte 5 底层是**信号图**：`$state` 是 source signal，`$derived` 是 derived signal，`$effect`/模板是 consumer。规则：

- 在 `$derived`/`$effect`/模板里**读**一个信号 → 建立依赖边。
- `$state` **写** → 标记下游 dirty → flush 时按拓扑序重算派生、跑 effect、打 DOM 补丁。
- 因此：**"读"决定依赖，"写"决定传播**，不存在"忘记写依赖数组"的问题（对比 React 依赖数组是手动且易错）。

---

## 五、三框架对照表

| 需求 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 状态 | `$state(0)` | `ref(0)` | `useState(0)[0]` |
| 改对象内部 | 直接改 ✅ | 直接改 ✅ | 需整体新对象 |
| 派生 | `$derived(x*2)` | `computed(()=>x*2)` | `useMemo(()=>x*2,[x])` |
| 副作用 | `$effect(()=>{...})` | `watchEffect(...)` | `useEffect(...,[deps])` |
| 清理 | effect 里 `return` | `onCleanup` | 依赖项数组里 `return` |
| 依赖收集 | 自动 | 自动 | **手动** |

---

## 六、自检清单

- [ ] 能说清 `$state` 深响应 vs `$state.raw` 浅响应，各自适用场景。
- [ ] 知道 `$derived` 惰性求值 + 缓存，复杂逻辑用 `$derived.by`。
- [ ] 记住 `$effect` 初始会跑一次、返回清理函数、在 DOM 更新后 flush 执行。
- [ ] 会用 `untrack` 排除不想追踪的依赖。
- [ ] 能默写"Svelte 5 / Vue / React"三列在状态·派生·副作用上的对应写法。

---

🚀 **下一关**：`svelte-props` 讲组件的输入输出——`$props()` 声明、默认值、`$bindable` 双向绑定，以及"props 只读、要往上传就用回调"的单向数据流纪律。
