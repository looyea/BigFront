# L6 阶段作业 · 进阶响应式与性能

> 范围：细粒度内核（signal/observer、动态依赖、同步追踪、Owner 树）、状态组织（store/produce/memo 派生/context）、性能（更新粒度、memo 收敛、untrack/on、batch、lazy/Suspense、onCleanup、For）。共 10 Bug + 5 手写 + 1 场景 + 3 简答 + 1 挑战。

## 一、找 Bug（每题 3 分）

**Bug 1**
```tsx
function Counter(props) {
  const { count } = props;
  return <p>{count}</p>;
}
```
父组件每次都传新的 `count`，但页面数字始终不变。指出问题并改对。

**Bug 2**
```tsx
createEffect(() => {
  setTimeout(() => console.log(price()), 500);
});
```
`price` 变了，控制台却始终打印初始值。为什么？给两种修法。

**Bug 3**
```tsx
const [state, setState] = createStore({ list: [] });
const { list } = state;
list.push(1);
```
界面上依赖 `state.list` 的地方没更新。两处错在哪？

**Bug 4**
```tsx
const total = createMemo(() => state.price);
```
面试官说这个 memo 是负担，为什么？应该怎么用？

**Bug 5**
```tsx
createEffect(() => {
  setState("count", state.count + 1);
});
```
页面卡死、无限增长。诊断并给出正确替代。

**Bug 6**
```tsx
function Todo() {
  const timer = setInterval(tick, 1000);
  return <div>{count()}</div>;
}
```
切换路由后 timer 仍在后台跑、内存上涨。补一行解决。

**Bug 7**
```tsx
<ul>{state.items.map((it) => <li>{it.name}</li>)}</ul>
```
items 频繁增删时整段 <li> 反复重建。换成什么、为什么更省？

**Bug 8**
```tsx
setA(1);
setB(2);
setC(3);
```
下游 effect 连着跑了三次。用什么把三次合并成一次？

**Bug 9**
```tsx
const [a, setA] = createSignal(1);
createEffect(() => {
  console.log("dep", b());   // b 是另一个信号，但这里不想被 b 拖着跑
  console.log("want", a());
});
```
b 每次变化都触发本 effect。如何只保留对 a 的订阅？

**Bug 10**
```tsx
const Heavy = lazy(() => import("./Heavy"));
return <Heavy />;   // 首屏就渲染它，但没做任何占位
```
白屏一段时间。缺了什么？它真的减小了首包吗，`lazy` 的作用是什么？

## 二、手写（每题 7 分）

**手写 1**：写一个 `createTemperature` 演示"动态依赖"——用一个开关信号 `show` 控制的 memo，`show` 为 false 时改 `unit` 不触发重算，并加 `createEffect` 打印，配文字说明观测到的现象。

**手写 2**：把下面这段"多个零散 signal + 手动同步"的任务状态重构成**一个 store + 路径 setter + produce**，并把派生的 `completedCount` 改成 `createMemo`：
```tsx
const [tasks, setTasks] = createSignal([]);
const [completedCount, setCompletedCount] = createSignal(0);
function toggle(id) {
  setTasks(tasks().map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  setCompletedCount(tasks().filter((t) => t.done).length); // 已知有 stale bug
}
```

**手写 3**：写一个可复用的任务上下文模块：`createTaskStore()` 工厂、`TaskProvider`、以及带"拿不到就抛错"守卫的 `useTasks()`（体现 `useContext` 的 `| undefined` 防御）。

**手写 4**：给一个"每次渲染都对大数组 filter + sort 且多处使用"的组件，用 `createMemo` 收敛这份计算，并在旁边注释：如果某个 memo 只是 `() => state.foo` 为什么不该存在。

**手写 5**：把一段"进关键路径就同步 import 重组件 + 手写 loading 布尔 + useEffect 式拉数据"的写法，改成 `lazy` + `Suspense` + `createResource`，让数据与代码都不阻塞兄弟内容。

## 三、场景题（20 分）

**场景：** 你接手一个 Solid 后台，列表页有约 2000 行、含筛选与排序，用户反馈"输入筛选关键字时整页卡顿、内存缓慢上涨"。代码里能看到：① 行组件把 `props` 解构了；② 每次输入都对全量数组 `filter().sort()` 后 `setState` 回 store；③ 一个 `createEffect` 里 `setKeyword(k)` 同步；④ 列表用 `items.map(...)` 渲染；⑤ 有一个没清理的 `setInterval` 轮询。请按"根因 → 修复手段 → 预期收益"逐条给出优化方案，并说明哪些属于"恢复细粒度"、哪些属于"减少计算/订阅"、哪些属于"防泄漏"。

## 四、简答（每题 5 分）

**简答 1**：用一句话分别说清 signal 的 getter/setter 各自在响应式里扮演的角色，以及"依赖是动态收集的"是什么意思。

**简答 2**：为什么"派生值用 createMemo、而不是存进 state 再用 effect 去 set"？给出至少两条理由。

**简答 3**：`untrack`、`on(deps, fn, {defer})`、`batch` 三者各解决什么问题？各给一个一句话场景。

## 五、挑战题（加分 10 分）

🏆 **挑战**：阅读下面代码，预测四行 `console.log` 分别打印什么，并解释每一次"跑/不跑"的响应式原因：
```tsx
const [a, setA] = createSignal(1);
const [b, setB] = createSignal(10);
const m = createMemo(() => {
  console.log("memo run");
  return a() > 0 ? a() : b();   // a>0 时只读 a，不读 b
});
createEffect(() => console.log("effect:", m()));
setB(20);   // ①
setA(-1);   // ②
setB(30);   // ③
```
(a) 初始 `effect:` 打印什么；(b) `setB(20)` 会否触发 memo 重跑/下游 effect；(c) `setA(-1)` 之后依赖集发生了什么变化；(d) `setB(30)` 会否触发、为什么。

---

**本阶段关键词**：signal/observer、动态依赖、同步追踪、render effect/computed/memo/effect 时序、createStore、路径 setter、produce、createMemo 派生、context/prop drilling、更新粒度、untrack/on、batch、lazy/Suspense、onCleanup、For keyed。

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L7**：SolidStart 上——项目结构、文件路由与数据加载，把纯客户端的响应式本领接到真实应用骨架上。
