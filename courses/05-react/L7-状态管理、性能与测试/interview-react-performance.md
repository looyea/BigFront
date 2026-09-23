# react-performance 面试题精选

> 共 12 题，覆盖 A 方法论与渲染模型 / B 记忆化与重渲染 / C 大列表与加载 / D React Compiler·Vue 对照四类。

---

## 一、方法论与渲染模型（A 类）

### 1. React 性能优化的整体思路是什么？为什么不该无脑 memo？

**答**：第一性原理是"少做工作"：减少渲染次数、降低单次渲染成本、少传/少载大数据。流程是**先 Profiler 测量定位瓶颈**（哪些组件渲染多少次、多久），判断是"多余重渲染"还是"单次太贵"，再对症。无脑 memo 的问题：记忆化本身有浅比较与内存开销、依赖数组写错会引 bug、很多"重渲染"其实很便宜（React 重渲染≠改 DOM，呼应 react-render-model）。优化要有证据。

**来源**：React 官方文档 — Profiler、Introducing the Profiler、React 官方 — 渲染行为

### 2. "重渲染"就一定会操作真实 DOM 吗？这对优化意味着什么？

**答**：不会。重渲染只是重跑组件函数、产出新 Element，再与上次 diff；若 diff 结果无变化，commit 阶段不动 DOM。所以**很多重渲染成本很低**，不必为每次重渲染焦虑——真正要优化的是"单次渲染很贵"（大列表、昂贵计算、大量 DOM）和"高频渲染叠加昂贵子树"。这解释了为何"减少渲染次数"和"降低单次成本"要分开对症下药（呼应 react-render-model 第四节）。

**来源**：React 官方文档 — Rendering behavior / reconciliation、Terms of & DOM diffing

---

## 二、记忆化与重渲染（B 类）

### 3. React.memo、useMemo、useCallback 分别缓存什么？如何配合？

**答**：`React.memo(Component)` 缓存**组件**——props 浅比较相等则跳过其重渲染；`useMemo(fn, deps)` 缓存**计算出的值**；`useCallback(fn, deps)` 缓存**函数引用**。配合：要给 memo 组件传稳定 props——用 `useCallback` 稳定回调、`useMemo` 稳定对象/数组，否则父每次渲染传新引用会让 memo 形同虚设（呼应 react-memo-hooks）。

**来源**：React 官方文档 — React.memo、useMemo、useCallback

### 4. 除了 memo，还有哪些更"釜底抽薪"的减少重渲染手段？

**答**：① **状态下沉/colocation**：把 state 放到真正需要它的最低层组件，缩小重渲染波及面；② **组合/children 传入**：把不常变的部分作为 `children`/slot 传进容器，容器重渲染不牵动已传入的元素（引用不变）；③ **选择器订阅**（Zustand/RTK）只订阅用到的切片；④ 拆组件隔离。这些往往比到处 memo 更有效也更省心（呼应 react-composition、react-state-mgmt）。

**来源**：React 官方文档 — Passing Children Explicitly、Optimizing performance、colocation

### 5. useMemo/useCallback 是"越多越好"吗？

**答**：不是。它们有创建与依赖比较的固定开销，对**廉价计算**用 memo 可能得不偿失；依赖数组漏写/多写会引入 stale closure 或失效（呼应 react-useeffect 依赖）。原则：只在"传给 memo 子组件要稳定引用"或"计算确实昂贵"时用，并优先靠**结构优化**（下沉、拆分）而非堆 memo。React Compiler 未来正是为免除这类手动判断（呼应 react-performance 第五节）。

**来源**：React 官方文档 — useMemo / useCallback 注意事项、You Might Not Need useMemo

---

## 三、大列表与加载性能（C 类）

### 6. 千行列表为什么卡？虚拟化为什么能解决？

**答**：一次性渲染上千 DOM 节点，创建/挂载/diff/布局/绘制的成本随行数线性增长，滚动或状态变化还触发大子树重渲染。**虚拟化**（react-window / `@tanstack/react-virtual`）只渲染**当前视口内 + 少量缓冲**的行，用一个撑高的容器 + 绝对定位模拟完整滚动条，DOM 节点数从 O(n) 降到 O(可见数)，故流畅。代价是要固定/估算行高、处理动态高度。

