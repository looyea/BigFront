# L4 作业：React 并发与安全

## 一、知识回顾
1. useSyncExternalStore 的三个参数与快照稳定契约。
2. startTransition / useOptimistic 各解决什么。
3. 为什么 Zustand 不能直接触发 Suspense，异步该交给谁。

## 二、代码实操
1. 复现一个 selector 返回新对象导致的 cached 警告，并用 useShallow 修复。
2. 用 startTransition 包裹一个「慢过滤」store 更新，用 isPending 给列表加半透明。
3. 搭一个「useSuspenseQuery 取数据 + 错误边界复位 store.loading」的详情页。

## 三、思考题
1. transition 内多次 set 会渲染几次，为什么？
2. 乐观更新失败回滚的 UX 如何做到不跳动？

## 四、延伸阅读
- React：useSyncExternalStore / useTransition / useOptimistic
- TanStack Query：Suspense 用法

## 五、自查清单
- [ ] 所有 getSnapshot 引用稳定
- [ ] 非紧急重渲染用 transition 包裹
- [ ] 异步挂起交给 Query/Jotai 而非 store
- [ ] 错误边界复位 loading
