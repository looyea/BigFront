# vue-conditional-list 面试题精选

> 共 12 题，覆盖 v-if/v-show / v-for 与 key / diff 原理 / 指令组合 四类。

---

## 一、v-if vs v-show

### 1. `v-if` 和 `v-show` 有什么区别？分别适合什么场景？

`v-if` 是**真正条件渲染**：条件为假时不渲染、切换时销毁/重建 DOM 并触发组件挂载/卸载；`v-show` 始终渲染，仅用 CSS `display` 切换，不触发生命周期。**频繁切换**用 `v-show`；**初始可能不显示、切换少、需要每次真重新挂载**用 `v-if`（呼应 vue-conditional-list 第一节）。

**来源**：Vue.js — "Conditional Rendering: v-if vs. v-show"

### 2 `v-show` 有什么限制？

不能配 `v-else`；不支持在带多根的 `<template>` 上使用；且因为它一直渲染，条件内容里若有**重的初始化副作用**（如挂载即取数）会在初始就发生——这类"别提前跑"的需求要用 `v-if`（呼应 vue-conditional-list 第一节、vue-lifecycle）。

**来源**：Vue.js — "v-show caveats"

---

## 二、v-for 与 key

### 3. `v-for` 里 `key` 的作用是什么？

`key` 是节点在 diff 时的**唯一身份标识**。Vue 用它在新旧列表间匹配"哪个旧节点对应哪个新节点"，从而做**复用与最小移动**，而不是就地按下标盲目 patch。没有正确的 key，列表更新会错乱（呼应 vue-conditional-list 第五节、reactivity-theory patch）。

**来源**：Vue.js — "List Rendering / key"

### 4. 为什么不建议用数组 index 作为 key？

index **不唯一稳定**：插入/删除/排序后，index 与数据错位，Vue 会误认为"同一项"而复用错误的 DOM/组件——表现为子组件内部状态串行、input 内容错位、过渡动画/焦点跳到别项，且本该移动的节点被就地重建反而更慢。应使用数据自带的**稳定唯一 id**（呼应 vue-conditional-list 第五节）。

**来源**：Vue.js — "Avoid index as key"、社区 — "Why not use index as :key"

### 5. 什么情况下用 index 当 key 是可接受的？

列表**纯展示、永不重排/增删、无带状态的子组件**时才勉强可以。但只要存在排序或就地编辑，就应换稳定 id（呼应 vue-conditional-list 第五节）。

**来源**：Vue.js — "in-situ / simple lists"

### 6. `v-if` 分支切换时，为什么有时要手动加不同 key？

Vue 默认会尽量**复用**结构相同的元素（含其内部表单状态）。登录/注册两个相似表单用 `v-if/v-else` 切换时输入会残留，给各分支加不同 `key` 可强制重建、互不干扰（呼应 vue-conditional-list 第三节）。

**来源**：Vue.js — "Avoiding Element Reuse Across Branches"

---

## 三、diff 与性能

### 7. 简述 Vue 3 列表 diff 为什么需要 key，双端比较做了什么？

Vue 用**同层最小移动**策略：先头头/尾尾双端比较复用，遇到乱序时用 `key → 旧节点` 的 Map 精确定位并移动，尽量不动能复用的节点。key 让这个定位 O(1) 且正确。无 key 则退化为按下标就地 patch，乱序时既慢又错（呼应 vue-conditional-list 第五节、reactivity-theory、vue-performance）。

**来源**：Vue 源码 — "patchKeyedChildren / 双端+map"、社区 — "Vue diff 算法解析"

### 8. 大列表（上万条）渲染卡顿，从 key 与渲染角度有哪些优化？

稳定 key 避免整表重建；`shallowRef`/不深层代理减少响应开销；`v-memo` 缓存未变子树；`v-once` 标静态；**虚拟滚动**只渲染可视区。核心是"别为没变的项做 diff/patch"（呼应 vue-performance、reactivity-theory 第六节）。

**来源**：Vue.js — "v-memo"、社区 — "Virtual list / vue-virtual-scroller"

---

## 四、指令组合

### 9. 同一元素上 `v-for` 和 `v-if` 谁先执行？Vue 2 和 Vue 3 有何不同？

Vue 3：**`v-if` 先于 `v-for`**，因此 `v-if` 里拿不到 `item`；Vue 2 相反（`v-for` 先）。官方都**不推荐**同元素混用。Vue 3 中"过滤"用 computed 预处理、"整块开关"用外层 `v-if` 或 `<template v-for>`（呼应 vue-conditional-list 第六节）。

**来源**：Vue.js — "v-if and v-for 优先级"、Vue 风格指南

### 10. 想"遍历并对每项做过滤显示"，为什么不推荐 `v-for` 每项 `v-if`？

一是 Vue 3 里根本拿不到 item（优先级问题）；二是即便能，也会**对每项都执行条件判断、仍创建占位/判断成本**，且破坏 key 对齐。用 `computed.filter` 先算出子集，只渲染命中项、只算一次，语义与性能都更好（呼应 vue-conditional-list 第六节）。

**来源**：Vue.js — "Filtering with computed"

### 11. `v-else-if`/`v-else` 能单独用或中间隔别的元素吗？

不能。它们必须**紧跟**在前一个 `v-if`/`v-else-if` 兄弟之后（空白/注释节点除外），否则编译报错。需要多根分支时用 `<template v-if>` 包裹（呼应 vue-conditional-list 第二节）。

**来源**：Vue.js — "v-else-if / v-else"

### 12. `v-for` 遍历一个对象，别名顺序是什么？还能遍历什么？

对象为 `(value, key, index)`。此外 `v-for` 可遍历**数组**、**整数**（`v-for="n in 5"` 得 1..5）、**可迭代对象/字符串**；`in` 可写作 `of`（呼应 vue-conditional-list 第四节）。

**来源**：Vue.js — "Rendering List Items / Objects & Integer Range"
