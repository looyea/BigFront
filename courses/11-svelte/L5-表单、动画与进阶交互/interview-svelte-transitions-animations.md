# svelte-transitions-animations 面试题精选

> 共 15 题，覆盖 A 指令机制 / B 列表与 morph / C 自定义过渡 / D 对照与工程。

## 一、指令机制（A 类）

### 1. transition: 指令为什么能捕获"出场"？元素何时真正销毁？
过渡挂在 `{#if}`/`{#each}` 块元素上，条件翻假时 Svelte **不立即移除**：先跑 out 过渡，播完才 detach——所以出场动画天然可行（Vue 需 `<Transition>` 包裹接管）。组件 state 在播完那一刻才销毁（呼应 svelte-transitions-animations 第一、五节）。
**来源**：Svelte 官方文档 — transitions 与 if block

### 2. in:、out:、transition: 三种写法什么关系？
`transition:x` = in 与 out 同用一个；`in:x out:y` 拆开各用各的（进场 fly 出场 fade）；只写 `in:` 则出场无过渡直接移除（呼应 svelte-transitions-animations 第一节）。
**来源**：Svelte 官方文档 — in and out

### 3. local 修饰符解决什么问题？
默认不带 local 时，元素**内部后来插入**的子节点（新 if 块/each 项）也会被补播进场过渡；`transition:slide|local` 把行为收窄为"只服务本元素的显隐"。列表套列表时几乎必加（呼应 svelte-transitions-animations 第一节）。
**来源**：Svelte 官方文档 — local modifier

### 4. SSR/首屏为什么有时看不到进场动画？怎么补？
水合阶段 intro 被跳过（避免首屏集体乱动）；要对"一直存在"的元素补播，把过渡函数当 action 用：`<div use:fly="{{ y: 20 }}">`（Svelte 4 的 use:mount 在 5 已移除，此为现行写法）（呼应 svelte-actions 第二节）。
**来源**：Svelte 官方文档 — 过渡函数用作 action

## 二、列表与 morph（B 类）

### 5. 讲讲 FLIP，以及 animate:flip 的使用要点。
First 记录旧位置 → Last 应用新布局量新位置 → Invert 用 transform 把元素视觉挪回旧位 → Play 过渡归零。要点：① `{#each}` 必须 keyed（靠 id 认人）；② flip 只处理**位移**，进场出场仍要配 transition（呼应 svelte-transitions-animations 第二节、svelte-template keyed）。
**来源**：FLIP 技术原理（Paul Lewis）+ Svelte animate 文档

### 6. crossfade 和 flip 分别适用什么场景？
flip：**同一列表内**重排序的平滑位移；crossfade：元素在**两个不同容器间迁移**（收件箱→归档），out 侧 `send`、in 侧 `receive`，相同 `key` 配对做"边退边进"的位置 morph，配不上的用 fallback 过渡（呼应 svelte-transitions-animations 第二节）。
**来源**：Svelte 官方文档 — crossfade

### 7. 列表动画为什么怕非 keyed each？
无 key 时 Svelte 按**位置**复用 DOM：排序后第 1 项的节点被当作"原来第 1 项"，FLIP 无法建立"同一元素旧位→新位"映射，动画表现为乱飞/闪烁。这是所有框架列表动画的共同前提（呼应 svelte-template 第二节、react-list-key）。
**来源**：Svelte/React/Vue 列表 key 文档共识

## 三、自定义过渡（C 类）

### 8. 手写一个过渡函数要满足什么签名？返回什么？
`(node, params) => { delay?, duration, easing?, css?(t,u), tick?(t,u) }`：`t` 进度 0→1、`u=1-t`。纯属性变化给 `css`（编译成 CSS 插值，跑在合成器）；要逐帧改内容/读写 DOM 给 `tick`（打字机、SVG 描边）（呼应 svelte-transitions-animations 第三节）。
**来源**：Svelte 官方文档 — 过渡构造器选项

### 9. css 与 tick 性能上怎么选？
css 生成的样式交给浏览器插值（transform/opacity 可走合成器），主线程空闲；tick 每帧 JS 回调，能做任何事但吃主线程——默认 css，只有"必须 JS 才能做到"（改文本、canvas、测量）才 tick（呼应 svelte-performance L6）。
**来源**：Svelte 官方文档 + web.dev 动画性能指南

### 10. 怎么处理 prefers-reduced-motion？
CSS 路线：`@media (prefers-reduced-motion: reduce)` 里关停 animation/transition；JS 过渡路线：构造器里查 `matchMedia` 命中就 `duration = 0`。这是无障碍审计常查项，不是可选项（呼应 svelte-transitions-animations 第五节）。
**来源**：MDN — prefers-reduced-motion；WCAG 2.3.3

## 四、对照与工程（D 类）

### 11. 对比 Vue 的 <Transition>/<TransitionGroup>。
Vue：包裹组件 + 类名约定（v-enter-active 等）+ `@after-leave` 钩子，列表用 TransitionGroup（内置 move 即 FLIP）；Svelte：指令直接挂元素、JS 过渡函数一等公民、move 拆成独立的 `animate:flip`。表达能力等价，Svelte 少一层组件包裹、Vue 对纯 CSS 党更顺手（呼应 vue 过渡动画、svelte-transitions-animations 第六节）。
**来源**：Vue/Svelte 官方文档设计对照

