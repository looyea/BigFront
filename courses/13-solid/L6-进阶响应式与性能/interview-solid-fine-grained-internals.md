# 细粒度响应式内核 · 面试题

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) Solid 的 signal 到底由什么构成？依赖是怎么被自动收集的？

signal 是一对函数：getter 读值、setter 写值。系统全局维护"当前正在执行的 observer"，getter 被读到时把该 observer 登记进自己的订阅集合，setter 被调用时先做 `===` 比较、值变了才通知订阅者重跑。所以依赖不是声明出来的，而是"函数运行过程中实际读了哪些信号"动态确定的。
**来源**：Solid 官方「fine-grained reactivity」从零搭建响应系统一节的高频考点转述。

### 2. (A) 为什么说 Solid 的依赖是"动态"的？举一个早返回改变依赖集的例子。

只有本次执行真正读到的信号才成为依赖。典型是 memo 里按开关早返回：`if (!on()) return "off"; return \`\${temp()}\${unit()}\`;`——`on` 为 false 时 `temp/unit` 根本没被读，改它们不触发重算；重新打开后才纳入依赖。这与 React 依赖数组"写死一堆"完全不同。
**来源**：官方温度示例（createMemo 早返回）常被面试追问的转述。

### 3. (A) render effect、computed、memo、effect 四者的时序差别？

render effect 立即执行、专管把属性写进 DOM；computed 按依赖图拓扑序随源更新、是 memo 的内部基础、不面向普通用户；memo 惰性求值并返回一个缓存的 signal；effect 延迟到渲染提交之后运行、用于和外部世界交互。总则是"上游 memo 先于下游 effect、更新父不更新子"。
**来源**：Solid 响应式 API 参考与进阶文档对执行时区的描述转述。

### 4. (B) 我在 createEffect 里用 setTimeout 延迟读了个 signal，为什么它不更新？怎么修？

因为依赖登记是同步的：effect 同步"登记→运行→注销"，等 setTimeout 回调真正跑时已脱离追踪上下文，那次读取不会建立订阅。修法是用 `on(deps, fn)` 显式声明要追踪的依赖，或把异步结果写回一个 signal 再由同步代码读取。
**来源**：官方 effects/reactivity 文档"异步不追踪"这一经典坑的高频提问转述。

### 5. (B) 嵌套写两个 createEffect，外层为什么没随内层读的信号更新？

Solid 故意让每个 effect 相互独立：内层 effect 里读到的信号只登记给内层，不会算到外层头上，信号变化只重跑内层。这是避免意外耦合的设计，不是 bug。
**来源**：官方 effects 文档嵌套 effect 小节转述为面试题。

### 6. (B) 组件卸载后有个定时器还在跑、内存一直涨，Solid 里怎么根治？

在 Owner 作用域里用 `onCleanup` 登记释放（clearInterval / 取消订阅 / 关连接）。销毁沿 Owner 树进行、子先于父；`createRoot` 之外或游离作用域不会自动回收，更要手动 dispose。
**来源**：官方 effects 文档 onCleanup 防内存泄漏一节转述。

### 7. (C) 和 React 的 useState/useEffect 相比，Solid 的响应式在"什么时候跑"上有什么本质不同？

React 靠重跑整个组件函数、用依赖数组手工描述订阅；Solid 组件只跑一次，之后由 signal 精确驱动订阅了它的 DOM/observer 更新，无需依赖数组、也没有"组件重渲染"。代价是要理解"读即订阅、异步不订阅、解构丢响应"这几条规则。
**来源**：Solid vs React 响应式模型对比在迁移讨论中的高频主题转述。

### 8. (C) createMemo 内部其实复用了什么机制？它和直接写个函数有什么区别？

memo 复用了 computed/effect 的自动追踪，但额外缓存并把结果暴露成一个 signal：依赖没变不重算、算出来值没变不通知下游。而普通函数每次调用都重新执行、也不会在源变化时主动唤醒任何订阅者。
**来源**：官方把 memo 描述为"返回 signal、优化计算"的复述转述。

### 9. (D) 面试官问"Solid 为什么不用虚拟 DOM 也很快"，你怎么从内核角度回答？

因为更新粒度在创建 DOM 时就确定了：每个 JSX 表达式/属性各自绑一个最小的 render effect 订阅具体信号，数据变化时直接对那个 DOM 属性赋值，跳过了"重跑组件 + diff 树"的整段开销。快来自"编译期已知结构 + 运行期精确订阅"。
**来源**：Solid 官方首页与 reactivity 文档反复强调的性能叙事转述。

### 10. (D) 让你向只写过 React 的团队讲清"别解构 signal/props"，你会怎么设计这个说明？

先演示 `const {count} = props` 拿到的是值快照、之后不更新；再对比 `props.count` 每次读都走 getter、被最小渲染 effect 追踪；最后给规则：props 不解构、不提前求值、用到才读，signal 一律用访问器调用。配一段 live demo 让差异肉眼可见。
**来源**：Solid 迁移指南"props 三条铁律"落地为团队规范的常见做法转述。

### 11. (B) setter 里传函数 prev 和直接传值，在触发更新上有什么区别？会不会重复通知？

传函数时以当前值算新值、传值时直接替换；两者最终都走同一条 `===` 短路——只要算出的新值和旧值全等就不通知订阅者。所以重复 set 相同值不会造成多余更新。
**来源**：官方 createSignal 更新语义与短路比较的高频追问转述。

### 12. (C) untrack 和 on 都在"关掉/指定追踪"，什么时候用哪个？

untrack 用于"我要在这次执行里读某信号、但不把它记为依赖"（就地屏蔽）；on 用于"这个 observer 的依赖就固定是我列出的这几个"，还能 `defer` 跳过首次。前者局部包裹、后者整体接管依赖集。
**来源**：官方 untrack / on 两个 API 的职责差异转述为对比题。

---

## 补充（新专题 13-15）

### 13.  没有调度器与优先级队列，Solid 靠什么保证更新顺序正确？ 

 依赖图本身即拓扑序：写从 signal 出发沿边传播，memo 拉取式求值保证读到上游终值；同层冲突由 batch/即时一致语义裁决；无 React 式任务优先级，所以也没有渲染被高优插队的现象。 

**来源**： https://www.solidjs.com/docs/latest/api#createsignal 

### 14.  keyed 列表更新时 Solid 如何移动 DOM 而不重建行？ 

 For 按引用键维护 item→节点映射，重排只调 insertBefore；行内 signal 随行存活天然保状态，无需 React 的状态搬移补丁；Index 才按位对齐，语义差异即实现差异。 

**来源**： https://www.solidjs.com/docs/latest/guides/loops 

### 15.  从实现角度解释为什么解构 props 会失去响应式。 

 props 是编译器生成的 getter 对象，每次属性访问才读对应信号/表达式；解构把当下值拷成普通局部变量，之后父组件更新无处触达；整页不更新的经典成因，修复点是用具函数或 props.x 惰性访问。 

**来源**： https://www.solidjs.com/docs/latest/guides/components 
