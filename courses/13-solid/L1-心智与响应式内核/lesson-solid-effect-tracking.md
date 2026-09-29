# createEffect 与同步依赖追踪的本质

> 目标：搞清"写即通知"到底通知了谁——沿官方"手搓一个最小响应系统"的路子，理解 `createSignal` 如何维护订阅集、`createEffect` 如何靠**同步的 currentSubscriber** 在跑回调的瞬间收集依赖、跑完即注销（这解释了为什么 `setTimeout` 里读不追踪）；再掌握三个追踪开关 `batch`/`untrack`/`on`，把"哪些读该订阅、哪些不该"变成可控的事（呼应 solid-signals、solid-fine-grained-internals、svelte-reactivity-internals）

## 一、把手搓响应系统还原成一张图

Solid 的响应内核可以用一个"观察者模式"最小模型讲清（官方 fine-grained reactivity 一文正是这么演示的）：signal 维护一个**订阅者集合**，effect 在"跑的时候把当下读到的 signal 都把自己登记进去"。核心三步：

```js
// 目的：手搓最小响应系统—signal 维护订阅集，effect 同步跑回调时把读到的 signal 都登记自己
let currentSubscriber = null;   // ✅ 全局"当前正在追踪的订阅者"指针，effect 跑前置成自己

function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();          // ✅ 谁读过这个 signal 就存进来
  function getter() {
    if (currentSubscriber) subscribers.add(currentSubscriber); // ✅ 读时登记当前订阅者（建立依赖边的关键一句）
    return value;
  }
  function setter(newValue) {
    if (value === newValue) return;            // ✅ 值相等短路：没变就不惊动任何人
    value = newValue;
    for (const s of subscribers) s();          // ✅ 写时只通知订阅过它的，不牵连无关 effect
  }
  return [getter, setter];
}

function createEffect(fn) {
  const prev = currentSubscriber;              // ✅ 存回旧指针以支持嵌套 effect（跑完要还原）
  currentSubscriber = fn;
  fn();                                        // ✅ 同步跑：这期间读到的 signal 都订阅上——依赖全靠这一段收集
  currentSubscriber = prev;                    // ✅ 跑完立刻注销：之后再读（如异步）不再被追踪
}
// ❌ 若把注销留到 fn() 的异步回调之后 → 追踪窗口被无限拉长，无关 signal 也被误订阅（Solid 恰恰同步即注销）
```

看懂这五行 `createEffect`，就看懂了 Solid：**依赖是"回调同步执行期间读到的 signal"决定的**，不多不少。这也解释了上一关的"读要 `count()`"——正是 getter 里那句 `subscribers.add(currentSubscriber)` 在建立边。

## 二、"同步"二字的分量：为什么 setTimeout 里读追不上

`createEffect` 登记 `currentSubscriber` → 跑 `fn()` → 注销，是**线性同步**完成的。异步回调发生时无人在追踪：

```js
// 目的：异步读落在追踪窗口之外—effect 同步跑完就注销，setTimeout 回调里没人被追踪
createEffect(() => {
  setTimeout(() => {
    console.log(count());   // ❌ 不会被追踪：effect 早已跑完注销，此时 currentSubscriber 为 null
  }, 1000);                 // ❌ count 之后变化也不会重跑本 effect（订阅从没建立）
});
// ✅ 修法一：on(count, ...) 显式声明依赖，不靠同步自动收集
// ✅ 修法二：把异步本身做成 createResource（L5），resource 自己是可追踪的 signal
```

同理，在 effect 里 `await` 之后再读 signal，那次读也在追踪窗口之外。官方给的解药有两类：一是**用 `on` 显式声明依赖**（不靠自动收集），二是**用 `createResource`** 把异步本身做成可追踪的 signal（L5）。记牢：**自动追踪只覆盖同步执行段**。

## 三、createEffect 到底何时跑、跑几次

