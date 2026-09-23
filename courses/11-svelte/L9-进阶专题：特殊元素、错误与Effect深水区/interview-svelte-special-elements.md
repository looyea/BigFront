# svelte-special-elements 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

---

### 1. (A) `<svelte:window>/<svelte:document>/<svelte:body>` 解决了什么共性问题？为什么不用 `onMount + addEventListener` 手搓？

**来源**：Svelte 文档特殊元素章 — 声明式事件目标的动机题

共性：组件需要监听**自身渲染 DOM 之外**的目标（全局快捷键、页签可见性、页面级进出）。声明式方案免掉手搓三件套（加 listener/存引用/卸载时解绑），事件随组件生命周期自动挂解，且模板里一眼看全"本组件对外界的监听面"。手搓的隐藏 bug 恰在解绑遗漏与 target 判空；加分：这属于 action 的特化——真要自定义目标/选项（capture、once）时 `use:` action 才是通用解（呼应 svelte-actions）。

### 2. (A) `<svelte:body onclick>` 实现"点击外部关弹层"，为什么还必须配一个 stopPropagation？完整机制说清。

**来源**：弹层交互经典题的 Svelte 实现版

事件模型：body 是弹层的祖先，弹层内点击会**冒泡到 body** 触发 close——不拦截就"点自己也关"。拼图：弹层根节点容器的事件处理链里对 `click` 调 `event.stopPropagation()`（或判断 `event.target` 是否在弹层内）。替代方案对比：capture 阶段挂 body + `contains` 判断（不怕中途有人 stopPropagation 破坏协议）——面试追问"如果弹层内部某组件已经 stop 了所有冒泡怎么办"时，capture+contains 是安全答案（呼应 L2 事件修饰符谱系）。

### 3. (A) `<svelte:element this={tag}>` 的 this 变化时是"原地改名"还是"重建"？为什么这样设计？

**来源**：动态元素语义题（文档换标签行为讨论转述）

重建。不同标签在 DOM 里不是同一"身份"：属性集、事件、表单关联、CSS 匹配都会变，原地复用会留下大量脏状态（比如 input→div 后 value 去哪）。重建的代价是**内部状态丢失**（焦点、滚动、非受控输入内容）——所以 this 应该只在"语义上确实是换元素"时变；若只是想改属性（class/type）， spread 属性即可，别动 this。追问 Vue 对应物 `<component :is>` 同款取舍时给对称答案。

### 4. (B) 从 Svelte 4 仓库里抄来一段 `<svelte:window on:keydown={...}>`，在钉了 runes: true 的项目里直接编译失败。报错本质是什么？两种走向？

**来源**：迁移期编译报错高频实录

本质：`on:keydown` 冒号语法属 legacy 模式，`runes: true` 档位下编译器拒绝混用新旧语法（同一文件同一世界观）。走向一（推荐）：改写 `onkeydown={...}`；走向二：该文件 `<svelte:options runes={false} />` 临时豁免——迁移期策略，L10 全量展开。顺手科普：报错信息会指明 legacy mode 字样，**编译器档位是第一排查位**，不是 window 元素的锅（呼应 svelte-tooling 三档旋钮）。

### 5. (B) 有人把 `{#each}` 里的 `<item.component />` 渲染出的却是名叫 `item.component` 的未知标签，页面啥也没有。最可能的世界观是哪边？

**来源**：4→5 行为换代陷阱题（点号语法变更实录）

Svelte 4 世界观：`<item.component>` 按 HTML 标签处理（自定义元素名含点也合法），组件必须 `<svelte:component this={item.component}>`。Svelte 5 改判：点号成员表达式=组件。修法按目标版本：5 里直接 `<item.component {...item.props} />`；4 里必须换 svelte:component。这题同时考"大写=组件/小写=元素"词法规则的例外谱（呼应 svelte-template）——**同一份模板两种编译结果**是迁移评审的重点回归面。

### 6. (C) Vue 的 `<Teleport to="body">`、React 的 `createPortal`、Svelte 的 `{@snippet}`+DOM 操作三种"内容投射"路线，Svelte 5 的弹层最终落在哪？

**来源**：跨框架弹层实现对比（L3 内容分发 + 特殊元素的综合题）

Svelte 没有内置 Teleport 等价物：弹层的主流落法是**组件树顶层渲染（context 驱动的 Overlay 出口）+ `{@render}` 投影**，或用一小段 action 把节点 `appendChild` 到 body（自己 20 行造 Teleport）。对比：Vue/React 把"跨 DOM 挂载"做进框架 API，Svelte 哲学是"够用的小胶水"——`<svelte:body>` 管事件目标、不管内容投射，面试常拿这条互考边界意识。加分：讨论 z-index/焦点管理的归属（顶层 overlay 组件统一管）。

### 7. (C) 三家动态组件语法对照：`<component :is>`、`const C=..;<C/>`、`<Thing/>`+点号——各家"动态性"分别建立在哪一层？

