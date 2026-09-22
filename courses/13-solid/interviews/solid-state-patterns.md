# 状态组织 · 面试题

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (C) 一个状态该用 createSignal 还是 createStore？判断标准是什么？

单个、独立、基本类型的值用 signal 最轻；成组、嵌套、需要按路径局部更新的状态用 store——它内部帮你懒建/管理一堆 signal，读用点属性、写用路径 setter。核心看"是否天然成组、是否需要定点更新"。
**来源**：官方 complex-state-management 与 stores 文档的选型叙述转述。

### 2. (A) store 的"路径 setter"相比整档替换有什么好处？

`setState("tasks", i, {...})` 只让被命中的那个节点的订阅者更新，其它读 `state.tasks` 别处属性的观察者不受影响；而整档替换会波及所有依赖该切片的地方，粒度更粗、重算更多。路径写保持了细粒度。
**来源**：官方 store 路径语法一节强调的精准更新转述。

### 3. (A) produce 解决了什么问题？它和 batch 是什么关系？

produce 允许用"直接变更草稿"的写法一次修改一个对象的多个属性，省去写一串 setState。官方明确它能替代多次 setStore；底层与 batch 一样把这一批改动合并、对外只触发必要更新，但 produce 写起来更像命令式。
**来源**：官方 complex-state-management 的 produce 小节转述。

### 4. (B) 我把 state 解构成 `const {tasks} = state` 后界面不更新了，为什么？

store 的响应式建立在"属性 getter 被读取时登记依赖"上，解构等于读了一次值、把当前引用/快照拿出来，之后源变化不再经过那个 getter，自然不更新。规则：始终 `state.tasks` 惰性读，别解构。
**来源**：Solid 社区反复出现、官方 store 文档明令避免的解构陷阱转述。

### 5. (B) 为什么在组件函数体里 `setState("count", …)` 有时不生效？

store 的属性 signal 是懒建的——只有被某个追踪作用域读到才会建立响应式连接。在没有任何 observer 读取它的裸作用域里写，等于改了个还没订阅的值。要么让读取发生在追踪作用域，要么用能正确建立依赖的路径写法。
**来源**：官方 complex-state-management "需落在追踪作用域"提醒转述为面试题。

### 6. (A) 派生值（如已完成任务数）为什么不该存进 state，而该用 memo？

存了就得在每个改动源的地方手动同步，漏一处就前后矛盾、还会触发多余重算。用 `createMemo` 让它从源数据自动派生，依赖不变不重算、天然一致。官方还提醒：与其在 effect 里 set 信号同步它，不如直接用 memo。
**来源**：官方 complex-state-management + effects 文档"别在 effect 里 set 信号"合述转述。

### 7. (C) 和 Redux / MobX 相比，Solid 的 store 有什么不一样？

Solid store 没有全局单一 store、reducer 或 action 仪式，它就是"局部、细粒度、按路径响应"的 reactive object，配合 context 做作用域共享；更新是直接路径写而非 dispatch 一个 action 走纯函数。心智更贴近"会响应的普通对象"。
**来源**：Solid 状态管理与主流方案横向对比在答疑中的高频话题转述。

### 8. (B) prop drilling 很痛，Solid 里怎么优雅共享跨层状态？

用 `createContext` + Provider 提供 value（常放 store 或 signal+动作），后代 `useContext` 取用。更稳的是把建/供/消封进一个模块、并提供一个 `useXxx` 守卫函数在拿不到时抛错——因为 `useContext` 类型带 `| undefined`。
**来源**：官方 complex-state-management 的 context 小节 + 类型最佳实践转述。

### 9. (D) 设计一个中型后台（列表+筛选+表单+当前用户）的状态结构，你会怎么切？

就近原则：局部 UI 状态放各组件；列表/筛选这类成组、需定点更新的放一个 store；当前用户等跨页共享放 Context（Provider）；服务端数据用 createResource 而非塞进 store 手动同步；所有派生（过滤后列表、计数）用 memo，不落 state。
**来源**：官方状态管理指南延伸到真实业务分层的场景题转述。

### 10. (B) 服务器返回的数据你一般放 signal/store 还是别的地方？为什么？

放 `createResource`：它把异步"变成同步语义"、自带 loading/error 状态、配 Suspense 非阻塞渲染，避免手写一堆 `setLoading`/`setData` effect 造成失同步。store 主要放客户端要局部更新的结构化状态。
**来源**：官方把 resource 定位为"异步数据"、complex-state 定位为"客户端状态"的分工转述。

### 11. (C) 用 store 之后还需要 memo 吗？两者会不会重复？

会各司其职：store 管"源状态"（可写的、按路径更新的事实），memo 管"从源推出的派生值"（不写、缓存）。store 给你细粒度写入，memo 给重复读取的昂贵计算收敛一份，二者组合而非替代。
**来源**：官方 stores 与 reactivity 文档对职责划分的综合转述。

### 12. (A) 多个相关 signal 收进一个 store，除了少写几个变量，还有什么实质收益？

一致性由结构承载（不必手动跨 signal 同步）、支持路径级精准更新、可整体放进 context 共享、能配合 produce 一次改多字段。本质是把"分散易失步"升级为"集中且细粒度"。
**来源**：官方 complex-state-management 引入 store 动机一段的转述。
