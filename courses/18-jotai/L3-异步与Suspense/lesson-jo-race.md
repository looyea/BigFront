# 异步竞态与取消

## 一、自动竞态处理
async atom 依赖值变化触发重取时，Jotai 以「最新依赖值」的结果为准，忽略过期 promise（后发先至不会覆盖新值）。

经典事故现场：输入「a」发请求 1（慢），输入「ab」发请求 2（快）——无竞态管理的实现里请求 1 后到，列表显示 a 的结果盖掉 ab。Jotai 的解法内建于依赖图：每个依赖值对应独立执行槽，set(query,'ab') 后槽位即切到 2，请求 1 的 resolve 落入废槽无人认领。

## 二、AbortController 手动取消
Jotai 不会替你中断底层请求，需要时把 AbortController 放进 getter：

```ts
// 目的：把 AbortController 塞进 getter 的雏形——注意这版“取消时机”写法并不可靠，见下一块
const dataAtom = atom(async (get) => {
  const q = get(queryAtom);                    // 依赖 query，变更即重取
  const ctrl = new AbortController();          // 每次执行新建一个控制器
  const onAbort = () => ctrl.abort();          // 备好 abort 回调，但下面没接上真正的触发时机
  get(onAbortAtom).addListener?.();          // 概念示意：见下方可靠写法（这行并不能把 onAbort 挂到重取时）
  const res = await fetch('/api?q=' + q, { signal: ctrl.signal });   // 带 signal 的请求
  return res.json();
});
// ❌ onAbort 定义了却没人调用——重取时旧 ctrl 不 abort，旧请求仍在后台跑完，signal 形同虚设
// ✅ 可靠做法见下一块“自增 tick 失效法”，或在重取/卸载时机显式 ctrl.abort()
```

真实可靠写法是「自增 tick 失效法」：

```ts
// 目的：自增 tick 失效法——订阅一个作废信号，下一轮 bump tick 让本轮未完成结果的旧值作废
const abortTickAtom = atom(0);                       // 作废计数器
const dataAtom = atom(async (get) => {
  get(abortTickAtom);                        // 订阅一个“作废信号”：tick 变即重取，旧执行落废槽
  const ctrl = new AbortController();        // 本轮控制器
  const p = fetch('/api?q=' + get(queryAtom), { signal: ctrl.signal });   // 带 signal 发起
  // 若本次执行在下一轮之前没完成，下一轮 set(abortTickAtom, t=>t+1) 让本 p 作废
  return (await p).json();                   // 正常返回；被 abort 则抛 AbortError，结果无人认领
});
// ✅ 结果层以最新 tick 为准（旧 resolve 落废槽无人认领），UI 永远显示最新参数对应数据
// ❌ 以为 bump tick 就等于中断了底层 HTTP→它只让旧结果作废，真要省流量仍须把 signal 接到真正的 abort 时机
```

配合 debounce 写 queryAtom、切换时 bump tick——「最新值语义」管对的结果，AbortController 管省的流量，两层分开理解才不糊涂（呼应 pinia-async 的 AbortController 同款课题）。

## 三、retry 封装
可写 atom 里做退避重试，或用第三方 jotai 生态 atomWithRetry，把「第 n 次尝试」做成依赖触发重取（呼应 pinia-optimistic 重试）。

```ts
// 目的：retry 封装——把“第 n 次尝试”做成依赖原子，失败后 bump attempt 触发退避重取
const attemptAtom = atom(0);                         // 尝试计数，进 getter 依赖即“重试触发器”
const dataAtom = atom(async (get) => {
  get(attemptAtom);                                  // 订阅 attempt：每次 +1 都重跑取数
  const res = await fetch('/api');                   // 发请求
  if (!res.ok) { /* 见下方外部退避 */ throw new Error('bad'); }   // 非 2xx 抛出，交给失败路径
  return res.json();                                 // 成功返回数据
});
// 失败后：setTimeout(() => store.set(attemptAtom, a => a + 1), backoff(attempt))   // 退避到点 bump attempt→自动重取
// ✅ attempt 进依赖 = 手动重取开关，退避/最大次数由外部 backoff 控制，逻辑与原子解耦
// ❌ 在 getter 内直接 while 重试循环→阻塞该原子求值、绕过 React 渲染节奏，退避应落到外部 set(attemptAtom) 触发
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
// 目的：transition 里更新依赖 atom——旧 UI 驻留到新数据就绪，配竞态忽略消除闪烁
const start = useStartTransition();                     // 取 transition 启动器
onChange={(e) => start(() => setQueryAtom(e.target.value))}   // 把 query 更新降级为可中断的 transition
// ✅ 打字不卡（更新可中断）+ 列表不换骨架（旧值驻留）+ 最终一致（新数据就绪一次性替换）
// ❌ 不加 transition 直接 setQueryAtom→每次击键立刻重取+重渲，慢网络下骨架反复闪、输入跟手性差
```

效果：打字不卡（query 更新可中断）、列表不换骨架（useDeferredValue 式的「旧值驻留」）、最终一致（新数据就绪一次性替换）——「输入即搜索」的天花板体验是竞态管理 + transition 的组合拳，单用谁都差一截。

## 六、测试竞态

msw 控制响应顺序即可复现：先发的请求配 `delay(300)`、后发的 `delay(50)`，断言最终 store.get 结果对应后发参数。Jotai 版应**天然绿**（内建忽略），拿同题测 useState/useEffect 手搓版会红——这条测试是「为什么用原子范式」的最硬证据（测法详见 jo-perf-test）。

## 小结
Jotai 以最新依赖为准自动忽略过期结果（语义正确），真取消要 AbortController/tick 作废（资源节约），重型缓存归 Query（架构分工），transition 配合出无缝 UX（体验收尾）——竞态四件套齐了再谈异步搜索。

## 部署预告
本地做输入即搜 demo：裸 fetch 复现竞态乱序 → 换 async atom 自动治愈 → 加 transition 消除闪烁 → msw 乱序延迟写一条回归测试。
