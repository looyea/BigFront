# svelte-effects-advanced 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与 runes 文档深水区章节的转述。

---

### 1. (A) 为什么 $effect 默认在 DOM 更新后跑、$effect.pre 在更新前跑？各举一个非它不可的场景。

**来源**：runes 文档 $effect/$effect.pre 时序动机的转述

默认后置的理由：effect 的多数职责是"与画面同步"（喂图表库、聚焦、上报几何），必须看到新 DOM；且一轮变更里多个 effect 合并执行只 flush 一次。前置的刚需场景：DOM 即将被重建碾过——保存滚动锚点、抢救用户未提交的 DOM 临时态（textarea 手动改过的高度）；后置场景：更新完把容器尺寸传给 ResizeObserver 消费方。加分：两者都不该用来做"从 state 算 state"——那是 $derived 的活（L1 纪律的深水版）。

### 2. (A) $effect.root 解决了"生命周期不匹配"的哪类问题？为什么它会返回清理函数而不是自动回收？

**来源**：$effect.root 文档（advanced scope）语义转述

场景：响应式状态的持有者比组件活得久——命令式挂载的子应用树、第三方 widget 实例池、全局 store 的 class 封装（文档的 TodoList 例子即此类）。自动回收的前提是"框架知道所有者何时死"；root 作用域的所有权已经**交还给命令式代码**，组件卸载不是它的死亡信号（子应用可能被挪走复用），所以必须手动 dispose。衍生考点：这就是"逃逸对象"清单的响应式版（呼应 svelte-lifecycle）——凡逃逸，必有手动还债点。

### 3. (A) $effect.tracking() 什么时候会返回 false？给一个"两副面孔工具函数"的实例。

**来源**：$effect.tracking 文档用法转述（自写 rune 场景）

在追踪作用域外执行时返回 false：事件处理器、`untrack` 回调内、普通函数调用栈里。实例：自写 `useClamp(source, min, max)`——追踪内返回 `$derived(clamped)`（继续响应），追踪外直接返回当前算好的值（一次性归约）。没有 tracking 探针，工具函数就只能假设自己永远在 reactive context 里被调用，事件处理器里一调就崩（`$derived` 在非法位置报错，呼应 runes 位置校验）。

### 4. (B) 组件卸载后某个 $effect.root 里的 effect 还在跑并报错"state 已失效"。排查与修法？

**来源**：泄漏类实战合集 — root 忘记 dispose 的标准事故

链路：root 建的图不随组件死 → 组件销毁后 effect 仍响应外部写入 → 读写已卸载组件闭包里的局部 state（DOM 引用为 null）。排查：给 root 作用域打 tag（日志/计数），卸载断言存活数归零；修法：`const dispose = $effect.root(...)`，把它塞进组件清理路径（onDestroy 等价：effect 返回的清理、或 action destroy、或直接 `unmount` 出口）；架构修法：能用 `$state` 单例+普通 effect 表达的所有权就别上 root——root 是手动挡，考驾照再骑摩托（呼应 svelte-global-state 单例模式）。

### 5. (B) `flushSync` 把同事的第三方图库卡顿"修好了"，code review 你该追问什么？

**来源**：性能反模式识别题（"修好了≠修对了"形态）

追问三连：①它在哪个调用栈？（effect/渲染里是禁地，事件处理器里合法）；②每次交互 flush 几次？（循环里 flushSync=N 次强制同步布局/绘制，微任务批处理被自废——帧率账先算）；③真正的病是不是"在错误时机读 DOM"？（正解常是 `await tick()` 或让 action 的 update 自己排更新时机）。结论口径：flushSync 是**同步性逃生舱**不是性能优化器——用它修的卡顿，八成是用其他姿势能免掉的时序设计问题（呼应 svelte-actions 库喂参时机、svelte-performance）。

### 6. (C) untrack、$state.snapshot、以及"把 state 提升出组件"三种手段分别在切什么？一张泄漏面矩阵。

**来源**：反应式隔离层级对比（社区 deep-dive 文章主题转述）

- `untrack`：切**依赖登记**（读你不跟你玩），对象还在网里；
- `$state.snapshot`：切**对象身份**（拍出普通克隆），反应式 Proxy 不出网——适合跨边界投递（Worker/postMessage/IndexedDB）；
- 状态提升：切**所有者**（从组件生命周期挪到模块/单例），响应性保留。
泄漏面矩阵：untrack 用错=行为随时机漂移（无泄漏）；snapshot 用错=改不动原件/深拷贝成本；提升用错=全局存活回收不掉（真泄漏源）。三选一的判据是**边界类型**：时间性读一次→untrack；出运行时边界→snapshot；共享+永生→提升（呼应 svelte-global-state 的决策树）。

### 7. (C) tick() 与 flushSync、以及 React 的 flushSync、Vue 的 nextTick，三家语义对照？

**来源**：跨框架时序原语对比高频题

