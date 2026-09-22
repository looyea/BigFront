# createMemo：可缓存的派生 signal

> 目标：把"随状态重算"这件事从 React 的"每次渲染重算"改造成 Solid 的"声明一条派生 signal"——`createMemo` 返回一个只在依赖真正变化时才重算、可被别处当 signal 读的**只读派生源**；讲清它相对"直接内联表达式"与"用 effect 手动同步"的取舍，掌握**用 memo 收敛过度订阅**、**早返回改变被追踪依赖集**、`prev` 值与 `equals`/`defer` 选项（呼应 solid-signals、solid-effect-tracking、svelte-reactive-runes 的 $derived）

## 一、memo 是"会缓存的只读 signal"

`createMemo(fn)` 返回一个 getter（只读 signal），它把你写的计算包起来：**首次读时求值、并登记它同步读到的所有 signal 为依赖；之后只有这些依赖变化时才重算**，没变就直接吐缓存值。

```js
import { createSignal, createMemo } from "solid-js";

const [first, setFirst] = createSignal("John");
const [last, setLast] = createSignal("Doe");
const full = createMemo(() => `${first()} ${last()}`);   // full 是个 getter

console.log(full());   // "John Doe"
```

官方把它归为"resemble effects but distinct"——它像 effect 一样按依赖更新，但**多一个能力：返回 signal 并缓存计算**，"more ideal for computational optimization"。所以定位很清楚：**派生值用 memo，别用 effect。**

## 二、三个"能做但不对"的替代，为什么 memo 才对

假设要"随 count 得到 count 是否大于 5"：

```js
// ① 直接内联：{count() > 5}         —— 简单场景 OK，但同一段计算被多处用会重复算
// ② effect 同步：createEffect(()=>setBig(count()>5))  —— ❌ big 会慢一帧、且要额外一个 signal 存它
// ③ memo：const big = createMemo(()=>count()>5)      —— ✅ 恒等于计算值、无中间态、可当 signal 到处读
```

effect 同步的通病：effect 在依赖变化后的**更新阶段**才跑，`big` 会有一帧是旧值；两个 effect 互相写还可能形成回环反复通知。memo 是**惰性 + 缓存 + 即时一致**，是派生的正解（呼应 solid-effect-tracking"能声明式派生就别命令式同步"）。

## 三、用 memo 收敛"过度订阅"

当某段逻辑在高频变化的 signal 上其实只关心**一个粗粒度结论**时，直接读那个 signal 会让所有订阅者被细碎更新轰炸。把结论压成 memo，下游只订阅 memo，变化频率骤降：

```js
const [scrollY, setScrollY] = createSignal(0);          // 每帧都在变
const showTop = createMemo(() => scrollY() > 300);      // 只关心"要不要显示"
createEffect(() => {
  // 依赖 showTop 而非 scrollY：只有布尔翻转才触发，不被每帧刷屏
  toggleButton(showTop());
});
```

memo 在这里起"**断链**"作用：`scrollY→showTop` 收敛成 `showTop→下游`，把 60fps 的源变成分散的布尔事件。这是 Solid 性能心智的核心手法之一（L6 会继续展开）。

## 四、早返回会"改变依赖集"（关键且易错）

memo 的依赖 = **本次执行同步读到的那些 signal**。若计算里 `if` 提前 return，那一次没读到的 signal 就**不在本次依赖里**，之后它变化不会触发重算：

```js
const [temp, setTemp] = createSignal(72);
const [unit, setUnit] = createSignal("F");
const [on, setOn] = createSignal(true);

const show = createMemo(() => {
  if (!on()) return "off";              // on=false 时这一支没读 temp/unit
  return `${temp()}°${unit()}`;
});
// 当 on 为 false 时，setUnit('C') 不会让 show 重算——因为它这次没订阅 unit
```

这正是官方 fine-grained 文档温度示例的含义：**追踪由"实际读到什么"动态决定**，不是静态声明。它是特性（天然省算），但要当心"我明明改了 unit 怎么没反应"——先想想是不是被早返回挡在依赖之外了。

## 五、进阶：prev 值、equals、defer

`createMemo(fn)` 的 `fn` 能收到 `(prev, init)` 两个参数——`prev` 是上一次的计算结果、`init` 是否首次。配合自定义相等可进一步抑制重通知：

```js
const list = createMemo((prev) => {
  const next = source();
  return cheapMerge(prev, next);        // 想基于旧结果增量算
}, undefined, {
  equals: (a, b) => a.length === b.length,   // 自定义"算不算变了"，默认是 ===
});
```

- `equals: false` → 每次依赖变都通知（关掉相等短路）。
- `equals: (a,b)=>...` → 用你的比较决定要不要让下游更新（大对象/数组很有用）。

注意：memo **默认首次会求值**；若要"先不算、等被读或有依赖变化再算"，可配合惰性读，但 Solid 里通常直接 memo 即可，defer 语义更多在 `on`（effect）里用。

## 六、何时该用 / 不该用

**该用**：贵的派生计算（排序/过滤/聚合/正则）、被多处复用、想收敛高频源。
**不该用（直接内联就够）**：一次性的、极廉价的读——在 JSX 里写 `{count() * 2}` 时 Solid 已经为那个绑定建了最小 effect，额外套 memo 只是多一个节点。**滥用 memo 反而增加响应式图开销与心智**，只在"计算贵 or 需要断链 or 需要复用一个派生值"时才上。

## 七、自检清单

1. `createMemo` 返回什么、什么时候重算？为什么"派生值用 memo 而非 effect 同步"能避免慢一帧和回环？
2. 用"断链"解释：给定每帧变的 `scrollY`，`showTop=createMemo(()=>scrollY()>300)` 如何让下游 effect 从 60fps 降到"仅翻转时"触发？
3. 温度示例里，`on` 为 false 时改 `unit` 为何不触发 memo 重算？"依赖由实际同步读到决定"这句话怎么用一句话复述？
4. `createMemo` 的回调能拿到哪两个参数？`equals` 选项能干什么、`equals:false` 与自定义比较各适合什么场景？
5. 给一个"直接内联表达式比套 memo 更好"的例子，说清 memo 的成本来源，避免无脑包 memo。

🚀 下一关：solid-stores——第一根支柱处理标量与整体替换，store 处理深层嵌套对象与数组的"按路径订阅"，以及 produce/reconcile/unwrap 三件工具。