- 首次：挂载后同步建立订阅、执行一次副作用；
- 之后：**每当它订阅过的某个 signal 真的变了**才被重跑；
- 它只用于**副作用/和外界同步**（打日志、操作第三方、滚动焦点、`console.log`），**不要**用它做派生值——那是 `createMemo` 的活（用 effect 派生会多一次渲染间隙、且语义不对）。

Solid 还有一个更贴渲染的变体 `createRenderEffect`（在 DOM 更新阶段跑），日常先记"副作用用 `createEffect`、派生用 `createMemo`、挂载一次性逻辑用 `onMount`"（生命周期详见 L2）。

## 四、三个追踪开关：batch / untrack / on

| 工具 | 作用 | 典型场景 |
| --- | --- | --- |
| `batch(fn)` | 把多次写合并、**结束时一次性通知**，削减中间态 | 一次事件里连改多个 signal；异步里手动合并 |
| `untrack(fn)` | 在 `fn` 内**读而不订阅** | effect 里读某 signal 只为拿值、不希望它触发本 effect |
| `on(deps, fn, { defer })` | **只按显式列出的依赖**触发、`fn` 拿 prev/new | 依赖某 signal 但要在 effect 里读别的"顺手值"、或首次 defer 不跑 |

示例：

```js
// 目的：三个追踪开关纠偏"追踪多了/追不到"—batch 合并通知、untrack 读而不订阅、on 只认显式依赖
import { batch, untrack, on, createEffect } from "solid-js";

// ✅ batch：两改一通知—setA/setB 合并，末尾一次性传播，削减中间态
batch(() => { setA(1); setB(2); });

// ✅ on(a, fn)：只按 a 触发重跑；fn 里 untrack(b) 读 b 的当下值却不因 b 变化重跑
createEffect(on(a, (aVal) => {
  console.log(aVal, untrack(b));   // a 变才跑；b 只被读一下不入依赖
}));
// ❌ 忘了 untrack 直接 console.log(aVal, b()) → b 也成了依赖，b 一变这 effect 就重跑（本只想随 a 动）
// ❌ on 默认会立即跑一次；想首跑不执行（只在变化后跑）传第三参 { defer: true }
```

经验法则：**默认信任自动追踪**，只在"追踪多了（过度订阅）"或"追踪不到（异步）"时，才用这三个工具精确纠偏。滥用 untrack 往往是没想清楚依赖图。

## 五、把两关连起来的心智

- signal（L1）是"被读的源"，effect/memo/DOM 绑定是"读者=订阅者"；
- 更新沿"谁读了它"这张图精确传播，**没有整组件重渲**（overview 的第一支柱）；
- 追踪是**同步、按读登记**的，所以 `count()` 要写在同步执行段里、异步要 `on`/resource 兜；
- 这张图跑久了会暴露"过度订阅/循环/断链"问题——那是 L6 的进阶主题，本课先把内核装进脑子。

## 六、自检清单

1. 用 currentSubscriber 的登记/注销机制解释：为什么 `createEffect` 只需"同步跑一遍回调"就能知道依赖了谁？嵌套 effect 为什么要先存 `prev` 再还原？
2. `createEffect(() => setTimeout(() => console.log(count()), 1000))` 为何 count 变了也不重跑？给两种修法（`on` 显式依赖 / 改用 resource）并说明原理。
3. 区分三个"何时用"：派生值、纯副作用、挂载一次性逻辑，分别该用 `createMemo`/`createEffect`/`onMount` 里的哪个？用错会怎样？
4. `batch`、`untrack`、`on` 各自解决"追踪的什么问题"？各写一行示例。为什么说"默认信任自动追踪、只在过载或追不到时纠偏"？
5. 结合上一关："丢失响应"的四种写法，哪些本质是"在追踪窗口外读了 getter"？（提示：异步里读 / 提前求值传参）

🚀 下一站 L2：派生、状态与生命周期——`createMemo` 缓存派生、`createStore` 深层细粒度状态、`onMount`/`onCleanup` 与 Owner 作用域如何界定"谁负责清理这些订阅"。
