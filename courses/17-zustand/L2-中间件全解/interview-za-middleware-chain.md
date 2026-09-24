# 面试题：中间件链（za-middleware-chain）

### 1. (原理类) 用一句话定义 Zustand 中间件。
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

(fn)=>(set,get,store)=>init 的函数，包装并增强 set/get，在不改业务代码前提下注入能力。

### 2. (实战类) devtools+persist+immer 推荐顺序及理由？
**来源**：https://zustand.docs.pmnd.rs/middlewares/immer-middleware

devtools(persist(immer(fn)))：immer 最内产出不可变，persist 序列化最终态，devtools 最外完整记录。

### 3. (坑类) 顺序写反会引入哪些隐蔽 bug？
**来源**：https://github.com/pmndrs/zustand/discussions

persist 在 immer 内可能存 Proxy；devtools 在内侧漏记水合；undo 在外侧可能捕获半成品状态。

### 4. (设计类) 为什么中间件用高阶函数而不是继承？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

函数式组合可自由排列、按需叠加、易测试，无 class 耦合。

### 5. (实战类) 写一个给每个 set 打时间戳的中间件思路。
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

包装 set：调用后 setState({__ts:Date.now()}) 或在 partial 里注入 lastModified，注意避免递归触发。

### 6. (对比类) Zustand 中间件与 Redux 中间件的本质差异？
**来源**：https://zustand.docs.pmnd.rs/integrations/redux

Redux 中间件拦截 action/dispatch；Zustand 中间件拦截 set/get，粒度更贴近状态变更本身。

### 7. (TS类) 自定义中间件的类型怎么写？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

type Mw=(fn:StateCreator<S,M,W>)=>StateCreator<S,M,W>，配合 curried create<T>()(...)。

### 8. (原理类) store 参数上如何给 hook 挂自定义 API？
**来源**：https://zustand.docs.pmnd.rs/troubleshooting

把方法写到 store.api 上，组件通过 useStore 拿到实例后可 store.api.undo() 调用。

### 9. (性能类) 中间件层数过多有何代价？
**来源**：https://zustand.docs.pmnd.rs/limits/known-limitations

每次 set 穿越整条链有函数调用开销；一般 3-4 层无感，极端高频写入需测量。

### 10. (综合类) 如何做一个“写入鉴权”中间件？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

包装 set，检查 get().role 或字段白名单，非法写入 console.warn 并丢弃或抛错。

### 11. (实战类) compose 手写实现大概是？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

const compose=(...fns)=>(fn)=>fns.reduceRight((acc,f)=>f(acc),fn)。

### 12. (对比类) subscribeWithSelector 为何常放较内层？
**来源**：https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector

它扩展 store.subscribe 支持 selector，被它包裹的内层 set 都要经过；但一般紧邻 fn 外层，供 persist/devtools 仍能记到。

### 13. (坑类) 在中间件里直接调用 set 造成无限循环的常见原因？
**来源**：https://zustand.docs.pmnd.rs/limits/known-limitations

拦截器内部又 setState 且没有终止条件，形成 set→中间件→set 递归；需加防抖/条件判断。

### 14. (趋势类) 中间件机制与 React 组合式 Hook 的相似点？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

都是「在既有能力外层无侵入增强」，可组合、可复用、可单测。

### 15. (综合类) 为团队封装“标准中间件三件套”你会选哪三个？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

devtools(开发可见)+persist(按需持久)+immer(可读更新)，并用统一 createStore 封装固定顺序，避免各写各的。
