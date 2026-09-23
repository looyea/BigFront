# mobx-react 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 observer 渲染模型与 React 集成工程。

### 1. (A) observer 组件的重渲触发源有几个？它们如何共存？

**来源**：https://mobx.js.org/react-integration.html

两条通道：① React 原生（父组件重渲带来 props 变化、自身 state 变化）——这条永远有效；② MobX 数据通道（渲染时读到的 observable 字段变化）——observer 叠加的能力。共存含义：observer 不是『屏蔽 React 渲染流的魔法』，而是在 React 之上多挂一个精准闹钟。答题延伸：想让父更新不再波及，仍要 React.memo——两套机制正交互补。

### 2. (A) 为什么 observer 组件里『渲染时读到的字段』即依赖？它靠什么实现读时追踪？

**来源**：https://mobx.js.org/the-gist-of-mobx.html

MobX 维护全局『当前追踪者』栈：observer 渲染前把自己压栈，渲染期间任何 observable 字段的 getter 执行时都会检查栈顶并把追踪者登记进自己的订阅表；渲染结束弹栈。这套机制与 computed/reaction 共用——组件只是『一个会调 React 渲染的 reaction』。答到这层就通了：解构丢追踪、回调不订阅，全是『读取是否发生在追踪上下文内』的推论。

### 3. (B) 组件从 props 接一个 store 实例，render 里 `const { user } = props.store`，然后渲染 `{user.name}`——这段代码更新吗？逐层拆。

**来源**：转述自高频事故（解构两层）

会更新但埋雷：`props.store` 的解构拿到的是 store 引用（store 对象本身不换），`user` 是 observable 对象的引用，渲染 `{user.name}` 时确实读了 name 字段→建立订阅。真正的雷在：若哪天 store 实例被整体替换（登录态切换），props.store 解构发生在渲染早期、读的是 store 对象的 user 字段——user 整体被 set 新对象时，因渲染里读了 user 字段（赋值即变化）组件会重渲并读新 user.name。总结：只要『最终渲染表达式的读取链』发生在 render 内就安全；丢追踪的判据是『读取是否还出现在本轮渲染』——逐条对着这判据核，比背禁忌清单可靠。

### 4. (B) 页面某个 observer 组件意外变得『哪都变哪都渲』，给出三个排查方向。

**来源**：转述自 MobX 性能调试实践

① 渲染体里有没有深读（toJS/展开整个对象/JSON.stringify/日志打整个 store）——一次深读=全字段订阅；② 是否把大 computed 的产物又 map/filter 成新数组且 map 回调读了高变字段——依赖面被间接扩大；③ 父组件是不是普通渲染风暴源（不是 MobX 的锅：React 通道照渲）——对照 React DevTools profiler 看 render 触发原因。方向对偶：MobX 的 bug 十有八九是『读得太贪』。

### 5. (C) 组件局部 UI 状态（如折叠面板开合），MobX 社区推荐 observer+useLocalStore 还是 useState？

**来源**：https://mobx.js.org/react-integration.html#mobx-with-react-should-you-use-stateno-observer

原则：纯组件私有、无跨组件需求→useState 更符合 React 习惯且无追踪成本；若这份状态要进快照/被 reaction 观察/与领域数据同构联动→useLocalStore（组件生命周期内的私有 observable 盒子）。MobX 官方那句『Should you use @state? No』针对的是『要不要用装饰器 state 注解』，不是禁 useState——面试常拿这句钓鱼，答『按需求分层』才是正解。

### 6. (A) SSR/hydration 下 observer 的注意事项是什么？

**来源**：https://mobx.js.org/react-integration.html（SSR 段）

服务端 renderToString 期间 observer 会照常建依赖但通知无意义，关键风险是**全局 store 单例跨请求串数据**——SSR 必须每请求新建 store 树（Provider 注入）；hydrate 时客户端首帧渲染数据要与服务端一致（注水 JSON 同源），否则 React 报 hydration mismatch 而 MobX 的『读即订阅』救不了你。工程姿势：toJS 注水+fromJS 水合（mobx-stores 关的 patch 线）。

### 7. (C) mobx-react-lite 只导出 observer 一个函数，这个『减法』的工程理由是什么？

**来源**：https://github.com/mobxjs/mobx-react-lite

Hooks 让『注入 store』回归 React 原生 context（自备 useStore 十行），旧 mobx-react 的 Provider/inject 是为类组件时代补的依赖注入课——课时已过。lite 砍掉兼容层：包体更小、无装饰器依赖、无 MobX 版本绑定、SSR 行为更可预测。启示：状态库绑定层的终局往往是『一个 HOC/Hook + 宿主框架原生 DI』，多余的胶水都是时代眼泪（Zustand 的 context 化同此理，呼应 za-patterns）。

### 8. (D) 设计一个『聊天窗口』的 observer 组件树：消息列表、未读数、输入草稿，要求草稿变化零波及列表。

**来源**：转述自本课粒度模型

