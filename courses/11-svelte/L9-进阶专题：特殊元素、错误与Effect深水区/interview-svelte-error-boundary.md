# svelte-error-boundary 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与 Svelte 5.3 发布叙事的社区讨论转述。

---

### 1. (A) 为什么错误边界必须由框架提供，组件自己 try-catch 做不到？

**来源**：Svelte 5.3 boundary 发布叙事 — "渲染事务"概念题

渲染期抛错发生在**框架的执行流**里（effect 运行、DOM 构建途中），不是你的函数调用栈——组件没有办法"预知自己哪里会炸"去包 try-catch；崩溃后还涉及半途 DOM 的处置、下游 effect 的取消、资源清理，这些是渲染引擎内部事务。boundary 的本质：框架在渲染事务上开一个"可回滚的安全点"，崩溃时整段卸载、渲染兜底分支。加分：这也解释了它为什么只接渲染/effect——事件处理器是"你的栈"，语言层工具够用。

### 2. (A) failed snippet 的 (error, reset) 双参各是什么时机有效的？reset 之后组件的 $state 处于什么状态？

**来源**：文档 failed/reset 语义的细节追问形态

error=被接住的原始错误（SSR 场景下经 transformError 转换过的序列化版本）；reset=重建 boundary 内容的函数，调用后 boundary 走"卸载 failed UI→重新挂载子树"流程。$state 回**初始值**（组件从头实例化，没有"续跑"语义）——所以重试有效性取决于错误是否瞬态：网络抖动→值得重试；数据形状 bug→重试即再塌，UI 要有重试计数/退避（把 reset 传进重试逻辑做次数上限，标准工程答案）。

### 3. (A) pending snippet 与 React Suspense 的对应关系与差异？为什么 Svelte 把它并进 boundary 而不是单独元素？

**来源**：Suspense 对照题（5.3 发布讨论高频观点）

对应：都圈住"内部有 await 的子树"，首挂解析期显示占位。差异：①Svelte 的 await 就在模板表达式里（`{await fn()}`），不需要懒加载组件边界才触发；②pending 只管首次，后续异步用 $effect.pending()——React 的 Suspense 重入策略（已有 UI 时保持旧 UI）语义不同。并入 boundary 的理由：两者都是"渲染事务的不确定态"（错误=坏的不确定、pending=等的不确定），一个元素统一表达"这块区域的渲染契约"——API 面最小化的一贯洁癖。

### 4. (B) 你的 boundary 里组件偶发白屏但 failed 没出现，控制台有 Uncaught TypeError at ...handler。解释为什么，并给正确的兜底位置。

**来源**：边界范围误判实战题（"boundary 没兜住"类工单）

错误发生在**事件处理器**（栈里 handler 字样是线索）——不在渲染/effect 流内，boundary 按设计不接。正确兜底：handler 内 try-catch（业务级错误 UI）+ 全局 `window.onerror/unhandledrejection` 监听做上报（SvelteKit 里另有 `handleError` hook 层）。复盘纪律：给团队画一次"捕获范围四行表"，boundary 不是万能 catch——它管渲染事务（课文第五节原表）。

### 5. (B) 生产环境 failed snippet 里直接显示 error.message，安全评审打回。给完整修法（客户端与服务端两头）。

**来源**：错误信息泄露面评审题（exp-security 同款在前端的翻版）

客户端：error.message 可能含内部路径/依赖报错原文/用户数据片段——failed 里展示"分类后的可公开信息"（原始 error 送 onerror→上报服务，界面只出错误编号+话术）；映射表（已知错误类型→用户文案）兜底默认文案。服务端：SSR 路径用 transformError 返回**脱敏且可序列化**的摘要对象（官方明确提醒服务端错误含敏感栈），未配则默认整页失败——顺带检查错误上报通道本身的采样与去重。两头一个原则：**给用户看编号，给工程师看全栈（在受控面板里）**。

### 6. (C) React 错误边界要求 class 组件（componentDidCatch），Svelte boundary 是模板元素——两种设计各自的成本与收益？

**来源**：跨框架 API 形态设计对比（框架演化话题转述）

React class 模式：能力来自生命周期的历史包袱，函数组件时代靠社区包（react-error-boundary）补封装——**生态补票**形态；收益是与组件模型解耦、可程序化组合，成本是新人学习曲线与 RSC 时代更绕。Svelte 模板元素：声明零胶水、编译期校验（snippet 参数、嵌套规则可静态查），成本是**控制力上限**（想在 React 里做一个"每层都带重试退避策略的边界组件"需要包一层组件；Svelte 里等价逻辑要塞进 onerror/外层状态）。结论没有赢家：API 吸附在语言面还是组件面，是两种世界观的又一次显影（呼应本包"编译器派"母题）。