### 12. 什么时候该放弃内置方案上专门动画库？
需要**编排**（多元素时间轴、滚动驱动、手势物理、共享元素转场跨路由）时内置指令不够表达——上 Motion（原 anime.js）/GSAP/Framer Motion（React）；单纯进出场+列表位移用内置零依赖最优。判据：出现"动画状态机"需求再引库，别预防性加依赖（呼应 svelte-transitions-animations 第六节）。
**来源**：web.dev 动画工具链综述 / Svelte 社区生态共识

---

## 补充（新专题 13-15）

### 13.  手写一个自定义过渡函数要满足什么签名？css 与 tick 两条路在性能上怎么选？

签名：transition 函数 (node, params) => { delay?, duration?, easing?, css?: (t,u)=>string, tick?: (t,node)=>void, intro?: boolean }——返回描述"如何随进度 t（0→1）改变样式"的对象，u=1-t。css 路线：返回一个 (t,u)=>CSS 声明字符串，Svelte 用 Web Animations（CSS keyframe 生成）驱动，跑在合成器/浏览器优化路径，性能好、省主线程（绝大多数用 css）。tick 路线：(t,node)=>每帧命令式改样式（用于需要读布局、调用非 CSS 能力、物理模拟等 css 表达不了的），每帧回调走主线程，昂贵——非必要不用，且避免在 tick 里读几何（强制同步布局/回流）。delay/intro/config：intro=false 可让元素"首屏不播进场只在状态变化播"（对应 SSR 首屏看不到进场动画题）。加分句：选 css 还是 tick 的判断是"这个动画能否用『从 A 样式插值到 B 样式』表达"——能就交给 css（借 Web Animations 的合成器加速），不能（依赖运行时计算/读 DOM）才下沉到 tick（对应既有"css 与 tick 性能怎么选"题，答到"合成器 vs 主线程"即高分）。

**来源**：Svelte transition 函数契约；css vs tick；动画帧性能

### 14.  animate:flip 到底做了什么？为什么它强依赖 keyed each？列表动画为什么怕非 keyed？

FLIP 原理：记录元素变化前位置 First → 应用 DOM 变化后量末位置 Last → 用 transform 把元素"反演(Invert)"回旧位置 → 播放(Play) transform 到新位置（用 transform 做补间，不动真布局，性能高）。animate:flip 把这套自动化的：列表重排/增删时每个元素平滑移动到新位。强依赖 keyed：FLIP 的前提是"变化前后能认出是同一个元素"才能配对 First/Last——只有 keyed each（item.id 稳定身份）才能让 Svelte 追踪"这块 DOM 对应这个数据项"（对应既有"flip 工作前提""列表动画怕非 keyed"题）。非 keyed 后果：无稳定身份→Svelte 按索引复用→重排时它不知道哪个是哪个→FLIP 无法配对→动画错乱或直接不生效（既暴露动画 bug 又暴露状态错位）。列表动画要点：容器与子都要正确配 key、flip 适合"同批元素重排"（排序、筛选、跨列表移动），crossfade 适合"A 换 B"的替换语义（既有 flip vs crossfade 场景区分题）。加分句：能把"keyed 是 FLIP 的身份基础"讲透，就同时答了三关（template/performance/transitions）的共同考点——key 不只是 React 的 diff 优化，它是"让编译器与运行时能追踪元素身份"的合同，动画只是这份合同最直观的受益方。

**来源**：FLIP 技术（First Last Invert Play）；Svelte animate:flip；keyed each 与身份

### 15.  SSR/首屏有时看不到进场动画，为什么？transition:slide|local 的 local 又解决什么？

首屏看不到进场的原因：① SSR 阶段 HTML 已含内容、客户端 hydrate 时元素是"已存在"而非"新插入"——transition 的 intro 播放对"初始就在 DOM 里的元素"默认可能不触发（动画是为"状态变化引起的插入"设计的，首屏插入语义模糊，既有"SSR 首屏为什么有时看不到进场"题）；② {#if} 初始即真值的内容在 hydration 时不算"进入"。补救：用 intro 控制、或把"首屏想动画"的元素放一个 onMount 后才翻真的条件、或用 tick 后加 class 走 CSS 动画。local 修饰符：transition:slide|local——限制过渡只在该组件"自己插入/移除"该元素时播放，不因祖先的过渡块连带触发（避免嵌套 if/each 里被子元素的进出场"绑架"父容器动画，或父整体淡入时子元素重复播放，对应既有"local 解决什么"题）。加分句：这两点合起来是"过渡的触发语义"问题——Svelte 的 transition 绑的是"这个元素被 Svelte 亲自 insert/detach"这一事件；SSR hydrate 的元素不是被 insert 的、local 限定的是"由谁的动作触发 insert"——理解"过渡挂在 DOM 插入/移除事件上"就能推导出所有边界行为，而不是背哪些场景没动画。

**来源**：Svelte intro 与 SSR；transition local 修饰符；首屏动画触发时机
