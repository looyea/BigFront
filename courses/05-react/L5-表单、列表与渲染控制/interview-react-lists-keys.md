# react-lists-keys 面试题精选

> 共 15 题，覆盖 A 列表渲染 / B key 与 diff / C index 之害 / D 派生列表·Vue 对照四类。

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

---

## 补充（新专题 13-15）

### 13.  同层 diff 时，React 依据 key 具体如何做「复用 / 移动 / 删除」的判定？placeChild 与删除标记的判据是什么？

React 用两段遍历：① 先从头同步遍历新旧 children，遇到 key+type 都相同就复用（生成 update 的 Fiber），一旦 key/类型对不上就 break；② 剩余旧 children 放进以 key 索引的 Map 供后面新节点查表复用，查不到就新建、并给旧节点打 deletion。移动判定：遍历新列表时维护 lastPlacedIndex，对每个复用节点取它在旧列表的 index，若 `< lastPlacedIndex` 说明它需要移动（插入位置在已排好的后面），否则 `lastPlacedIndex = 该 index` 不动。最终配合 LIS/最小化移动决定实际 DOM 搬移。讲清这条就能解释「为什么中间插入但保持 key 稳定只移动少数节点、而 index key 会让所有节点误判需移动」。

**来源**：React 源码 react-reconciler/Sibling 与 updateChildren 的 keyToIndex Map、lastPlacedIndex 逻辑。

### 14.  嵌套列表 / 树形结构怎么设计稳定且唯一的 key？为什么「整条路径 index」常常不够？

理想是「节点自身携带的全局稳定 id」（后端主键、uuid v7），与层级无关，最省心。当只能拼路径时，用「父路径 + 本层 id」组合键，但要警惕：① 纯 index 路径在任一层重排/删除后全链路错位（问题被层数放大）；② 节点在树里跨父移动（拖拽把 A 的子节点挪到 B 下），其 index 路径必然变→触发整棵子树卸载重建，state 全丢。所以只要允许移动/重排，就必须用不依赖位置的稳定 id。可折中：为每个数据实体维护一个「进入树时分配的、与位置无关」的 uid，渲染 key 用它。这与「数据没 id 怎么办」是同一命题的嵌套版。

**来源**：React 列表 key 最佳实践；树/可拖拽结构稳定 key 设计社区经验。

### 15.  若列表数据真的没有任何唯一 id 且内容可变，如何构造「尽量稳定」的 key？最终解是什么？

退而求其次可合成「准稳定 key」：挑几个「在项的生命周期内不变、且组合后区分度高」的业务字段拼接（如 `skuId + 首次出现的创建时间戳 + 价格档位`），避免用「会随编辑变化的字段」（用会被改的 name 当 key 等于没有 key）。若内容会变又不想错位，宁可退回 index（前提是列表不重排/不中部删）或强制每行不可有内部状态（无输入/勾选/动画）。但这些都是创可贴——真正的解是推动数据模型「每一行都有一个不透明、不可变、唯一的 id」，前端渲染层不该替数据层背这个债。面试把这层「临时缓解 vs 根因在数据」讲出来，比背「别用 index」更深。

**来源**：React「Index as a key is an anti-pattern」及无 id 数据建模建议；社区稳定合成 key 实践。
