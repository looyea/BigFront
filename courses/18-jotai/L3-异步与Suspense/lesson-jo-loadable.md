# loadable / unwrap：解 Suspense 黑盒

## 一、loadable 把状态显式化

```ts
import { loadable } from 'jotai/utils';
const loadableAtom = loadable(asyncAtom);
// 值形如：
// { state: 'pending' }
// { state: 'hasData', data }
// { state: 'hasError', error }
```
不必用 Suspense 也能拿到「加载中/成功/失败」三态，在组件里自行决定渲染。

一句话定性：Suspense 是「框架代管三态」，loadable 是「把三态摆回你手里」。代价是组件里多了 if 分支，收益是渲染时机、样式、错误文案全部可控。

## 二、useAtomValue(loadableAtom) 做局部 loading

```tsx
const v = useAtomValue(loadableAtom);
if (v.state === 'pending') return <Spinner/>;
if (v.state === 'hasError') return <Err msg={v.error}/>;
return <Data d={v.data}/>;
```
适合「不想整块 Suspense、想要局部 spinner」的场景。

错误也在此收口：loadable 把 rejection 变成「可读的 hasError 值」，**不会**冒泡到 ErrorBoundary——用 loadable 就别再套 boundary 管这个原子，一套心智管一条路（混用会漏网：以为有 boundary 兜底，实际错误静静躺在 v.error 里没人显示）。

## 三、unwrap 反向
unwrap(loadableAtom) 又把它变回可挂起的 promise 语义，两种风格互转（呼应 kit-load-universal）。

```ts
const listAtom = atom(async (get) => fetchList());
const safeListAtom = loadable(listAtom);           // 命令式三态
const backAtom = atom((get) => unwrap(get(safeListAtom))); // 再挂起化
```

实用模式：**外层大区块用 Suspense 管节奏，深层细节组件用 loadable 做差值渲染**（比如列表骨架已出、单个头像还在转）。两种风格可在同一棵树的不同层各取所需。

## 四、atomWithObservable
接 RxJS/EventSource/WebSocket：`atomWithObservable(sub=>...)` 把推流转成 atom，配 loadable 消费（呼应 rx-inapp）。

```ts
const timeAtom = atomWithObservable(() => interval(1000));
const esAtom = atomWithObservable(() => fromEventSource('/sse'));
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