**来源**：react-window 文档、TanStack Virtual 文档、Web.dev — Virtualize DOM

### 7. 减小首屏包体积在 React + Vite 里怎么做？

**答**：① 路由级/重组件 `React.lazy(() => import())` + `<Suspense>` → Vite 按动态 import 自动 code-splitting 出独立 chunk（呼应 react-render-control）；② 按需引入第三方库（`lodash-es` 具名、别整包 moment→dayjs）；③ Vite `build.rollupOptions.manualChunks` 拆 vendor、公共依赖；④ 生产压缩/tree-shaking（呼应 10-vite-build、10-vite-splitting）；⑤ 预取关键后续资源。

**来源**：Vite 文档 — Build / dependency pre-bundling、Rollup manualChunks、React.lazy

### 8. key 不稳定为什么是性能问题？

**答**：若 key 每次渲染都变（`Math.random()`）或列表用 index 且会增删重排，React 无法把新旧节点正确对应，会把可复用的节点当作"新元素"**卸载重建**（连带子树 state 丢失、DOM 全量操作），diff 工作量与 DOM 操作暴涨。稳定唯一 key 让 React 走"移动复用"的快路径（呼应 react-lists-keys、react-render-model 第三节）。

**来源**：React 官方文档 — Lists and Keys、Rendering Lists

---

## 四、React Compiler 与 Vue 对照（D 类）

### 9. React Compiler 会取代手动 memo 吗？它的原理和前提是？

**答**：目标是——在构建期自动为组件做细粒度记忆化（等价自动插 `memo`/`useMemo`/`useCallback`），多数场景下开发者不再需要手动 memo。前提是你的代码**遵守 React 规则**：渲染是纯的、不突变已渲染的 props/state、Rules of Hooks、可标注的不可变数据（呼应 react-custom-hooks）。短期仍需理解本课原理，因为 Compiler 的收益正建立在"你遵守了不可变/纯渲染"之上；违反规则的地方 Compiler 也无法优化。

**来源**：React 官方文档 — React Compiler、React Labs: Compiler、Rules of React

### 10. Vue 和 React 在"要不要手动优化重渲染"上的最大差别？

**答**：Vue 有**编译期 patchFlag + 响应式依赖追踪**：只有真正相关的节点/组件更新，`computed` 自动缓存，多数性能问题框架层面就消化了，开发者较少手动 memo。React 是**运行时全量重渲染 + diff**，默认父变子都重跑，故更依赖开发者用 key/memo/选择器/结构优化给"提示"（呼应 vue-reactivity-theory、react-render-model）。React Compiler 正试图用编译期能力抹平这部分差距。

**来源**：Vue 官方文档 — Rendering Optimizations / patch flags、React 官方文档 — Rendering behavior

### 11. 一个输入框每敲一个字整页就卡，你会怎么排查和修？

**答**：先 Profiler 录制，确认是不是"顶层 state 一变全树重渲染"。修法：① 把输入的 state **下沉**到输入框所在小组件，别放页面顶层；② 昂贵列表/图表用 `React.memo` + 稳定 props，或用 `useDeferredValue`/`startTransition` 让慢更新降优先级、输入保持跟手（呼应 react-advanced-hooks）；③ 大列表虚拟化；④ 昂贵派生 useMemo。根因通常是"状态放太高 + 大子树跟着渲染"。

**来源**：React 官方文档 — Managing state / colocation、useDeferredValue、Rendering performance

### 12. 如何量化一次优化"值不值"？

**答**：用可复现指标：Profiler 的 **Actual Duration**（每次提交渲染耗时）与 **Commit Count**（渲染次数）前后对比；大列表看 FPS / Long Task（Performance 面板）；加载看 **首包体积**（Vite build 输出 / bundle 分析）、LCP/TBT（Lighthouse）。设基线→改一处→再测，避免"凭感觉变快"。若指标无明显改善就不值得增加 memo 的复杂度——工程上"能测量才优化"（呼应 react-performance 第一节、10-vite-deploy）。

**来源**：React DevTools Profiler 文档、web.dev — Measure performance、Lighthouse
