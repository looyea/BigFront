# useMutation 与缓存更新

## 一、写操作为什么要单独一个 hook

POST/PATCH/DELETE 与 GET 的三宗不同：**不该按 key 缓存**（每次点击都是新操作）、**需要「提交中」态驱动按钮**、**要拿响应回写缓存**。useMutation 就是为此而生：不缓存结果、提供生命周期回调、variables 参数化。

```tsx
const m = useMutation({
  mutationFn: (todo: Todo) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(todo) }),
});
button.onClick = () => m.mutate(newTodo);
```

## 二、四拍生命周期

```ts
useMutation({
  mutationFn,
  onMutate: (vars) => ({ snapshot: 1 }),     // 请求前（乐观更新的舞台，见 tq-optimistic）
  onSuccess: (data, vars, ctx) => { ... },   // 响应成功（拿 data 回写/失效）
  onError:   (err, vars, ctx) => { ... },    // 失败（提示/回滚）
  onSettled: (data, err, vars, ctx) => {     // 成败都跑（invalidate 标准位）
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

onSettled 放 invalidate 比 onSuccess 更稳：就算接口「返回 200 但语义失败」，也照样拉一次服务器真相兜底。

## 三、失效之后，还要不要手改？

默认答案：**invalidate 就够**——变更影响面你常常说不清，让服务器重新说话最稳。但两种情况值得精确更新（updates-from-mutation-responses）：① 响应就带完整新实体，`setQueryData(['todos'], list => 替换那条)` 免去一次列表重取；② 列表巨大，重取成本高于打补丁。能用 invalidate 的先用 invalidate，性能账算得过来再上手改。

## 四、按钮的 loading 从哪来

mutate 触发的 isPending 是**每个 useMutation 实例**的局部状态——A 组件的 pending 不会传给 B 组件。跨组件读「这条变更提交中」用 **useMutationState**：

```tsx
const pendingIds = useMutationState({
  filters: { mutationKey: ['add-todo'] },
  select: (m) => m.state.context?.id,
});
// 任何组件里：pendingIds.includes(id) 决定该行转圈
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
