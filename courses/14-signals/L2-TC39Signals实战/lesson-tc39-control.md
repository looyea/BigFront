# tc39-control：watch / untrack / equality——订阅控制

> 目标：治理『读即订阅』带来的过度订阅与误判变化，掌握 watch、untrack、自定义 equality 三件控制阀（呼应 solid-effect-tracking、svelte-effects-advanced）

## 一、问题的根源：读即订阅是把双刃剑

tc39-core 立过宪法：函数体里读到谁，就订阅谁。它换来零依赖数组的心智红利，也带来三个必须正视的副作用：

1. **过度订阅**：你只想"顺便瞄一眼"某个 signal，却建了一条永久订阅——它每次变你都重跑；
2. **误触发**：写入一个"内容相同、引用不同"的新对象（`{...obj}` 展开是家常便饭），默认按引用判等，下游全体被惊动；
3. **失控传播**：effect 里调用第三方代码，对方内部读了什么 signal 你根本不知道，订阅图被动扩张。

提案与各家实现给了三个控制阀，逐一对症。

## 二、watch：观察而不建细粒度依赖

`watch`（提案讨论中的语义，Preact/Solid 各有近亲实现）解决场景一：**"我只关心'它变了'这个事件，不关心'它变成了什么的全家当'"**。

```js
import { signal, effect } from 'signal-polyfill';
// 各家近亲：Solid 的 untracked 读 + on(f) / Vue 的 watch(src, cb, {flush}) /
// Preact 里手写：用一个普通订阅回调替代 effect 追踪

const user = signal({ name: 'ann', loginAt: Date.now() });

// 需求：只在 user 被"整体替换"时打埋点，不想因追踪 user.name 的读取而多订阅
effect(() => {
  const u = user.get;          // 只读容器本身这一层
  analytics.track('user-swapped', u.name);  // 内部字段不再深入追踪
});
```

关键区分三种读取姿态：

| 姿态 | 语义 | 工具 |
| --- | --- | --- |
| 深度追踪 | 读到哪个字段订阅哪个字段 | 默认行为 |
| 浅观察 | 只订阅容器被替换这件事 | watch / 单层读取 |
| 完全不订阅 | 这次读取别记账 | untrack |

## 三、untrack：这次读取别记账

`untrack(fn)` 执行 fn，期间所有 signal 读取**不登记为依赖**：

```js
import { signal, computed, untrack } from 'signal-polyfill';

const items = signal([3, 1, 2]);
const showBanner = signal(false);

const text = computed(() => {
  const sorted = [...items.get].sort((a, b) => a - b);
  // 横幅开关只影响文案拼装，不该让"切横幅"触发排序重算
  return untrack(() => showBanner.get) ? `置顶! ${sorted}` : `${sorted}`;
});
```

没有 untrack 的世界：切一下 `showBanner`，整条排序管道重跑。有了它，`showBanner` 的变化只惊动真正订阅它的 effect，computed 依赖图保持干净。

**untrack 的纪律**：它是逃生舱不是常规武器。每条 untrack 都意味着"这里有一个隐式依赖，我选择手动负责"。code review 规范建议：untrack 必须带注释说明"为什么这个读取不该建依赖"。滥用 untrack = 用回手写的 useMemo 心智，自动追踪红利清零。

典型正当用途三类：

- 日志/埋点里读取当前值但不建订阅；
- 防御式编程：读取可能触发循环的 signal（tc39-core 误区三的解药之一）；
- 性能：昂贵派生链的入口只想订阅"变化事件"而不要"值依赖"。

## 四、equality：变化到底由谁说了算

默认判定是 `Object.is`——NaN 等于 NaN、+0 不等于 -0、对象比引用。这让每次"内容不变的新对象写入"都变成一次全图风暴：

```js
const pos = signal({ x: 0, y: 0 });
pos.set = { ...pos.get };        // 内容没变，Object.is 说不一样 → 下游全体重跑
```

提案与各家实现允许**自定义相等函数**（polyfill 语境下 `signal(value, { [SIG_EQUALS]: fn })` 形态在演进，Solid/Preact/Vue 均已内建同款）：

```js
// Solid: createSignal(init, { equals: deepEq })
// Vue:   watch(src, cb, { deep: true }) 或 customRef 自控触发
// 自定义思路：
const pos = signal({ x: 0, y: 0 }, {
  equals: (a, b) => a.x === b.x && a.y === b.y,   // 逐字段判等，相同则不通知
});
```

**equality 的成本账**：判等函数每次写入都跑。浅比较近似免费；深比较 O(子树) 可能比"直接重渲"还贵——大对象慎上 deep equal，这是 MobX 社区用血泪验证过的老账（L4 mobx-core 会再遇到它）。折中方案：结构性共享（不可变更新保证"没改到的字段引用不变"，浅比较即可命中，呼应 za-middleware 的 Immer 讨论）。

## 五、三阀合奏：一次搜索框的完整治理

```js
const query = signal('');
const results = signal([]);

effect(() => {
  const q = query.get;                 // 真依赖：词变了才该搜
  if (!q) return;
  fetchResults(q).then((r) => {
    // 回填时不追踪 results：避免写→读→写的回环
    results.set = r;
  });
  analytics.track(untrack(() => pageId.get));  // 埋点顺带读取，不建依赖
});
```

三件事同框：真依赖保持最小（query）、旁路读取走 untrack（pageId）、写入端将来再配 equality（列表按版本对象替换）。**"读即订阅"的自由与"订阅控制"的纪律是一体两面**——这也是提案 API 演进中反复拉锯的焦点（watch 系语义至今仍在讨论，正合 L1 所说"提案先统一语义"）。

> 🚀 部署预告：本课全部实验（含自定义 equality）在 signal-polyfill、@preact/signals-core、Solid 沙盒里都能当场跑；把三张"姿态对照表"存进你的 code review checklist，比背 API 更有长期价值。
