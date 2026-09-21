# svelte-transitions-animations 面试题精选

> 共 12 题，覆盖 A 指令机制 / B 列表与 morph / C 自定义过渡 / D 对照与工程。

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
