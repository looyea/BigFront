# 面试题：Store 工厂与多实例（za-factory）

### 1. (设计类) 什么时候必须放弃全局单例改多实例？
**来源**：https://zustand.docs.pmnd.rs/limitations

同类组件需各自独立状态（多个表格/向导/弹窗），或测试要完全隔离时。

### 2. (实战类) createStore + Context 注入的完整步骤？
**来源**：https://zustand.docs.pmnd.rs/store-boop/contexts

工厂产 vanilla store→Provider 用 useRef 持有→Context 下发→子组件 useStore(ctx, sel) 订阅。

### 3. (原理类) useStore(store, selector) 和 create 返回的 hook 有何关系？
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/use-store

create 内部就是用 useStore 绑定它自己的 store；对外部 store 手动调 useStore 等价。

### 4. (坑类) 在 render 里直接 makeStore() 会怎样？
**来源**：https://github.com/pmndrs/zustand/discussions

每次渲染新建 store，状态永远丢；必须 useRef 缓存或 useState 初始化。

### 5. (对比类) 工厂封装相比每个 store 各写一遍中间件的优势？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

统一 devtools/persist/immer 与命名规范，一处维护、全局一致。

### 6. (设计类) 多实例下如何共享一部分全局逻辑？
**来源**：https://zustand.docs.pmnd.rs/limitations

把全局态留在单例 store，实例 store 通过 get()/选择器组合，或工厂注入公共 slice。

### 7. (TS类) Context 的类型怎么标注 store？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

createContext<StoreApi<T> | null>(null)，用 useContext 后非空断言或抛错保护。

### 8. (实战类) 如何给工厂 store 做懒初始化？
**来源**：https://github.com/pmndrs/zustand/discussions

if(!ref.current) ref.current=makeStore(props)，仅在首渲染创建。

### 9. (对比类) 与 React Context + useReducer 实现多实例相比？
**来源**：https://react.dev/reference/react/useReducer

工厂方案状态在 store 里、可脱离 React 读写且支持 selector 细订阅；Context 更新易整体重渲。

### 10. (综合类) 写一个可复用的 useTableInstance 绑定 hook。
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/use-store

const useTableInstance=(sel)=>useStore(useContext(Ctx), sel)，并导出 Provider 组件。

### 11. (坑类) 多实例 + persist 要注意什么？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

每实例需唯一 name，否则互相覆盖存储；或实例 store 干脆不持久化。

### 12. (设计类) 工厂如何支持部分实例可配置中间件开关？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

工厂接收 options，按 flag 有选择地 compose devtools/persist。

### 13. (性能类) Context 注入会不会引起整子树重渲？
**来源**：https://react.dev/reference/react/useContext

Context value（store 引用）不变则不触发；实际更新由 useStore 的 selector 粒度控制。

### 14. (趋势类) Signal/新提案对多实例的影响？
**来源**：https://github.com/tc39/proposal-signals

原生 signal 天然 per-scope，未来隔离更轻，但工厂+Provider 仍是当下稳态方案。

### 15. (综合类) 单例 vs 工厂，你的选型口诀？
**来源**：https://zustand.docs.pmnd.rs/limitations

全局唯一→单例直接 import；同组件多副本要各记各的→createStore+Context 工厂。
