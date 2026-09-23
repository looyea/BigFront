# svelte-performance 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与性能专项面经高频主题的转述。

---

### 1. (A) "Svelte 编译没了 VDOM，所以性能自动最优"——这句话对吗？你在意哪些仍然存在的瓶颈？

**来源**：架构面开场题 — 框架选型与性能边界

不对。编译器消掉的是 **diff/reconcile 的 CPU 与 VDOM 内存**，以及 React 式"父变连坐子重渲染"。框架无关的瓶颈一个不少：DOM 节点总量（布局/绘制成本）、每帧 JS 工作量（rAF 回调、滚动监听）、深层 `$state` 的代理读取开销、网络与包体积、水合成本。正确的说法：Svelte 把**更新机制**的下限抬高了，应用上限仍由这些普适瓶颈决定——所以优化流程仍是"量→改→再量"。

### 2. (B) 万行列表滚动卡顿，给出从便宜到昂贵的三级优化阶梯。

**来源**：大厂前端面经 — 长列表专项

① **先对口令**：keyed each（`as row (row.id)`）保证局部更新，行组件 `{@const}`/props 收窄，别整行重建；② **CSS 免费午餐**：`content-visibility: auto` + `contain-intrinsic-size` 跳过视口外子树渲染、行内容 `contain: layout paint` 限制重排波及；③ **虚拟滚动**：`$state(scrollTop)` + `$derived` 算窗口 slice，只渲视口±缓冲——Svelte 做虚拟列表比 React 舒服，因为窗口外没有"重渲染"心智。每级之后回测再上下一级。

### 3. (A) `$state` 深代理的成本花在哪？什么数据形态该换 `$state.raw`？

**来源**：Svelte 文档 — Raw state 动机 + 社区基准讨论

成本两处：**创建时**递归包裹对象图（大数据初始化就慢）；**读取时**每个属性穿越 proxy 陷阱并登记依赖（读取密集扫描型数据放大）。该换 raw 的形态：只读查找表/字典、按不可变风格整体替换的数据集、高频写入的数值坐标（拖拽、rAF 采样）。判据一句话：**"这个值会被'就地改属性'吗？"** 不会，就不配拥有深代理。

### 4. (B) 页面加载后 DevTools 显示大量 tiny function 长任务，怀疑 effect 风暴，怎么定位与根治？

**来源**：性能专项面经 — 响应式过度订阅排查

定位：`$inspect(x)` 打在可疑 state 上数打印频率；`$inspect.trace()` 看一次写入波及面；Performance 录制里 effect 函数名可读到归属组件。根治三板斧：① 派生链改 `$derived`（惰性+共享缓存），切断"effect 写 state 再触发 effect"的接力；② effect 内非触发源读取包 `untrack`（典型：把 props 回调对象排除出依赖）；③ 高频源头节流/合帧（滚动、resize 写入 `rAF` 合并）。本质都是**缩小图的边**。

### 5. (C) 和 React 比：`useMemo/useCallback/memo` 三板斧在 Svelte 里对应什么？为什么大多数场景"什么都不用做"？

**来源**：跨框架迁移工作坊 — 优化手段映射表

Svelte 没有对应物，因为病不存在：没有组件重跑，就没有"props 引用变导致子重渲染"，回调每次新建也无成本（它不是依赖，除非你把它放进 effect 依赖——那时用 untrack）。真正对应的是**语义层**工具：昂贵计算→`$derived`（自动缓存且惰性），稳定值→普通变量。反向陷阱：从 React 来的人给对象"上 memo"往往多此一举甚至变慢。考点是讲清"优化手段跟着执行模型走"。

### 6. (D) 设计一次"首屏性能"改造：SSR + 分包 + 动画不掉的组合拳，说说步骤与度量。

**来源**：高级面前端 — 首屏优化系统设计题

步骤：① Lighthouse 定基线（FCP/LCP/TBT 记下）；② 路由级 code splitting——动态 `import()` + `{#await}`，重依赖（图表库）挪出主包；③ SSR/预渲染首屏 HTML（纯 Svelte 用 render 或上 SvelteKit），数据进同步体别靠 onMount-fetch；④ 水合期不闪：客户端专属内容 mounted 门闸；进场动画用 action 补播手法；⑤ 图片 `fetchpriority=high`/宽高占位防 CLS。度量：包分析 visualizer + Lighthouse 回归 + RUM。**动画掉帧属于 INP 维度**，与加载分开优化。

