# L5 阶段作业：异步、Resource 与错误

> 覆盖：solid-resource / solid-suspense-transition / solid-error-boundary

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```jsx
const [data, setData] = createSignal();
const [loading, setLoading] = createSignal(false);
createEffect(async () => {
  setLoading(true);
  const r = await fetchUser(id());
  setData(r); setLoading(false);   // 想让 id 变化就重取
});
```
指出这套"手搓 resource"的问题（await 后脱出追踪、loading 竞态），改用哪个原语。

**Bug 2**
承接 Bug 1：`id()` 为 `undefined` 时仍然发了一次 `/users/undefined` 请求。用 `createResource` 的哪个特性天然避免？

**Bug 3**
```jsx
const [user] = createResource(fetchUser);
return <div>{user().name}</div>;   // 首帧直接崩
```
`user()` 首帧是 undefined。指出应如何用 `loading`/`Suspense`/`initialValue` 三者之一修，并说明 fetcher 何时才真正跑。

**Bug 4**
```jsx
const [posts, { refetch, mutate }] = createResource(fetchPosts);
// 想"重新从服务器拉一次"
mutate((p) => p);
```
点了没发请求。指出 `mutate` 与 `refetch` 的差别、这行该怎么改。

**Bug 5**
```jsx
const [price, { refetch }] = createResource(fetchPrice);
setInterval(() => refetch(), 1000);   // 组件卸载后还在刷
```
切走页面后请求还在发。指出缺什么、用哪个 API 回收。

**Bug 6**
```jsx
const [report] = createResource(source, fetchReport, { lazy: true });
// 界面始终空白
```
指出 `lazy: true` 的资源为什么永远不来、要怎么才开始取。

**Bug 7**
```jsx
<ErrorBoundary fallback={<Err/>}>
  <button onClick={() => { JSON.parse(badInput); }}>提交</button>
</ErrorBoundary>
```
点击抛错、边界却没兜住。指出 ErrorBoundary 的捕获范围、这里为何漏网、怎么处理。

**Bug 8**
```jsx
<Suspense fallback={<Skel/>}>
  <AsyncUser/>   {/* 内部读到 pending 的 resource */}
</Suspense>
// AsyncUser 里 onMount(() => reportAnalytics()) 在 loading 期没跑
```
指出挂起子树内 `onMount`/`createEffect` 的执行时机、这条能不能解释"没跑"。

**Bug 9**
```jsx
<Suspense fallback={<Skel/>}>
  <ErrorBoundary fallback={<Err/>}>
    <AsyncData/>
  </ErrorBoundary>
</Suspense>
```
想同时兜加载和错误，但顺序摆反了。指出应谁包谁、为什么。

**Bug 10**
```jsx
const [userId, setUserId] = createSignal(1);
const [user] = createResource(userId, fetchUser);
const next = () => setUserId(userId() + 1);   // 点一下：整块先闪回 fallback 再出新数据
```
指出"切换闪屏"的成因（resource 退回 + Suspense 切 fallback），用哪个 API 把这次更新标为过渡来消除，并写出改法。

## 二、手写改造（5 小题，写出关键代码）

**手写 1** 用 `createResource(userId, fetchUser)` 实现"输入数字 ID → 展示用户"，用 `<Show when={user.loading}>` + `<Switch>`（`user.error` / `user()`）手写渲染加载/错误/成功三态。

**手写 2** 待办"乐观添加"：点 Add 立刻把新条目 `mutate` 上屏，再后台发 POST；若 POST 失败，把列表回退到添加前。用 `mutate` + 保存旧值写出这条流程。

**手写 3** 股票行情每 2 秒刷新一次价，组件销毁即停。用 `refetch` + `onCleanup` 写完整实现。

**手写 4** 搜索框输入 → 防抖写 `q` → `createResource(q, search)`，要求"取新结果时旧结果仍显示、不闪屏"。用 `useTransition` 把"改 q"包成过渡写出关键代码，并说明为何这样 Suspense 不回退 fallback。

**手写 5** 给一个"主内容 + 侧边推荐"两块各自异步的页面，做**分区降级**：每块独立 `<ErrorBoundary fallback={(e,reset)=>…重试}>` 且各自包就近 `<Suspense>`，一块崩不塌另一块。写出嵌套结构与谁包谁。

## 三、场景大题（1 题）

