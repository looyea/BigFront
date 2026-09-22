# 生命周期与 Owner 作用域

> 目标：回答"组件只执行一次，那还需不需要生命周期"——需要，但含义变了：不再是"每次渲染的钩子"，而是"**挂载后一次性副作用**"与"**作用域销毁时回收订阅**"。掌握 `onMount`（DOM 挂载后跑一次、SSR 期不跑）、`onCleanup`（在**响应式 Owner 树**被 dispose/refresh 时回收）、`createRoot` 建立**不随父级自动释放**的非追踪作用域、以及 `Owner` 如何决定"谁负责清理"；理解 `createEffect` 与 `createRenderEffect` 的时机差（呼应 solid-effect-tracking、solid-stores、kit-internals 的 render 位点）

## 一、组件不重渲，"生命周期"到底指什么

React 有 mount/update/unmount 三段是因为组件会反复重执行。**Solid 组件只执行一次**，于是没有"update 钩子"这回事——"随数据变化重算"是响应式订阅（memo/effect）自己在做，不经过组件。剩下真正的生命周期只剩两件事：

1. **挂载后跑一次**的初始化（量 DOM、接第三方、起订阅）→ `onMount`；
2. **作用域被销毁时清理**（停定时器、解绑、关连接）→ `onCleanup`。

而"作用域"由 **Owner 树**界定——这是理解 Solid 内存管理的钥匙。

## 二、onMount：DOM 就绪后、只此一次

```js
import { onMount } from "solid-js";

function Chart() {
  let el;                       // 用 ref 拿 DOM（L4）
  onMount(() => {
    const chart = new ThirdPartyChart(el);          // 首次渲染后、DOM 已挂载
    onCleanup(() => chart.destroy());               // 卸载时回收
  });
  return <div ref={el} />;
}
```

要点：

- **只跑一次**，且在**初始渲染之后 / DOM 变更之后**——适合放"需要真实 DOM 才能做"的初始化。
- **SSR 期间不执行**（服务端没有浏览器 DOM/定时器/`window`）；若逻辑依赖 `document`/`localStorage`/第三方，务必放进 `onMount` 而不是组件顶层（否则 SSR 直接 ReferenceError，水合/构建即崩——与 12-sveltekit 的 SSR 水合纪律同源）。
- 需要清理时，在 `onMount` 里注册 `onCleanup`。

## 三、onCleanup：按 Owner 树回收，而非 DOM 移除

`onCleanup(fn)` 把 `fn` 注册到**当前响应式作用域**上，作用域被**销毁(dispose)或刷新(refresh)**时调用 `fn`。官方关键句：**`onCleanup` 依据的是响应式 ownership 树，而不是 DOM 是否被移除**——只要建立它的那个 owner（组件/root/effect 作用域）被释放，就会触发。

```js
createEffect(() => {
  const id = setInterval(() => tick(), 1000);
  onCleanup(() => clearInterval(id));   // 每次 effect 重跑前 & 作用域销毁时，先清掉上一个 interval
});
```

注意这里的双重语义：effect **每次因依赖变化重跑**，Solid 会在重跑前调用上一次注册的 cleanup——所以"定时器不会叠加"。忘了 `onCleanup`，就是经典的"路由切走后轮询还在跑/内存泄漏"（L1 手写 5 埋的点）。

## 四、Owner 与 dispose：谁负责清理订阅

组件执行时处于一个 **Owner（所有者）作用域**中；在它执行期间 `createSignal`/`createMemo`/`createEffect` 建立的响应式节点都被**挂到这个 Owner 之下**。当组件所属的路由/父级被销毁，Solid 沿 Owner 树 **dispose** 掉这一整片：所有订阅解除、所有 `onCleanup` 触发。**这就是"组件不重渲却没有内存泄漏"的机制底座**——回收是按树批量做的，不需要你逐个手动 unsubscribe。

推论（也是新手大坑）：`createSignal`/`createEffect`/`createMemo` **必须跑在某个 Owner 作用域里**（组件函数体内、或 `createRoot`/`render` 之下）。否则你会看到那条著名警告：

> "computations created outside a `createRoot` or `render` will never be disposed"

意思是：这些计算没有 owner 兜底，**永远不会被回收 → 内存泄漏**。全局/模块顶层建 signal 时要特别警惕。

## 五、createRoot：造一个"不归父级管"的独立作用域

默认所有东西随组件 Owner 一起 dispose。但有时你要一个**跨组件生命周期**、或**在回调里新建但不想被外层 memo/effect 重算牵连**的作用域。`createRoot(fn)` 建立一个新的、**不会随父级自动释放**的非追踪 Owner 作用域，把 `dispose` 作为第二个参数交给你：

```js
import { createRoot } from "solid-js";

const dispose = createRoot((dispose) => {
  createEffect(() => console.log("running", someSignal()));   // 不挂在当前组件下
  // 需要时手动释放：
  // dispose();
  return dispose;
});

// 用完显式回收：
dispose();
```

典型用途：① 在 memo/effect 内部起一段"不该随本次重算被销毁"的长期订阅；② 命令式地创建一块生命周期独立于周围组件的响应式逻辑，再手动 `dispose()`。原则：**能用组件自带 Owner 就别开 root**，`createRoot` 是为"故意脱离自动回收"准备的，用了就得自己负责 dispose，否则正是上面那个泄漏。

## 六、时机对照：createEffect vs createRenderEffect

- `createRenderEffect`：在 **DOM 更新阶段**内跑（渲染事务里），用于需要"和其他 DOM 改动同批发生"的场景。
- `createEffect`：在**初始渲染之后**跑、依赖变化后也在常规更新后跑——日常副作用首选。
- `createMemo`：派生计算（上一关）。

日常心智：**副作用用 `createEffect`、派生用 `createMemo`、挂载一次性用 `onMount`、清理用 `onCleanup`、脱离自动回收用 `createRoot`**。别把这些原语的角色串门（用 effect 派生、用 memo 副作用都会出问题，见 solid-memo）。

## 七、自检清单

1. "组件只执行一次"为什么让 Solid 没有 React 式的 update 生命周期？剩下的两件事分别归谁管（onMount / onCleanup）？
2. 为什么"依赖 `window`/第三方/`document`"的初始化必须放进 `onMount` 而非组件顶层？这和 SSR/水合纪律是什么关系？
3. `onCleanup` 依据"响应式 ownership 树而非 DOM 移除"——据此解释：effect 每次重跑前为何会先调用上一次的 cleanup？漏写它会导致什么现象？
4. 写出"计算建在 Owner 之外"的著名警告原文含义，并说明为什么全局/模块顶层建 signal 有泄漏风险、怎么规避。
5. 什么时候该用 `createRoot`？它交给你什么、你必须相应负什么责任？给一句"别滥用"的判断标准。

🚀 下一站 L3：组件、模板与组合——把"组件是只执行一次的函数、props 是 getter"正式讲透，并引出你必须掌握的 `<For>`/`<Show>` 控制流组件与 Context 组合。