Svelte `await tick()`：等本轮更新刷完（不强制同步，微任务语义）；Svelte `flushSync(fn)`：把 fn 内变更**立即同步**刷完再返回。React `flushSync(fn)`：同名同义（强制同步刷 React 队列，禁在生命周期里调）；Vue `nextTick()`：与 tick() 同款（等 DOM 更新）。差异在默认世界：Svelte 状态写→DOM 刷本来就近（微任务），React re-render 是异步调度——同一个 flushSync 在三家"对抗的惯性"不同。面试地图：会读时序原语=能读任何响应式框架的更新循环（呼应 svelte-reactivity-internals）。

### 8. (D) 写一个 `useAutoSave(draft, save, { wait })`：输入停止 wait 毫秒后自动保存，要求组件卸载时取消待发、可在测试里快进时间。口述实现骨架与用到的深水区原语。

**来源**：组合式函数设计题（debounce+生命周期的经典合并考察）

骨架：`$effect(() => { const t = setTimeout(() => save($state.snapshot(draft)) ... wait; return () => clearTimeout(t); })`——依赖 draft，每次变更重挂定时器（清理函数=天然的 debounce 重置器）；卸载自动 clearTimeout（effect 清理路径，无需手动）。深水区原语点名：snapshot（save 走异步网络，防草稿后续变更污染请求体）；测试用 fake timers+`await tick/advanceTimersByTimeAsync`（L7 假定时器三件套）；进阶：`untrack` 读"故意不响应"的配置对象。追问点"保存请求在途时组件卸载"——AbortController 挂清理链（fetch 取消，呼应 01-es 网络课），这层逃逸出 Svelte 归 JS 资源管理。

### 9. (A) $effect 里"读了自己也写了自己"为什么会死循环？运行时的护栏是什么，护栏报了你该怎么办？

**来源**：effect_update_depth_exceeded 错误解剖（社区疑难帖主题）

机理：effect 读 a 写 b、b 的派生链回到 a → 自己把自己标脏 → 无限重跑。护栏：effect 重入深度计数超上限抛 `effect_update_depth_exceeded`（开发/生产都有，防浏览器假死）。处置：报错栈找"读写环"——把派生改 `$derived`（声明层消灭环）、写入改事件驱动（用户动作才写）、或环上某读点 `untrack`（**最后手段**，等于宣布"这里故意不响应"）。错误消息官方口径："effects cannot update state that they themselves read"——承认这是设计错误不是调优问题（呼应 L6 内核图论）。

### 10. (C) 对比 Vue watchEffect(flush:'pre'|'post')、Svelte $effect.pre/$effect、React 的 useLayoutEffect/useEffect——"前后两拍"三家都缺不了吗？

**来源**：跨框架 effect 时序档位对比（前端基础共识题）

都缺不了——两拍切的是"与绘制的相对时机"：读布局前快照（pre/layout）与画面就位后副作用（post/passive）是两类物理需求。差异：Svelte 的"pre"是 DOM 更新前（仍在同一次 flush 内），React useLayoutEffect 是**绘制前同步**（阻塞 paint，比 Svelte 的语义更重）；Vue flush:'post' 是默认、'sync' 还有第三档。面试价值在翻译能力：听到"滚动锚点丢失/测量为 0"能秒映到"哪一拍站错岗"（各家名字不同、物理一样——呼应 react-hooks、vue-watchers 同题）。

### 11. (B) 有人把 $state 对象直接 JSON.stringify 存进 localStorage 再 parse 回来赋给 $state，问"为什么丢了一个 Set 和两个方法"。解释并给规范路径。

**来源**：持久化数据形状事故实录

JSON 只表达普通值：Set/Map/函数/Error/日期（变字符串）全部降级或蒸发；snapshot 走的是结构化克隆语义，同样不救方法但保内置类型的方式不同（对 Set 等也有边界——细节以文档为准）。规范路径：**可序列化状态设计**——store 的形状先定成 JSON-safe（Set 换数组），持久化层 `snapshot 拍扁 → 存`，恢复时 `parse → 再赋 $state`；复杂类型上 IndexedDB+序列化适配器（idb 库支持结构化克隆），别拿 localStorage 硬扛。跨包呼应：nuxt/next 的同款 hydration 序列化纪律（0 转 1 的老坑在这里换皮重演）。

### 12. (D) 终题：给一个"在线文档编辑器"的响应式架构划界——正文状态、协同光标、本地草稿持久化、撤销栈、导出 PDF（需等 DOM 完全渲染），每个子系统落在哪个原语上？

**来源**：架构分层综合题（深水区全家桶的实战验收卷）

正文：CRDT 库实例活在组件外 → `$effect.root` 托管（或 runes 单例+手动 dispose）；协同光标：高频外部事件 → 普通 `$state` 承接（不驱动 DOM 的部分用 untrack 读）；本地草稿：debounce（清理函数版）+ snapshot → IndexedDB（可序列化状态设计）；撤销栈：纯函数模块 + 显式事件写入（**不是 effect**——撤销是命令流不是派生流）；导出 PDF：`await tick()` 等渲染完成再截图/打印，全程禁 flushSync（一次变更就要一次 flush，循环里是灾难）。评分：每格说对原语只是表，**分清"声明流 vs 命令流"这个里**（派生的用 $derived、事件的用 handler、同步外部世界才轮到 effect 家族）才是本课的全部心法（呼应 svelte-reactivity-internals 终题谱系）。

