# useReducer 与并发 Hooks

> 目标：把"更少人熟、但工程价值高"的一组 Hook 补齐。本课：**`useReducer`**（用一处 reducer 管理多字段/复杂迁移，替代一堆 useState）、**`useId`**（SSR/水合安全的唯一 id）、**`useSyncExternalStore`**（安全订阅组件外的 store，防撕裂）、以及**并发 Hooks**——`useTransition`/`useDeferredValue`（把昂贵更新降为可打断的低优先级，保住输入流畅）。这些是理解 Zustand/Redux 与 React 18 并发的地基（呼应 react-usestate、react-state-mgmt、react-performance、react-render-model 并发）。

---

## 一、useReducer：把状态迁移收进一处

```jsx
const initialState = { count: 0, step: 1 };
function reducer(state, action) {
  switch (action.type) {
    case 'inc': return { ...state, count: state.count + state.step };
    case 'setStep': return { ...state, step: action.payload };
    case 'reset': return initialState;
    default: throw new Error();
  }
}
const [state, dispatch] = useReducer(reducer, initialState);
dispatch({ type: 'inc' });   // 描述"发生了什么"，不描述"怎么变"
```
适用：一个对象里**多字段一起变**、迁移逻辑复杂、多个子操作共享规则。优势：更新逻辑集中、可测（纯函数）、`dispatch` 引用稳定（适合传给 memo 子组件，呼应 react-memo-hooks）。这就是 Redux/Zustand 的心智雏形（呼应 react-state-mgmt）。

---

## 二、useId：水合安全的唯一标识

```jsx
const id = useId();     // 如 ":r1:"，服务端与客户端水合时生成同样的 id
<input id={id} /> <label htmlFor={id}>邮箱</label>
```
用途：给表单控件、`aria-*`、无障碍关联生成唯一且**两端一致**的 id。**别用 `Math.random()`/计数器**——那会导致 SSR 服务端与客户端 id 不一致、触发水合 mismatch（呼应 vue-ssr-nuxt 水合纪律）。

---

## 三、useSyncExternalStore：订阅外部数据源

React 渲染是"快照"，若边渲染边读一个会被外部随时改的 store，可能读到撕裂（同一次渲染里前后不一致）。`useSyncExternalStore` 封装"订阅 + 读快照 + 变化通知 React"，并内建防撕裂：

```jsx
const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
```
Zustand/Redux 的 React 绑定底层就靠它（SSR 版给第三个参数 `getServerSnapshot`，呼应 react-advanced-hooks、node 每请求隔离）。手写订阅 effect 能覆盖简单场景，但库级集成用它最稳（呼应 react-effect-patterns 第三节）。

---

## 四、并发 Hooks：useTransition 与 useDeferredValue

大列表筛选时输入卡顿，是因为一次 state 更新触发了很重的大渲染，阻塞了后续输入。React 18 允许把更新**标记为可打断的低优先级**：

```jsx
const [isPending, startTransition] = useTransition();
const onChange = (e) => {
  setText(e.target.value);                 // 紧急：输入框立即回显
  startTransition(() => { setQuery(e.target.value); });  // 过渡：大列表可被打断地更新
};
```
- `startTransition`：把某次 setState 包成"过渡"，高优先级（打字）可插队，isPending 显示加载态；
- `useDeferredValue(value)`：拿到一个"允许落后一拍"的 value，把慢渲染降为低优先级，无需自己分两次 state。
根因是 render 阶段可中断（呼应 react-render-model 第六节并发）。

---

## 五、怎么选

| 场景 | 选择 |
|---|---|
| 多字段联动、迁移规则集中 | `useReducer` |
| 跨组件共享 + 迁移规则集中 | store（Zustand/RTK，底层 useSyncExternalStore） |
| 表单/a11y 需要稳定唯一 id | `useId` |
| 订阅组件外可变 store | `useSyncExternalStore` |
| 昂贵列表/图表更新拖慢输入 | `useTransition`/`useDeferredValue` |

---

## 六、自检清单

- [ ] 什么时候把一堆 useState 换成 useReducer？好处？
- [ ] 为什么 useId 对 SSR 重要？用随机 id 会怎样？
- [ ] useSyncExternalStore 解决"读外部 store"的什么问题？
- [ ] startTransition 和 useDeferredValue 分别在什么时机用？它们优化的是什么？
- [ ] 这些和并发渲染的"可中断 render"有什么因果关系？

---

## 🚀 部署预告

- `useReducer`/`dispatch` 稳定引用与"迁移集中"是 **react-state-mgmt（L7）** Zustand/Redux Toolkit 的底层模型；`useSyncExternalStore` 正是它们的 React 绑定；
- 并发 Hooks 的"降优先级"依赖 **react-render-model** 的可中断 render 与 **react-performance** 的整体策略；
- L3 完成，进入 **L4**：组件通信与逻辑复用——先看 Context 跨层传数据（对照 Vue provide/inject）。