**场景：无限滚动数据流。** 一个列表页，首屏取第 1 页；滚到底加载下一页并**追加**到已有数据后（不替换）；翻页期间已加载内容要保留、只在列表底部显示 spinner；某页请求失败要能"重试该页"而不影响已加载项。请只用本阶段三关知识给出方案并逐条回答：

(a) 页码/数据怎么组织？用 `refetch` 还是让页码 signal 作 source？"追加而非替换"用 resource 的哪个能力（`mutate` 合并 / 或 fetcher 依 `info.value` 累加）实现？
(b) 为什么"整列表包一个顶层 Suspense"会在翻页时全列表闪回 fallback？正确的 Suspense 摆位是什么（底部就近小边界）？
(c) 翻页这次加载要不要用 `useTransition`？它和 (b) 的底部 Suspense 各自解决什么、会不会冲突？
(d) 某页失败：`resource.error` 能怎么用于"只在底部显示重试按钮、保留上面内容"？为什么不能靠 `onClick` 抛错让外层 ErrorBoundary 接管？

## 四、简答题（3 题）

**简答 1** 列出 createResource 的五态，重点说 `pending` 与 `refreshing` 的区别，以及 `refreshing`（保留旧值）如何正是 transition 防闪屏的底层依据。

**简答 2** createResource 失败有两条错误通道（`resource.error` 与冒泡到 ErrorBoundary），分别何时生效、官方建议怎么配合？为什么"事件处理器里 throw"不在 ErrorBoundary 捕获范围内？

**简答 3** 用三句话说清 Suspense 的三个行为：非阻塞（挂起期子树跑不跑）、就近边界（嵌套谁切 fallback）、effect 延后（onMount/createEffect 何时执行）。

## 五、挑战题 🏆

**"一个异步档案页的四重问题"**：下面这段有四处各自独立的问题：
```tsx
function Profile() {
  const [id, setId] = createSignal(1);
  const [user, { refetch }] = createResource(id, fetchUser);
  setInterval(() => user.refetch, 5000);                    // (A)
  return (
    <Suspense fallback={<Skel/>}>
      <ErrorBoundary fallback="出错了">                      {/* (B) */}
        <button onClick={() => { throw new Error("boom"); }}>刷</button>  {/* (C) */}
        <Show when={!user.loading}>
          <div>{user().name}</div>                           {/* (D) */}
        </Show>
      </ErrorBoundary>
    </Suspense>
  );
}
```
(a) (A) 的定时刷新有两处错，指出（`user.refetch` 没被调用 / `refetch` 应从 actions 解构、且缺回收），给修法；
(b) (B) 的 ErrorBoundary 与 Suspense 嵌套顺序有什么问题？谁该在外层、为什么？
(c) (C) 在 `onClick` 里 throw，外层 `fallback="出错了"` 接得住吗？"点一下就重取数据"的正确写法应该是什么（结合 refetch/transition）？
(d) (D) 当 `user` 处于 `errored` 态时 `user()` 为 undefined、`.name` 会崩；给两种修法（判 `user.error` 或 `initialValue`/keyed 守卫），并顺手说明"切 id 时整块闪 fallback"该怎么用 useTransition 消除。

---

**本阶段关键词**：createResource 非阻塞、source+fetcher、source 假值短路不取、五态(unresolved/pending/ready/refreshing/errored)、loading/error/latest/state、initialValue、lazy+refetch、refetch(info)→info.refetching、mutate 乐观更新/不发请求、轮询 refetch+onCleanup、createAsync(await/read/use)、lazy 异步组件、resource 错误双通道、Suspense fallback、非阻塞(子树跑/内容不落DOM)、就近边界、onMount+createEffect 延后、SuspenseList revealOrder/tail(实验)、useTransition [pending,start]、startTransition(无 pending)、客户端微任务异步/服务端同步、transition 防闪屏保 refresh旧值、路由 transition、ErrorBoundary 捕获范围(渲染+更新期)、不捕事件/游离异步错、fallback(err,reset)、reset 清错重渲、多级降级、catchError/modifyFailure、边界在外 Suspense 在内、全局 error/unhandledrejection 补网

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L6**：进阶响应式与性能——细粒度内核（Owner/Computation、依赖图与更新队列、batch/flush 时机）、状态组织模式（信号/store/资源如何编排），以及把 resource/Suspense/transition/lazy/代码分割收成一套性能打法。
