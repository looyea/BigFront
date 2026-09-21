# svelte-reactivity-internals 面试题精选

> 共 12 题。A 类=原理机制（考深度）；B 类=实战排坑（考经验）；C 类=横向对比（考视野）；D 类=场景设计（考架构）。来源为一线大厂面试与官方 FAQ/博客高频主题的转述。

---

### 1. (A) Svelte 5 的 runes 和 Svelte 4 的 `$:` / store 响应式有什么本质区别？

**来源**：The New Stack — Svelte 5 发布深度解读

Svelte 4 的 `$:` 是编译期"赋值语句依赖分析"：编译器和手动 `invalidate` 决定重算时机，粗粒度且隐式；store 靠订阅契约（`$` 前缀解包）参与模板响应。Svelte 5 把一切收拢成**显式的信号图**：`$state` 是 source、`$derived` 是计算节点、`$effect` 是消费者，依赖关系在**运行时按实际读取**建立，细粒度到单个属性。收益：逻辑可以离开组件放进 `.svelte.js` 复用；`$:` 的"猜依赖"玄学被读取即依赖的确定语义取代。

### 2. (A) 讲讲 Svelte 5 信号更新的完整流程：从 `count++` 到 DOM 变化。

**来源**：Svelte 官方博客 — 细粒度响应式预告

写操作把 source 版本自增并沿图向下**推**脏标记（不计算）；受影响的 effect 进入队列；当前任务结束前的**微任务 flush** 统一处理：effect 重新执行时**拉**取依赖——`$derived` 此刻才重算并缓存，文本/属性 effect 拿到值直接 set 到 DOM 节点。全程无组件重渲染、无 diff。同一批多次写入只 flush 一次，天然批处理。

### 3. (B) 用户报告"改了对象属性界面不更新"，你的排查路径？

**来源**：Stack Overflow — Svelte 5 reactive object not updating 高频问题

三步：① 确认它**是不是信号**——普通对象、`$state.raw`、class 私有字段都没有代理，改动必然不响应；② 确认**写入是否换了引用**——`obj.meta = obj.meta` 被 === 短路，要展开新建；③ 确认**读取端接没接上**——解构拿的是快照值、`untrack` 内的读取不算依赖。开发期用 `$inspect(x)` 打在可疑点：没打印=图没连上，打印了 UI 没变=模板读的不是这个量。

### 4. (B) `$effect` 里写 `todos = todos.filter(...)` 为什么可能死循环？怎么写才对？

**来源**：Reddit r/sveltejs — effect 无限循环经典帖

effect 读取了 `todos`（登记依赖）又写入 `todos`（标脏自己），若两次值不满足 === 就自激。修复方向：① 派生归派生——过滤结果本应是 `$derived`，别用 effect 镜像；② 确需"变化时清洗一遍"的，写入前判等（值没变就不写）；③ 外部触发（如路由参数）驱动的清洗，把读取面用 `untrack` 收窄到触发源。原则：**effect 是图的叶子，不该回写自己的输入**。

### 5. (C) 对比 Svelte 5、Vue 3、Solid 的信号实现异同。

**来源**：Dev.to — 响应式原语横向评测

同：都是 signal 系（source/computed/effect + 细粒度依赖），都抛弃了"组件级重渲染"。异：Vue 用 **Proxy** 自动收集依赖，模板读 `obj.x` 即订阅，代价是解构脱离响应、ref 心智；Solid 同为 Proxy+信号但绑定 **JSX**，编译不动模板、运行时保留轻量 reconciler 语义；Svelte 5 依赖**编译器配合**——模板每个表达式编译成微 effect，runes 只能在受限位置用（不从 `.svelte.js` 导出信号引用、不进 snippet），换来运行时几乎零开销。Solid 与 Svelte 都真细粒度，Vue 组件粒度与细粒度混合。

### 6. (C) React 团队为何说"没有内置响应式"？Svelte 的信号模型给 React 社区留下了什么（如 Signals 提案讨论、Preact Signals 生态）？

**来源**：React Today 播客 — 状态库作者访谈；TC39 之外的 Signals 提案讨论

React 的更新模型是**不可变数据+重渲染+diff**：状态变更触发函数体重跑，靠引用比较决定复用。信号模型（读即订阅、写即精确更新）证明"跳过组件重跑"可行，Preact Signals、MobX、Legend-State 因此能作为 React 的"加速内核"外挂；React 官方则以 Compiler（自动 memo）作为对细粒度诉求的回应——优化编译而非改执行模型。面试考点是说清两种世界观的取舍：信号要学习纪律（反应性位置受限），编译器要信任魔法（可推导纯代码）。

