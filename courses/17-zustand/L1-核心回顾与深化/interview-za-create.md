# 面试题：create 精析与 v5 变化（za-create）

### 1. (原理类) create 返回的函数为什么能既当 hook 又当 store？
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

内部先创建 vanilla store（getState/setState/subscribe），再返回一个包了 useSyncExternalStore 的函数，并把 store 方法挂到该函数属性上。

### 2. (版本类) v5 把 selector 默认相等从 shallow 换成 Object.is 的动机？
**来源**：https://github.com/pmndrs/zustand/releases

shallow 默认会掩盖返回新对象的性能陷阱且违反直觉；v5 让默认行为可预测，需要浅比较时显式 useShallow。

### 3. (坑类) selector 返回数组 [a,b] 会发生什么？怎么修？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

每次渲染返回新数组引用 → useSyncExternalStore 判定变化 → 无限重渲。修法：用 useShallow 或多个独立 selector。

### 4. (实战类) set 用对象还是函数式？给判据。
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

新值依赖旧值一律函数式 set(s=>...)；与旧值无关的常量注入可用对象式，避免闭包读到过期 state。

### 5. (对比类) Zustand 相比 Redux 在“新增一个状态”上的步骤差异？
**来源**：https://zustand.docs.pmnd.rs/integrations/redux

Redux：写 action type、creator、reducer、注册、dispatch。Zustand：在 store 里加字段与一个改它的函数即可。

### 6. (设计类) 为什么 Zustand 不需要 Provider 也能全局共享？
**来源**：https://zustand.docs.pmnd.rs/getting-started/typescript

store 在模块作用域创建即为单例，hook 直接闭包引用它，不依赖 React context 传递。

### 7. (TS类) create<T>() 里那对空括号能省吗？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

使用中间件时不能省——curried 类型才能正确推断中间件包装后的签名；无中间件可写 create<T>(fn)。

### 8. (性能类) 多次 setState 的批处理从哪一版开始？依赖什么？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

React 18 起 createRoot 自动批处理同事件循环内多次更新；同帧多次 set 只产生一次订阅通知。

### 9. (实战类) getState 拿到的快照和组件里订阅的值有什么区别？
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/create

getState 是调用瞬间的最新值（非响应式，不触发重渲）；组件里 selector 是响应式订阅，值变则重渲。

### 10. (坑类) 在渲染期间直接调用 setState 会怎样？
**来源**：https://zustand.docs.pmnd.rs/limits/known-limitations

触发“Cannot update a component while rendering”警告并可能死循环；应放事件处理器或 useEffect。

### 11. (对比类) combine 与直接 create 的取舍？
**来源**：https://zustand.docs.pmnd.rs/middlewares/combine

combine 类型推断更好、初值集中；但带中间件时写法略绕。复杂 store 常用 curried + 显式类型。

### 12. (设计类) 为什么推荐把 action 和 state 放同一个 store 而不是分离？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

就近封装内聚，action 能直接 set；但过大 store 应按 slice 拆分以控制订阅粒度。

### 13. (趋势类) useSyncExternalStore 对 Zustand 意味着什么？
**来源**：https://react.dev/reference/react/useSyncExternalStore

它是 Zustand 订阅底层的官方 API，保证并发模式下读取外部 store 的一致性快照，杜绝撕裂。

### 14. (综合类) 从零封装一个 counter store 并解释每一处。
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

create<Counter>((set)=>({count:0, inc:()=>set(s=>({count:s.count+1}))}))：泛型定类型，set 函数式更新，inc 是 action。

### 15. (综合类) 如果让你给团队定 create 使用规范，会包含哪几条？
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

① 一律 curried 写法预留中间件；② selector 只返回原始值或用 useShallow；③ action 命名动词、内部函数式 set；④ 禁止渲染期 setState。