### 7. (A) keyed each 为什么既保正确性又提性能？key 选错（用 index）会退化成什么？

**来源**：React/Svelte 双栈面试题 — 列表 diff 通用原理

keyed 让框架按**身份**对齐新旧项：中间插删只移动/增删单点，其余节点与组件实例原地保留——更新面最小且状态（输入框、动画、选中）跟人走。无 key 用 index 时，删第 0 行会让所有后续行"错位一格"：组件实例状态串位，若内容比对又失效，等价于整列表属性重写。Svelte 里 key 还必须**唯一且稳定**，`as row (row.id + Math.random())` 每次全量重建，比无 key 更糟。

### 8. (B) 一条 `transition:` 加在长列表每一行上，滚动/刷新明显变卡，为什么？怎么办？

**来源**：Svelte GitHub discussions — 列表过渡性能帖

过渡=每行挂载/销毁都起一个 JS/CSS 动画实例：列表频繁整段重建时（配合不稳定的 key 更灾难），动画调度与合成层暴涨，还可能触发整页重排。处置：① 检查 key 稳定性，让"刷新"只 diff 真变化的行；② 行级只做**轻量**过渡（opacity），transform/blur 类重效果上移到容器；③ `local:` 阻断样式级联重算波及；④ 尊重 `prefers-reduced-motion` 直接砍掉（无障碍+性能双赢）。

### 9. (C) Svelte 的编译期优化（class 提取、静态节点、runes 剔除）在产物里长什么样？你如何验证？

**来源**：Svelte 编译器 playground 阅读题 — 面试"读过产物吗"

打开 svelte.dev/playground 看同一组件的编译输出：纯静态 HTML 被抽成模板字符串一次性 `create`；不随状态变的属性不生成更新代码；未用的 helper 被摇掉，生产构建里 `$inspect` 整体消失；本地样式的哈希 class 编译期就替换进模板。验证习惯：**读一次产物**能回答"我的哪行代码在运行时花钱"——这也是排查"莫名订阅"的第一手证据。本地加 `rollup-plugin-visualizer` 看模块占比。

### 10. (D) 让第三方图表库（命令式 API、自带 DOM）在 Svelte 里高效共存，注意什么？

**来源**：大屏可视化项目面经

封装成**元素级 action 或单组件**：创建在挂载点、`update(next)` 里 `chart.setData(next)` 增量更新（别销毁重建）；`$state` 只存**数据**不存 chart 实例（实例进闭包/普通变量，塞进代理是雷，呼应 svelte-global-state 大坑题）；高频联动用 rAF 合帧 + 节流；resize 交给 ResizeObserver 且 effect 清理断连；SSR 下组件只渲占位 div（库本体动态 import）。考点：action/effect/生命周期的组合运用与"代理外对象"纪律。

### 11. (A) 为什么"在 `<script>` 顶层做重计算"对 SSR 应用是双倍罪？

**来源**：SvelteKit 性能文档 — 服务端渲染注意事项转述

① 它**每次服务端渲染都跑**——脚本体不是"模块加载一次"而是"每请求每组件实例执行"（组件级），无 memo 就无缓存，CPU 直接乘并发；② 它阻塞水合起点——HTML 越晚出，`hydrate` 越晚，INP/TTI 全线劣化。对策：能静态化的提到**模块层**（真正的 import 一次求值，`.svelte.js` 里做纯函数缓存）；不能的进 `$derived`（惰性）或按请求缓存（服务端内存层，到 12-sveltekit 讲）。

### 12. (C) 团队从 Vue 迁到 Svelte，你如何建性能防回归机制而不陷入"凭感觉优化"？

**来源**：前端团队工程化面经 — 迁移季

四层：① **预算**——bundle size 阈值进 CI（size-limit/vite 报告），主包超线即红；② **冒烟**——Playwright + Lighthouse CI 跑关键页 FCP/LCP/INP 基线对比；③ **现场**——错误与性能上报（web-vitals 包一薄层）拆到路由维度；④ **纪律**——code review checklist：列表 keyed？大数据 raw？effect 是否镜像 state？动画是否 CSS 优先？关键是全部指标**迁移前先测旧系统**——没有基线的"变快了"都是玄学。呼应 10-vite 构建分析与 node-testing 的 CI 话题。

---

## 补充（新专题 13-15）

