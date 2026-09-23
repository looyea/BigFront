# vue-conditional-list 面试题精选

> 共 15 题，覆盖 v-if/v-show / v-for 与 key / diff 原理 / 指令组合 四类。

---

## 一、v-if vs v-show

### 1. `v-if` 和 `v-show` 有什么区别？分别适合什么场景？

`v-if` 是**真正条件渲染**：条件为假时不渲染、切换时销毁/重建 DOM 并触发组件挂载/卸载；`v-show` 始终渲染，仅用 CSS `display` 切换，不触发生命周期。**频繁切换**用 `v-show`；**初始可能不显示、切换少、需要每次真重新挂载**用 `v-if`（呼应 vue-conditional-list 第一节）。

**来源**：Vue.js — "Conditional Rendering: v-if vs. v-show"

### 2. `v-show` 有什么限制？

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

---

## 补充（新专题 13-15）

### 13. Vue 3 diff 算法的双端指针+最长递增子序列完整走一遍：为什么 LIS 对"列表整体前移"场景仍是 O(n log n) 级重建，虚拟列表为什么能救？

新 旧 vnode 数组 先 头尾 双 指针 收缩（命中 复用+挪 指针），解 不了 的 中间 段 建 key→index map 逐项 找 旧 位；旧 索引 序列 求 **最长 递增 子序列**（LIS）：不在 LIS 上 的 节点 才 移动 DOM——最 优 情况「尾部 追加」旧 序列 全 递增，零 移动。但「整体 前移/倒序」这类 全局 重排：LIS 长度 小、要 移动 的 节点 多，DOM move（remove+insert）是 布局 开销 大头——算法 已 最 优，问题 在 **n 本身 太 大**。虚拟 列表（vue-virtual-scroller/自研）把 参与 diff 的 n 降到 可视区 数量 级：diff 只 对 窗口 内 十几 个 节点 做，滚动 时 换 窗口+key 复用；配 定 高 计算（绝对 定位/transform 顶 位）保 滚动条 正确。组合 出 答案 的 话 术：「diff 优化 的 是 常数 项 与 移动 次数，虚拟 列表 砍 的 是 n——两者 正交 且 都要」。

**来源**：Vue 源码 renderer.ts diff 算法与 LIS（getSequence 注释）；ivi/vue-virtual-scroll 与 react-virtualized 的 diff 对比分析（Evan You 博客引用）。

### 14. v-if/v-else 切换时组件实例发生了什么？想保留内部状态该怎么做，何时反而应该销毁？

v-if 翻 转：旧 分支 组件 **unmount**（beforeUnmount/unmounted、watch 停、DOM 卸）；翻 回=全新 实例（setup 重 执行、ref 初始值、弹窗 里 填 一半 的 表单 没了）。保留 状态 三 档：① v-show（最 便宜 但 永远 挂 着=常驻 内存+后台 定时器 都 还 活）；② KeepAlive（缓存 实例，配 include/exclude/max；弹窗/抽屉 场景 标准 答案，但要 处理 失活 钩子 deactivated 里 停 轮询）；③ 状态 上提（组件 销毁 但 数据 在 父/store，「表单 草稿 在 外部，弹窗 只是 视图」——架构 更 干净）。必须 销毁 的 场景：组件 内 有 全局 订阅/定时器 且 生命周期 逻辑 已 写好——destroy 反而 是 清理 器；「缓存 一切」导致 内存 缓慢 上涨 + deactivated 里 漏 停 的 轮询 继续 打 后端 是 反 模式。判据：状态 便宜 就 销毁（重建 即 新鲜），状态 昂贵/易 丢（长 表单、滚动 位置）才 缓存，且 缓存 要 设 淘汰（max/LRU）。

**来源**：Vue 条件渲染与 KeepAlive 文档；本关 v-if/v-else 机制与缓存策略通行实践。

### 15. 渲染 10 万条列表卡顿，按「先算法外、后数据结构」给一条完整优化路线。

第一 刀 **数据结构**：响应式 层面 降级——shallowRef 存 数组（10 万 对象 不 做 深层 代理，本包 响应式 关）；数据 本身 裁剪（后端 分页/字段 精简，别 把 全量 对象 扔 进 列表 再 用 3 个 字段）。第二 刀 **渲染 数量**：虚拟 滚动 把 DOM 节点 数 降到 几十（窗口 化 后 diff 压力 同 步 消失）；万级 以下 但 仍 卡 → v-memo（`v-memo="[item.id===selected]"`）给 静态 行 跳 diff。第三 刀 **单 行 成本**：行 组件 拆 薄（无 响应式 开销）、class 绑定 对象 字面量 转 computed、图片 懒加载。第四 刀 **更新 模式**：增量 合并（key 稳定 的 原地 patch）替代 整 数组 替换；批量 写 配 nextTick 合并。测量 先行：Performance 面板 看 是 render 函数 慢、patch 慢 还 是 浏览器 layout 慢——paint 瓶颈 时 减 行 内 DOM 深度 比 任何 JS 优化 都 管 用。底线：能 不 渲染 10 万 就 不 渲染（分页/搜索 是 产品 层 答案）。

**来源**：Vue 性能优化 官方 指南《大型 虚拟 列表》章节；vue-virtual-scroller 文档与 社区 大数据 列表 基准 测试。