**来源**：模板系统词法设计对比题

Vue：特殊指令承载动态语义（`:is` 是模板 DSL 的一部分）；React：JSX 本来就是表达式，动态性来自"组件只是变量"的语言事实；Svelte 5：模板保持"大写引用=作用域组件"的词法约定，**编译器让引用本身成为响应式读取**（Thing 变了重解析绑定）。谱系上 Svelte 5 在向 React 靠拢、但用编译期实现——每家的动态组件语法都是其世界观的显微镜（呼应 react-jsx-runtime、vue-compiler 相关题）。

### 8. (D) 设计一个"全局快捷键系统"（`?` 弹帮助、`Esc` 关一切弹层、`g d` 序列键去仪表盘），说出特殊元素族的分工与状态边界。

**来源**：交互系统设计题（键盘无障碍方向加分）

骨架：`<svelte:window onkeydown={route}>` 单点入口（别每组件各挂一个互相打架）；route 是纯函数：读"键序列状态机"（挂在 context 或 runes 单例，呼应 svelte-global-state）决定派发；帮助/弹层组件通过 context 注册 handler + 优先级（Esc 永远最先）；序列键计时器放 `$effect` 可清理作用域里。无障碍加分项：`?` 帮助层用 boundary 兜错、焦点圈闭（focus trap）、`aria-keyshortcuts` 声明。追问"组件卸载了 handler 谁清"——context Map + 注册函数返回解绑闭包（手搓生命周期纪律的例外场景）。

### 9. (A) `<svelte:window bind:innerWidth={w}>` 和 `use:elementSize` / ResizeObserver 三种"响应式尺寸"来源，精度与时机各差在哪？

**来源**：响应式测量三路线对比（社区性能讨论转述）

`bind:innerWidth`：视口宽度，window resize 才动，SSR 端初值语义要想清（服务端没有"当前宽度"——Kit 里首屏可能用 UA 猜）；ResizeObserver/action：观察**元素自身**盒子（容器查询时代的正解，CSS container queries 更纯）；`matchMedia + $effect`：断点语义（只在跨阈值时变，最省渲染）。面试考点不是背 API 是**选粒度**：布局跟视口走→innerWidth、跟容器走→RO/CQ、跟语义断点走→matchMedia（呼应 svelte-styling 响应式章）。

### 10. (B) 页面同时有"点击外部关弹层 A"（body click）和"点击任意处开始播放"（document pointerdown），互相误伤。给排查框架与两个修法。

**来源**：全局事件互扰实战题（弹窗类组件库常见工单）

框架：先画**事件目标层级**（window→document→body→…→组件）与修饰符（capture/once/passive），误伤几乎都因"不同组件选了不同目标+都响应同一次交互"。修法一：统一收编——所有全局监听走快捷键/点击派发中心（context 单入口，按注册栈顶决定归属）；修法二：目标下沉+containment 判断（只在 capture 阶段 `!popup.contains(e.target)` 才触发 A 的关闭）。纪律：库组件禁止裸挂全局监听，提供受控开关（呼应 svelte-testing 里"全局事件难测"的痛点）。

### 11. (C) 为什么 Svelte 没有 `svelte:teleport` 却有 `svelte:boundary`？从"编译器派 vs 运行时派"解释这两个框架对"框架该管什么"的分歧。

**来源**：框架职责边界讨论的面试化转述（社区 feature-wishlist 长帖观点提炼）

Teleport 是**DOM 搬运术**——不改变数据流与生命周期语义，Svelte 判断"20 行 action 可代"，不占 API 面；boundary 是**错误传播与渲染中断的控制流原语**——涉及 effect 图与渲染事务，组件自己写不出一半（要在渲染崩溃处接住），必须由编译器/运行时协作提供。分歧模型：运行时派（Vue/React）愿意多给现成 API 换开发效率，编译器派只把"用户造不出来的"收进语言（对比各包同题：过渡系统也是这个标准的另一面——CSS 可代所以做成 action+指令而非内置组件）。

### 12. (D) 终题：面试官现场出题——"用一个组件同时实现：滚动进度条、页签失焦暂停的倒计时、点击外部关闭的下拉、按数据渲染 h1~h6 标题、配置驱动的表单控件分发。限制：除按钮外不许写 addEventListener。"口述实现蓝图。

**来源**：特殊元素族全技能压缩考察题（白板轮形态）

逐条对位：①`<svelte:window bind:scrollY>` + `$derived` 百分比；②`<svelte:window bind:focus={active}>`，`$effect` 里按 focus 启停 interval（清理函数归还）；③`<svelte:body onclick>` + 下拉内 `stopPropagation`（或 capture+contains，说清取舍）；④`<svelte:element this={`h${level}`}>` + spread 属性；⑤`{#each}` 里 `<field.component {...field.props} />` 点号动态组件。蓝图题评分看"事件目标选得准不准、绑定与派生的方向感、以及每条对应哪个 `<svelte:*>` 词"——全部命中即本课满分卷（各条深挖分别是 2/9/10 题与 L6/L1 的入口）。