### 7. (C) 三层错误设施怎么分工：boundary / Kit 的 +error.svelte 与 handleError / 全局 window 监听？给一张路由时代的分层图。

**来源**：SvelteKit 错误体系与语言层边界的组合题（12 包预习题）

自下而上：①boundary——组件子树粒度，接渲染/effect 错误，保页面其余部分；②Kit `+error.svelte`——**路由粒度**，接 load/server 返回的 HTTP 错误（404/500 语义），配 `handleError` hook 做服务端统一上报与状态码整形；③window 监听——进程级漏网之鱼（事件/异步/第三方脚本）。图：事件流错误→try-catch；渲染错误→boundary；导航/数据错误→路由 error 页；未知→全局兜底+上报。面试要的是**不重叠的归责表**，全塞 boundary 是新人常见错。

### 8. (D) 设计"仪表盘页面"的容错蓝图：六个独立卡片（各自取数）、两个第三方 embed、一个共享全局态。boundary 怎么摆、reset 怎么联动数据层？

**来源**：容错架构设计题（监控大盘类业务真实形态）

每卡片一个 boundary（故障隔离单元=数据独立单元）；第三方 embed 各包一层（外因不可控，failed 里给"重载第三方"单按钮）；**共享全局态不放 boundary 管辖**——boundary 卸载重建的是组件局部 state，全局 store/runes 单例活得更久（重置它要显式设计，呼应 svelte-global-state）；卡片级"重试"=reset+让数据层使该资源缓存失效再 refetch（把 reset 包一层：`async retry(){ invalidate(key); reset(); }`）；顶层再一个大 boundary 兜"框架级不可能错误"，failed 文案=「刷新页面」。加分：上报带卡片标识（error context 注入 card id）。

### 9. (A) onerror 里为什么"存 error 到外层 $state、boundary 外渲染兜底 UI"是一种反模式预警？给出它合法的正当场景。

**来源**：文档 onerror 逃生舱段落的批判性阅读题

反模式面：绕开 failed 的声明式协议后，"错误态"散落在外部 state，**渲染事务与业务状态混线**——忘记在 reset 时清 error state 就会出现"内容恢复了但错误条还挂着"的经典 bug；多人协作时失去 boundary 一处读全的清晰度。正当场景：兜底 UI 必须渲染在 boundary **结构外**（如整页布局的 footer 报错条）、或需要跨多个 boundary 聚合错误到统一出口。合法用法纪律：failed/onerror 与外部 state 二选一做**唯一真相源**，reset 路径上成对清理。

### 10. (B) HMR 期间 boundary 疯狂重播 pending→failed→pending，代码没改错。可能的原因与处置？

**来源**：开发体验疑难合集 — 热更新与边界交互（社区 issue 形态转述）

机理：boundary 内文件被热替换→子树重建→首次 await 重跑（pending 重播）；若改动正引入临时错误则再塌 failed——开发期放大成"循环"。处置：①先把当前编译错误修完再看是否仍循环；②把慢 await 移出编辑热点文件；③临时把 boundary 的 pending 换成空 snippet（playground 同款做法）降低视觉噪音；④确认 svelte/vite 版本配对（internal 版本错配的历史症状之一，呼应 svelte-tooling 作业 9）。认知修正：这不是 bug，是**首次语义**的忠实执行——生产无 HMR，不会发生。

### 11. (C) Vue 的 onErrorCaptured 返回 false 拦截传播、Svelte 的 onerror rethrow 决定传播——两种"传播控制"的哲学差异？配全局 errorHandler 的分工呢？

**来源**：跨框架错误传播协议对比题（组合式 API 与模板元素两种世界观）

Vue：默认**向上传播**（每个祖先钩子依次过一遍），拦截=显式 return false——传播是默认流，停要踩刹车；Svelte：错误先被**最近的 boundary 接走**（不再上抛即终止），传播=显式 rethrow——接住即消化，继续抛要主动。两种方向对 API 表面影响：Vue 钩子链天然适合"沿途都上报一次"，Svelte 天然适合"就近 UI 兜底、只有处理不了的才升级"。全局层分工同构：Vue `app.config.errorHandler`／Svelte 顶层 boundary+window 监听／Kit handleError——都是"传播链终点的收尸人"（上报归口）。

### 12. (D) 终题：面试官挑战——"boundary 只能接渲染错误，这功能残缺吧？为什么不做成 React try/catch 提案那种全场景捕获？" 给一段辩护或认账的诚实回答。

**来源**：框架设计权衡思辨题（收官形态，考察工程判断而非背书）

