# L5 作业：架构与性能

## 一、知识回顾
1. 全局默认 store 的三大隐患与 createStore/Provider 的解法。
2. SSR 的每请求 store + dehydrate/hydrateAtoms + 防闪烁。
3. 细订阅、派生深度、高频隔离三条性能主线与纯 store 测试。

## 二、代码实操
1. 用 Provider + 独立 store 让同页两个 Widget 互不干扰。
2. 在 Next App Router 里做每请求 store 并用 dehydrate/hydrateAtoms 消除取数闪烁。
3. 用 vanilla store 写一组纯测，并用 Profiler 验证某组件只订阅其用到的 atom。

## 三、思考题
1. 为什么把大对象拆成 focus 子原子能显著减少重渲？
2. SSR 下 async atom 不水合会付出什么代价？

## 四、延伸阅读
- Jotai：utilities/provider、utilities/ssr、devtools
- React Profiler 使用

## 五、自查清单
- [ ] 需要隔离处均用 Provider/新 store
- [ ] SSR 每请求 store 且水合 async 结果
- [ ] 大对象已 focus/split 拆细
- [ ] 关键逻辑有纯 store 测试
