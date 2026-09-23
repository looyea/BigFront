# React 状态管理

> 目标：React 没有内置"全局 store"，状态管理是一串**取舍**而非固定答案。本课讲：先问"到底需不需要全局态"（大多数不需要），再按类别选工具——**局部态 useState/useReducer → 跨组件共享用 Context → 复杂/高频全局态用外部 store（Zustand 代表）→ 服务端数据交给 Query（L6）**。并讲单向数据流、slice + 选择器订阅避免重渲染。呼应 **react-context**（Context≠状态库）、**react-data-fetching**（服务端态分离）、**vue-pinia-basics**。

---

## 一、先别急着上库：状态该放哪

一条铁律（呼应 vue-state-patterns）：**把状态放在"需要知道它的最小公共父组件"**，能局部就局部，能派生就别存。
- 只有一个组件用 → `useState` 就地；
- 父子几层要共享 → 提到共同父，**向下传 props**（单向数据流）；
- 深层/广泛但低频（主题、登录用户）→ Context；
- 高频更新、多处细粒度读、需中间件/devtools → 外部 store；
- 来自服务器、只是缓存 → Query（**根本不算"客户端全局状态"**，见 L6）。

> "You Might Not Need a State Management Library"——多数被塞进 Redux 的状态，其实用组件局部 state + 数据流就够。

---

## 二、Context 做全局态（及其代价）

```jsx
const CountCtx = createContext(null);
function CountProvider({ children }) {
  const [count, dispatch] = useReducer(reducer, 0);
  return (
    <CountCtx.Provider value={{ count, dispatch }}>   // dispatch 引用稳定
      {children}
    </CountCtx.Provider>
  );
}
const useCount = () => useContext(CountCtx);
```
- 适合**读多写少、变化不频繁**的全局值；
- 代价：`value` 是**新对象**时所有消费者都重渲染，`React.memo` 挡不住 Provider 下的广播（呼应 react-context）；
- 缓解：① `value` 用 `useMemo`；② 拆成 `StateCtx` + `DispatchCtx` 两个 Context（动作不变、只状态变）；③ 把高频 state 尽量下推到局部。

---

## 三、外部 store：Zustand

```jsx
import { create } from 'zustand';
const useStore = create((set) => ({
  count: 0,
  inc: () => set(s => ({ count: s.count + 1 })),     // 单向：action 里算新值
}));

function A() {
  const count = useStore(s => s.count);              // 选择器：只订阅 count 切片
  return <button onClick={useStore.getState().inc}>{count}</button>;
}
```
- **选择器订阅**：组件只重渲染于它 `s => ...` 选中的切片变化——这正是 Context 难做到、Redux 靠 `useSelector` 做到的"细粒度更新"；
- store 在组件外、天然单例，`set` 支持函数式（读旧 `s`）；
- 中间件：`persist`（本地存储）、`immer`（直接"改"再冻结）、`devtools`；
- 对比 Redux：Zustand 样板极少、无 Provider（但 SSR 多请求要每请求建实例，呼应 react-custom-hooks SSR 一节）。

---

## 四、单向数据流与"派生而非存储"

- **单一数据源**：一个值只有一处真相，其余**派生**（`useMemo` 算，别复制进 state 再同步，避免双写不一致，呼应 react-usestate、vue-state-patterns）；
- **变更走 action**：组件不直接改 store 字段，调 `inc()`/`dispatch()`，让"谁改了状态"可追踪；
- **别把 props/context 复制进 state** 又用 effect 同步——这是"状态同步"反模式，能用派生就用派生。

---

## 五、Redux Toolkit（了解定位）

- `createSlice`（state + reducers 一处）、`configureStore`、`useSelector`/`useDispatch`；重但规范、时间旅行 devtools、适合**大团队/复杂状态机/需严格可预测**；
- 现在新项目多数场景 Zustand/Jotai（原子化）或 Context + useReducer 已足够；服务端数据一律 Query。选型看**团队协作与状态复杂度**，而非"越重越专业"。

---

## 六、自检清单

- [ ] 决定"要不要全局态"的第一原则是什么？
- [ ] Context 做状态库的最大代价是什么？如何拆 state/dispatch 缓解？
- [ ] Zustand 的选择器为何能减少重渲染？它和 Context 广播有何不同？
- [ ] 什么是"派生而非存储"？为何不要把 props 复制进 state 再同步？
- [ ] 服务端数据为什么不进 Zustand/Redux？

---

## 🚀 部署预告

- 本课给出选型决策树：局部 → Context → 外部 store（Zustand 选择器细粒度），服务端数据一律 Query；
- 下一关进入 **react-performance**：真正让 React 快的三件事——少渲染（memo/选择器）、渲染得便宜（虚拟化/列表 key）、懒加载（lazy/Suspense 代码分割），并用 Profiler 定位，呼应 react-memo-hooks、10-vite 产物拆分。