### 7. (A) `$derived` 的"惰性"具体指什么？会带来什么可观察的行为差异？

**来源**：Svelte 文档 — Derived signals 章节转述

只有**被读取时**才求值：没有任何 effect/模板读它，依赖变了也不算；同一 flush 内多处读只算一次。可观察差异：① 把带副作用的函数塞进 `$derived`，副作用"有时发生有时不发生"——所以官方定性 derived 必须纯；② 昂贵计算放 `$derived` 天然按需，不需要 React 式 useMemo 的手动保鲜。

### 8. (B) `untrack`、`$state.raw`、`$derived` 不读就不算——三者都能"少做工作"，分别用在哪？

**来源**：Svelte Discord — 响应式逃逸机制答疑精选

`untrack`：effect 内**读但不依赖**（回调 prop、日志变量），针对依赖图；`$state.raw`：值**整体替换才响应**，跳过深层代理，针对大/不可变数据；`$derived` 惰性：声明"这是什么"，框架自动省掉无人消费的计算。三者层次不同——raw 改变信号的粒度，untrack 改变边的连接，derived 惰性是 pull 机制的红利。乱用会互相制造 bug：raw 里改属性=彻底不响应；untrack 包了该依赖的量=永远不更新。

### 9. (D) 设计一个"运行时性能可观测"的 Svelte 5 全局 store 模块，你会怎么用 runes 与调试原语？

**来源**：GitHub — svelte 生态状态库作者访谈

模块（`.svelte.js`）导出 `$state` 内核 + 纯函数 API（不导出原始引用，防止外部裸赋断链）；派生统计全走 `$derived` 惰性；开发分支挂 `$inspect(...).with()` 打印关键转移、`$inspect.trace()` 供性能排查现场开启；持久化写回用 `$effect` 且 `untrack` 掉非触发源读取。生产构建 runes 调试原语被编译器剔除，零成本。加分点：提 SSR 时模块单例泄漏问题（呼应 svelte-global-state），该设计只客户端使用或改工厂形态。

### 10. (A) 编译器说"模板每个表达式是一个 effect"，这解释了哪些现象？

**来源**：Svelte 峰会演讲 — Compiler internals Q&A

① 文本节点级更新：`{a}` 变不动 `{b}` 的节点——各是各的 effect；② `{fmt(x)}` 多处调用=多处独立计算，共享要 `$derived`；③ 组件 `<script>` 里的 `console.log` 只打一次——脚本体不是 effect、不重跑，要观测变化用 `$inspect`；④ 模板依赖是**运行时读出来**的：`{#if flag}{other}{/if}` 里 `other` 只在 flag 真时是依赖——分支跳过即零订阅。

### 11. (B) class 装业务模型、runes 装状态，两者怎么组合才不掉坑？

**来源**：Hacker News — Svelte 5 与 OOP 争论帖

规则：`$state(new Model())` 后，**公开属性**经代理可变可响应；**私有 `#field`、Symbol 键、getter 捕获的闭包变量**不在代理面内，改了不响应——还有一类"方法内 `this.items.push()`"依赖数组被代理且调用发生在信号写入通道上，通常可行但版本兼容要测。稳妥姿势：class 只做**无状态方法/纯数据构造**，需要响应的外层用 `$state` 包 plain object，或用工厂函数返回 `$state` 对象 + 游离纯函数。别把 DOM 引用、函数闭包塞进 `$state`。

### 12. (C) 面试官追问："你说 Svelte 无 VDOM，那组件大量条件切换时它靠什么保证 DOM 正确性？"

**来源**：Frontend Focus — 编译器派框架原理专栏

靠**编译期确定的静态骨架 + 靶向指令**：模板结构编译成 create/updates/destroy 代码路径，每个动态槽位独立 effect 精确 set 到节点；分支（if/each）切换走的是各自的挂载/卸载函数，节点身份由 keyed 算法保证。正确性来源不是"两棵树对比"，而是"更新代码与模板一一对应"——这要求模板必须静态可分析（也是为什么指令名、绑定目标这类结构必须写成静态代码，只有值可以是表达式）。代价：编译期魔法需要学习成本，模板里藏着大量不可见的响应式接线。