可辩护面：渲染事务与命令流是两种错误域——命令流错误 try-catch **就地处理语义更好**（离案发现场最近、可精确恢复），全收进声明式边界反而鼓励"大范围捕获+状态未知重试"（把数据写到一半失败当成可 reset 的小事是危险的）；React 的 error boundary 同样不接事件错误，两家选择一致，是工程共识非偷懒。可认账面：确实缺"跨域的统一策略层"（重试退避、错误分类、面包屑聚合），当前要靠约定与库拼装——这正是语言特性成熟前的常态。加分收束：**评价特性看它划的边界是否有清晰不变量**（"渲染可回滚、命令你自己负责"），"能做所有事"不是好 API 的标准（呼应全课程对"最小原语"的审美线）。

---

## 补充（新专题 13-15）

### 13.  为什么错误边界必须由框架提供，组件自己 try/catch 不行？boundary 捕获的是什么阶段的错误？

核心：子组件"渲染阶段"抛错发生在 Svelte 内部的渲染/effect 执行流程里，不在父组件的任何用户代码调用栈上——父组件包 try/catch 根本罩不住（错误发生在"未来某个 flush 里渲染子树"时，catch 的栈早就退出了）。框架能做是因为它掌控渲染调度：在渲染子树的边界处插一层 try/catch（或 effect 错误钩子），捕获后决定"渲染 failed snippet 还是上抛"。捕获阶段限定：渲染期（组件函数执行、derived 求值触发的错误）——事件 handler、async、setTimeout、effect 回调里后发的错误不归 boundary（既有"哪个不会被捕获"题），要走 onerror 或各自处理。与 React 对照：React 错误边界同样只拦渲染期、且不拦事件/SSR/hydration 错误（同款边界），React 还要 class 组件（didCatch），Svelte 用 failed snippet 声明式更轻（对应既有 React class 边界对照题）。加分句：一句话讲透——"错误边界拦的是『渲染这个动作抛的错』，而渲染是框架调度的不是父组件调用的，所以只能框架兜底"；分清"渲染错误 / 事件异步错误 / 数据加载错误（Kit 的 form action/error）"三类错误谱系，就知道 boundary 只是其中一道闸（呼应既有"三层错误设施分工"题）。

**来源**：Svelte boundary 设计；React Error Boundary 对照；渲染错误 vs 事件错误；既有"为何框架提供"深化

### 14.  生产环境里 failed snippet 直接把 error.message 显示给用户，有什么问题？你会怎么设计降级 UI？

问题：① 安全——error.message/stack 可能含内部路径、SQL、第三方返回、用户数据片段，直显=信息泄露（对应既有"生产直显 error"题）；② 体验——用户看不懂技术错误、也没行动指引；③ 品牌——满屏 stack 显得失控。设计：failed snippet 展示"人话兜底"（出错了 + 重试按钮(reset) + 联系客服/反馈入口），技术细节不上屏而是上报（onerror/错误监控带 errorId）。用"关联 ID"串起用户看到的与监控里的（用户报"错误码 a1b2"、你在 Sentry 按此查完整栈）。分层：开发模式可展开 stack（辅助调试），生产模式隐藏（用 import.meta.env.DEV 判）。加分句：成熟的错误 UI 是"对用户给行动、对系统给证据"——用户看到"重试/反馈"、监控拿到"完整栈 + 关联 ID + 版本（release 维度呼应 ci-perf）"，两条链用 errorId 缝合；能主动区分"降级展示"与"错误上报"两个关注点，说明你把可观测性与用户体验一起设计了。

**来源**：错误信息泄露；可观测与用户友好平衡；既有"生产不直显 error"深化

### 15.  仪表盘页面有六个各自取数的卡片，一个挂了不能拖垮整页，用 boundary 怎么搭容错蓝图？

蓝图：① 每个卡片各套一个 <svelte:boundary>（细粒度隔离，一个渲染抛错只把它自己的区域换成 failed snippet，其余五卡照常，对应既有"六卡片容错"题）；② failed snippet 提供"重试"（reset 重新渲染该卡）+ 局部占位（骨架/上次缓存），而非整页错误；③ 数据层错误（fetch 失败）与渲染层错误分治——取数失败在 load/effect 里转成可渲染的 error 状态（交给该卡 boundary 或直接条件渲染），别指望 boundary 拦异步取数错误（既有"boundary 拦不到 async"）；④ 外层再放一个粗粒度 boundary + 全局 onerror 兜底（意外崩溃也不白屏，记录上报）；⑤ 加载/空/错三态与"依赖后端可用性"的降级（某服务挂了相关卡片统一进"暂不可用"）。加分句：容错架构的关键判断是"故障域的粒度 = boundary 的粒度"——按"能独立失败的部分"划边界（每卡独立数据源→每卡独立 boundary），别用一个大 boundary（一挂全挂）也别每个最小组件都套（过度、且 failed UI 碎片化）；能讲出"粒度按故障域而非组件树形状来定"就把这题从 API 应用提升到了可靠性设计。

**来源**：容错 UI 设计；细粒度 boundary 划分；错误恢复与重试；既有"仪表盘容错蓝图"深化
