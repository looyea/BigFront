# L2 阶段作业：TC39 Signals 实战

> 覆盖：tc39-core / tc39-control / tc39-frameworks
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（提案现状）
技术周报写道："signal-polyfill 已随 Chrome 130 内置，线上可直接 `signal(0)` 全局调用。"
指出两处事实错误并给出正确口径。

**Bug 2**（惰性计数）
```js
const a = signal(1);
const b = signal(2);
const sum = computed(() => a.get + b.get);
a.set = 10;
b.set = 20;
// 全程无人读取 sum
```
某同学断言"sum 的函数体跑了 2 次，因为两个依赖各变了一次"。判断并按'推标记+拉计算'说明实际次数。

**Bug 3**（effect 泄漏）
```js
function setup() {
  effect(() => console.log(userName.get));
}
setup(); setup(); setup();   // 组件反复挂载
```
内存持续增长、日志三倍打印。指出缺失的治理动作，给出两种修法。

**Bug 4**（循环更新）
```js
const count = signal(0);
effect(() => {
  console.log(count.get);
  count.set = count.get + 1;   // 想在 effect 里自动加一
});
```
控制台报警/栈溢出。指出'读即订阅'如何形成回环，把自增挪到哪里才是职责归位。

**Bug 5**（untrack 误用）
```js
const price = signal(100);
const cart = computed(() => untrack(() => price.get) * 2);
```
改 price 后 cart 永远返回旧值。指出 untrack 用错了位置——这里真正想要什么语义？

**Bug 6**（判等风暴）
```js
const pos = signal({ x: 0, y: 0 });
// 动画循环里：
pos.set = { ...pos.get };   // 每帧执行，多数帧坐标没变
```
下游 computed 每帧全量重算。指出默认 Object.is 判等如何被新引用欺骗，给三种梯度修法。

**Bug 7**（框架事实）
架构师断言："Svelte 5 的 $state 就是 TC39 提案规定的官方语法，Vue 3 已在 3.5 版本跟进对齐。"
指出两处的错误（提案与语法、Vue 的立场），给出正确表述。

**Bug 8**（Angular 形态）
```ts
const count = signal(0);
count.value = 5;          // 想写入
const double = count.value * 2;
```
在 Angular 组件里报错/不生效。指出把哪家的读写形状串台了，写出 Angular 的正确形态。

**Bug 9**（跨库直传）
团队把 Preact 的 signal 实例直接塞进 Vue 组件的模板当状态渲染，发现"Preact 侧改了、Vue 界面不动"。用'响应式只认协议'解释原因，给出适配层方案。

**Bug 10**（eager 错觉）
某同学从某库文档确认其 computed 是"依赖变化时立即重算"（eager）。他写下："所有 signal 实现都这样，成本无所谓。"
指出以偏概全在哪，说明惰性 vs eager 在大计算图上的成本差异，给出验证方法（本课实验 14 的思路）。

## 二、手写题（5 题）

**手写 1**：用 signal-polyfill（或 @preact/signals-core）实现"秒表"：running signal + elapsed computed + 一个 effect 每秒写一次 elapsed；要求 effect 返回的 stop 被正确清理。5 分钟内完成为标准。

**手写 2**：复现并修复 Bug 4：把自动自增改成①事件驱动写法、②确实需要派生时的 computed 写法。两版各不超过 8 行。

**手写 3**：给一个 `position = signal({x,y,z})` 写自定义 equals（逐坐标判等），再用 console 计数器证明：写入同内容对象时下游 0 次重算。

**手写 4**：手工填表——把 polyfill/Preact/Solid/Angular/Svelte runes 五家的"读、写、派生、副作用"四格 API 形状背写出来，错一格重抄全表。

**手写 5**：用 20 行内实现带脏标记的 mini-computed：`computed(get)` 返回 `{ get }`，上游 `mark()` 后首次读重算、重复读命中缓存（提示：版本计数即可）。

## 三、场景题（1 题，20 分）

某团队用 @preact/signals-core 管理一个 React 富文本编辑器的共享状态（文档、光标、协作成员在线列表、撤销栈）。上线后发现三类问题：① 每次按键全局 30 个订阅组件集体重渲；② 协作列表每 2 秒轮询写入，内容常没变也触发更新；③ 一个"字数统计 effect"里顺手读了光标位置，光标每次移动字数 effect 重跑。请用本课三阀（粒度/untrack/equality）分别诊断三问题的根因，给出修法并说明每条修法的代价与回退开关，最后给这个状态层立一条'订阅纪律'团队规范（≤3 行）。

## 四、简答题（3 题）

**简答 1**：为什么说 TC39 提案"标准化的不是浏览器内置函数，而是语义宪法"？用三件套+互操作契约展开。

**简答 2**：对比 Angular signals 与 zone.js 的关系、以及 React 生态里 signals-react 的争议——同样是 signal 进框架，两家触碰的各自"立国之本"分别是什么？

**简答 3**：untrack 被称为"逃生舱不是常规武器"，请给出它的三类正当用途与一条 code review 铁律。

## 五、挑战题 🏆（+10 分）

实现一个 60 行以内的 `mini-signals` 库：`signal/computed/effect/untrack` 四函数，要求 computed 惰性（无人读不重算）、effect 返回 stop、untrack 生效；附一段 10 行测试脚本证明：推标记拉计算次数正确、循环写入被报警、untrack 切断依赖。（分项合计 ≤10 分：四 API 可用 4 + 惰性证明 3 + 测试脚本 3——这正是 L9 sig-internals 的预演，做完即提前拿到终战关卡一半学分。）
