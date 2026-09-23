# 响应式内核（源码级） · 面试题

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 只用不到 30 行，怎么实现一个最小响应系统？

signal 存值 + 一个 subscribers 集合，getter 在被读时把全局 `currentSubscriber` 加进集合、setter 在 `!== ` 时遍历通知；effect 设 `currentSubscriber=fn` 跑一次（建立订阅）再还原。这就是"读时登记、写时短路通知"的全部魔法。
**来源**：Solid 官方 fine-grained-reactivity「从零搭一个响应系统」转述。

### 2. (A) 为什么说"依赖是动态、运行期确定"的？

因为订阅发生在 getter 被真正读到的那一刻：本轮没执行到的分支里的 signal 不会被登记。官方温度 memo 早返回例子——`displayTemp=false` 时 `unit` 没被读，就不在订阅集里、改它不触发。
**来源**：官方 createMemo 动态依赖温度示例转述。

### 3. (A) createEffect 里为什么要"保存并还原 currentSubscriber"？

为了正确支持嵌套：内层 effect 跑完要把"当前 observer"还原成外层，否则外层后续的 signal 读取会错误登记给内层。这也解释了官方那句"内层 effect 读的信号不会成为外层依赖"。
**来源**：官方最小实现 prevSubscriber 逻辑与嵌套 effect 说明转述。

### 4. (A) 从源码角度，createMemo 和 createEffect 的根本差异是什么？

memo 像一个"结果被再包成 signal"的 observer：它缓存计算、且输出可被下游订阅、值不变不向下传播；effect 只执行副作用、不产出可订阅的值。所以 memo 能进依赖图当中间节点、effect 是叶子。
**来源**：官方"memo 像 effect 但返回 signal 并缓存"的机制叙述转述。

### 5. (B) 为什么 effect 里 await 之后再读 signal 就"不响应"了？

登记是同步的：effect 同步跑完就把 `currentSubscriber` 复位，异步续体执行时已无当前 observer，那次 getter 读取登记不上。解法是 `on` 显式声明依赖，或把异步交给 resource/query。
**来源**：官方同步追踪与异步陷阱说明转述。

### 6. (A) 一次更新里，Solid 靠什么保证"memo 先于下游、父不重跑子"？

计算图的拓扑排序 + 批处理：一次提交按依赖层级推进，上游派生先算完、配合 `===` 短路让每节点一轮至多跑一次。这使细粒度更新不产生级联风暴。
**来源**：Solid 响应式更新调度（拓扑序、非阻塞）机制转述。

### 7. (C) Owner 树和 React 的"组件树/渲染树"有什么本质不同？

Owner 是**创建时捕获的词法归属树**，决定生命周期回收（子 Owner 先于父 dispose、onCleanup）与 `useContext` 解析路径；它不等于渲染/DOM 位置。Portal、被传出去的 children 都可能改变渲染树但不改变 Owner 树。
**来源**：官方 Owner/Cleanup 与 Context 解析机制综合转述。

### 8. (A) `createRoot` 存在的意义是什么？和自动回收什么关系？

它在组件体系之外手动开一个 Owner 根、返回 `dispose`。组件内创建的计算随组件自动回收；`createRoot` 外的（如库/模块顶层的 effect）不会自动回收，必须手动 dispose，否则就是内存泄漏的常见来源。
**来源**：官方 createRoot 与非自动回收的警告转述。

### 9. (D) 面试官让你解释"Solid 快"，从编译产物角度怎么答到点子上？

JSX 编译期把静态结构建成真实 DOM、每个动态表达式包成一个订阅对应 signal 的 render effect；更新时只对具体文本/属性赋值，不重跑组件、不 diff。粒度天然是"属性级"，所以省掉了 React"重跑整棵子树 + 协调"的开销。
**来源**：官方 fine-grained 对比 React"重跑整组件"的性能叙事转述。

### 10. (B) 为什么"把 props 解构出来"会破坏响应式？从实现解释。

编译后 props 是被包的 Proxy，每个属性是 getter；`const {a}=props` 只在解构那一刻读了一次值、脱离了"每次渲染读取即登记订阅"的路径，之后源变化无从通知。惰性 `props.a` 才走 getter。
**来源**：官方 createComponent/props Proxy 机制与"别解构"警告转述。

### 11. (C) 有人问"Solid 没有虚拟 DOM 那 diff 交给谁"，怎么答？

交给**编译期已知的静态结构 + 运行期精确订阅**：结构不透明地映射成真实 DOM 构建代码，需要改的只有绑了动态表达式的节点，因此根本不需要"比较两棵树"。虚拟 DOM 的 diff 是在弥补"每次重跑组件"带来的不确定性，而 Solid 从源头消除了这种不确定。
**来源**：Solid 无 VDOM 设计（编译 + 细粒度订阅）常见答疑转述。

### 12. (D) 让你写一段"证明你懂调度"的最小可观察示例，会怎么设计？

建两个 signal、一个依赖两者的 memo、一个读 memo 的 effect；先 `batch` 里连改两个源，观察 memo/effect 只各跑一次（合并提交）；再把某源 set 成相同值，观察 `===` 短路使 memo 不重算、effect 不触发；最后用早返回分支演示动态依赖集变化。三步覆盖批处理、短路、动态依赖。
**来源**：把官方 batch/短路/动态依赖三点合成一个自检实验的设计题转述。

---

## 补充（新专题 13-15）

### 13.  不查源码，设计一个能证明动态依赖的实验？ 

 两信号+开关 memo：开关走 false 分支时读另一信号，改它断言 memo 不重跑（用执行计数）；再翻转开关重跑一次证明订阅动态重建——一个测试文件讲清依赖收集时机。 

**来源**： https://www.solidjs.com/docs/latest/api#creatememo 

### 14.  Owner 树与渲染 DOM 树为什么不是一回事？各自主导什么？ 

 owner 是词法/执行归属（effect、资源、context 解析沿 owner 链），DOM 树是渲染产物；createRoot 脱离组件造独立生命周期（命令式弹窗、全局服务），其 dispose 回收整棵子 owner；context 查找走 owner 而非 DOM 父子是高频事故点。 

**来源**： https://www.solidjs.com/docs/latest/api#createroot 

### 15.  虚拟 DOM diff 在什么场景仍优于 Solid 的编译模型？反过来 Solid 怕什么负载？ 

 运行时动态无法静态编译的通用组件库/第三方渲染函数密集场景，VD 的兜底比对有价值；Solid 怕的是每帧全量换数据源（整表重绘）这类细粒度优势归零的负载，以及首建巨量节点的构造成本。 

**来源**： https://krausest.github.io/js-framework-benchmark/current.html ； https://svelte.dev/blog 
