# Suspense 边界里的 store 行为

## 一、关键事实：Zustand 不会 throw Promise

与 Jotai async atom 不同，Zustand 的 store 本身不具备「渲染时挂起」能力——set 不会抛出 Promise 让 Suspense 捕获。

所以「把数据 fetch 塞进 Zustand 然后等 Suspense 骨架屏」是错误预期。Suspense 的协议是渲染期 throw promise，Zustand 的更新模型是命令式 set——两者根本没有接触面。

## 二、正确的职责划分

- 数据获取的挂起交给 **Suspense + TanStack Query（useSuspenseQuery）** 或 Jotai。
- Zustand 只存 **UI 态 / 业务态**，不参与 throw promise。

```tsx
<Suspense fallback={<Skeleton/>}>
  <TodoList/>        {/* 内部 useSuspenseQuery 挂起 */}
  <FilterChips/>     {/* 订阅 Zustand 筛选态，不挂起 */}
</Suspense>
```

同一屏两种节奏：数据区有 fallback，交互区即时渲染——这正是分层（za-layers）在组件树上的投影。

## 三、错误边界联动

数据加载失败由 ErrorBoundary 捕获；store 里若有相关 loading 标志，应在边界 reset 时一并清理，避免卡在 loading。

```tsx
class StoreAwareBoundary extends React.Component {
  componentDidCatch() { useStore.setState({ loading: false }); }
}
```

细节：componentDidCatch 里 setState 清 store 要防循环（清标志本身别再触发抛错的渲染）；更稳的写法是把「重置 UI 态」放进 ErrorBoundary 的 onReset 回调，用户点重试时才清。

## 四、retry 归属
重试逻辑放 Query/Jotai，不放 store；store 顶多记录「用户点击重试」的事件态。

Query 的 retry: 3 + exponential backoff 是数据层策略；「重试」按钮 UI 态是客户端态——两层各管各的，别在 store action 里手写 while 重试循环。

## 五、模式：server 下发 → effect 注入
SSR 拿到首屏数据后，用 effect 把值 setState 进 store（一次性水合），之后 store 管交互态。

```tsx
// RSC 里： <ClientIsland initial={await fetchConfig()} />
useEffect(() => { useCfgStore.setState({ cfg: initial }); }, [initial]);
```

注意 effect 注入晚于首帧——依赖 cfg 的 UI 首帧要能渲染「无值」形态（skeleton 或默认值），否则闪白（呼应 za-hydration）。

## 六、use() 新原语的边界

React 19 的 `use(promise)` 可以消费「在 store 外面创建」的 promise（props/context 传入），但仍不能在渲染里 `use(storePromise)`——store 里的 promise 不是响应式来源，状态变化不触发重渲。想让「挂起」与「可写」共存的是 Jotai async atom（呼应 jo-async），不是 Zustand。

## 小结
别指望 Zustand 触发 Suspense；挂起归 Query/Jotai，UI 归 Zustand；错误边界与 loading 清理联动；SSR 数据 effect 一次性注入且首帧留无值形态。

## 部署预告
本地做一个「Suspense 内 useSuspenseQuery + 外部 Zustand 筛选」的混合页，DevTools 里断网观察 fallback → ErrorBoundary → 重试 → loading 标志清理的完整链路。
