# L2 阶段作业：派生、状态与生命周期

> 覆盖：solid-memo / solid-stores / solid-lifecycle

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```jsx
const [count, setCount] = createSignal(0);
const [name, setName] = createSignal('');
const isAdult = createEffect(() => count() >= 18);   // 想派生"是否成年"
return <p>{isAdult() ? '成年' : '未成年'}</p>;
```
`isAdult()` 报错或恒 false。指出该用哪个原语、为什么 effect 不行。

**Bug 2**
```jsx
const [first, setFirst] = createSignal('Jo');
const [last, setLast] = createSignal('Doe');
const full = createMemo(() => `${first} ${last}`);
```
名字改了 `full()` 却一直不变。指出读 signal 的写法错误。

**Bug 3**
```jsx
const [store, setStore] = createStore({ users: [{ id: 0, on: false }] });
console.log(store.users[0].on);           // 想在改值后自动打印新值
```
改 `store.users[0].on` 后这行再也不打印。指出原因（懒建 signal）与修法。

**Bug 4**
```jsx
const [store, setStore] = createStore({ user: { name: 'a', age: 1 } });
const u = store.user;
u.name = 'b';                              // 想改名
```
界面不更新。指出直接改 Proxy 取出的引用为何不可靠、正确 setter 写法。

**Bug 5**
```jsx
const [list, setList] = createStore([1, 2, 3]);
setList(5, 99);                            // 想把值设成 [1,2,3,?,?,99] 的某处
```
数组出现空洞 / 结果不符预期。指出索引越界写的问题，及"追加一项"的正确写法。

**Bug 6**
```jsx
setData('items', [...existingItems, newItem]);   // 想给 store 里的数组追加
```
能工作，但整表所有依赖都被惊动。指出更局部高效的替代写法（用 length 当索引）。

**Bug 7**
```jsx
onMount(() => {
  const chart = new Chart(document.getElementById('c'));
  // 组件卸载后 chart 还在，且路由内 topic 变时旧实例没销毁
});
```
指出缺了哪句回收代码、它该写在哪。

**Bug 8**
```jsx
createEffect(() => {
  const id = setInterval(() => console.log(tick()), 1000);
});
```
切走页面后日志疯狂叠加。指出缺什么、为什么 effect 重跑会让它更糟。

**Bug 9**
```jsx
// module 顶层
const [now, setNow] = createSignal(Date.now());
setInterval(() => setNow(Date.now()), 1000);
```
控制台出现 "...created outside a createRoot or render will never be disposed"。指出根因与两种修法。

**Bug 10**
```jsx
const temp = createSignal(72);
const unit = createSignal('F');
const on = createSignal(false);
const label = createMemo(() => {
  if (!on()) return 'off';
  return `${temp()}${unit()}`;
});
setUnit('C');            // 此时 on 仍是 false
// 期望 label 变，但没有
```
有人报"memo 坏了"。判断这到底是 bug 还是特性，并用一句话解释依赖集。

## 二、手写改造（5 小题，写出关键代码）

**手写 1** 有一个每帧变化的 `scrollY` signal 和一个"是否显示返回顶部按钮"的低频需求。用 memo 做"断链"，写出 `showTop` 与只订阅它的 `createEffect`，并一句话说明下游触发频率的变化。

**手写 2** 用 createStore 表示 `todos: [{id,text,done}]`，写出四行 setter：① 追加一项；② 把 id 为 2 的那项 `done` 取反（动态赋值）；③ 一次性把所有 `text` 以 "t" 开头的项标为 `done:true`（过滤函数）；④ 改第 0 项的 `text`（浅合并只给一个字段）。

**手写 3** 有一个异步接口每 2 秒返回一整个 `stats` 对象，但通常只有一两个字段变了。用 `reconcile` 把它并进 store，写出代码，并说明为什么"只变字段对应的订阅会被触发"。

**手写 4** 写一个 `<Timer/>`：显示从挂载起的秒数；用 `onMount` 起 `setInterval`，用 `onCleanup` 保证组件销毁时清掉定时器。给出完整最小代码。

**手写 5** 需要在组件树之外建立一个"贯穿 App 全程、手动才回收"的全局 `theme` signal 及其持久化 effect。用 `createRoot` 写出创建与（稍后）释放的代码，并说明 dispose 由谁持有。

## 三、场景大题（1 题）

