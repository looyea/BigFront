# useMutation 与缓存更新

## 一、写操作为什么要单独一个 hook

POST/PATCH/DELETE 与 GET 的三宗不同：**不该按 key 缓存**（每次点击都是新操作）、**需要「提交中」态驱动按钮**、**要拿响应回写缓存**。useMutation 就是为此而生：不缓存结果、提供生命周期回调、variables 参数化。

```tsx
// 目的：写操作交 useMutation——不缓存结果、variables 参数化、提供“提交中”态驱动 UI
const m = useMutation({
  mutationFn: (todo: Todo) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(todo) }),   // 入参即 variables
});
button.onClick = () => m.mutate(newTodo);   // 触发一次写，m.isPending 期间按钮置 loading
// ✅ 每次点击都是独立操作，不像 useQuery 按 key 复用——写天然不该缓存
// ❌ 用 useQuery 做写：把 POST 塞 queryFn→结果被按 key 缓存、不会重发，语义全错
```

## 二、四拍生命周期

```ts
// 目的：四拍生命周期——onMutate 备乐观快照、onSuccess 回写、onError 回滚、onSettled 收尾失效
useMutation({
  mutationFn,
  onMutate: (vars) => ({ snapshot: 1 }),     // 请求前（乐观更新舞台，见 tq-optimistic；返回值作 ctx 传下去）
  onSuccess: (data, vars, ctx) => { ... },   // 响应成功（拿 data 回写/失效）
  onError:   (err, vars, ctx) => { ... },    // 失败（提示/回滚，ctx 拿回 onMutate 的快照）
  onSettled: (data, err, vars, ctx) => {     // 成败都跑（invalidate 标准位）
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
// ✅ onSettled 放 invalidate 比 onSuccess 更稳：接口“200 但语义失败”也照样拉服务器真相兜底
// ❌ 只在 onSuccess invalidate：200 空/语义失败时缓存不更新，UI 停在旧列表
```

onSettled 放 invalidate 比 onSuccess 更稳：就算接口「返回 200 但语义失败」，也照样拉一次服务器真相兜底。

## 三、失效之后，还要不要手改？

默认答案：**invalidate 就够**——变更影响面你常常说不清，让服务器重新说话最稳。但两种情况值得精确更新（updates-from-mutation-responses）：① 响应就带完整新实体，`setQueryData(['todos'], list => 替换那条)` 免去一次列表重取；② 列表巨大，重取成本高于打补丁。能用 invalidate 的先用 invalidate，性能账算得过来再上手改。

## 四、按钮的 loading 从哪来

mutate 触发的 isPending 是**每个 useMutation 实例**的局部状态——A 组件的 pending 不会传给 B 组件。跨组件读「这条变更提交中」用 **useMutationState**：

```tsx
// 目的：跨组件读“这条变更提交中”——isPending 是各实例局部态，聚合用 useMutationState
const pendingIds = useMutationState({
  filters: { mutationKey: ['add-todo'] },   // 前提：useMutation 得配 mutationKey 才被选中
  select: (m) => m.state.context?.id,        // 从 ctx 挑出正在提交的那条 id
});
// 任何组件里：pendingIds.includes(id) 决定该行转圈
// ✅ 多个“添加”实例的 pending 汇成一个 id 集合，任意组件读它渲染行级 loading
// ❌ 忘了给 useMutation 配 mutationKey→filters 选不中，pendingIds 永远空
```

给 useMutation 配 mutationKey 是它的前提（v5 惯例，也是 devtools 里认出它的名牌）。

## 五、mutate 还是 mutateAsync

mutate 火后不管（错误走 onError，不 throw）；mutateAsync 返回 promise（在 await 链/表单提交流里顺手，但要自己 try/catch）。命令式流程 mutateAsync，「点击-回调」式 UI 用 mutate——一个事件循环里别混用两种心智。

## 六、全局钩子：每笔变更都要做的事

鉴权失效统一处理、埋点上报，别写到每个 useMutation 里：new QueryClient 时配 `mutationCache: new MutationCache({ onError })`，或在 defaultOptions.mutations 里放全局 onSuccess——变更逻辑的「中间件层」在这。

## 小结
useMutation 三件套=不缓存的写+四拍生命周期+mutate/mutateAsync 两副面孔；invalidate 保正确、setQueryData 省请求、useMutationState 管跨组件 pending——写操作的闭环合上。

## 部署预告
给 L2 的 todo 页补删除功能：onSettled 里 invalidate；再故意让删除接口返回 200+失败体，观察「只 invalidate」如何自动纠偏；用 useMutationState 在页头显示「N 项删除中」。
