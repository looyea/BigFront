# L3 作业：异步与 Suspense

## 一、知识回顾
1. async atom 触发 Suspense 的机制。
2. loadable 三态与 unwrap 的互转用途。
3. Jotai 竞态处理边界与 AbortController 的角色。

## 二、代码实操
1. 用 async atom + Suspense 渲染用户详情，切换 id 观察自动重取。
2. 用 loadable 实现「局部 spinner + 错误提示」，不依赖整块 Suspense。
3. 给搜索 async atom 加 debounce 与 AbortController，验证过期结果被忽略。

## 三、思考题
1. 为什么 Jotai 忽略过期结果却不主动 abort？何时必须自己 abort？
2. 何时该把 async atom 换成 TanStack Query？

## 四、延伸阅读
- Jotai：utilities/loadable、utilities/observable
- TanStack Query：cancel 与竞态

## 五、自查清单
- [ ] async atom 读取处有 Suspense 或 loadable
- [ ] 依赖即请求键，自动重取正确
- [ ] 贵/敏感请求接了 AbortController
- [ ] 复杂缓存已考虑交给 Query
