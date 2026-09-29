# React 19 Transition 与 Zustand 更新

## 一、startTransition 让更新「可打断」

```tsx
// 目的：startTransition 把 store 更新降级为可打断——大列表过滤不卡手
import { useTransition } from 'react';
const [isPending, start] = useTransition();                 // start 包裹的更新标为非紧急(transition)
start(() => useSearchStore.getState().setQuery(input));      // 事件期 getState 调 action，可被更紧急输入中断重来
// ✅ 打字触发的紧急更新永远插队，transition 渲到一半可丢弃重来，输入框不跟手
// ❌ 在 setQuery 里做埋点/发请求这类一次性副作用→transition 可能重放多次，埋点重复上报、请求发好几次
```
把 store 更新标记为非紧急(transition)，React 可中断它去处理更紧急输入，大列表过滤不卡手。

心智：紧急更新（打字、点击）永远插队；transition 渲染到一半可以丢弃重来。代价是 transition 期间的渲染可能被多次启动——action 要保持「纯」，别在 set 里做埋点/发请求这类一次性副作用。

## 二、Zustand set 天然批量

同一事件回调里多次 set，只触发一次订阅通知 + React 18/19 自动批处理，一次渲染。

```ts
// 目的：同一事件回调里多次 set，只触发一次订阅通知 + React 18/19 自动批处理，一帧渲染
reset: () => set({ step: 0 }),          // 单看像独立一次渲染……
clear: () => set({ data: {} }),         // ……但同一回调里连发，也只合并成一个渲染帧
// ✅ React 18+ 自动 batching 统一接管批处理，外部 store 无需再手动合并
// ❌ 还照 class 时代给每次 set 包 unstable_batchedUpdates→18+ 下纯属多余，白绕一层
```

对比 v16 之前的 class setState 批处理玄学——外部 store + uSES 的模型下，批处理由 React 18+ 的自动 batching 统一接管（呼应 za-sync-external）。

## 三、useOptimistic + store

React 19 的 useOptimistic 适合「提交前先行展示」：
```tsx
// 目的：useOptimistic 做“提交前先行展示”——局部子树的临时视觉态，失败自动回落
const [optimistic, setOptimistic] = useOptimistic(serverTodos);   // serverTodos 是真相基准
// action 里先 setOptimistic(newTodo) 再触发 store.add / 提交
// ✅ 提交即乐观渲染，transition 结束或失败时自动回落到 serverTodos，UI 不用手写回滚
// ❌ 需要跳路由存活、可撤销的乐观却用 useOptimistic→它只在子树渲染期有效，卸载即丢，应进 store 手动快照回滚
```
表单/列表提交先乐观渲染，失败由 store 回滚。

分工：useOptimistic 管「这一棵子树的临时视觉态」，action 完成/失败后自动回落到 serverTodos；要跨路由存活、可撤销的乐观则进 store 手动快照回滚（呼应 za-crud、pinia-optimistic）。

## 四、并发安全的 store 读

transition 渲染期间读 store，务必用 useStore 订阅值而非中途 getState 变化值，保证同一渲染内快照一致（呼应 za-sync-external）。

反例：组件 render 函数里 `if (useStore.getState().flag)`——它不参与订阅，transition 重放时值可能已变，界面自相矛盾。规则一句话：**渲染期只订阅，事件期才 getState**。

## 五、isPending 反馈
用 isPending 给列表加半透明/loading，标识「正在后台算」。

```tsx
// 目的：isPending 标识“正在后台算”——给过渡中的列表加半透明反馈
<div style={{ opacity: isPending ? 0.6 : 1 }}>   {/* 三元控透明度，pending 时压到 0.6 */}
// ✅ 一个 isPending 覆盖当前所有进行中的 transition，零成本给出“慢点也没卡”的反馈
// ❌ 多个 transition 想分别显示各自 pending 却共用一个 isPending→分不清谁在算，需自维护 action 级标志进 store
```

多个 transition 共享一个 isPending；需要区分是谁在 pending 时，自己维护 action 级标志位进 store。

## 六、debounce 还要不要？

老写法「输入 → debounce 300ms → setState」是用节流换流畅度；startTransition 让重渲染可打断后，许多 debounce 可以直接删掉——即时反馈 + 后台算更舒服。保留 debounce 的场景只剩：请求要花钱（搜索接口）、或 transition 也扛不住的巨型计算（再配 useDeferredValue 分级）。

## 小结
startTransition 把 store 更新降级为可中断；useOptimistic 做局部乐观；多次 set 自动批量；渲染期只订阅、事件期才 getState——四条守则拼出并发 UI 的流畅与正确。

## 部署预告
本地用 10k 行表格 + 输入框过滤，开关 startTransition 各录一段 Performance 轨迹，对比 INP；再给删除按钮接 useOptimistic 断网验证回滚。
