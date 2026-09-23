# L1 阶段作业：心智与响应式内核

> 覆盖：solid-overview / solid-signals / solid-effect-tracking

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```jsx
const [count, setCount] = createSignal(0);
const c = count();               // 想在界面上显示"当前计数"
return <p>{c}</p>;
```
`setCount` 后页面纹丝不动。指出这行取的是什么、为什么丢响应、两种改法。

**Bug 2**
```jsx
function Card(props) {
  const { title } = props;       // 父组件会更新 title
  return <h1>{title}</h1>;
}
```
父组件改了 `title`，`<h1>` 不更新。指出 Solid 里 props 的真实形态、为何解构会定格、怎么改。

**Bug 3**
```jsx
const [items, setItems] = createSignal([1, 2, 3]);
// 想渲染随 items 变化的列表
return <ul>{items().map(n => <li>{n}</li>)}</ul>;
```
`setItems([...items(), 4])` 后列表不更新。指出组件"执行一次"如何导致 `.map` 冻结、正确用什么组件。

**Bug 4**
```jsx
const [user, setUser] = createSignal({ name: 'A', age: 1 });
user().name = 'B';               // 想改名字
setUser(user());
```
界面没反应。指出 setter 的哪条规则短路了这次更新、两种修法（换引用 / 换 API）。

**Bug 5**
```jsx
createEffect(() => {
  setTimeout(() => console.log(count()), 1000);   // count 变化时希望打印
});
```
count 变了、这个 effect 却不再跑。指出"同步追踪"为什么让 setTimeout 里的读没建立订阅、给两种修法。

**Bug 6**
```jsx
const [a, setA] = createSignal(1);
const [b, setB] = createSignal(0);
createEffect(() => { b(a() * 2); });   // 其实只想同步一次派生值
```
评审说"你不该用 effect 做派生、b 会慢一帧"。指出应改用哪个原语、为什么 effect 派生有中间态。

**Bug 7**
```jsx
function incTwice() { setCount(count() + 1); setCount(count() + 1); }   // 想 +2
```
实际只 +1。指出同一批次里 `count()` 读到的是什么值、改哪种更新形式能 +2。

**Bug 8**
```jsx
createEffect(() => {
  console.log(store.x);          // 只想在 y 变时打日志
}, /* 期望依赖 y */);
```
结果 store.x 一变就触发，出现"过度订阅"。指出 effect 自动订阅了什么、用哪两个工具能限定依赖/读而不订阅。

**Bug 9**
```jsx
const d = createMemo(() => {
  return open() ? value() : 'off';
});
```
面试官问：把 `open()` 改成 false 后再改 `value()`，memo 会因 value 重算吗？从"追踪的依赖由实际读到决定"角度答，并说明这算 bug 还是特性。

**Bug 10**
```jsx
import { render } from 'solid-js/web';
// ... 组件里 setInterval(() => setTick(t=>t+1), 1000) 起了个轮询
```
路由切走（组件销毁）后轮询还在跑、报错/泄漏。指出 Solid 靠什么机制回收订阅、应怎么注册清理。

## 二、手写题（5 题）

**手写 1** 写一个计数器组件：`createSignal(0)`、按钮 `onClick` 里用**函数式更新** `setCount(c => c + 1)`、JSX 里 `{count()}` 显示。两句话注释：① 为什么读要写 `count()`；② 为什么函数式更新比 `setCount(count()+1)` 稳。

**手写 2** 不看资料、用"观察者模式"手搓一个最小响应系统：`createSignal`（getter 里登记 `currentSubscriber`、setter 里相等短路并通知订阅集）+ `createEffect`（存 prev→设 currentSubscriber→同步跑 fn→还原）。用 `const [n,setN]=createSignal(0); createEffect(()=>console.log(n()))` 验证，说明"依赖到底在哪一步被登记"。

**手写 3** 用 `on` + `untrack` 写一个 effect：**只在 `a` 变化时**执行、执行时**顺手读一下 `b` 但不因 b 变化重跑**、首次 `defer` 不执行。三行以内代码 + 注释每个工具挡住什么。

**手写 4** 给定一个高频变化的 `scrollY` signal 和一个布尔 `showTop`（阈值 300 才 true），用 `createMemo` 把"要不要显示回顶按钮"收敛成派生，解释为什么让下游 effect/JSX 订阅这个 memo 比直接读 `scrollY()` 更省（消除过度订阅）。

