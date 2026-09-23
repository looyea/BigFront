# useEffect 与依赖数组

> 目标：`useEffect` 是"渲染完成之后"跑副作用的地方——它不是 Vue 的 `watch`，而是"每次相关值变化就重新执行的一段同步逻辑 + 可选清理"。本课讲：effect 何时跑、**依赖数组的三种形态**与语义、清理函数、执行时机（commit 后、异步）、React 18 严格模式双调用、以及最坑的**闭包捕获旧值（stale closure）**（呼应 react-usestate 快照、react-render-model commit、vue-watch 对照、react-effect-patterns）。

---

## 一、useEffect 是什么

```jsx
useEffect(() => {
  // 副作用：订阅、手动改 DOM、打点、定时器……
  return () => { /* 可选：清理函数 */ };
}, [dep1, dep2]);   // 依赖数组
```
- 它在**渲染提交到 DOM 之后**异步执行（不阻塞绘制，呼应 react-render-model commit）；
- 语义是"**这次渲染的结果和外部系统同步**"，而非"值变了回调一次"（和 Vue `watch` 的心智不同）。

---

## 二、依赖数组三种形态（务必分清）

```jsx
useEffect(fn);            // 无第二参：每次渲染后都跑（几乎总不该这样）
useEffect(fn, []);        // 空数组：仅【挂载后】跑一次
useEffect(fn, [id]);      // 依赖 id：挂载后 + id 变化后跑
```
React 用 `Object.is` 逐个比较本轮依赖与上轮，**任一不同就重跑** effect（先跑上次的清理，再跑新的）。漏写依赖 = 读到旧值的经典 bug（见第五节、ESLint `react-hooks/exhaustive-deps`）。

---

## 三、清理函数：卸载前 / 重跑前

```jsx
useEffect(() => {
  const ws = new WebSocket(url);
  ws.connect();
  return () => ws.close();          // 组件卸载 或 url 变化重跑前，先 close
}, [url]);
```
- 清理发生在：**下次 effect 执行前** 和 **组件卸载时**；
- 订阅、定时器、事件监听、`AbortController` 都必须成对清理，否则**内存泄漏**（呼应 vue-events off、node-events 泄漏、events 的 addListener/removeListener 对称）。

---

## 四、执行时机：为什么是"渲染之后"

effect 在 paint 之后跑，所以它不该用来**计算渲染所需的派生值**（那应在 render 里算或用 useMemo）。只有"结果不影响本次渲染、但要和外部世界同步"才用 effect（订阅、日志、请求）。想在**绘制前同步读/改布局**用 `useLayoutEffect`（下一课，呼应 vue-onMounted 时机）。

---

## 五、闭包捕获旧值（stale closure）——头号坑

组件函数每次渲染重跑，effect 里闭包捕获的是**那次渲染**的 props/state 快照（呼应 react-usestate 第五节）：

```jsx
useEffect(() => {
  const t = setInterval(() => {
    setCount(count + 1);        // ❌ count 永远是挂载时的 0 → 一直变 1
  }, 1000);
  return () => clearInterval(t);
}, []);                          // 空依赖 → 闭包里 count 定格

// ✅ 修法一：函数式更新，不依赖外部 count
setCount(c => c + 1);
// ✅ 修法二：把 count 放进依赖（会每秒重建 interval，注意清理）
```
`exhaustive-deps` 规则就是逼你把闭包用到的值都列进依赖，避免"读到旧快照"。

---

## 六、React 18 严格模式：开发期挂载→卸载→再挂载

开发环境下 StrictMode 会把组件**挂载后再卸载再挂载**，effect 因此跑两遍（setup→cleanup→setup）。这不是 bug，是帮你**暴露缺失的清理**和依赖不纯的写法。生产只跑一遍。别为了"只跑一次"去 hack，而要让 effect + cleanup **对称幂等**（呼应 react-component 面试题第8题）。

---

## 七、什么时候根本不该用 effect

- 派生数据 → 在 render 里直接算 / `useMemo`（呼应 react-usestate 面试题第10题）；
- 事件响应用户操作（点击提交）→ 放进**事件处理器**，不是 effect；
- props 变化重置 state → 用 `key` 重置，而非"effect 里 set"；
- 只有"与外部系统同步"（订阅/手动 DOM/网络）才用 effect。滥用 effect 会造成瀑布式多余渲染与 bug（呼应 react-effect-patterns）。

---

## 八、自检清单

- [ ] `useEffect(fn)`、`fn,[]`、`fn,[a]` 三种分别何时跑？
- [ ] 清理函数在什么时点执行？不清理会有什么后果？
- [ ] 为什么定时器里 `setCount(count+1)` 会卡在旧值？两种修法？
- [ ] 严格模式双跑是 bug 吗？该怎么正确应对？
- [ ] 举三个"不该用 effect"的场景，该用什么替代？

---

## 🚀 部署预告

- 本课的"stale closure"根因是 **react-usestate / react-render-model** 的"每次渲染重跑 + 快照"；
- 依赖数组里传对象/函数会因新引用每次都触发 → 需 `useMemo`/`useCallback` 稳定（**react-memo-hooks，L3**）；
- 数据获取的竞态、`useLayoutEffect`、"何时不用 effect"的更多模式在 **react-effect-patterns（L2 下一段）**（对照 vue-watch 的 flush/竞态、node-async-errors 的异步错误）。

下一关进入 **react-effect-patterns**：数据获取与 AbortController 竞态、useLayoutEffect/useInsertionEffect、订阅与外部 store。
