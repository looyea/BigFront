# createResource：把异步纳入响应式

> 目标：把"手动管 loading/error/data 三个 state + useEffect 触发"这套 React 数据获取模式，换成 Solid 的**一个非阻塞、自动追踪依赖、自带五态与读写接口的异步 signal** `createResource`。掌握 source+fetcher 双参形态（source 为假值时不取、变化即重取）、返回的 `[resource, {mutate, refetch}]`、`loading/error/latest/state` 五个响应式属性、`initialValue`、`onCleanup`+`refetch` 做轮询，以及它与 Suspense/ErrorBoundary 的配合（呼应 solid-memo、solid-effect-tracking、solid-suspense-transition、kit-load-functions）

## 一、createResource 是什么：专为异步造的 signal

官方定义：*"a specialized signal designed specifically for managing asynchronous data fetching"*，它**非阻塞**——`createResource` 保证取数期间 UI 依旧响应，绕开"取数时界面卡住"的传统坑。它包住的正是 React 里你要手写 `useState(data)+useState(loading)+useState(error)+useEffect(fetch,[deps])` 的一整套。

```js
import { createResource } from "solid-js";

const fetchUser = async (id) => (await fetch(`/api/users/${id}`)).json();
const [user] = createResource(userId, fetchUser);   // userId 是 signal
```

`createResource` 要求 fetcher **返回 Promise**；返回的是一个"带响应式属性的 signal"：`user()` 拿数据、`user.loading`、`user.error`、`user.latest`、`user.state` 都是可读的响应式状态。

## 二、source + fetcher：依赖变了自动重取

两种调用形态：

```js
// ① 无 source：fetcher 只跑一次（除非 refetch）
const [data] = createResource(async () => (await fetch("/api")).json());

// ② 有 source：source 每次变化 → 自动重跑 fetcher，并把 source 当前值作第一参传入
const [userId, setUserId] = createSignal(1);
const [user] = createResource(userId, async (id) => (await fetch(`/api/users/${id}`)).json());
setUserId(2);   // 自动用 id=2 重取
```

**条件取数**靠 source 的假值短路：source 求值为 `false`/`null`/`undefined` 时 **fetcher 根本不跑**——所以"用户 ID 为空就不该发请求"这种逻辑，直接 `createResource(userId, ...)`（`userId()` 为 undefined 时就不取），无需手写 `if`。这也是它比 `createEffect(async...)` 干净的点：追踪、条件、加载态、错误态全内建。

## 三、五态 + 读写接口（返回的第二个值）

`Resource<T>` 的 `state` 有五种：

| state | 含义 | loading | error | latest |
|---|---|---|---|---|
| `unresolved` | 初始、尚未取 | false | undefined | undefined |
| `pending` | 正在取 | true | undefined | undefined |
| `ready` | 成功 | false | undefined | T |
| `refreshing` | 重取但**保留旧值** | true | undefined | T |
| `errored` | 失败 | false | any | undefined |

actions：

```js
const [posts, { refetch, mutate }] = createResource(fetchPosts);
await refetch();                         // 不改 source 也重跑 fetcher；传参会进 fetcher 的 info.refetching
mutate(optimisticValue);                 // 直接改本地值、不发网络请求（乐观更新）
```

- **`refetch(info?)`**：手动重取；`info` 会作为 `info.refetching` 传进 fetcher（区分"是哪种刷新"）。
- **`mutate`**：跳过 fetcher、就地覆盖 resource 值，做**乐观更新**——用户点"加一条"先 `mutate(t=>[...t,新])` 立刻上屏，后台再和服务器对齐。

fetcher 签名是 `(source, info) => ...`，`info` 里带 `{ value, refetching }`，可据 `info.value` 做增量。

## 四、渲染：配合 Suspense 或手写 Switch

条件渲染三态，两种风格：

```jsx
// 手写：用 loading/error/data 属性
<Show when={user.loading}><p>加载中…</p></Show>
<Switch>
  <Match when={user.error}><span>出错了</span></Match>
  <Match when={user()}><div>{JSON.stringify(user())}</div></Match>
</Switch>

// 或交给 Suspense（下一关），只写"成功态"，加载中由边界兜底
<Suspense fallback={<p>加载中…</p>}>{user.loading ? null : <div>{user().name}</div>}</Suspense>
```

官方提示：**预计会出错时，把 createResource 包进 `ErrorBoundary`**——fetcher 抛出的错误会让 resource 进入 `errored`（`user.error` 可读），若被 Suspense 消费则向上冒泡到边界（详见 solid-error-boundary）。

## 五、initialValue、懒加载与轮询

```js
// initialValue：给初值 → 直接从 ready 态开始、类型也去掉 undefined、首帧不闪空
const [user] = createResource(fetchUser, { initialValue: { name: "加载中…" } });

// 懒取（deferred）：初始不自动跑，需手动 refetch 触发
const [data, { refetch }] = createResource(source, fetcher, { lazy: true });
refetch();   // 你决定何时开始取
```

**轮询**用 `refetch` + `onCleanup` 管定时器，干净回收：
```js
const [price, { refetch }] = createResource(fetchPrice);
const t = setInterval(() => refetch(), 1000);
onCleanup(() => clearInterval(t));   // 组件销毁即停（solid-lifecycle）
```

## 六、createAsync 与 lazy：两个邻居

- **`createAsync(fn)`**（solid-js）：`createResource` 的"可 await"变体，返回一个 AsyncResource——`read()`/`await` 它取值、`.loading`/`.error`/`.state`/`.latest`/`refetch`/`mutate`/`use` 一应俱全。适合在另一个 async 流程里链式取数、或想"读到才挂起、不读到不挂起"的场景；核心差别是**能像普通 Promise 一样 await、按需 `read()` 触发 Suspense**。
- **`lazy(() => import("./Comp"))`**：异步**组件**（不是数据）——首次渲染时挂起最近的 Suspense、等 `import()` resolve 后再渲染，做代码分割（性能关 L6 展开）。

## 七、自检清单

1. `createResource` 为什么说"非阻塞"？它替你省掉了 React 里手写的哪几个 state 与哪个 effect？
2. source 形态下，什么值会让 fetcher **不跑**？据此说明"ID 为空不发请求"为何不用手写 `if`。source 变化时会发生什么？
3. 五态里 `pending` 与 `refreshing` 的关键区别是什么（旧值保不保留）？`mutate` 和 `refetch` 各自会不会发网络请求？
4. `initialValue` 对首帧渲染与类型各有什么好处？`lazy: true` 的资源怎么才开始取数？
5. 写一个"每秒 refetch、组件销毁即停"的轮询，用到哪两个 API？fetcher 抛错时 resource 进入哪个态、`user.error` 和 ErrorBoundary 是什么关系？

🚀 下一关：solid-suspense-transition——`<Suspense>` 如何替你把"加载中"兜底、为何边界内 `onMount`/`createEffect` 要等解析完才跑；`<SuspenseList>` 协调多块揭示顺序；`useTransition`/`startTransition` 如何让"切换时保留旧界面、无闪屏"。