**手写 5** 写一个"挂载起轮询、销毁自动停"的片段：`createEffect`/`onMount` 里 `setInterval`，配 `onCleanup(() => clearInterval(id))`；再用 `createRoot` 说明若轮询要跑在独立于组件作用域时该如何手动 dispose。

## 三、场景题（1 题）

一个 React 团队决定试点 Solid，把一批组件搬过来后冒出一堆"改了不更新/停不住/白屏"，逐条给诊断与修法：

① **冻结类**：有的页面数据变了 UI 不动——盘点三种最常见的"丢失响应"写法（快照赋值 / 解构 props 或 store / `.map`、`&&` 渲染），各给正确写法（memo / 直接读 getter / `<Show>`、`<For>`）；
② **异步失灵类**：某组件在 `await` 之后读一个 signal、期望它变化能触发，实际不能——解释同步追踪窗口，给出改用 `on` 或 `createResource` 的方向；
③ **派生 vs 副作用类**：团队到处用 `createEffect` 同步 A→B，出现闪一帧旧值、个别互相写入形成回环——说清"能声明式派生就别用 effect 命令式同步"，把合适的项改成 `createMemo`；
④ **清理类**：轮询/定时器/第三方实例在路由离开后仍在跑——用 Owner 作用域 + `onCleanup`/`createRoot` 给回收方案；
⑤ 给一份"React→Solid 迁移 code review 检查清单"（至少 4 条可机器或肉眼核对的项），并说明每条对应上面哪一类 bug。

## 四、简答题（3 题）

**简答 1** 用三句话讲清 Solid 的两条支柱，各"省掉了 React 的哪一步"。为什么 Solid 保留 JSX 却不需要每次渲染重跑组件？

**简答 2** 说出 signal 的"值相等短路"依据什么比较，并由此推出：什么时候用 `createSignal`、什么时候该上 `createStore`。各举一个存对象时的后果。

**简答 3** 解释"依赖追踪是同步按读登记的"这句话，并说明它如何同时解释：`.map` 渲染列表会冻结、`const c=count()` 丢响应、`await` 里读 signal 不触发——三者背后是同一条什么机制？

## 五、挑战题 🏆

**"同一个组件里的三种失灵"**：下面这段（React 同事写的）里有三处各自独立的问题：
```jsx
const [q, setQ] = createSignal('');
const [list, setList] = createSignal([]);
createEffect(() => {                 // (A) 想按 q 搜索
  const res = doSearch(q);           // 注意：这里传的是 q 不是 q()
  setList(res);
});
return (
  <ul>
    {list().map(x => <li>{x}</li>)}  {/* (B) */}
  </ul>
);
```
(a) 指出 (A) 把 `q` 当值传（而非 `q()`）为什么让 effect 既不追踪 q、搜索又拿到函数——给修法，并说明"输入后不发请求"的根因；
(b) 指出 (B) 的 `.map` 为什么让结果列表不更新，改用哪个控制流组件、它"记忆"了什么；
(c) 修好 (A) 后若 `doSearch` 内部 `await` 结果再 `setList`，是否仍有追踪问题？解释同步窗口与 resource 的取舍；
(d) 综合：给出"改一次输入→列表平滑更新"的最终正确写法（signal + 合适的追踪/resource + `<For>`），并一句话总结三处失灵共同依赖的 Solid 底层机制。

---

**本阶段关键词**：细粒度响应式、编译期 JSX、无 vdom/不 diff、组件执行一次、createSignal getter/setter 元组、读即订阅（count()）、写即通知、值相等短路（===）、原地改对象不更新、函数式更新 setCount(c=>c+1)、batch/untrack/on、currentSubscriber 同步收集依赖、setTimeout/await 里读追不到、createMemo 派生与早返回影响依赖集、createEffect 只做副作用、onMount 一次性、丢失响应四写法（快照/解构/提前求值/异步）、props 惰性 getter 不可解构、For/Show 而非 map/&&、For 记忆 item→DOM、signal vs store 选型、过度订阅、Owner dispose/onCleanup/createRoot、React-ism 迁移陷阱

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L2**：派生、状态与生命周期——`createMemo` 缓存派生、`createStore` 深层细粒度状态与 produce/reconcile、`onMount`/`onCleanup` 与 Owner 作用域如何界定"谁负责清理订阅"。
