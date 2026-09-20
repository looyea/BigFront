# useState 与不可变更新

> 目标：`useState` 是 React 状态的入口，但它和 Vue 的 `ref` 有本质不同——**state 必须被当作不可变值对待**，更新靠"造新值再 set"而非"就地改"。本课讲：`useState` 返回值与调用、函数式更新、惰性初始化、对象/数组怎么"改"（展开/映射）、`Object.is` 提前退出、React 18 自动批处理、以及"state 异步、本帧读到的是快照"（呼应 react-render-model、react-useeffect 闭包、vue-reactivity 的 ref 对照）。

---

## 一、useState 基础

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);   // [当前值, 更新函数]
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```
- `useState(初始值)` 返回 `[state, setState]` 数组（解构成任意名字，约定 `xxx`/`setXxx`）；
- 一个组件可多次 `useState`，每个是**独立**的一块状态（对照 Vue 多个 `ref`）；
- 状态"归属"这个组件实例，卸载即销毁（对照 vue-reactivity 的响应式）。

**关键差异**：Vue 里 `count.value++` 就地改即可触发更新；React 里绝不能改 `count`，必须调 `setCount(新值)`。

---

## 二、state 是不可变值：更新要造新对象

React 用 `Object.is(next, prev)` 判断要不要重渲染。你直接改原对象，引用没变 → React 认为"没变" → 不更新（且破坏了可预测性）。所以：

```jsx
// 对象
const [user, setUser] = useState({ name: 'A', age: 1 });
setUser({ ...user, age: user.age + 1 });        // ✅ 新对象 + 覆盖要改的字段
// setUser(user); setUser.age = 2;              // ❌ 同引用，不重渲染

// 数组
const [list, setList] = useState([]);
setList([...list, item]);                        // 追加
setList(list.map(x => x.id === id ? { ...x, done: true } : x));   // 改某项
setList(list.filter(x => x.id !== id));          // 删除
```
这就是"不可变更新(immutable update)"——每次造新引用（呼应 vue-state-patterns 的 single source、react-forms）。深层嵌套可用 immer 简化。

---

## 三、函数式更新：基于旧值时用

连续多次更新、或新值依赖旧值时，传函数 `prev => next`，避免读到陈旧快照：

```jsx
setCount(prev => prev + 1);     // 永远基于最新值
// 对比错误：连续两次 setCount(count + 1) 因 count 是本帧旧值 → 只 +1
const [n, setN] = useState(0);
setN(n + 1); setN(n + 1);        // 结果 1，不是 2（都是基于同一旧 n）
setN(p => p + 1); setN(p => p + 1);   // 结果 2 ✅
```
事件处理器、`setInterval`、异步回调里尤其要用函数式（呼应 react-useeffect 闭包陈旧值、react-render-model homework L1 第9题）。

---

## 四、惰性初始化：初始值要算的时候

```jsx
useState(JSON.parse(localStorage.getItem('k')));        // ❌ 每次渲染都 parse（浪费）
useState(() => JSON.parse(localStorage.getItem('k')));  // ✅ 传函数，仅首渲染算一次
```
传函数时 React 只在**挂载那一帧**调用它拿初始 state，之后忽略——这就是"惰性初始化"，适合从 URL/localStorage/大计算得来的初值（对照 vue ref 初值只算一次）。

---

## 五、state 是异步的、本帧读到的是快照

```jsx
setCount(5);
console.log(count);      // 仍是旧值！count 是本次渲染的常量快照
```
`setXxx` 只是"请求下次渲染用新值"，当前函数作用域里的 `count` 不变。要在**更新后**做事，用 `useEffect` 监听该 state，而不是紧跟在 set 后面读（呼应 react-render-model 第六节、react-useeffect）。

---

## 六、批处理与提前退出

- React 18：一次事件/微任务里的多次 `setXxx` **自动批处理**成一次渲染（呼应 react-render-model 第六节）；
- 若 `next` 与 `prev` `Object.is` 相等，React 可能跳过这次重渲染（提前退出），但仍会渲染子一次再决定是否继续，别把"值相等就不渲染"当绝对；
- state 存对象/数组时，务必新引用；存原始值时相等会 bail。

---

## 七、自检清单

- [ ] React 的 `useState` 和 Vue 的 `ref` 在"怎么改值"上最大不同是什么？
- [ ] 为什么 `setUser(user); user.age=2` 不触发更新？正确写法？
- [ ] 什么时候必须用函数式 `setXxx(prev=>...)`？
- [ ] 惰性初始化解决什么问题？怎么写？
- [ ] `setCount(5)` 后马上读 `count` 得到什么？为什么？

---

## 🚀 部署预告

- "state 是快照、异步更新"直接引出 **react-useeffect（L2 下一段）** 的依赖数组与"闭包捕获旧值"问题；
- 不可变更新是 **react-memo-hooks** 里 `useMemo`/引用相等、`React.memo` 浅比较能生效的前提；
- 多块 `useState` 变得零散时，复杂状态改用 `useReducer`（呼应 react-advanced-hooks），全局共享交给 store（呼应 react-state-mgmt、vue-pinia）。

下一关进入 **react-useeffect**：依赖数组语义、清理函数、执行时机，以及严格模式双调用与闭包陈旧值。
