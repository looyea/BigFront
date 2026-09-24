# 面试题：immer + devtools（za-immer-devtools）

### 1. (原理类) immer 如何把 push 变成不可变更新？
**来源**：https://zustand.docs.pmnd.rs/middlewares/immer-middleware

produce 用 Proxy 收集 draft 上的改动，结束生成新对象树，仅改路径新建、其余复用旧引用。

### 2. (实战类) set 第三个参数在 devtools 下有什么用？
**来源**：https://zustand.docs.pmnd.rs/middlewares/devtools

作为 action 名显示在 Redux DevTools，便于在更新流里定位是谁改的。

### 3. (性能类) immer 的 Proxy 开销什么时候会成为问题？
**来源**：https://zustand.docs.pmnd.rs/middlewares/immer-middleware

超大集合、每帧高频写、极深遍历；普通表单/列表无感，需 Profiler 测量。

### 4. (对比类) 不用 immer 写深层更新会多痛苦？
**来源**：https://zustand.docs.pmnd.rs/middlewares/immer-middleware

要逐层展开 {...s,a:{...s.a,list:[...s.a.list,x]}}，易错且不共享引用；immer 一行搞定。

### 5. (坑类) immer 回调里又用 set 返回新对象会怎样？
**来源**：https://github.com/pmndrs/zustand/discussions

produce 要求“要么改 draft 要么 return 新值”，混用报错。

### 6. (设计类) devtools 的时间旅行原理？
**来源**：https://zustand.docs.pmnd.rs/middlewares/devtools

记录每次命名 set 的前后快照，jump 时用 setState(replace) 回放对应状态。

### 7. (实战类) 生产环境要关 devtools 吗？
**来源**：https://zustand.docs.pmnd.rs/middlewares/devtools

默认仅开发模式连上；生产无扩展连接开销极小，也可 enabled 显式关闭。

### 8. (TS类) immer 中间件下的类型怎么写？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

create<Write<T>,[],[typeof immer]>(immer(...)) 或用 curried create<T>()(immer(...)) 自动推断。

### 9. (坑类) devtools 里看不到更新常见原因？
**来源**：https://zustand.docs.pmnd.rs/troubleshooting

store 在 devtools 外创建、window.__REDUX_DEVTOOLS_EXTENSION__ 未就绪、或 name 未设导致实例不显示。

### 10. (对比类) immer 与 Object.assign 展开各自适用场景？
**来源**：https://zustand.docs.pmnd.rs/middlewares/immer-middleware

浅层单字段用展开更轻；深层/多处嵌套用 immer 可读性与引用稳定更佳。

### 11. (综合类) 写一个 devtools+immer 的 todo store 关键片段。
**来源**：https://zustand.docs.pmnd.rs/middlewares/immer-middleware

create(devtools(immer((set)=>({todos:[],add:t=>set(s=>{s.todos.push(t)},"add")}))),{name:"todos"})。

### 12. (趋势类) React Compiler/新原语会取代 immer 吗？
**来源**：https://react.dev/learn/react-compiler

不可变仍是前提，immer 提供写体验；二者互补，暂无取代关系。

### 13. (性能类) 如何验证结构共享是否生效？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

改深层字段后，打印未改分支的引用是否 ===，或用 Profiler 看无关组件是否重渲。

### 14. (综合类) 一个可命名 action 的最佳实践约定？
**来源**：https://zustand.docs.pmnd.rs/middlewares/devtools

每个 set 传第三参 action 名，命名与函数一致（inc/addTodo），团队形成 lint/CR 规则。

### 15. (设计类) 为什么把 devtools 放最外层记录更完整？
**来源**：https://zustand.docs.pmnd.rs/middlewares/devtools

最外层能看到经过 immer 等变换后的最终 state，时间旅行还原的才是用户可见状态。
