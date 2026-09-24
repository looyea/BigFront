# 面试题：React 19 Transition 与 Zustand（za-transition）

### 1. (原理类) startTransition 为什么能改善卡顿？
**来源**：https://react.dev/reference/react/useTransition

把更新标为非紧急，React 可中断/延后其渲染，让紧急输入优先绘制，长计算切片让路。

### 2. (实战类) 用 transition 包裹 Zustand 更新的写法？
**来源**：https://react.dev/reference/react/useTransition

start(()=>store.getState().setFilter(v))，配合 isPending 展示 loading。

### 3. (对比类) transition 与 debounce 取舍？
**来源**：https://react.dev/reference/react/useTransition

debounce 延迟执行、可能仍卡；transition 立即开始但可中断不阻塞输入，体验更实时。

### 4. (实战类) useOptimistic 和 Zustand 如何配合做提交？
**来源**：https://react.dev/reference/react/useOptimistic

useOptimistic 负责 UI 先行展示，store action 发请求，成功用 Query/store 落地、失败 store 回滚。

### 5. (坑类) transition 里 setState 被 React 警告？
**来源**：https://react.dev/reference/react/useTransition

某些版本 transition 内不能同步 await；异步应放 action 里再 start 更新。

### 6. (设计类) 多次 set 的批量语义在并发下的保证？
**来源**：https://react.dev/reference/react-dom/client/createRoot

同帧 set 归为一次更新，作为同一 transition 原子提交，不会渲染中间态。

### 7. (性能类) isPending 适合做哪种反馈？
**来源**：https://react.dev/reference/react/useTransition

列表半透明/骨架/spinner，提示后台正在计算而非冻结。

### 8. (综合类) 给搜索框设计“不跟手”解决方案。
**来源**：https://react.dev/reference/react/useTransition

输入即时受控，过滤放进 startTransition，大结果渲染被切分，保留 typing 流畅。

### 9. (对比类) transition 更新与普通更新的 store 读取一致性？
**来源**：https://react.dev/reference/react/useSyncExternalStore

都用 useSyncExternalStore 取一致快照，transition 不破坏 store 订阅一致性。

### 10. (坑类) 乐观更新可能引发什么 UX 问题？
**来源**：https://react.dev/reference/react/useOptimistic

失败回滚造成“闪现/跳动”，需对回滚做动画与提示，避免用户困惑。

### 11. (趋势类) React 19 对 transition/optimistic 的增强？
**来源**：https://react.dev/blog/2024/12/05/react-19

Actions、useOptimistic、useActionState 与 form 集成，乐观/待处理态更开箱即用。

### 12. (综合类) 如何在向导多步里用 transition？
**来源**：https://react.dev/reference/react/useTransition

步骤跳转的较重渲染用 start 包裹，isPending 时禁用按钮防重复点击。

### 13. (实战类) transition 与 Suspense 的协作？
**来源**：https://react.dev/reference/react/Suspense

transition 触发的挂起会保留旧 UI 直到新数据就绪，避免闪白。

### 14. (设计类) 哪些更新不该放进 transition？
**来源**：https://react.dev/reference/react/useTransition

文本框受控 value 等需即时响应的输入类更新应保持紧急，不放 transition。

### 15. (综合类) 团队引入 transition 的落地建议？
**来源**：https://react.dev/reference/react/useTransition

先从“慢列表/重派生”切入，配 isPending 反馈，逐步把非紧急 store 更新 transition 化。
