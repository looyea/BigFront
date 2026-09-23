# L1 阶段作业：导论与全景

> 覆盖：sig-landscape / sig-paradigms / sig-map
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（年代与动机）
某同学笔记写道："Redux（2015）提出单向数据流治好了双向绑定的数据乱麻。"
指出这句话张冠李戴在哪，正确的因果链是什么。

**Bug 2**（不可变语义）
```js
function todosReducer(state, action) {
  state.push(action.newTodo);   // 想追加一条
  return state;
}
```
DevTools 里这条 action 之后视图不更新。指出违反了 Redux 哪条地基约定、连锁后果是什么。

**Bug 3**（Context 粒度）
团队把主题、登录态、侧栏开关全塞进一个大 Context 对象，发现"改侧栏开关，全网页都重渲"。用'粒度'语言解释病根，给两种修法（不换库）。

**Bug 4**（解构丢追踪）
```js
const { count } = someSignalStore;
setTimeout(() => console.log(count), 100);  // 期望永远是最新值
```
打印定格在首次取值。指出两个独立问题（解构快照 / 追踪作用域），各给修法。

**Bug 5**（useSyncExternalStore 误读）
某同学说："因为 React 18 有了 useSyncExternalStore，所以 Zustand 才能用。"
指出因果倒置在哪（时间线：Zustand v1 早于 React 18）。

**Bug 6**（范式错配）
```js
const store$ = new BehaviorSubject({ user: null, theme: 'dark' });
// 全应用 40 个组件 subscribe(store$)
```
每次任意字段变化，40 个组件全执行回调。指出这属于哪个库/范式的正确用法被误用成什么，给两个改进方向。

**Bug 7**（computed 重算误解）
```js
const a = signal(1), b = signal(2);
const sum = computed(() => a() + b());
a.set(2); a.set(3); a.set(4);   // 没人读 sum
```
新同学断言"sum 重算了 3 次"。判断对错并按'推标记+拉计算'模型说明实际发生了几次。

**Bug 8**（selector 新引用）
```js
const pos = useStore(s => ({ x: s.x, y: s.y }));  // Zustand
```
组件在无关字段变化时也重渲。指出引用比较被谁欺骗了，给两种修法。

**Bug 9**（提案现状失真）
技术方案里写："采用 TC39 Signals 提案的原生实现，浏览器已普遍支持 signal() 全局函数。"
指出两处事实错误（阶段与交付物形态）。

**Bug 10**（服务端态错置）
用 Zustand 存接口用户列表，手动维护 isLoading/isError/data 三件套，月月出竞态 bug。指出分层错误本质，给架构级修法与迁移步骤概述。

## 二、手写题（5 题）

**手写 1**：不查资料，写出 Zustand 最小 store（count + increment）并在组件中用 selector 只订阅 count。5 分钟内完成为标准。

**手写 2**：用伪代码/任意 signal 库实现"温度摄氏 signal → 华氏 computed → effect 打印"，并演示"改摄氏 3 次、effect 应各跑几次"的自我验证。

**手写 3**：把"输入框搜索：300ms 去抖 + 只保留最后一次请求结果"用 RxJS 管道写出来（操作符名要准确），再口述等价的纯 DOM 手写版需要哪几件状态。

**手写 4**：画出本包"库的野心"光谱（语言原语→应用框架），把 TC39 Signals/RxJS/MobX/Zustand 放上并各配一句"第一性用途"。

**手写 5**：用 30 行内 JS 实现一个玩具 observable：`createSignal(v)` 返回 `{get, set}`，`subscribe(fn)` 登记回调、set 时值变化才通知。（提示：这就是 signal 内核的 60%）

## 三、场景题（1 题，20 分）

某 50 人前端团队遗留 React 应用同时存在 Redux、MobX、大 Context 三套共享状态，新需求"购物车（跨页+持久化）+ 实时消息中心 + 编辑器画布联动"要落地。请给出：① 状态分层清单（组件/共享/领域/服务端四类各归谁）；② 三个新需求各自的技术选择与一句话理由；③ 存量三套的治理路线（冻结/收敛/清理三步各做什么）；④ 你会补哪一条团队规范防止继续腐化。

## 四、简答题（3 题）

**简答 1**：为什么说"每一代状态方案都把上一代机制吸收为子集"？用 Action、自动追踪、selector 三个概念的漂流各举一例。

**简答 2**：解释"signal 是寄存器、stream 是磁带"比喻，并各给一个对方不可替代的场景。

**简答 3**：Zustand 无 Provider 即可全局共享，这个特性的实现原理（模块单例+闭包）与它在 SSR 下的风险各是什么？

## 五、挑战题 🏆（+10 分）

为一家同时维护 React 与 Vue3 两套中台的公司，设计"共享状态逻辑层"方案：以 Signals 语义为核心（可选 @preact/signals-core 或 signal-polyfill），输出：① 分层架构图（逻辑层/绑定层/服务端缓存层）；② React 绑定用 useSyncExternalStore、Vue 绑定用 customRef 的示意代码各一段（各 ≤15 行）；③ 说明这套方案对"提案尚未落地"的现状做了什么妥协、将来提案定型后如何收编（分项合计 ≤10 分：架构 4 + 代码 4 + 演进说明 2）。