### 13.  "Svelte 编译没了 VDOM 所以性能自动最优"这句话对吗？给出你的反驳与 Svelte 真正的性能陷阱清单。

反驳：没了 VDOM 消掉的是"协调（diff）成本"与"重渲染级联"，但没消掉也不自动保证——① 首屏包体积/网络（Svelte 运行时小是优势但业务代码仍可能撑大）；② 大列表一次性渲染成千节点（细粒度不帮你减少 DOM 数量，要虚拟化）；③ 不当心把大对象包 $state（深代理成本）；④ $effect 滥用/依赖写错导致过度更新或死循环；⑤ transition 加在长列表每行（每行进出场开销，既有"一条 transition 加每行"题）；⑥ 无 key 的 each 导致 DOM 错乱复用（既有"删一行发生什么"题）。真正的优势是"默认不用管 memo"，不是"默认就最快"。清单化：性能陷阱从"渲染级联"转移到"数据量/代理成本/effect 纪律/DOM 规模"——不是没了，是变了。加分句：成熟的说法是"Svelte 把 React 里最贵的『重渲染』变成了『几乎免费』，于是性能瓶颈整体上移到了数据规模与 DOM 数量层"——能指出瓶颈"移动"而非"消失"，说明你理解性能是守恒的、只是被细粒度响应式重新分配（呼应 performance 关"自动最优吗"题）。

**来源**：Svelte 性能边界讨论；fine-grained 的代价；既有"Svelte 性能自动最优吗"反驳深化

### 14.  万行列表滚动卡顿，给出从便宜到昂贵的三级优化阶梯，并说清每级解决什么。

一级（最便宜先做）：keyed each（正确复用、避免错位重渲染）+ 减少每行 DOM/复杂度 + 只读数据别包 $state——很多卡顿是"无 key 全量重写"造成，先修正确性再谈性能（对应既有 keyed 保正确又提性能题）。二级：CSS 层 content-visibility: auto / contain（屏幕外区块跳过渲染与布局计算，零 JS，对应既有"零 JS 跳过渲染"题）+ 图片懒加载 + 行组件拆细让更新局部化。三级（最贵）：虚拟滚动/窗口化（只渲染视口内 N 行，动态换 DOM——用库或自写，复杂度最高但根治万行 DOM 数量问题）。顺序哲学："先删浪费（key/代理/CSS）再减数量（虚拟化）"——很多项目做完一二级就不卡了，不必上虚拟化。加分句：这题高分在"给出度量与验证"——用 Performance 面板看是"渲染慢"（脚本/布局）还是"数量多"（DOM 节点数、paint），先定性再选级，而不是条件反射上虚拟列表（过度工程）；能提"虚拟滚动会牺牲部分 transition/滚动位置体验，是权衡不是银弹"更显工程判断。

**来源**：窗口化/虚拟化；keyed each 与 DOM 复用；content-visibility；既有"万行卡顿三级阶梯"

### 15.  让一个命令式第三方图表库（自带 DOM 操作、非响应式）在 Svelte 组件里正确存活并与状态联动，你会怎么接？

标准接法=action 或 $effect 桥接三段：① 初始化——元素创建时用 action（拿到 node）或 onMount（bind:this 引用）new 图表实例（命令式库要真实 DOM，故必须客户端，SSR 跳过，呼应 actions SSR 题）；② 数据联动——用 $effect 读响应式数据、变化时调 chart.setData/update（把"声明式 state 变化"翻译成"命令式方法调用"）；③ 销毁——$effect cleanup 或 action destroy 里 chart.dispose()（防内存泄漏与"离开页面还在跑"，对应 lifecycle 事故题）。注意：$state 深代理过的数据传给库要 $state.snapshot 拿纯值（库可能内部改数据、Proxy 传进去会意外触发或性能差，呼应既有 JSON.stringify 深代理题）；高频更新要节流 setData。加分句：这个模式的通用名是"把命令式库包成响应式组件"——action 管 DOM 生命周期、effect 管数据到方法的映射、cleanup 管回收；掌握它就能把任何 imperative 库（地图、编辑器、图表、视频播放器）干净地嵌进 Svelte，且 SSR 安全、无泄漏（对比直接 bind:this + 手动 useEffect 一堆散乱，包成 action 是"可复用 + 生命周期自洽"的升级）。

**来源**：Svelte 集成 imperative 库；action 桥接；既有"第三方图表库怎么接"设计题