**场景：一个"可编辑数据表格"组件。** 需求：5000 行 × 若干列，用户会高频编辑单个单元格；顶部有一个搜索框按关键字过滤；要显示"过滤后行数"；切换某列排序。请用本阶段三关（memo / stores / lifecycle）的知识给出组件骨架的状态设计与关键代码，并逐条回答：

(a) 行数据用 `createSignal` 还是 `createStore`？为什么？编辑单个单元格时写出对应 setter，并说明"为什么其它 4999 行不重渲染"。
(b) "过滤后列表""过滤后行数""排序后视图"三者如何组织成 memo 链？给出依赖关系，说明为何不该在每列渲染里各 filter 一遍。
(c) 搜索关键字用 signal；当关键字高频输入导致过滤很贵时，如何用 memo + （可选）防抖/resource 控制重算，说明 memo 在这里省了什么。
(d) 组件内起了一个 WebSocket 接收行更新，topic 会随用户选择变化、组件卸载要彻底断开。用 `createEffect` + `onCleanup` 写出"切 topic 自动退订旧订新、卸载自动关闭"的代码，并解释为什么不需要自己记录"当前连的是哪个 topic"。

## 四、简答题（3 题）

**简答 1** 用"惰性 / 缓存 / 即时一致"三个词分别解释 createMemo 的行为，并说明为什么"派生值用 memo"优于"用 effect 把派生值 set 回另一个 signal"（至少两点：中间帧、自激/回环）。

**简答 2** store 的 signal 是"懒建"的这一事实，如何同时解释：`console.log(store.x)` 顶层裸读不响应、`createEffect` 里读才响应？据此给出"我改了 store 但某处没更新"的三步排查顺序。

**简答 3** Solid 组件只执行一次，那 onMount / onCleanup 各自对应 React 的什么、又不同在哪？用"响应式 ownership 树而非 DOM 移除"解释：effect 每次重跑前会发生什么，以及为什么漏写 onCleanup 就会定时器/订阅叠加。

## 五、挑战题 🏆

**"派生链上的抖动"**：下面是同事写的一段，功能上能跑但性能与正确性都有隐患：
```jsx
const [w, setW] = createSignal(0);            // 每帧变的宽度
const big = createSignal(false);
createEffect(() => setBig(w() > 500));        // (A)
const style = createMemo(() => {
  if (!big()) return {};                       // (B)
  return { width: w() + 'px', color: 'red' };
});
const [cfg, setCfg] = createStore({ m: 1, list: [] });
createEffect(() => {
  setCfg('list', [...cfg.list, w()]);          // (C) 想每帧记录宽度
});
```
(a) 指出 (A) 用 effect 同步 `big` 的坏处，改用哪个原语、改后写法；
(b) (B) 里当 `big` 为 false 时改 `w`，style 会不会重算？这是不是 bug？用依赖集一句话解释；
(c) (C) 每帧都 spread 一个越来越长的数组、还每次都惊动所有 `cfg.list` 订阅者。指出两个问题（整体替换 vs 路径追加、以及响应式里做累积的时机），给出更合理的写法或改用 signal/局部变量的判断；
(d) 综合：把 (A)(B)(C) 修正成一份"宽度高频源只驱动必要下游、样式随 big 翻转才重算、累积不炸渲染"的写法，并用一句话总结"memo 断链 / 路径更新 / effect+cleanup 配对"三条本阶段主线在这段里分别落在哪。

---

**本阶段关键词**：createMemo 只读派生 signal、惰性+缓存+即时一致、memo 优于 effect 同步（无中间帧/无回环）、memo 断链收敛过度订阅、scrollY→showTop、早返回改变依赖集、createMemo(prev,init)、equals 自定义相等、何时别用 memo（内联即可）、createStore Proxy 路径订阅、signal 懒建、store 读无需()、顶层裸读不响应、setStore 路径语法（键/索引/索引数组/{from,to,by}/过滤函数/动态赋值）、单次 setter 自动 batch、对象浅合并、spread 追加 vs length 索引路径追加、produce 可变草稿、reconcile diff 更新、unwrap 裸对象、嵌套 store、onMount 挂载后一次/SSR 不跑、onCleanup 按 Owner 树、effect 重跑前触发 cleanup、createRoot 非自动回收/dispose、outside root 泄漏警告、createEffect vs createRenderEffect

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L3**：组件、模板与组合——把"组件是只执行一次的函数、props 是惰性 getter"讲透，掌握 `<Show>`/`<For>`/`<Index>` 控制流与 mergeProps、splitProps、Context 组合模式。
