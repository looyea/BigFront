# 面试题：Slices Pattern（za-slices）

### 1. (设计类) Slices Pattern 解决的本质问题？
**来源**：https://zustand.docs.pmnd.rs/limitations 或 patterns

单一 create 随业务膨胀失控，切片按域内聚、可独立演进与测试，再安全组合。

### 2. (TS类) StateCreator 四个泛型分别是什么？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

<聚合State, Middlewares, Missing被注入的action, 本Slice形状>，多数写 [],[] 由推断补。

### 3. (实战类) slice 间协作的正确姿势？
**来源**：https://github.com/pmndrs/zustand/discussions

通过共享的 get() 调对方 action，避免重复维护；类型上要把所有 slice 合并进 AppState。

### 4. (对比类) slices 与拆成多个独立 store 的取舍？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

同一 store 的 slice 共享一次订阅上下文、跨域协作方便；完全独立 store 隔离更彻底但跨读要额外订阅。

### 5. (坑类) get().otherAction 拿不到值常见原因？
**来源**：https://github.com/pmndrs/zustand/discussions

slice 未组合进同一 store，或 AppState 类型没 extends 该 slice 接口。

### 6. (设计类) 为什么 slice 里同时导出 selector？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

把“如何从 state 取数据”的知识与组件解耦，改结构只动 selector。

### 7. (实战类) 一个 slice 太大怎么办？
**来源**：https://github.com/pmndrs/zustand/discussions

再按子域拆，或把纯派生逻辑移出成 selector，action 保持动词化小函数。

### 8. (TS类) 组合 slice 时类型怎么不丢？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

interface AppState extends A,B,C，create<AppState>()((...a)=>({...aSlice(...a)})) 保留全部签名。

### 9. (对比类) slices 与 Redux Toolkit createSlice 神似点？
**来源**：https://redux-toolkit.js.org/api/createSlice

都强调“状态+操作”同域封装；RTK 强制 reducer/immutable，Zustand slice 直接 set 更自由。

### 10. (综合类) 给出 cartSlice 的最小骨架。
**来源**：https://github.com/pmndrs/zustand/discussions

interface CartSlice{items:Add[]} 与 createCartSlice:StateCreator<AppState,[],[],CartSlice>=(set)=>({items:[],add:i=>set(s=>({items:[...s.items,i]}))})。

### 11. (性能类) slice 会影响订阅粒度吗？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

订阅粒度由 selector 决定而非 slice；合理导出细 selector 才能享受拆分红利。

### 12. (设计类) 循环依赖风险在哪，怎么避免？
**来源**：https://github.com/pmndrs/zustand/discussions

slice A、B 互相 import 对方类型/action 时易循环；用聚合 AppState 类型放独立文件、action 走 get() 打破循环。

### 13. (实战类) 测试单个 slice 方便吗？
**来源**：https://zustand.docs.pmnd.rs/limitations

可把 StateCreator 喂进 createStore 单独测其 reducer 式逻辑，无需整 app。

### 14. (趋势类) feature-sliced 架构与 zustand slices 关系？
**来源**：https://feature-sliced.design/

理念一致：按 feature 组织；slice 放 feature 目录，selector 作对外接口。

### 15. (综合类) 团队定 slice 规范你会写哪几条？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

① 每 slice 一文件导出 slice/接口/selector；② AppState 集中 extends；③ 跨 slice 只经 get().action；④ 组件禁止直连 state 字段。
