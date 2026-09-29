# loadable / unwrap：解 Suspense 黑盒

## 一、loadable 把状态显式化

```ts
// 目的：loadable 把 async atom 的三态显式化——不靠 Suspense 也能读“加载中/成功/失败”
import { loadable } from 'jotai/utils';
const loadableAtom = loadable(asyncAtom);   // 包一层，把 throw promise 转成可读状态对象
// 值形如：
// { state: 'pending' }            // 挂起中（仅首取挂起时）
// { state: 'hasData', data }      // 成功，data 是 resolve 值
// { state: 'hasError', error }    // 失败，error 是 reject 原因（不冒泡到 boundary）
// ✅ 组件里 switch(v.state) 自行决定三态渲染，错误文案/样式全可控
// ❌ 既然用了 loadable 又套 ErrorBoundary 管这同一个原子→loadable 已把 error 吞成 hasError 值，boundary 永远收不到，错误静躺 v.error 没人显示
```
不必用 Suspense 也能拿到「加载中/成功/失败」三态，在组件里自行决定渲染。

一句话定性：Suspense 是「框架代管三态」，loadable 是「把三态摆回你手里」。代价是组件里多了 if 分支，收益是渲染时机、样式、错误文案全部可控。

## 二、useAtomValue(loadableAtom) 做局部 loading

```tsx
// 目的：useAtomValue(loadableAtom) 做局部 loading——三态分支各自渲染，不整块 Suspense
const v = useAtomValue(loadableAtom);                    // 拿到 {state,...} 判别对象
if (v.state === 'pending') return <Spinner/>;            // 首取未就绪：局部小转圈
if (v.state === 'hasError') return <Err msg={v.error}/>; // 失败：就地显示错误，不冒泡 boundary
return <Data d={v.data}/>;                               // 成功：渲染数据
// ✅ 三态都在组件手里，适合“只想给这一小块上 spinner”的差值渲染
// ❌ 忘了写 hasError 分支→失败时落到 <Data d={v.data}/>，而 v.data 是 undefined，解构即崩
```
适合「不想整块 Suspense、想要局部 spinner」的场景。

错误也在此收口：loadable 把 rejection 变成「可读的 hasError 值」，**不会**冒泡到 ErrorBoundary——用 loadable 就别再套 boundary 管这个原子，一套心智管一条路（混用会漏网：以为有 boundary 兜底，实际错误静静躺在 v.error 里没人显示）。

## 三、unwrap 反向
unwrap(loadableAtom) 又把它变回可挂起的 promise 语义，两种风格互转（呼应 kit-load-universal）。

```ts
// 目的：unwrap 把 loadable 再变回可挂起语义——loadable/unwrap 两风格互转
const listAtom = atom(async (get) => fetchList());              // 源头：async 取数原子
const safeListAtom = loadable(listAtom);                        // 命令式三态对象
const backAtom = atom((get) => unwrap(get(safeListAtom)));      // unwrap 还原成会 throw promise 的原子
// ✅ 外层用 Suspense 管整块节奏、深层用 loadable 做局部差值，同一棵树分层各取所需
// ❌ 对普通 async atom 直接 unwrap（没先 loadable 包）→语义错位，unwrap 期望的是 loadable 的输出对象
```

实用模式：**外层大区块用 Suspense 管节奏，深层细节组件用 loadable 做差值渲染**（比如列表骨架已出、单个头像还在转）。两种风格可在同一棵树的不同层各取所需。

## 四、atomWithObservable
接 RxJS/EventSource/WebSocket：`atomWithObservable(sub=>...)` 把推流转成 atom，配 loadable 消费（呼应 rx-inapp）。

```ts
// 目的：atomWithObservable 把推流（RxJS/SSE/WS）并入拉流世界——订阅转成 atom，配 loadable 消费
const timeAtom = atomWithObservable(() => interval(1000));               // RxJS 定时流 → atom，每秒推新值
const esAtom = atomWithObservable(() => fromEventSource('/sse'));        // SSE 事件流 → atom
// ✅ complete/error 流语义映射为 hasData/hasError；无订阅者时 Jotai 引用计数自动断开上游，WS 不用手动 close
// ❌ 不交给 atom 自己 rxjs subscribe 存进组件 state→绕过引用计数，卸载不退订造成连接泄漏
```

observable 的 complete/error 流语义映射为 atom 的 hasData/hasError——推流世界正式并入拉流世界，组件侧一视同仁 useAtomValue。无订阅者时 Jotai 自动断开上游（引用计数），WebSocket 不再需要手动 close。

## 五、pending 的「粘性」细节

loadable 的 pending 语义：async atom **重取**期间，get(loadableAtom) 返回的是「旧值 + isPending 语境」还是 pending？——Jotai 的 loadable 会保留上一次 hasData 结果（旧数据可用），只在首次挂起时 pending。这正是「陈旧-而-有效」（stale-while-revalidate）UI 的原料：列表继续显示旧的，角落转个小圈提示刷新中（配 `isPendingAtom = atom((get)=>...)` 探测或直接用 useSuspense 类工具）。

## 六、取舍
Suspense 声明式优雅但边界粒度难控；loadable 命令式灵活、易做局部态——按 UI 需求选择。

决策口诀：**整块数据没到就不该存在 → Suspense；数据分段到位、各自有骨架 → loadable；既要整块兜底又要局部差值 → 外层 Suspense + 内层 loadable**。异步风格之争不是信仰题，是渲染节奏的产品题。

## 小结
loadable/unwrap 是 Jotai 异步的「显式三态」工具：错误自管不上冒泡、重取保留旧值可做 SWR、observable 打通推流；与 Suspense 是互补双层而非二选一。

## 部署预告
本地做一个 SSE 计数屏：atomWithObservable 接 EventSource、loadable 渲染连接三态、外层 Suspense 兜首屏；拔网线观察 hasError 而不弹 boundary。
