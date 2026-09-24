# 请求取消与竞态

## 一、signal 从天而降（v5）

```ts
queryFn: async ({ queryKey, signal }) => {
  const res = await fetch(url, { signal });   // 一行接入
  if (!res.ok) throw new Error('bad ' + res.status);
  return res.json();
}
```

v5 把 AbortSignal 直接塞进 queryFn context。Query 在「这次请求已经没有意义」时 abort 它：**失效/重取挤掉在飞请求、key 变化旧查询失去订阅、GC 回收、setActive(false)**。不传 signal 也能跑——结果照样被正确忽略（竞态层），只是底层流量没省（取消层）。

## 二、竞态与取消是两层皮

- **正确性层（竞态）**：后发的新执行胜出，旧结果作废——Query 按「依赖值的每次执行」管状态，从 v4 起就自动做对（jo-race 同款语义）。
- **资源层（取消）**：AbortController 真把 TCP/请求掐了，省流量省后端算力。

只要正确性，signal 可以不接；要做资源管理，接上那一行。两件事分得清，面试不糊涂。

## 三、CancelledError：从「错误」降级为「事件」

被取消的执行抛 `CancelledError`，v5 里它**不再把查询置为 error**，也不触发 retry（retry 跳过取消错误）。想统计取消事件，在 queryFn 的 catch 里 `isCancelledError(err)` 判断后原样 rethrow——取消是流程的一部分，不是事故，别写进 onError。

## 四、mutation 不自动取消

同一 mutationKey 再次 mutate，**旧请求不会被 abort**（可能已经落库，取消反而制造「以为撤销了」的假象）。要防重复提交，上 isPending 禁用+幂等键（L3 讲过），别指望取消。

## 五、三家竞态方案横评

| 库 | 正确性 | 资源取消 |
|---|---|---|
| 手写 fetch | 自己比 seq/tick | 自己拿 AbortController |
| Pinia/Zustand action | 手写（版本号/AbortController） | 手动接线 |
| Jotai async atom | 内建（最新依赖值槽位） | 自造 tick+signal |
| TanStack Query | 内建（执行槽+订阅） | 内建 signal 一行接 |

这正是「异步取数交给专业缓存层」最硬的论据之一（za-layers、jo-race 分工表的又一次会师）。

## 六、retry 与取消的交互

退避重试等待中遇到新触发（invalidate/dep 变化）：旧的重试链条整体作废，新执行接管。自定义 retry 里 `failureCount` 只数真失败；对 4xx 永不重试 `retry: (n, e) => e.status >= 500 ? 2 : 0`，取消与 4xx 都不该烧退避时长。

## 小结
v5 取消一句话：signal 白送到手，接上就省资源；竞态正确性本来就内建；CancelledError 是事件不是错误；mutation 不自动取消；与手写/状态库方案对比，Query 在异步治理上省的就是这两层代码。

## 部署预告
做一个慢接口（setTimeout 2s）的搜索页：不传 signal 快速切关键词，验证「结果正确但 Network 请求堆满」；接上 signal 后同样操作，对比 Network 的 canceled 条目数。
