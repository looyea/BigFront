# useMemo 与 useCallback

> 目标：`useMemo`/`useCallback` 是"引用记忆化"——**缓存一个计算结果 / 一个函数，直到依赖变了才换新**，用来避免昂贵重复计算、以及稳定 props 引用让 `React.memo` 与 effect 依赖如预期工作。本课讲清两者区别与联系、引用相等为何重要、什么时候**根本不该**记忆化，以及 **React Compiler** 如何自动做这件事、让手动 memo 逐步退场（呼应 react-render-model 重渲染、react-useeffect 依赖、react-performance、vue-reactivity-theory 的 computed 缓存对照）。

---

## 一、两个 API，一个目的：控制"引用"

```jsx
const value  = useMemo(() => expensive(a, b), [a, b]);   // 缓存"计算结果"
const fn     = useCallback(() => doX(a), [a]);           // 缓存"函数本身"
```
- `useMemo(fn, deps)`：deps 不变则返回**上次算好的值**，不重算；
- `useCallback(fn, deps)`：`useMemo(() => fn, deps)` 的语法糖，缓存的是**函数引用**；
- 记忆化比较的是**引用**（`Object.is`），对象/数组/函数每次渲染都是新引用——这正是需要它的原因（呼应 react-usestate 不可变、react-render-model 每次重跑）。

---

## 二、什么时候真正需要

1. **昂贵纯计算**：大数组过滤/排序/树构建，每帧重算浪费 → `useMemo`（对照 Vue computed 缓存）；
2. **稳定传给 memo 子组件的引用**：`React.memo(Child)` 靠浅比较 props，若你每次传 `style={{}}`、`onSelect={() => ...}` 新对象/函数，memo 直接失效 → 用 `useMemo`/`useCallback` 稳定（呼应 react-render-model 第四节、homework L1 场景题）；
3. **作为 effect 依赖的值**：对象/函数进 `useEffect` 依赖，每次新引用会让 effect 狂跑 → 记忆化稳定它（呼应 react-useeffect 第二节、react-effect-patterns 第4题）。

---

## 三、记忆化不是"越多越好"

`useMemo` 自身有成本（分配、依赖比较、内存）。**为便宜的值到处 memo** 反而更慢、更难读。判断：
- 值是给 DOM 用的普通字符串/数字 → 不用 memo；
- 没传给 memo 子组件、没进依赖数组的普通函数 → 不用 useCallback；
- 只有落入第二节三种情形才 memo。**先 Profiler 证明有瓶颈，再加**（呼应 react-performance）。

---

## 四、经典失效场景

```jsx
const data = useMemo(() => transform(list), [list]);   // list 若每次新引用 → 白 memo
<Child onClick={useCallback(() => go(id), [id])} />    // id 每次变 → 仍每次新函数
```
memo 依赖必须稳定，否则记忆化形同虚设。**不要 memo 一个本身每帧都变的值来"假装优化"**。深层对象可用选择器/原始值依赖替代（呼应 react-state-mgmt 的 selector）。

---

## 五、React Compiler：手动记忆化的退场

React Compiler（原 React Forget）在构建期**自动分析组件、插入等价于 useMemo/useCallback 的记忆化**，依赖由编译器推断，无需手写、也不会漏依赖。它成立的前提是你的组件**保持纯**（呼应 react-component 面试题第10题）。趋势：**新代码优先写清晰的纯组件，把 memo 交给编译器**；理解本课原理仍是为了读懂旧代码与排查。

---

## 六、对照 Vue：computed 为什么更"自动"

Vue 的 `computed` 基于 Proxy 依赖收集，天然缓存、自动追踪依赖、无引用问题；React 无内置响应式，派生值要么 render 里直接算（React 每帧重跑，简单值成本可忽略），要么昂贵时手动 `useMemo`。这是"框架帮你记 vs 你自己记"的又一处体现（呼应 vue-reactivity-theory、react-render-model 第三节）。

---

## 七、自检清单

- [ ] useMemo 与 useCallback 各缓存什么？二者关系？
- [ ] 为什么传内联对象/函数会让 React.memo 失效？怎么用这两个 Hook 修？
- [ ] 列举必须记忆化的三种场景。
- [ ] 为什么"到处 memo"可能是负优化？
- [ ] React Compiler 靠什么接管记忆化？它对组件提了什么要求？

---

## 🚀 部署预告

- `useMemo`/`useCallback` 存在的根因是 **react-render-model** 的"每次渲染重跑、引用每次都变"；
- 它是 **react-performance（L7）** 优化重渲染工具箱（`React.memo` + 稳定引用 + key + 虚拟化）的核心件之一；
- 更多 Hooks（`useReducer` 合并多状态、`useSyncExternalStore`、并发 `useDeferredValue`）在 **react-advanced-hooks（L3 下一段）**（呼应 vue-reactivity-theory computed、react-memo 对照）。

下一关进入 **react-advanced-hooks**：`useReducer`、`useId`、`useSyncExternalStore`，以及并发渲染的 `useTransition`/`useDeferredValue`。