---

## 补充（新专题 13-15）

### 13.  <svelte:window> 的绑定（innerWidth/scrollY）与手动 window.addEventListener 相比好在哪？滚动进度条怎么写最省？

专元素优势：① 生命周期自动——组件在才监听、卸载自动解绑（手动要自己 removeEventListener，易漏致泄漏，呼应 lifecycle 定时器事故）；② 声明式绑定——bind:scrollY={y}、bind:innerWidth 直接把窗口状态映射成 $state，无需在 handler 里读赋值；③ 事件修饰符可用（onscroll|passive 提升滚动性能，呼应 vite/事件 passive 题）。滚动进度条：bind:scrollY + bind:innerHeight + document.documentElement.scrollHeight 派生比例（$derived(scrollY/(scrollHeight-innerHeight))）写 CSS 变量驱动 scaleX——避免每帧 JS 改 style（用 CSS transform + 变量，滚动监听设 passive，对应性能意识）。注意：scrollY 高频变化，$derived/CSS 变量更新代价要控（别在 effect 里做重活），或改用 IntersectionObserver/CSS scroll-driven animations（现代方案，滚动关联动画零 JS）。加分句：能主动提"滚动这类高频窗口绑定，理想是最终落到 CSS（scroll-driven animation / transform 变量）而非每帧跑 JS effect"——把"框架能力（专元素绑定）"与"性能边界（高频更新下沉 CSS）"两层都想到了，比只会 bind:scrollY 高一档（呼应 special-elements"滚动进度"设计题）。

**来源**：svelte:window bindings；滚动性能（passive）；既有 svelte:window bind:scrollY 深化

### 14.  Svelte 没有 <Teleport>/<portal> 内置组件，怎么实现"把弹层渲染到 body 下"？

现状：Svelte 无声明式 Teleport（对应既有"为什么没有 svelte:teleport"题），实现"渲染到组件 DOM 之外"有几种：① action——用 svelte:body 或一个 action 把某段用 mount()/手动 appendChild 到 body（命令式）；② Svelte 5 运行时 mount(App,{target:document.body}) 挂独立子应用（但脱离主组件树，context 断，呼应 context 独立 mount 题）；③ <dialog> + showModal()（原生模态就是"逃出层叠上下文"的语义化方案，多数弹层场景首选，无需 portal）；④ 靠 CSS（position:fixed + 高 z-index + 正确的 stacking context）——很多时候"需要 portal"其实是被父级 overflow/transform/z-index 困住，用 fixed + 管理层叠上下文可不 portal。为何 Svelte 不内置：编译器系倾向"少运行时概念"，portal 引入"渲染位置与树位置分离"破坏其 DOM 贴近源码模型，交给原生 dialog/CSS/action 覆盖。加分句：先质疑"是否真需要 portal"——现代 Web 里 dialog[open]+showModal、:popover、CSS 层叠管理（contain/z-index）已覆盖大部分"逃出父容器"需求，portal 是 React/Vue 生态的习惯未必是 Svelte 的必要；能给出"优先原生语义方案、portal 是兜底"的排序最显功力（对应既有 body click-outside/teleport 系列题）。

**来源**：Svelte portal 模式；mount/svelte:body；Vue Teleport/React createPortal 对照；既有"为什么没有 teleport"深化

### 15.  动态渲染组件（{#if}/{@render}/<svelte:component 等价>/<svelte:element>）这几条路各自边界在哪？

分四路：① 换元素标签名（h1/p/div，同一种组件行为）→ <svelte:element this={tag}>；② 换"哪个组件实例"→ Svelte 5 runes 下把组件当值：let Comp = 条件 ? A : B 然后 <Comp/>（编译器支持组件表达式），旧 <svelte:component this={Comp}> 是 Svelte 4 写法（迁移注意，对应既有 svelte:component 迁移题）；③ 渲染"一段模板片段/插槽"→ {@render snippet(args)}；④ 简单显隐 → {#if}（销毁重建）或 class/hidden（保留实例，呼应 {#if} vs display 题）。选择判据："换的是标签→element、是组件→组件表达式、是内容片段→render、是可见性→if/class"。坑：动态组件切换默认会销毁重建（状态丢），要"保状态换外观"用 class/CSS 而非 if/切换实例（呼应 key/重建题）。加分句：这四条路的分界本质是"你在动态改变什么"——DOM 标签、组件类型、内容模板、还是仅可见性；把需求先归到这一格，语法选择就机械化了，也避免用错工具（如用 {@render} 去做本该 <svelte:element> 的标签切换）——这正是 special-elements 整组题的总纲（对应"用一个组件同时实现滚动进入 + 动态标签 + ..."终题的拆解法）。

**来源**：Svelte 5 动态组件与动态元素；snippet 渲染；<svelte:component> 在 runes 下的现状；既有动态组件切换深化
