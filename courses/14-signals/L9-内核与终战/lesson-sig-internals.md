# sig-internals：手写 60 行 mini-signal

> 目标：不依赖任何库实现 signal/computed/effect 最小闭环——当前观察者栈、订阅集、推送通知三件套亲手写一遍；然后用 13 包学过的依赖图语言给这 60 行开验尸单：它缺的批处理、环检测、glitch-free、惰性求值，正是工业实现的溢价清单（呼应 solid-internals、svelte-reactivity-internals、interview-sig-debug q15）

## 一、三行设计宣言再走一遍代码

L1 立的 flag：signal=值+订阅者集合+拉取式读取。六十行就是这句话的直译：

```js
let CURRENT = null;            // 当前观察者栈顶：谁在读我？
const bump = { v: 0 };         // 全局版本号（调试用，可删）

function createSignal(init) {
  let value = init;
  const subs = new Set();      // 订阅者集合：记住谁读过我
  const signal = () => {
    if (CURRENT) { subs.add(CURRENT); CURRENT.deps.add(signal); }  // 读=建立依赖
    return value;
  };
  signal.set = (next) => {
    if (Object.is(value, next)) return;   // 值→变化闸门（equals 的极简版）
    value = next; bump.v++;
    [...subs].forEach(fn => fn());        // 推送：通知全部订阅者
  };
  return signal;
}
```

**读的时候建立依赖、写的时候广播**——全库共有的心脏就这两句。tc39-core 的『读即订阅』、MobX 的追踪窗口、Solid 的 get 陷阱，剥到底都是这个 `if (CURRENT)`。

## 二、computed 与 effect：栈一进一出，图就立起来

```js
function createComputed(fn) {
  const compute = () => {
    compute.deps.forEach(d => d.subs.delete(compute));   // 先清旧边（依赖集会变）
    const prev = CURRENT; CURRENT = compute;             // 压栈：从现在开始我监听了
    try { compute.value = fn(); } finally { CURRENT = prev; }  // 出栈：恢复现场
  };
  compute.deps = new Set(); compute.subs = new Set();
  compute();                                              // 首跑建立依赖
  compute.dependsOn = (target) => { /* 订阅 target 的通知，见下 */ };
  return compute;
}

function createEffect(fn) {
  const run = () => { /* 同款压栈出栈，跑用户副作用 */ };
  run.deps = new Set(); run.subs = new Set();
  run();
  return () => run.deps.forEach(d => d.subs.delete(run)); // 返回 dispose——退订纪律的出生地
}
```

computed 包一层『压栈-执行-出栈』，内部对 signal 的每次读都被 `CURRENT` 捕获——**依赖图不是分析出来的，是跑出来的**（solid-internals 的 track 机制原样）。`finally` 恢复栈是命门：忘了它，一次异常之后全世界都在替死者订阅。通知传播这里用最笨的『写→直接跑所有订阅者』：级联 computed 靠各自重跑来传导——能用，但 §三会告诉你它的账单。

## 三、验尸单：这 60 行缺的，恰是工业实现的钱

拿 13 包依赖图语言逐项点名：

1. **无批处理**：`a.set(1); b.set(2)` 触发依赖两者的 effect **跑两次**，中间那次是缝合态。工业方案各不同：MobX 推导状态机两阶段（先标记后执行）、Solid 调度器微任务批量、Vue `nextTick` 队列——本包的 batch/`untracked` 关关提，手写一次才知道它不是锦上添花；
2. **无环检测**：effect 里读又写同一个 signal → `fn()` 套娃栈溢出，还查不到栈里有环——MobX 的 `reactivity-check` 报错、signals 库的 cycle detection，都是给这条裸路装的护栏；
3. **glitch 不设防**：菱形依赖（a→b、a→c、b+c→d）下写 a，d 先拿『b 新 c 旧』跑一遍——**推送顺序当拓扑顺序用是原罪**，glitch-free（先集齐变更再按拓扑跑）是 13 包图语言的压轴概念，本实现直接违反；
4. **急切求值**：computed 定义即首跑、没人读也照通知——惰性（dirty 标记+读时重算）省掉的正是『没人看的派生全表重算』；
5. **订阅集是内存泄漏预约券**：`subs` 强引用 effect，组件销毁不调 dispose 永远存活——L7 坑3 的『N 次挂载=N 份活订阅』在 60 行里就能看到胚胎。

## 四、面试终题的验收单：把钩子焊上去

interview-sig-debug q15 的『三级调试钩子』（记录写入栈/通知计数/依赖快照）此刻从考题变练习：给 `signal.set` 加 `history.push({v: value, stack: new Error().stack})`、给通知循环加计数、给 `CURRENT` 建立边时 dump 一次 dep 图——**加完这三样，你手里就有一个（丑但真的）DevTools 内核**。面板只是日志的 GUI，这句话在 60 行代码上验证比任何面板都彻底。

往回收一句本包世界观：四大库互相换 API 不难（都是 §一那两句的变体），换**实现档位**才难——从 60 行到 1500 行（Solid 的量级），中间全是 §三清单上的名字。**会用信号是技能，知道信号廉价、一致性昂贵，才是本关要留下的直觉。**

> 🚀 部署预告：把 §一 §二 的代码抄进 sandbox 跑通『计数器+倍率 computed+日志 effect』，然后亲手制造 §三的三个事故：两次 set 让 effect 跑两遍抓缝合态、写一个环看栈溢出、删掉 dispose 看内存曲线——每个事故配一行修复思路注释，那就是你自己的 reactivity 设计文档第一页。
