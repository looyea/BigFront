# React 19 Transition 与 Zustand 更新

## 一、startTransition 让更新「可打断」

```tsx
import { useTransition } from 'react';
const [isPending, start] = useTransition();
start(() => useSearchStore.getState().setQuery(input));
```
把 store 更新标记为非紧急(transition)，React 可中断它去处理更紧急输入，大列表过滤不卡手。

心智：紧急更新（打字、点击）永远插队；transition 渲染到一半可以丢弃重来。代价是 transition 期间的渲染可能被多次启动——action 要保持「纯」，别在 set 里做埋点/发请求这类一次性副作用。

## 二、Zustand set 天然批量

同一事件回调里多次 set，只触发一次订阅通知 + React 18/19 自动批处理，一次渲染。

```ts
reset: () => set({ step: 0 }), // 与下面合并为一次渲染
clear: () => set({ data: {} }),
// 一个 action 里连发多次 set 也只有一个渲染帧
```

对比 v16 之前的 class setState 批处理玄学——外部 store + uSES 的模型下，批处理由 React 18+ 的自动 batching 统一接管（呼应 za-sync-external）。

## 三、useOptimistic + store

React 19 的 useOptimistic 适合「提交前先行展示」：
```tsx
const [optimistic, setOptimistic] = useOptimistic(serverTodos);
// action 里先 setOptimistic 再 store.add
```
表单/列表提交先乐观渲染，失败由 store 回滚。

分工：useOptimistic 管「这一棵子树的临时视觉态」，action 完成/失败后自动回落到 serverTodos；要跨路由存活、可撤销的乐观则进 store 手动快照回滚（呼应 za-crud、pinia-optimistic）。

## 四、并发安全的 store 读

transition 渲染期间读 store，务必用 useStore 订阅值而非中途 getState 变化值，保证同一渲染内快照一致（呼应 za-sync-external）。

反例：组件 render 函数里 `if (useStore.getState().flag)`——它不参与订阅，transition 重放时值可能已变，界面自相矛盾。规则一句话：**渲染期只订阅，事件期才 getState**。

## 五、isPending 反馈
用 isPending 给列表加半透明/loading，标识「正在后台算」。

```tsx
<div style={{ opacity: isPending ? 0.6 : 1 }}>
```

多个 transition 共享一个 isPending；需要区分是谁在 pending 时，自己维护 action 级标志位进 store。

## 六、debounce 还要不要？

老写法「输入 → debounce 300ms → setState」是用节流换流畅度；startTransition 让重渲染可打断后，许多 debounce 可以直接删掉——即时反馈 + 后台算更舒服。保留 debounce 的场景只剩：请求要花钱（搜索接口）、或 transition 也扛不住的巨型计算（再配 useDeferredValue 分级）。

## 小结
startTransition 把 store 更新降级为可中断；useOptimistic 做局部乐观；多次 set 自动批量；渲染期只订阅、事件期才 getState——四条守则拼出并发 UI 的流畅与正确。

## 部署预告
本地用 10k 行表格 + 输入框过滤，开关 startTransition 各录一段 Performance 轨迹，对比 INP；再给删除按钮接 useOptimistic 断网验证回滚。
