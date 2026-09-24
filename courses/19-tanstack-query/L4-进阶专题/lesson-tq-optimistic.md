# 乐观更新与回滚

## 一、三件套模板（背下来）

```ts
const m = useMutation({
  mutationFn: toggleLike,
  onMutate: async (post) => {
    await queryClient.cancelQueries({ queryKey: ['posts'] });      // ① 停掉在飞重取
    const prev = queryClient.getQueryData(['posts']);              // ② 快照
    queryClient.setQueryData(['posts'], (old) => flip(old, post.id)); // ③ 先爽
    return { prev };                                               // ④ 交给 onError
  },
  onError: (_e, _v, ctx) => queryClient.setQueryData(['posts'], ctx.prev), // 回滚
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),  // 对齐
});
```

cancelQueries 那一步防的是「乐观改完恰好后台重取落地，旧数据把你盖掉」——顺序不是玄学，每步都有对手。

## 二、第四拍 onSettled 的深意

成败都要 invalidate：乐观更新是 **UX 层骗一骗**，服务器口径（点赞总数、他人并发操作）最终必须回流。不写 onSettled 的乐观更新=假账永久入账。

## 三、哪些操作配乐观

适合：**高频、低风险、可回滚**——点赞、收藏、关注、勾选完成、拖卡片排序。
不适合：钱、库存、权限、状态机严格流转（支付、下单、退款）——失败回滚的代价从体验问题升级为信任事故，这类老实转圈+按钮禁用。
一条灰度口诀：**「回滚时用户骂不骂？」** 骂=别乐观。

## 四、竞态防护升级

高频连点（赞→取消赞→赞）时，旧响应可能后到并错误触发回滚/失效。标准补件：**回滚表（rollback buffers）**——onMutate 记下本次乐观补丁，onError 只撤销「自己那笔」而非整张快照，避免把更新的乐观态也回滚掉；简单场景用「每次变更 bump 一个版本号，回滚前比对」也能挡住大半。

## 五、与其他两家的镜像

Zustand 版：action 里 snapshot→set→catch→rollback→finally invalidate（za-crud 同款五步）；Jotai 版：moveCardAtom 一次 write 里乐观 set + catch set(prev)（jo-capstone 原样）。三家骨架完全同构：**快照-先爽-回滚-对齐**——这门课把它从「各库技巧」升格为「通用模式」。

## 六、usePendingActions：全局「有变更未落地」

任意 mutation pending 的变量集合可以用 `useMutationState({ select: m => m.variables })` 一把捞出——页头「同步中…」横幅、禁掉离开路由的守卫，都从这里取材，无需每个组件自己拼。

## 小结
乐观=四拍生命周期全用上：cancel→快照→改→(回滚|失效)；只给「回滚不心疼」的操作开绿灯；竞态连点靠回滚表/版本号补刀——骨架在 Query/Zustand/Jotai 三家同构，学会一次到处用。

## 部署预告
给列表加乐观点赞：制造 30% 失败率接口，连点三次观察回滚是否只撤自己那笔；再加 onSettled 失效对齐服务器真数；最后用 useMutationState 做「同步中」横幅。
