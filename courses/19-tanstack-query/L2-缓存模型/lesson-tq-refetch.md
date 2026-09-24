# 失效与后台重取

## 一、invalidateQueries：失效一号位

变更成功后第一件事不是改缓存，是**宣告过期**：

```ts
await createTodo(todo);
queryClient.invalidateQueries({ queryKey: ['todos'] });
```

三个高价值参数：`refetchType: 'active' | 'inactive' | 'all' | 'none'`（默认 active——只重取有人看的，没人看的标 stale 下次再说）；`cancelRefetch: true`（正在取的先掐再重取）；`exact`/前缀匹配（上一关）。invalidate 与 removeQueries 的区别：前者保数据静待重取（UI 不断流），后者连数据一起丢（UI 立刻空）。

## 二、被动三连：聚焦 / 重连 / 轮询

```tsx
useQuery({ ...opts,
  refetchOnWindowFocus: true,   // 默认开：切回来保新鲜
  refetchOnReconnect: true,     // 断网恢复自动补取
  refetchInterval: 5_000,       // 轮询；可函数 (state)=> 根据数据决定间隔
});
```

聚焦/重连是「用户可能看到陈旧数据了」的产品直觉；轮询是实时性不够时的兜底，实时要求高再上 WebSocket 写缓存（setQueryData 配合）。三档全开等于默认值，**关掉它们的理由应该比开着的理由更充分**。

## 三、networkMode：离线不是断点

```tsx
useQuery({ ...opts, networkMode: 'offlineFirst' });
```

默认 `online`：断网时查询进 `fetchStatus:'paused'`（UI 可显「离线」角标），恢复自动续。mutation 用 `offlineFirst` 可离线排队、上线重放（React Native 场景标配）。paused 时 loading 语义要小心——isInitialLoading 仍 true，UI 该给离线提示而不是无限转圈。

## 四、后台刷新的正确姿势：indicators 不是 skeletons

isFetching && !isPending 时，数据是「陈旧-而-有效」的——**整页骨架屏会闪瞎用户**，正确表达是角落小转圈/淡出进度条（background fetching indicators 官方专章）。配合 placeholderData 翻页时旧页不闪空，「后台静默刷新」的产品感就齐了。

## 五、手动挡全家桶

`refetch()`（hook 返回，强制重取当前查询）、`client.refetchQueries({...})`（批量）、`client.removeQueries()`（踢出缓存，登出清场）、`client.reset()`（回到初始）。invalidate 是「标脏等取」，refetch 是「现在立刻取」——95% 场景应该用前者，因为「脏了谁在乎谁取」比「全量立刻取」省得多。

## 小结
主动失效 invalidateQueries（前缀匹配+refetchType 精调）是数据联动的正门；被动刷新聚焦/重连/轮询是新鲜度兜底；networkMode 管离线、indicators 管体验——「改一处数据，全站自动对齐」从此成立。

## 部署预告
做一个 todo 增删改页：新增成功后只 invalidate ['todos'] 前缀，观察列表与角标 count 两条查询一起刷新；再断网点一次「收藏」，验证 offlineFirst 排队与恢复重放。
