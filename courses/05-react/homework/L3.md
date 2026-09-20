# L3 课后作业 —— Refs、记忆化与进阶 Hooks

> 覆盖本阶段三关：react-refs、react-memo-hooks、react-advanced-hooks。

---

## 一、读代码找 Bug（10 小题）

1. ```jsx
   const [pos, setPos] = useState(0);
   useEffect(() => {
     const on = () => window.addEventListener('scroll', () => setPos(window.scrollY));
     on();
   }, []);
   ```
   滚动很卡，还少了什么？
2. ```jsx
   const ref = useRef();
   return <div>{ref.current && <span>{ref.current.offsetWidth}</span>}</div>;
   ```
   宽度永远不显示，两个原因？
3. ```jsx
   const Child = React.memo(function Child({ style }){ ... });
   <Child style={{ marginTop: 8 }} />
   ```
   memo 不生效，为什么、怎么修（引 L3 memo）？
4. ```jsx
   const value = useMemo(() => ({ a, b }), [a, b]);
   useEffect(() => { use(value); }, [value]);
   ```
   这段其实合理；但把依赖写成 `[a,b]` 的 effect 里又 new 对象会怎样？说明引用稳定性。
5. ```jsx
   const [form, setForm] = useState({ name: '', age: 0 });
   // name、age、错误、dirty、提交态全塞一个 useState，逻辑散落十几个 setForm
   ```
   重构方向？给一句理由。
6. ```jsx
   const id = 'field-' + Math.floor(Math.random()*1000);
   <label htmlFor={id}>邮箱</label>
   ```
   SSR 下会出什么问题？该用什么？
7. 你在 `useMemo` 里写了 `fetch(...)`，偶尔发了两次请求——用"渲染可被重跑/丢弃"解释为什么不该在 useMemo 里做副作用。
8. ```jsx
   const [n, setN] = useState(0);
   const heavyList = expensiveFilter(all, n);   // all 有 5 万条
   ```
   每次渲染都全量重算，怎么优化？优化前先做什么？
9. 大列表实时过滤输入卡顿，`useDeferredValue(query)` 为什么能改善？它减少了 DOM 数量吗？
10. 用 `useReducer` 后把 `dispatch` 传给 memo 子组件，比传一个 `() => setX()` 好在哪？

---

## 二、手写编程（5 题）

1. 用 `useRef` + `useEffect` 实现"元素进入视口打点"的 `useInView(ref)`（IntersectionObserver，cleanup 断开）。
2. 把一个含 `items / filter / sort / page` 的联动状态，从多个 useState 重构为 `useReducer`，写 reducer + action。
3. 用 `useMemo` 缓存一个对 5 万条数据的过滤结果，并用 `React.memo` + `useCallback` 让子组件在无关 state 变化时不重渲染。
4. 用 `useTransition` 实现"输入即时回显、大列表低优先级更新"，并显示 `isPending`。
5. 用 `useSyncExternalStore` 订阅一个手写迷你 store（`{get,subscribe,set}`），实现跨组件共享计数。

---

## 三、场景题（1 题）

后台一个"订单表格 + 顶部筛选"页面：筛选改变会重算 2 万行、每次输入都卡；某个格式化函数很贵；一个子组件本不该跟随重渲染却在刷。请给出**分层优化方案**：区分"重计算 / 重渲染 / DOM 数量"三类问题，分别用 `useMemo`/`useCallback`+`memo`/`useDeferredValue`/虚拟滚应对，并说明**先用 Profiler 定位再动手**的流程（引 L3 + react-performance）。

---

## 四、简答题（3 题）

1. 一句话讲清 state 与 ref 的边界，并各举两个典型用途。
2. `useMemo` 依赖一个每帧新建的对象为什么会"假优化"？两种正确做法？
3. `useId`、`useSyncExternalStore`、`useTransition` 各自解决的"非显而易见"的问题是什么？

---

## 五、挑战题 🏆

写一个 `useDebouncedValue(value, delay)`：用 ref 存定时器 + `useEffect` 管理清理，返回防抖后的值；再基于它写 `useThrottledTransition`：结合 `useTransition` 把昂贵派生更新包进 `startTransition`。要求注释里说清"为什么定时器 id 用 ref 而不是 state"（呼应 react-refs 第二节、react-useeffect）。
