# ErrorBoundary：捕获渲染与更新期的错误

> 目标：给异步与响应式更新装一道"崩了也不白屏"的防线——`<ErrorBoundary fallback>` 捕获**其子树在渲染 JSX、以及更新响应式计算（含经同一渲染/更新流冒泡出来的 async 原语）时抛出的错误**；但**事件处理器里、以及在 Solid 渲染/更新流之外调度的回调里抛的错，它捕不到**。掌握函数式 `fallback(err, reset)` 的就地重试、`reset` 清错并重渲 children、"fallback 自己又抛错由父边界兜住"的层级、以及底层 `catchError`/`modifyFailure` API（呼应 solid-suspense-transition、solid-resource、solid-lifecycle 的 Owner 树）

## 一、ErrorBoundary 抓什么、不抓什么（头号重点）

官方对边界能力划了清清楚楚的线：

**能抓**：
- 子树**渲染 JSX 时**抛的错；
- 子树**更新响应式计算（memo/effect/绑定）时**抛的错；
- 上述流里冒泡出来的**响应式异步原语**的错误（如被 Suspense/绑定读取的 resource 在渲染/更新流中 surfacing 的失败）。

**抓不到**：
- **事件处理器**里抛的错（`onClick` 内部 `throw`）；
- **在 Solid 渲染/更新流之外调度的回调**里抛的错（裸 `setTimeout`/`Promise.then`/第三方异步回调里 `throw`）。

```jsx
<ErrorBoundary fallback={<h1>出错了</h1>}>
  <Broken/>               {/* 渲染即 throw → 被兜住 */}
</ErrorBoundary>
```
> 这条边界是 React 老手最常踩的"我以为它什么都接"：边界不是 `try/catch` 全局网，只管"由 Solid 驱动的渲染/更新"。**事件与游离异步里的错，要么自己 try/catch，要么走 `globalThis.onerror`/`unhandledrejection`。**

## 二、fallback：静态节点 或 (err, reset) 函数

```jsx
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>{String(error)}</p>
      <button onClick={reset}>重试</button>     {/* reset：清掉错误态、重新渲染 children */}
    </div>
  )}
>
  <Flaky />
</ErrorBoundary>
```

- `fallback` 可以是**一段 JSX**（静态"出错了"）；
- 也可以是**函数** `(err, reset) => JSX`：拿到被捕获的错误值 `err`、和一个 `reset()`。
- **`reset()` 清空当前错误状态并重渲子树**——用户点"重试"就会重新执行 children（若底层错误是瞬时的，比如网络抖一下，就能恢复）。

## 三、层级：fallback 自己抛错，由父边界接管

若**某个边界的 fallback 渲染时又抛错**，这个新错误**由更外层的 ErrorBoundary 捕获**。所以可以做"多级降级"：内层给"重试"UI，内层都崩了外层给"回到首页"兜底。理解依据同 solid-lifecycle：错误沿 **Owner 树**上抛，`handleError` 沿 `Owner.context[ERROR]` 找注册的处理器——边界就是往这条链上挂处理器。

## 四、和 createResource 的错误分工：error 属性 vs 抛错

`createResource` 失败有两种处置路径，别混：
1. **`resource.error` 属性**：fetcher reject → resource 进 `errored` 态、`user.error` 可读、`user()` 为 undefined。你**可以在 JSX 里判 `user.error` 显示提示**（solid-resource 的 Switch 写法），这时并不一定需要边界。
2. **冒泡到 ErrorBoundary**：当失败**经由 Suspense/渲染读取冒泡出来**（比如你直接 `user()` 而没判 error，pending/errored 在边界里 surfacing），错误会被 `ErrorBoundary` 捕获。

所以官方 tip 说"预计会出错时，把 `createResource` 包进 `ErrorBoundary`"——但**更稳的是二者配合**：用 `user.error` 做温和的内联提示，用 ErrorBoundary 兜住"没预判到的抛错"。

## 五、底层：catchError / modifyFailure

命令式捕获用 `solid-js` 的 `catchError`（在某个 Owner 下注册错误处理器、返回其结果，错误经 `handleError` 上抛）与 `modifyFailure`（包装/改写错误再抛，常用来给错误附上"发生在哪个组件"的诊断信息）。

```js
import { catchError, runWithOwner } from "solid-js";

const owner = getOwner();
const result = catchError(
  () => doRiskyThing(),                       // 同步/响应式流内会抛的操作
  (err) => console.error("捕获:", err, getOwnerDebugInfo())
);
```
ErrorBoundary 就是这套机制的 JSX 形态：源码里靠 `catchError(fn, onError)` + Owner 的 `context[ERROR]` 槽实现，`onError` 里"设一个 signal 把边界翻到 fallback 态"、`reset` 把它清回。自定义错误日志/上报，可组合 `modifyFailure` 给每个边界挂不同标签。

## 六、放哪一层：粒度与体验

- **粗粒度**：整页套一个边界，崩了就整页降级——简单但体验重。
- **细粒度**：给每个 Suspense 数据块各配边界，哪块崩只塌哪块、其余照常。
- 常见组合：`<ErrorBoundary><Suspense fallback=…>{内容}</Suspense></ErrorBoundary>`——**外层管"错"、内层管"加载"**，各司其职；顺序反了会漏（边界在内层就接不到内层子树渲染抛出的错……其实应让 ErrorBoundary 在外，包住 Suspense 及其内容）。

## 七、自检清单

1. 列出 ErrorBoundary **能捕**的三类错与**捕不到**的两类错；解释为什么"`onClick` 里 throw"不会被它接住，那该怎么处理。
2. 函数式 `fallback(err, reset)` 里 `reset()` 具体做了什么？适合什么样的错误（举一个"瞬时错误重试可恢复"的例子）。
3. 一个边界的 fallback 渲染时又抛错，会发生什么？据此说明如何做"多级降级"。
4. `createResource` 失败时，`user.error` 属性和 ErrorBoundary 捕获是同一回事吗？分别在什么触发路径下生效？官方建议怎么配合？
5. ErrorBoundary 与 `<Suspense>` 嵌套时谁包谁、为什么？命令式场景用哪两个 API 做捕获与"给错误附诊断信息"？

🚀 下一站 L6：进阶响应式与性能——回看细粒度内核（Owner/Computation/依赖图与更新队列、`batch`/flush 时机），沉淀状态组织模式，并把 resource/Suspense/transition/`lazy`/代码分割收成一套性能打法（呼应 kit-performance、solid-fine-grained 内核）。