---

## 补充（新专题 13-15）

### 13.  为什么 $effect 默认在 DOM 更新后跑、$derived 却是惰性求值？这套时序带来的两个经典坑是什么？

设计动机：$effect 常用于"依赖最新 DOM 的副作用"（读元素尺寸、操作第三方、聚焦），故排在渲染 effect 把 DOM 改好之后跑（保证你读到的是新 DOM）；$derived 是纯计算，惰性求值只在被读时算 + 缓存，不需要"跑"的时机（它是"被拉"不是"被调"）。两个经典坑：① effect 里"读了自己也写了同一个 signal"→ 自己触发自己 → 死循环/无限 effect（既有"读自己也写自己死循环"题），解法是拆开或用 untrack 读；② effect 首跑也会执行（不是只在变化时），把初始化副作用写进去要意识到"挂载即跑一次"，且 SSR 不跑（既有"$effect 不在 SSR 跑导致什么体验差异"题）。加分句：把三者时机讲成一个模型——state 写(同步) → derived 拉(惰性) → 渲染 effect(改 DOM) → 用户 effect(DOM 后)，这条"同步标脏、异步分层 flush"的流水线解释了 99% 的时序困惑；理解它才能预判"为什么 effect 里读 DOM 是新的、为什么 effect 会自激"（呼应既有 tick/flushSync/effect 时机辨析题）。

**来源**：Svelte effect/derived 时机模型；DOM 更新与 effect 顺序；既有"effect 在 DOM 后跑"深化

### 14.  untrack、$state.snapshot、$derived 三者都能"减少响应"，语义差别与各自适用场景？

语义分层：① untrack(fn)——"在 fn 里读的 signal 不登记为当前 effect 的依赖"（读当下值但不订阅，之后它变不重跑；用于"我用一下这个值但不想因它变化重跑"，对应既有 untrack 举例题）；② $state.snapshot(obj)——"把 $state 深代理对象拍成一次性普通值快照"（脱离代理，用于传给第三方/postMessage/结构化克隆/JSON，避免把 Proxy 递出去，对应既有"postMessage 深对象""JSON.stringify 深代理"题）；③ $derived——不是减少响应而是"建立新的派生依赖并缓存"（读它仍响应其源，只是把多次读合成一次算）。适用：想让 effect 忽略某个读了的值→untrack；要把响应式数据交给不认 Proxy 的外部世界（worker/库/存储）→snapshot；要复用一份计算→derived。加分句：区分"控制订阅(untrack)""控制值形态(snapshot)""控制计算(derived)"三条正交轴——三者常被混当"逃逸响应式"，但 untrack 动的是依赖收集、snapshot 动的是数据代理形态、derived 动的是计算复用；能一句话说清"我要脱的是订阅、是代理、还是重复计算"，就再不会用错工具（呼应既有 untrack/snapshot/derived 三兄弟辨析题）。

**来源**：Svelte untrack/snapshot 文档；响应式脱钩工具；既有"三者区别"深化

### 15.  写一个 useAutoSave(draft, save) 的能力，$effect.root、定时器、清理、竞态你会怎么组织？

组织：① 依赖跟踪——用一个会随 draft 变化的响应式源触发保存（若作为 action/组件内，$effect 读 draft 即自动订；若脱离组件用 $effect.root 手动管，返回 dispose 供调用方关，对应既有 root 生命周期题）。② 防抖——$effect + setTimeout 或独立防抖，"draft 停止变化 N 毫秒后才 save"，避免每键入都请求（呼应定时器/防抖测试题）。③ 清理——effect cleanup 里 clearTimeout + 组件/root 销毁时取消未决保存与进行中的请求（AbortController，防"离开页面还在写回"，对应 lifecycle 事故题）。④ 竞态——多次快速保存要保证"后发起的结果不覆盖更晚的成功保存"（保存队列/序号/仅接受最新 revision），或串行化写。⑤ 失败处理——保存失败重试 + 冲突提示（服务端 revision vs 本地）。加分句：这个题真正的考点是"把声明式响应式翻译成一套有生命周期的命令式 IO 流"——触发(响应)、节流(定时器)、取消(清理+Abort)、顺序(竞态)四件事各要独立处理，尤其它们在 $effect 重跑的语义下容易漏（每次重跑都要清上一轮的 timer/请求）；能主动点出"$effect 重跑即代表上一轮保存应作废，cleanup 就是这个作废钩子"就抓住了响应式与异步 IO 协作的命门（呼应既有 effect cleanup 与"组件卸载后 root 里 effect 还在跑"题）。

**来源**：自动保存设计；effect root 与手动生命周期；防抖与请求竞态；既有 useAutoSave 设计题
