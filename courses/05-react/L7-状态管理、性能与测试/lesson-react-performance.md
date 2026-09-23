# React 性能优化

> 目标：React 性能的第一性原理是**减少"做的工作"**——少渲染、渲染得便宜、少传大数据。方法论是"**先 Profiler 定位，再对症下药**"，别凭感觉 memo。本课讲：重渲染从哪来（呼应 react-render-model）、`React.memo`/`useMemo`/`useCallback` 的正确用法与失效陷阱、状态下沉与选择器、**列表虚拟化**、**代码分割**（lazy/Suspense + Vite 产物），以及 React Compiler 的前景。呼应 **react-memo-hooks**、**vue-performance**、**10-vite-splitting**。

---

## 一、先测量：渲染为什么慢

- 打开 React DevTools **Profiler**：录制交互，看哪些组件"渲染了多少次、每次多久"；
- 两类问题：**渲染次数太多**（多余重渲染）与**单次渲染太贵**（大列表、昂贵计算、大 DOM）；
- 别没测就上 memo——过度记忆化本身有内存/比较成本，还可能因依赖写错引 bug。Vue 侧同理先测（呼应 vue-performance）。

---

## 二、减少重渲染

回忆 **react-render-model**：state 变 → 该组件**及其所有子组件默认重渲染**。手段：

```jsx
const Row = React.memo(function Row({ user, onSelect }) { /* ... */ });
```
- **React.memo**：props 浅比较相等则跳过重渲染；但若父每次传**新对象/新函数**，memo 失效——所以要配合 `useCallback`/`useMemo` 稳定引用（呼应 react-memo-hooks、"传内联对象令 memo 失效"）；
- **状态下沉（colocation）**：把只被某子树用的 state 放到**尽量靠近使用者**的组件，别放顶层，避免顶层 state 一变整树重渲染；
- **子元素作为 children 传入**（组合，呼应 react-composition）：children 引用不变时，包裹组件重渲染不牵动 children 子树；
- **选择器订阅**（Zustand/useSelector）：只订阅用到的切片。

---

## 三、让单次渲染更便宜

- **列表虚拟化**：千行列表只渲染视口内的行（react-window / `useVirtualizer`），DOM 节点从 O(n)→O(可见数)，滚动才换内容——大列表卡顿的首选解；
- **稳定 key**（呼应 react-lists-keys）：避免无谓卸载重建；
- **昂贵计算 useMemo**：`useMemo(() => heavyTransform(items), [items])`；
- **拆组件**：把"会变的一小块"拆成独立组件，使 state 变化只重渲染那一块；
- CSS `content-visibility:auto`、避免在 render 里 `new Date()`/建大数组。

---

## 四、代码分割与加载性能

```jsx
const Dashboard = lazy(() => import('./Dashboard'));   // 独立 chunk
<Suspense fallback={<Skeleton/>}><Dashboard/></Suspense>
```
- 路由级/大组件 `React.lazy` + 动态 `import()` → Vite 自动切分 chunk，减小首包（呼应 react-render-control、10-vite-splitting）；
- 配 `import()` 的分组、`manualChunks`、按需引入重型库（别整包引 lodash/moment）；
- 首屏只载关键、其余进再载；预取 hover/focus 目标（`link rel=prefetch` / router `prefetch`）。

---

## 五、React Compiler（前瞻）

- React 18+ 实验性的**编译器**：在构建期自动为组件做**记忆化**（等价自动插入 memo/useMemo/useCallback），前提是你的组件**符合"React 规则"**（纯渲染、不改已渲染的 props/state、Rules of Hooks，呼应 react-custom-hooks）；
- 意义：把"手写 memo、稳定引用"这类负担交给编译器，多数手动优化在编译版下不再必要；理解本课原理仍重要——因为 Compiler 靠的是"你遵守了不可变/纯渲染"这些规则。

---

## 六、自检清单

- [ ] 性能优化第一步是什么？为什么不该凭感觉 memo？
- [ ] React.memo 为什么会"失效"？要保证什么稳定？
- [ ] 状态下沉、children 组合、选择器订阅分别怎么减少重渲染？
- [ ] 千行列表卡，第一招是什么？为何有效？
- [ ] lazy + import() 如何和 Vite 配合减小首包？React Compiler 靠什么前提工作？

---

## 🚀 部署预告

- 本课把"渲染模型 + 记忆化 + 虚拟化 + 代码分割"串成一条优化路径，并以 Profiler 收尾闭环；
- 下一关进入 **react-testing**：用 Testing Library 按"用户视角"测组件（render/queryBy/fireEvent/userEvent、findBy 处理异步、mock 网络），呼应 vue-testing、node-testing。
