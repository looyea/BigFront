# Suspense 与 Transition：加载兜底与无闪切换

> 目标：把"到处 `{loading && <Spinner/>}`"的散点兜底，升级成 `<Suspense>` 边界的**声明式集中兜底**——理解 Suspense 靠"识别边界内对被追踪异步依赖的读取"来显示 fallback、非阻塞特性（子树照常吃、边界揭示后才落 DOM）、**嵌套只有最近的边界切 fallback**、**边界内 `onMount`/`createEffect` 要等解析完才跑**；再用 `<SuspenseList>` 协调多个兄弟边界的揭示顺序，用 `useTransition`/`startTransition` 实现"数据没回来前保留旧界面、不闪屏"的平滑切换（呼应 solid-resource、solid-error-boundary、kit-streaming）

## 一、Suspense 替你集中兜底"加载中"

`<Suspense fallback={...}>` 包裹子树：当子树里**读到**一个"被 Suspense 追踪的异步依赖"（典型是 `createResource` 尚在 pending、或 `createAsync` 的 `read()`）且它未完成时，Suspense 就渲染 `fallback`，直到该异步 resolve 再换成真实内容。

```jsx
import { Suspense, createResource } from "solid-js";

function AsyncMessage() {
  const [message] = createResource(fetchMessage);
  return <p>{message()}</p>;               // 读到 pending 的 resource → 触发外层 Suspense
}

<Suspense fallback={<p>加载中…</p>}>
  <AsyncMessage />
</Suspense>
```

这消除了"每个组件自己写 loading 分支"——**加载态交给边界统一兜**，组件只写"成功长什么样"（配合 solid-resource 的 Switch 手写风格，二者择一，Suspense 更省心）。

## 二、三个关键行为（官方明说）

1. **非阻塞**：*"the subtree can continue running and create reactive owners before the boundary reveals the resolved content in the DOM。"* —— 挂起不冻结整个应用，子树照常执行建节点，只是**内容暂不落 DOM**、由 fallback 顶着。
2. **就近边界**：嵌套 Suspense 时，异步依赖由**最近的祖先边界**处理——只那一层切 fallback，外层不受牵连。可任意嵌套：
   ```jsx
   <Suspense fallback={<div>整页…</div>}>
     <Title />
     <Suspense fallback={<div>详情…</div>}><Details /></Suspense>
   </Suspense>
   ```
3. **边界内 effect 延后**：*"onMount and createEffect inside the suspended subtree run after the boundary resolves。"* —— 挂起期间的 `onMount`/`createEffect` **不会**提前跑，等揭示后才执行。别指望它们在 loading 期触发（排查"effect 没跑"时先想这条）。

> 路由/流式场景下 Suspense 常被"执行两遍"（先收集资源再揭示），是设计如此，不必惊慌（与 SSR 流式加载同源，L8 展开）。

## 三、SuspenseList：协调多个兄弟边界的出现顺序

一页里几个独立 `<Suspense>` 各自好了就跳出来，会显得凌乱。`<SuspenseList>` 把兄弟边界**按序**揭示：

```jsx
import { SuspenseList } from "solid-js";

<SuspenseList revealOrder="forwards" tail="collapsed">
  <Suspense fallback={<p>一…</p>}><A/></Suspense>
  <Suspense fallback={<p>二…</p>}><B/></Suspense>
  <Suspense fallback={<p>三…</p>}><C/></Suspense>
</SuspenseList>
```

- `revealOrder`：`forwards` / `backwards` / `together`（一起出）。
- `tail`：`collapsed`（未到的折叠）或 `hidden`（隐藏）。
- 它登记每个子 Suspense 的 `inFallback` 状态、汇总成有序揭示。（官方 JSDoc 标注为**实验性**，生产用前留意。）

## 四、Transition：切换时保留旧 UI、不闪屏

痛点：点"下一用户"→ `setUserId(2)` → resource 进入 pending → 若直接是 `unresolved`，Suspense 会**闪一下 fallback**、旧数据消失。`useTransition` 把这次更新标为"过渡"：**保留旧界面、后台取新，取完再原子替换**。

```jsx
import { useTransition, Suspense, createResource, createSignal } from "solid-js";

const [userId, setUserId] = createSignal(1);
const [user] = createResource(userId, fetchUser);
const [pending, start] = useTransition();

<button onClick={async () => { await start(() => setUserId(2)); }}>下一个</button>
<div>{pending() ? "切换中…" : "就绪"}</div>
<Suspense fallback={<p>加载用户…</p>}>
  <pre>{JSON.stringify(user(), null, 2)}</pre>
</Suspense>
```

要点（官方行为）：

- `useTransition()` 返回 `[pending, start]`：`start(fn)` 把 `fn` 里的更新标为过渡、返回 Promise；`pending()` 报告是否仍在过渡中（可做顶部进度条/禁用按钮）。
- **客户端 `start` 在微任务里异步调度**；**服务端 `pending()` 恒为 false、过渡同步跑完**（SSR 无闪屏概念）。
- 单独的 `startTransition(fn)` = 同样的 `start` 函数，只是**不带 `pending` 访问器**（不需要进度态时用它）。
- 过渡态与 **Suspense + 边界内的 resource 读取相集成**——这正是"取数不闪、保留旧值"的实现底座（配合 solid-resource 的 `refreshing` 态语义）。

## 五、路由里的 transition（预告 L7/L8）

`@solidjs/router` 的 `<Link transition>`、`useNavigate(..., {state})` 与导航 transition 复用同一套 `USE_TRANSITION` 上下文：页面切换被标为过渡，旧页保留到新页数据就绪——避免"切路由白屏一下"。核心 API 就是本页的 transition，路由只是把它接到导航上。

## 六、三件套怎么配合

- **Suspense**：管"没数据时显示什么"（兜底）。
- **Transition**：管"数据切换过程中旧界面留不留"（防闪屏）。
- **SuspenseList**：管"多块兜底按什么顺序收场"（编排）。
再加 **ErrorBoundary**（下一关）管"取数失败显示什么"——四者都是沿 Owner 树工作的响应式控制流组件，一起构成 Solid 的异步 UX 骨架。

## 七、自检清单

1. Suspense 靠什么决定"要不要显示 fallback"？为什么说它"非阻塞"——挂起期间子树到底还跑不跑？
2. 嵌套 Suspense 时，一个孙组件读到 pending 资源，哪一层切 fallback？据此解释"就近边界"的价值。
3. 挂起边界内的 `onMount`/`createEffect` 什么时候执行？这条能解释什么"effect 没跑"的怪现象？
4. `useTransition` 返回什么？`start(fn)` 做了什么、`pending()` 何时为真？客户端与服务端行为差在哪？`startTransition` 和它差什么？
5. 一次"切换到新数据"的操作，怎样才不闪 fallback、保留旧界面到最后一刻？用 Suspense + transition + resource 的 `refreshing` 语义串起来说。

🚀 下一关：solid-error-boundary——`<ErrorBoundary>` 到底能捕获哪些错、捕不到哪些（事件/异步回调里抛的为什么会漏网），`fallback(err, reset)` 怎么就地重试，父边界如何兜住"fallback 自己又抛错"。
