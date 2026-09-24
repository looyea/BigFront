# Async Atom：throw Promise 与 Suspense

## 一、async atom 天生可挂起

```ts
const userAtom = atom(async (get) => {
  const id = get(userIdAtom);
  const res = await fetch('/api/user/' + id);
  return res.json();
});
```
getter 是 async → 返回 Promise → Jotai 在渲染读取时「throw promise」交给 Suspense 捕获。

机制拆穿：React 的 Suspense 协议就是「渲染期 throw 一个 thenable，fallback 显示，promise resolve 后 React 重试渲染」。Jotai 只是把这条协议接在「读原子」上——`useAtomValue(asyncAtom)` 值未就绪时就把 promise 扔出去。没有魔法，是协议的正统使用（对比 za-suspense：Zustand 的 set 模型没有「渲染期读数」接触面，故做不到）。

## 二、配合 Suspense

```tsx
<Suspense fallback={<Spinner/>}>
  <Profile/>   {/* 内部 useAtomValue(userAtom) */}
</Suspense>
```
数据没就绪时展示 fallback，就绪后自动渲染——无需手写 isLoading（对比 Zustand 手动 loading，呼应 za-suspense）。

边界粒度即 UX 粒度：Suspense 放包裹多宽，骨架就多大。喜欢细碎局部骨架就多开几个小边界；喜欢整页优雅就一个大边界 + 内部骨架卡——结构决定节奏，不需要任何状态代码参与。

## 三、依赖驱动的自动重取
async atom 依赖的源 atom 变化时自动重新执行（重取），Jotai 管理每个依赖值的 promise 状态。

```ts
const userIdAtom = atom(1);
const userAtom = atom(async (get) => (await fetch('/u/' + get(userIdAtom))).json());
set(userIdAtom, 2);   // userAtom 自动以 id=2 重取，订阅者经 Suspense 再看新数据
```

「取数参数化」由此变成纯声明：组件不管何时刷新，改依赖原子即触发重取——useEffect + useState 那套「手动编排依赖数组」整体消失，这正是 async atom 最降维的一处（对比 svelte-load、solid-createAsync 各家都在解同一道题）。

## 四、与 Zustand 的分工
Zustand 不 throw promise；Jotai 是「异步优先」范式代表。跨关对比呼应 sig-async、kit-load-universal。

共存模板：Jotai async atom 管「进入页面即要、参数变了就重取」的首屏/联动数据；Zustand 管交互业务态；重型缓存（跨页共享、失效策略、后台刷新）让 TanStack Query 坐庄（jo-race 第四节有分工表）。三层各司其职，别用 async atom 手搓缓存系统。

## 五、竞态内建
新依赖值触发重取时，旧 promise 结果被忽略（详见 jo-race），天然防后发先至。

「忽略」的准确语义：以**最新依赖值**的执行为准；旧执行即便后 resolve 也不会写入订阅者视野——Jotai 为每个依赖值维护独立 promise 状态，过期即弃。但底层 HTTP 并未取消（省流量的 AbortController 见 jo-race）。

## 六、错误与重试

async atom reject 时，最近的 ErrorBoundary 捕获（与 Suspense 成对使用）。注意两点：① 失败的 promise 会被记住——不在 boundary reset 时重触发依赖，UI 会卡在 error 态；标准解法是放一个 `retryAtom` 计数器进依赖（`get(retryTick)`），按钮 `set(retryTick, t=>t+1)` 即手动重取。② 想在同层既兜 loading 又兜 error，用 ErrorBoundary 包 Suspense，别指望一个边界管两件事。

## 小结
async atom 把「取数」变成声明式可挂起原子：throw-thenable 是协议正统、依赖变即自动重取、竞态内建忽略旧值；错误管理靠 retry 计数器，重型缓存仍归 Query。

## 部署预告
本地用 jsonplaceholder 做 userId 下拉 + Profile 组件：切换 id 观察自动重取与 Suspense 闪烁；断网触发 reject，加 retryAtom 按钮修复卡死。