ChatStore（messages observable 数组、unread=computed(messages/已读游标)、draftMap=observable Map）；MessageList 只读 messages（map 内读每条 text/sender，不读 draft）；DraftBox 只读 draftMap.get(roomId) 且写走 action；未读徽标组件只读 unread computed。验证：打草稿（写 draftMap）→ 只有 DraftBox 的订阅被唤醒，列表与徽标零重渲——用『读取面隔离』而不是 memo 挡。评分点：每个组件的渲染读取清单是否小且清晰。

### 9. (B) 团队新规：『observer 组件禁止在渲染中调用带副作用的 store 方法』，这条规矩防的是什么？

**来源**：转述自 React 纯渲染契约与 MobX 文档 FAQ

渲染即 reaction：渲染体执行多次（StrictMode 双跑、重渲、并发渲染的放弃与重试）——render 里调 `store.markSeen()` 这类 action 等于让副作用次数失控（重复上报、重复已读）；且 action 写状态可能在本帧触发自身依赖环。规矩的正解：副作用归事件与 effect（useEffect/显式 reaction），渲染只读不写——MobX 的追踪红利与 React 的纯渲染契约在这条线上不打折。

### 10. (A) 并发渲染（useTransition）下 MobX 更新为什么可能『撕裂』？社区怎么绕？

**来源**：转述自 React 18 并发语义与 observer 兼容性讨论

React 并发可让一次过渡渲染读到『新旧不一致的中间态』，而 MobX 的可变字段只有『最新值』没有版本快照——startTransition 里慢渲染读到已推进的 store 值即撕裂。实践：① 过渡内尽量不直读可变全局源，转成 useSnapshot/复制值再渲；② 高并发场景评估把全局可变 store 退为不可变快照源（Zustand/Redux 天然无此患）；③ 关注 mobx-react 适配层演进。这题是 L6 sig-mutability 与并发议题的交叉火力。

### 11. (C) React.memo+Context 大对象方案与 MobX+observer 方案，重渲控制上的本质差距在哪？

**来源**：转述自 react-context 关与本课互补

Context：value 引用一变全树消费者必渲，切分靠『拆多个 Context』手工开刀（Provider 数量膨胀、组合处灾难）；memo 只挡 props 不挡 context。MobX：依赖天然落到字段，订阅面自动=读取面——『按粒度切』这件事在 Context 是架构决定（切错了要重构），在 MobX 是渲染时自然形成。一句话：Context 的粒度天花板是 Provider 边界，MobX 的粒度是属性访问。

### 12. (D) 把一个 Redux 大列表页迁到 MobX，给出渐进策略与三个回退点。

**来源**：转述自迁移方法论

策略：新页面先行（只新模块用 MobX store+observer），旧页不动；跨栈经 context 桥（RootProvider 同时供 redux store 与 mobx root）；共享数据以服务端缓存层为单一真源避免双写。回退点设计：① 特性开关按页切换（每页可一键回到旧路径）；② 数据写入只在 action 出口双写，砍掉即断；③ 性能基线（每页重渲次数/交互 P95）上线前埋点，指标劣化自动回滚。评分点：有没有可断、可测、可退三个动作，而不是敢不敢赌。

### 13. (A) 为什么 observer 组件推荐写成 `observer(function Name(props) {...})` 而不是 `observer(() => ...)` 内联匿名？

**来源**：https://mobx.js.org/react-integration.html（tip 段）

功能性原因几乎为零，工程原因三个：DevTools 里匿名组件全是 Anonymous、排障失明；命名函数便于 React Fast Refresh 稳定匹配；HMR 与 memo 语义下组件类型引用更稳。MobX 官方文档专门提醒『别在 observer 里再造组件』——每次渲染 new 一个新组件类型会导致整子树卸载重建。这类题考的是『绑定层使用纪律』的敏感度。

### 14. (B) 升级 React 18 StrictMode 后，某个 autorun 副作用跑了两遍造成重复请求，为什么？observer 组件会同样中招吗？

**来源**：转述自 StrictMode 双执行与 reaction 生命周期

StrictMode 开发模式下挂载 effect 双跑（mount→unmount→mount）：autorun 若挂在 useEffect 里且 cleanup 正确 dispose，第一遍的 autorun 被销毁、第二遍重建——只跑一遍逻辑。中招的真因通常是：autorun 建在组件体顶层（非 effect）或 cleanup 漏 dispose。observer 渲染本身双跑但追踪是幂等重建，无双订阅问题；副作用双跑的账永远记在『副作用没挂对生命周期』上。

### 15. (C) 有人批评『MobX 让数据流变成看不见的魔法』，用本课机制正面回应：它显式与隐式各在哪一层？

**来源**：转述自社区长期辩论（正反双方公开文章）

承认隐式面：谁订阅了谁=渲染期读取行为决定，无法静态 grep 出依赖边。给出显式面：① 谁可写在谁里——action 纪律+严格模式，比裸可变对象显式得多；② 组件依赖面有审计工具（why-did-you-render 类与 MobX spy 事件流）；③ 团队规约把『渲染只读清单』写进 code review。公允结论：MobX 把依赖从『声明的显式』换成『运行时可观测的显式』——调试工具跟上，魔法就变齿轮。面试官要听的正是这种两头都站得住的评估。
