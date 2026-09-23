# useRef 与 DOM 引用

> 目标：`useRef` 提供两件能力——① 拿到真实 **DOM 节点**去命令式操作（聚焦、测量、集成第三方库）；② 存一个**跨渲染保持、改动不触发重渲染**的可变值。本课讲：ref 的挂载与 `ref.current`、为什么 ref 更新不影响渲染、React 19 起函数组件直接收 `ref`（forwardRef 退场）、`useImperativeHandle` 控制暴露面、回调 ref，以及"能用 state/派生就别用 ref"的分寸（呼应 react-refs、vue-refs-expose、react-effect-patterns 存实例、react-state-mgmt）。

---

## 一、useRef 是什么

```jsx
import { useRef } from 'react';

function Form() {
  const inputRef = useRef(null);           // { current: null }，跨渲染保持同一对象
  const submit = () => {
    inputRef.current.focus();              // 拿到真实 DOM 节点，命令式操作
  };
  return <><input ref={inputRef} /><button onClick={submit}>聚焦</button></>;
}
```
- `useRef(initial)` 返回一个**可变对象** `{ current }`，组件整个生命周期是**同一个引用**；
- 把 `ref` 挂到 JSX 上，React 在 DOM 创建后把节点塞进 `ref.current`（**挂载后**才可用，呼应 vue 模板 ref 时机、react-render-model commit）。

**关键**：修改 `ref.current` **不会触发重渲染**——它是"渲染之外的一次性盒子"。要驱动 UI 更新就用 `useState`。

---

## 二、ref 更新不重渲染 → 什么时候正好

- 存**不需要参与渲染**的值：定时器 id、上一次滚动位置、是否首次挂载的标志、第三方库实例（呼应 react-effect-patterns 第8题）；
- 若把"滚动位置"存进 state，每次 scroll 都 setState → 疯狂重渲染；用 `useRef` 记 + 只在需要显示时读，性能天差地别（呼应 vue 里普通变量、react-performance）。

判断口诀：**会出现在 JSX 输出里的用 state，只是"记一笔"的用 ref。**

---

## 三、子组件 ref 与 forwardRef → React 19 变化

```jsx
// 旧（React ≤18）：函数组件默认收不到 ref，要用 forwardRef 转发
const FancyInput = forwardRef((props, ref) => <input ref={ref} .../>);
// 新（React 19）：ref 作为普通 prop 直接可用，forwardRef 基本退场
const FancyInput = ({ ref, ...props }) => <input ref={ref} {...props} />;
```
拿到子组件 DOM 后常 `useImperativeHandle(ref, () => ({ focus(){...} }))` **只暴露想开放的方法**，而非整个 DOM/实例——对应 Vue 的 `defineExpose`（呼应 vue-refs-expose、vue-sfc-compiler-macros）。

---

## 四、回调 ref 与测量

除了对象 ref，还可传函数（每次挂载/卸载被调用，参数为节点或 null）：

```jsx
<div ref={node => { if (node) elRef.current = node; }} />
```
用途：条件动态绑定、把节点存进 Map、或触发 `ResizeObserver`。测量尺寸/位置的时机要在**渲染之后**（effect/layout effect）读（呼应 react-effect-patterns 第四节、vue-onMounted）。

---

## 五、ref 的常见坑

- ❌ **render 期间读写 `ref.current`**：破坏纯渲染，并发/严格模式下会错乱；ref 只在事件/effect 里读写；
- ❌ 想"改了就更新视图"却用 ref：ref 不触发渲染，该用 state；
- ⚠️ 首帧 `ref.current` 为 `null`：节点尚未挂载，任何 `.current` 访问前判空；
- ⚠️ 别把大量本应 state 的东西塞 ref 来"躲渲染"——会失去可预测性（呼应 react-state-mgmt）。

---

## 六、自检清单

- [ ] `useRef` 返回的对象有什么特性？为什么改 `.current` 不重渲染？
- [ ] 什么时候该用 ref、什么时候该用 state？
- [ ] React 19 下子组件收 ref 的写法怎么变了？`useImperativeHandle` 干嘛用？
- [ ] 首帧 `ref.current` 是什么？该注意什么？
- [ ] 为什么不能在渲染阶段读写 ref.current？

---

## 🚀 部署预告

- ref "不触发渲染 + 跨渲染保持" 的特性，正是 **react-memo-hooks（L3 下一段）** 谈"引用相等 / 稳定依赖"的铺垫；
- 存第三方库实例、`useImperativeHandle` 暴露方法，与 **vue-refs-expose / defineExpose** 完全对照；
- 命令式测量/聚焦的时机依赖"渲染之后"，与 **react-effect-patterns** 的 layout effect 呼应。

下一关进入 **react-memo-hooks**：`useMemo`/`useCallback` 稳定引用、何时值得、以及 React Compiler 让手写记忆化逐步退场的展望。
