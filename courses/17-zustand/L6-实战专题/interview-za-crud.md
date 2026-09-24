# 面试题：CRUD 看板（za-crud）

### 1. (设计类) 为什么看板用 ids+entities 而不是数组？
**来源**：https://redux.js.org/usage/structuring-reducers/normalizing-state-shape

单条按 id O(1) 增删改、天然去重、跨引用方便；数组 find/splice 成本高且易不同步。

### 2. (实战类) 乐观删除 + 失败恢复快照完整写法？
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

记录被删对象与其在 ids 的位置，先本地移除，请求失败按位置插回并恢复对象。

### 3. (对比类) 分页数据为什么交给 Query 而非 store？
**来源**：https://tanstack.com/query/latest

分页是服务端态，需要缓存/竞态/失效；store 存它会制造第二真相（呼应 za-layers）。

### 4. (性能类) 一次改 50 个任务怎样最小化重渲？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

单个 set 内批量更新 entities，只发一次通知；组件用细 selector 订阅各自 id。

### 5. (坑类) 乐观更新与服务端返回冲突怎么办？
**来源**：https://tkdodo.eu/blog/

以服务端权威数据为准回填、必要时 invalidate 重取，乐观态仅提升即时体验。

### 6. (设计类) undo/redo 在批量操作下如何原子？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

把整批 set 作为历史一步快照，undo 时一次性 replace 回该步前状态。

### 7. (实战类) 拖拽改顺序 store 怎么更新？
**来源**：https://github.com/pmndrs/zustand/discussions

重排 ids 数组对应片段，task.columnId 变则从旧列 ids 移到新列 ids。

### 8. (综合类) 给看板设计一个 moveTask(action)。
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

moveTask(id,toCol,idx)：乐观改 columnId+splice ids，存快照，api 失败恢复。

### 9. (TS类) entities 的类型怎么保证不越界？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

Record<string,Task>，更新用 {...s.entities,[id]:{...old,...patch}} 保证键与值类型。

### 10. (坑类) structuredClone 与浅拷贝在快照上的区别？
**来源**：https://developer.mozilla.org/docs/Web/API/structuredClone

浅拷贝仍共享嵌套引用，回滚会脏；深快照用 structuredClone 或 immer produce。

### 11. (性能类) 大量行组件如何避免全量重渲？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

每行订阅 (s)=>s.entities[id]，仅该 id 变才重渲，配合稳定 selector。

### 12. (对比类) 乐观 vs 悲观更新分别适合什么？
**来源**：https://react.dev/reference/react/useOptimistic

高频低风险(点赞/拖拽)乐观；破坏性/需校验(支付)悲观等确认。

### 13. (设计类) 筛选/排序放 store 还是派生？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

条件放 store，结果用 memoized selector 派生，别把派生数组存进去。

### 14. (综合类) 整块看板的 store + Query 分工图？
**来源**：https://tanstack.com/query/latest

Query：任务分页/列表数据；Zustand：乐观覆盖、选中、筛选排序、拖拽临时态。

### 15. (趋势类) 实时协作下乐观更新要注意什么？
**来源**：https://datatracker.ietf.org/doc/html/rfc6902

多端并发需 conflict resolution、版本号或 CRDT，乐观只是过渡展示最终以权威 merge 为准。
