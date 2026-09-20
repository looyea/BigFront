# react-lists-keys 面试题精选

> 共 12 题，覆盖 A 列表渲染 / B key 与 diff / C index 之害 / D 派生列表·Vue 对照四类。

---

## 一、列表渲染基础（A 类）

### 1. React 如何渲染一个列表？和 Vue 的 v-for 有何不同？

**答**：React 用原生 JS：在 JSX 的 `{}` 表达式里对数组调用 `map`，返回一组带 `key` 的元素，React 自动展开渲染。没有专用指令，就是普通 JS 数组方法。Vue 用 `v-for="(item,i) in items"` 指令 + `:key`，由编译器展开。差异根源：React "UI 即 JS"，一切用语言特性表达；Vue 用模板指令 DSL（呼应 react-jsx、vue-conditional-list）。

**来源**：React 官方文档 — Rendering Lists、Vue 官方文档 — List Rendering

### 2. `{}` 里能直接写 `if/else` 或 `for` 循环吗？渲染列表为什么用 map？

**答**：JSX 的 `{}` 只接受**表达式**，不接受语句（`if`、`for` 是语句），所以不能直接放。列表用 `map`（表达式，返回数组）；需要条件时用三元 `cond ? <A/> : null` 或 `&&`，或把逻辑提到 JSX 外用普通 JS 算好再插入（呼应 react-jsx 第二节、react-render-control）。

**来源**：React 官方文档 — JSX、Conditional Rendering

---

## 二、key 与 diff（B 类）

### 3. key 的底层作用是什么？没有 key 会怎样？

**答**：React 做同层 diff 时，用 key 把新旧子节点**一一对应**：key 相同则复用该位置的 DOM 与组件实例（保留 state、只 patch 变化），key 不同/缺失则视为新元素重建。没有 key 时 React 退化为用**索引**作隐式身份，一旦列表增删重排就会错误复用（见第 5 题），并打印告警。

**来源**：React 官方文档 — Lists and Keys、Rendering Lists、React 源码 reconciliation 章节

### 4. React 的 diff 有哪三条假设？key 属于哪一条？

**答**：① **同层比较**——只比同一层级的节点，跨层移动当作删除+重建；② **类型即身份**——元素 type 变了就整棵重建；③ **列表用 key 标识**——同一层内的数组子项靠 key 判断谁是谁。key 属于第三条，是 React 唯一能"信任开发者提供的身份"的地方，用来弥补它不做完整最小编辑距离（O(n³)）而换来的 O(n) 算法（呼应 react-render-model 第三节）。

**来源**：React 官方文档 — Lists and Keys、Understanding the diff algorithm

### 5. key 需要全局唯一吗？可以放在 Fragment 或组件上吗？

**答**：只需**同一父节点的兄弟之间**唯一，不同列表可重复。可放组件标签（`<Row key={id}/>`）——React 用它 diff 该组件在列表中的位置，但 key **不会**作为 prop 进入组件内部。Fragment 需要 key 时用显式 `<Fragment key={x}>…</Fragment>`（简写 `<>` 不能带 key）。

**来源**：React 官方文档 — Lists and Keys、Fragments

---

## 三、index 作 key 之害（C 类）

### 6. 为什么官方说"不要用数组 index 作 key"？请举一个具体的 bug。

**答**：index 不是数据的稳定身份——列表增删/重排后，同一个 index 指向的数据变了。例：一个每行有输入框的待办列表，在**顶部插入**一项后，原来 key=0 的节点现在对应新项，React 复用了旧 DOM 与旧组件 state，于是**用户在新行看到上一行残留的输入内容**、删除中间某行后其后各行状态整体错位。只有列表**完全静态**（永不增删重排）时 index 才安全，但那不如直接用 id。

**来源**：React 官方文档 — Rules of Keys、You Might Not Need an Index Key、Vue 官方文档 — 不要在生产用 index 作 key

### 7. 用 `Math.random()` 或时间戳作 key 会发生什么？

**答**：每次渲染都会生成不同的 key，React 认为"这是一个全新元素"，于是**卸载旧节点、重建新节点**——不仅性能极差，组件内部 state、焦点、动画每次都重置。key 必须**在多次渲染间保持稳定**，这正是要用数据自带 id 的原因。

**来源**：React 官方文档 — Lists and Keys

### 8. 如果数据真的没有唯一 id 怎么办？

**答**：优先在**数据源头**补一个稳定 id（后端返回、入库时生成 UUID、或用某个业务上天然唯一的字段组合）。避免临时 `Math.random()`。如果只是渲染顺序固定、永不变动的小静态列表，index 勉强可用，但更稳妥仍是给每项分配一次、之后不变的 id（如首次生成后存进数据）。

**来源**：React 官方文档 — Lists and Keys、UUID / crypto.randomUUID MDN

---

## 四、派生列表与 Vue 对照（D 类）

### 9. 渲染前要对列表做 filter/sort，怎么写才安全？

**答**：不要突变 state 数组。`filter`/`map`/`slice` 返回新数组可直接用；`sort`/`reverse` 会**原地改**，必须先拷贝：`[...items].sort(...)`。派生结果用 `useMemo` 缓存，依赖 `[items]`，避免每次渲染都重算和产生新引用（那会连带下游 memo 失效）（呼应 react-usestate、react-memo-hooks）。

**来源**：MDN — Array.prototype.sort（原地）、React 官方文档 — useMemo

### 10. React 里"改列表项内容但 React 认为没变"通常是什么错？

**答**：多半是**直接突变了原数组/对象再 setX(同一个引用)**——React 用 `Object.is` 比较，引用没变就跳过渲染（呼应 react-usestate）。正确做法是每次生成新数组/新对象（`map` 出新项、`[...arr]`、展开），让引用发生变化，React 才 diff 到内容更新。

**来源**：React 官方文档 — Updating State Immutably、Why is my component not re-rendering

### 11. Vue 的 `v-for :key` 和 React 的 `map + key` 本质区别？

**答**：本质相同——都是给同层列表项提供稳定身份供 diff 复用，也都不推荐 index。区别在表层：Vue 用编译指令 `v-for`/`:key`，且 Vue 有响应式 + patchFlag 做部分静态优化；React 是纯 JS `map`、返回 Element，运行时对列表做全量 key 匹配。心智模型一致，语法载体不同（呼应 vue-conditional-list）。

**来源**：Vue 官方文档 — List Rendering、React 官方文档 — Lists and Keys

### 12. 大列表（上千行）渲染卡顿，你在 React 里怎么优化？

**答**：① 保证 key 稳定以最大化复用；② **虚拟化**——只渲染视口内的行（react-window / react-virtualized / 自写 IntersectionObserver），把 DOM 节点数从 O(n) 降到 O(可见数)；③ 行组件 `React.memo` + 稳定 props/回调，避免任一状态变化导致整列重渲染；④ 昂贵派生 `useMemo`；⑤ 必要时 `useDeferredValue`/`startTransition` 降优先级（呼应 react-memo-hooks、react-performance）。

**来源**：React 官方文档 — Scaling React、react-window 文档、useDeferredValue
