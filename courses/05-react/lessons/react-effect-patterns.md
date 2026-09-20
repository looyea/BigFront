# 副作用模式与坑

> 目标：把 useEffect 用到真实场景时会遇到三类硬骨头——**数据获取（含竞态）**、**订阅/外部系统**、**布局与注入类时机**。本课给出标准写法与坑位：`AbortController` 取消过期请求、`ignore` 标志防对已卸载组件 setState、`useLayoutEffect` 同步布局、`useInsertionEffect`（CSS-in-JS 专用）、以及"能用事件/派生/memo 就别用 effect"的判断树（呼应 react-useeffect、react-data-fetching、vue-async-suspense、node-async-errors 异步错误处理）。

---

## 一、数据获取 effect 的标准骨架

```jsx
useEffect(() => {
  const ctrl = new AbortController();
  let ignore = false;                 // 防对已卸载组件 setState
  setLoading(true); setError(null);
  fetch(`/api/user/${id}`, { signal: ctrl.signal })
    .then(r => r.json())
    .then(d => { if (!ignore) { setData(d); setLoading(false); } })
    .catch(e => { if (!ignore && e.name !== 'AbortError') { setError(e); setLoading(false); } });
  return () => { ignore = true; ctrl.abort(); };   // 卸载/重跑：取消 + 标记忽略
}, [id]);
```
两把锁缺一不可：
- **`AbortController`**：真正取消在途请求，省流量、避免慢覆盖快；
- **`ignore` 标志**：即使取消失败也保证过期结果不写 state。

---

## 二、竞态（race condition）为什么会发生

`id` 从 1 快速变到 2：两次 effect 各发一个请求，若"请求 1"回来得比"请求 2"**晚**，就把 2 的结果覆盖成 1（旧数据闪现/错误）。effect 的 **cleanup 在重跑前先跑**（`abort`+`ignore=true`）正好丢弃 1 的结果——这就是"依赖变化重建 effect"模型的威力（呼应 react-useeffect 第二节）。

---

## 三、订阅 / 事件 / 外部 store

```jsx
useEffect(() => {
  const onResize = () => setW(window.innerWidth);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);   // 必须对称移除
}, []);
```
要点：**add 与 remove 成对**（呼应 node-events 泄漏、vue-events off）。集成非 React 库（图表/地图）：在 effect 里 `new Lib(el)`、cleanup 里 `lib.dispose()`。高频外部 store 的订阅 React 提供专用 `useSyncExternalStore`（呼应 react-advanced-hooks）。

---

## 四、useLayoutEffect：绘制前同步改布局

当你要"读 DOM 尺寸/位置后立即再改 DOM，且不想让用户看到中间闪烁"：

```jsx
const ref = useRef(null);
useLayoutEffect(() => {
  const h = ref.current.offsetHeight;   // 测量
  // 同步调整，避免 paint 后跳动
}, [data]);
```
- 它在 **DOM 变更后、绘制前同步**跑（阻塞绘制），普通 effect 在绘制后异步跑；
- **SSR 会告警**（服务端无 DOM），要么 `import.meta.client` 守卫、要么优先 useEffect（呼应 react-useeffect 第四节、08-nuxt/SSR）。

---

## 五、useInsertionEffect：仅限 CSS-in-JS

第三类 effect，**在其它 effect 之前、DOM 变更时**注入样式，专为运行时 CSS-in-JS 库生成 keyframes 用。日常业务代码基本用不到，知道有它、别误用即可（三者顺序：insertion → layout → passive）。

---

## 六、"要不要用 effect"判断树

1. 值能由 props/state 推出？→ **render 里算** 或 `useMemo`，不用 effect；
2. 由**用户交互**触发？→ 放**事件处理器**，不用 effect；
3. 某步完成后要顺带做？→ 放到那步的事件处理器里，别 watch 一个 flag；
4. 子组件挂载时父想"同步"?→ 直接在父 render 传值，别 effect 推；
5. 只有"和**外部系统**同步（订阅/手动 DOM/网络/定时器）"→ 才用 effect，且配 cleanup。
滥用 effect 的坏味道：把派生数据存进 state、用 effect 同步两个 state、`useEffect(()=>{setX(...)})` 空转（呼应 react-useeffect 第七节、You Might Not Need an Effect）。

---

## 七、异步里的错误处理

effect 回调不能是 async（返回值会被当 cleanup），要内部定义 async 函数：
```jsx
useEffect(() => {
  (async () => { try { const d = await load(); if(!ignore) setData(d); }
                 catch(e){ if(!ignore) setError(e); } })();
}, [id]);
```
别吞异常——要么 setState 成错误态让 UI 呈现，要么冒泡到 ErrorBoundary（呼应 react-render-control、node-async-errors、exp 错误中间件分层兜底哲学）。

---

## 八、自检清单

- [ ] 数据获取 effect 里 `AbortController` 和 `ignore` 各自防什么？
- [ ] 竞态是怎么产生的？effect 的 cleanup 为什么刚好能治它？
- [ ] `useLayoutEffect` 和 `useEffect` 时机差异？SSR 要注意什么？
- [ ] `useInsertionEffect` 是给谁用的？
- [ ] 给出三条"不该用 effect、该用别的"的情形。

---

## 🚀 部署预告

- 手写数据获取 effect 到规模化就露怯（缓存/去重/失效/重试/加载态），那是 **react-data-fetching（L6）** TanStack Query 的地盘；
- 依赖数组里传对象/函数导致 effect 狂跑，解药在 **react-memo-hooks（L3）** 的 `useMemo`/`useCallback`；
- 全局错误冒泡与 ErrorBoundary 在 **react-render-control（L5）**，SSR 水合与 Next 在 **react-nextjs（L8）**（呼应 vue-async-suspense、node-async-errors）。

L2 完成。进入 **L3**：refs 与记忆化——先讲 `useRef`（DOM 引用 + 可变实例）。
