# L3 作业：请求模式

## 一、知识回顾
1. enabled / skipToken / placeholderData / initialData 四开关各自解决什么时机问题。
2. 并行为默认、瀑布为敌；useQueries 与 prefetch 的适用边界。
3. useMutation 四拍生命周期与 onSettled-invalidate 惯例。

## 二、代码实操
1. 实现「token 守卫 + user→projects 依赖」两连查询，DevTools 验证 B 在 A resolve 前 paused。
2. 给列表加 keepPreviousData 翻页 + hover 预取详情（staleTime 10s），记录 Network 里「秒出」的命中证据。
3. 完成 todo 的增删改三个 mutation：onSettled 失效、删除按钮用 useMutationState 跨组件转圈、提交按钮 isPending 禁用+幂等 uuid。

## 三、思考题
1. 为什么「响应里带完整实体」仍然常常选择 invalidate 而不是手改？写出两个理由。
2. placeholder 数据期间用户点了「编辑」，你的 UI 会怎样？给出防护方案。

## 四、延伸阅读
- TanStack Query 官方：guides/disabling-queries、dependent-queries、placeholder-query-data、parallel-queries、prefetching、request-waterfalls、mutations、invalidations-from-mutations
- reference/functions/useMutationState

## 五、自查清单
- [ ] 所有写操作都有 onSettled 失效（或说明为何手改）
- [ ] 依赖链的每一环 key 都含依赖值
- [ ] 预取都配了 staleTime
- [ ] 按钮 pending 与幂等保护成对出现
