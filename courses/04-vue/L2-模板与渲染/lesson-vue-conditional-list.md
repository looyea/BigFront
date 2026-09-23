# 条件与列表渲染

> 目标：`v-if` / `v-show` / `v-for` 是模板里出现频率最高的指令，但它们的**运行机制差别很大**。本课掌握 **`v-if`（真正销毁/创建，惰性）与 `v-show`（CSS 切换，始终渲染）** 的取舍、`v-else`/`v-else-if`、`v-for` 遍历数组/对象/整数区间、**`key` 的作用与为什么不能用 index 当 key**、`v-for` 与 `v-if` 同元素的优先级与正确写法、`v-if` 上的 `key` 复用技巧、以及 `v-for` 里 `v-show`/计算属性的配合。（呼应 vue-reactivity-theory diff/patch、vue-template-syntax）

---

## 一、v-if vs v-show：本质区别

```vue
<p v-if="ok">A</p>          <!-- ok=false 时：节点根本不存在于 DOM -->
<p v-show="ok">B</p>        <!-- ok=false 时：display:none，节点一直在 DOM -->
```

| | `v-if` | `v-show` |
|---|---|---|
| 初始为假 | **不渲染**（惰性） | 渲染但 `display:none` |
| 切换开销 | 销毁/重建 DOM + 触发**生命周期** | 仅切 CSS，**不触发** mounted/unmounted |
| 编译开销 | 条件块独立按需编译 | 首屏就全部渲染 |
| 适用 | 很少切换、初始可能不显示 | 频繁切换、内容较重 |

口诀：**频繁切换用 `v-show`；条件渲染/惰性/需要"每次真重新挂载"用 `v-if`**。`v-show` 不能配 `v-else`，也不能用在 `<template>` 上带多根。（呼应 vue-lifecycle：v-if 切换会触发挂载/卸载）

---

## 二、v-else / v-else-if 与条件链

```vue
<div v-if="type === 'A'">A</div>
<div v-else-if="type === 'B'">B</div>
<div v-else>其它</div>
```
`v-else`/`v-else-if` 必须**紧跟**在前一个带 `v-if`/`v-else-if` 的元素之后（中间不能插入无关节点，空白/注释节点除外）。多根分支用 `<template v-if>…</template>` 包裹。

---

## 三、切换不同分支时避免"状态复用"：key

`v-if` 系列切换时，Vue 会尽量**复用**相同结构的元素（含其内部表单状态）。要强制"各分支独立、切换即重建"，加不同的 `key`：

```vue
<!-- 反面：登录/注册来回切，用户名输入框内容会残留 -->
<input v-if="mode==='login'" placeholder="账号" />
<input v-else placeholder="邮箱" />

<!-- 正确：用 key 区分，Vue 不再复用同一 DOM -->
<Input v-if="mode==='login'" key="login" />
<Input v-else key="register" />
```

---

## 四、v-for：遍历的四种源

```vue
<li v-for="item in list">{{ item }}</li>                <!-- 数组 -->
<li v-for="(item, i) in list" :key="item.id">{{ i }}</li> <!-- 带索引 -->
<li v-for="(v, k, i) in obj" :key="k">{{ k }}:{{ v }}</li> <!-- 对象 -->
<li v-for="n in 5" :key="n">{{ n }}</li>                <!-- 整数区间 1..5 -->

<li v-for="{ id, name } in users" :key="id">{{ name }}</li>  <!-- 解构 -->
```
`in` 也可写成 `of`（`v-for="x of list"`，兼容 JS `for...of`）。别名顺序：对象是 `(value, key, index)`。

---

## 五、key 的作用：为什么不能用 index ⭐

`v-for` 的 `key` 是 **diff 算法**识别"新旧节点谁对应谁"的身份牌。Vue 的 patch 靠 key 做**同层最小移动**复用，而不是就地按下标比对。

用**数组索引**当 key 的坑：当列表**插入/删除/排序**时，index 与数据错位，Vue 会误判"就是同一项"，导致：

- **DOM 复用错乱**（尤其带内部状态的子组件、input 值串行）；
- **性能不升反降**（本该移动的节点被就地重建）；
- **动画/焦点**跳到错误项。

```vue
<!-- ❌ 反例 -->
<li v-for="(t, i) in todos" :key="i">...</li>
<!-- ✅ 用稳定的唯一 id -->
<li v-for="t in todos" :key="t.id">...</li>
```

只有当列表**纯静态、永不重排、无组件状态**时，用 index 才勉强安全——但默认该避免。（呼应 vue-reactivity-theory：diff/patch 与复用；vue-performance 大列表）

---

## 六、v-for 与 v-if 同元素：优先级与正确写法

Vue 3 里 **`v-if` 优先级高于 `v-for`** 在同一元素上——此时 `v-if` 里**访问不到 `v-for` 的循环变量**（Vue 2 相反）。所以要"过滤式条件"时，**别把它们写在一个标签上**：

```vue
<!-- ❌ 同元素：拿不到 item，且每项都跑一次条件 -->
<li v-for="item in list" v-if="item.ok" :key="item.id">{{ item }}</li>

<!-- ✅ 用 computed 预先过滤（最佳：只渲染命中的） -->
<li v-for="item in okList" :key="item.id">{{ item }}</li>
```
```js
const okList = computed(() => list.value.filter(i => i.ok));  // 呼应 vue-reactivity 第四节
```

若确需"对整体加条件"，用 `<template v-for>` 包一层、`v-if` 放内层；反之"整块开关"用外层 `<div v-if>` + 内层 `v-for`。

---

## 七、自检清单

- [ ] `v-if` 和 `v-show` 分别在什么时机有开销？各适合什么频率的切换？
- [ ] 为什么登录/注册切换要加不同的 `key`？
- [ ] `v-for` 能遍历哪些源？对象别名顺序是什么？
- [ ] `key` 在 diff 里干什么？用 index 当 key 会引发哪三类问题？
- [ ] 同元素上 `v-if` 和 `v-for` 谁先执行？"过滤"应怎么写？

---

## 🚀 部署预告

- `key` 与最小移动 diff 的底层，正是 **vue-reactivity-theory** 里"trigger→重新 render→patch"的一环；大列表 + `key` + `v-memo`/`shallowRef` 的组合在 **vue-performance（L7）** 系统展开；
- `v-if` 切换触发组件挂载/卸载，直接联系下一阶段的 **vue-lifecycle（L3）** 与 `<KeepAlive>`；
- "过滤用 computed"再次印证 L1 的选型观：**派生数据用 computed，别用 v-if 在模板里做逻辑**。

L2 最后一关 **vue-class-style-transition**：`:class`/`:style` 的对象与数组语法、绑定 CSS 变量，以及 `<Transition>`/`<TransitionGroup>` 与列表动画（FLIP）。
