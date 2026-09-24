# 条件与依赖请求

## 一、enabled：让查询「装死」

```tsx
useQuery({
  queryKey: ['user', id],
  queryFn: () => fetch('/api/user/' + id).then(r => r.json()),
  enabled: !!id,          // id 为空串/undefined 时：不发请求、不重试
});
```

enabled:false 的查询 fetchStatus 进 paused——挂载不取、聚焦不取、invalidate 也不取，等 enabled 翻 true 才补一发。开关式懒加载（点开 Tab 再取）、登录态守卫（有 token 才取）都是这一行。

## 二、dependent queries：拿 A 的产物喂 B

```tsx
const { data: user } = useQuery({ queryKey: ['user'], queryFn: fetchUser });
const { data: projects } = useQuery({
  queryKey: ['projects', user?.teamId],
  queryFn: () => fetchProjects(user.teamId),
  enabled: !!user,        // 经典串联：B 等 A
});
```

key 里带上依赖值（user?.teamId），依赖一变自动重取；enabled 挡住「undefined 当参数」的脏请求。这是「依赖驱动」的 Query 版，与 jo-dependencies 的 get 建边殊途同归。

## 三、skipToken：更诚实的跳过（v5）

enabled 的语义是「暂停」——查询对象仍占着位置。v5 提供 `skipToken` 作 queryFn 的哨兵值：`queryFn: id ? () => fetch(id) : skipToken ——明确表示「这次不参与」，TS 也不再逼你为不跑的分支编造返回值。二选一即可，别 enabled+skipToken 混打。

## 四、placeholderData：先顶上再换真

翻页场景最痛的一下：page 变化 → key 变化 → 新 key 无缓存 → 整页闪回骨架。`placeholderData: (prev) => prev` 让新查询**先显示上一条查询的数据**，后台静默取新页：

```tsx
useQuery({
  queryKey: ['todos', page],
  queryFn: fetchTodos,
  placeholderData: keepPreviousData,   // v5 官方导出
});
```

注意它是「占位」不是「真相」：`isPlaceholderData: true` 期间 UI 该置灰/打「旧数据」标，别让用户把上一页当本页操作。

## 五、initialData：出生即有

与 placeholder 相反，initialData 是这条查询**自己的**初始值：给了它 isPending 直接 false、首帧就有 data，随后按 staleTime 决定要不要后台刷新。适合 SSR 注入、构建期常量、localStorage 缓存回填。「必填字段首帧不许空」的表单联动数据用 initialData，「别闪」的列表翻页用 placeholder——一词之差，语义两样。

## 六、isLoading 的修正姿势

有 placeholder/initialData 的查询 isPending 为 false，`isLoading` 不再为 true——「条件加载」UI 要用 `isPending || (isFetching && !isPlaceholderData)` 这类组合，或直接接受「占位即非空」的产品语义。

## 小结
enabled 挡不该发的请求，skipToken 诚实标注跳过，placeholder 治「切换闪空」，initialData 治「首帧必空」——四个开关把「何时取、拿什么顶着」讲完。

## 部署预告
做一个「团队-项目」两级页：先取 user 再按 teamId 取 projects 验证 enabled 串联；给分页列表接 keepPreviousData，对比开关时翻页的闪屏差异；用 devtools 观察 placeholder 条目的 isPlaceholderData。
