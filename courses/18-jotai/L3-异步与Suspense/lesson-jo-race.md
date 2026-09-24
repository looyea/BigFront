# 异步竞态与取消

## 一、自动竞态处理
async atom 依赖值变化触发重取时，Jotai 以「最新依赖值」的结果为准，忽略过期 promise（后发先至不会覆盖新值）。

经典事故现场：输入「a」发请求 1（慢），输入「ab」发请求 2（快）——无竞态管理的实现里请求 1 后到，列表显示 a 的结果盖掉 ab。Jotai 的解法内建于依赖图：每个依赖值对应独立执行槽，set(query,'ab') 后槽位即切到 2，请求 1 的 resolve 落入废槽无人认领。

## 二、AbortController 手动取消
Jotai 不会替你中断底层请求，需要时把 AbortController 放进 getter：

```ts
const dataAtom = atom(async (get) => {
  const q = get(queryAtom);
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  get(onAbortAtom).addListener?.();          // 概念示意：见下方可靠写法
  const res = await fetch('/api?q=' + q, { signal: ctrl.signal });
  return res.json();
});
```

真实可靠写法是「自增 tick 失效法」：

```ts
const abortTickAtom = atom(0);
const dataAtom = atom(async (get) => {
  get(abortTickAtom);                        // 订阅一个“作废信号”
  const ctrl = new AbortController();
  const p = fetch('/api?q=' + get(queryAtom), { signal: ctrl.signal });
  // 若本次执行在下一轮之前没完成，下一轮 set(abortTickAtom, t=>t+1) 让本 p 作废
  return (await p).json();
});
```

配合 debounce 写 queryAtom、切换时 bump tick——「最新值语义」管对的结果，AbortController 管省的流量，两层分开理解才不糊涂（呼应 pinia-async 的 AbortController 同款课题）。

## 三、retry 封装
可写 atom 里做退避重试，或用第三方 jotai 生态 atomWithRetry，把「第 n 次尝试」做成依赖触发重取（呼应 pinia-optimistic 重试）。

```ts
const attemptAtom = atom(0);
const dataAtom = atom(async (get) => {
  get(attemptAtom);
  const res = await fetch('/api');
  if (!res.ok) { setTimeout(() => set => {}, 0); /* 见下 */ throw new Error('bad'); }
  return res.json();
});
// 失败后：setTimeout(() => store.set(attemptAtom, a => a + 1), backoff(attempt))
```

指数退避（1s/2s/4s 封顶 + 抖动）+ 最大次数兜底——三行规则别手写玄学；retry 语义在 Query 里是配置项（retry: 3），在 atom 里是你写的纪律。

## 四、与 TanStack Query 分工
需要缓存/失效/分页/乐观/后台重取的重型场景交给 Query；Jotai 的 async atom 适合轻量的依赖驱动取数。

| 需求 | 选 |
|---|---|
| 进入页面取一次、联动重取 | async atom |
| 跨路由缓存、失效策略、prefetch | Query |
| SSE/WS 推流 | atomWithObservable |
| 分页 infinite + 后台刷新 | Query（或 jotai-websocket 类生态） |

混用规范：Query 的数据**不拷进** atom（双真相源），交互参数（筛选/排序）放 atom 作 Query key 的输入——参数原子化、数据查询化（呼应 za-layers 同款分层）。

## 五、Suspense 与竞态协同
在 transition 里更新依赖 atom，旧 UI 保留到新数据就绪，配合竞态忽略避免闪烁（呼应 za-transition）。

```tsx
const start = useStartTransition();
onChange={(e) => start(() => setQueryAtom(e.target.value))}
```

效果：打字不卡（query 更新可中断）、列表不换骨架（useDeferredValue 式的「旧值驻留」）、最终一致（新数据就绪一次性替换）——「输入即搜索」的天花板体验是竞态管理 + transition 的组合拳，单用谁都差一截。

## 六、测试竞态

msw 控制响应顺序即可复现：先发的请求配 `delay(300)`、后发的 `delay(50)`，断言最终 store.get 结果对应后发参数。Jotai 版应**天然绿**（内建忽略），拿同题测 useState/useEffect 手搓版会红——这条测试是「为什么用原子范式」的最硬证据（测法详见 jo-perf-test）。

## 小结
Jotai 以最新依赖为准自动忽略过期结果（语义正确），真取消要 AbortController/tick 作废（资源节约），重型缓存归 Query（架构分工），transition 配合出无缝 UX（体验收尾）——竞态四件套齐了再谈异步搜索。

## 部署预告
本地做输入即搜 demo：裸 fetch 复现竞态乱序 → 换 async atom 自动治愈 → 加 transition 消除闪烁 → msw 乱序延迟写一条回归测试。
