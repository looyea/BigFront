# svelte-web-components 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

---

### 1. (A) Svelte 组件编译成 Custom Element 的机制是什么？和"运行时包一层 register"有什么本质区别？

**来源**：编译器多目标主题（custom-elements 文档开篇转述）

编译期行为：`customElement: true` 是编译器 generate 档位之一（与 client/server 并列），产出物本身就是 CustomElementConstructor——包含 wrapper 类、attribute/property 同步器、shadow root 挂载逻辑，**import 时自动 define**（写了 tag 的话）。与运行时包装的区别：无需宿主框架适配层、体积不含反射魔法、类型信息靠显式解构静态确定（编译器不知道你要暴露哪些 prop 就不暴露）。加分：没写 tag 的组件不自动注册，拿静态属性 `MyWidget.element` 手动 define——库作者控名必备。

### 2. (A) 为什么 customElement 组件必须显式解构 `$props()`？`let props = $props()` 整包接住会怎样？

**来源**：文档 "you need to list out all properties explicitly" 陷阱题

编译器要在编译期产出"哪些 prop 需要生成 DOM property/attribute 同步代码"的清单，整包接收让清单无从推断——结果是 prop 依然能在 Svelte 世界内部正常工作，但**DOM 元素上的属性同步静默失效**（`el.name = 'x'` 不驱动更新）。属于"能编译能运行就是不同步"的三级静默伤，排障应先查解构写法。

### 3. (A) attribute → prop 与 prop → attribute 两条翻译通道各受哪些选项控制？默认行为说全。

**来源**：props 选项三件套（attribute/reflect/type）机制题

入向：attribute 名默认=prop 名小写（`attribute` 可改名），值默认按 String 理解（`type: 'Number' | 'Boolean' | 'Array' | 'Object'` 决定解析，Array/Object 走 JSON）。出向：**默认不反射**——prop 更新不回写 DOM，`reflect: true` 才开。property 直写通道（`el.count = 5`）不受 attribute 规则约束、类型原样保留，是推荐主通道；attribute 通道服务于"HTML 里静态写死"的场景。

### 4. (B) `<my-widget ondone={fn}>` 里 fn 神秘地再也没被调用，但改成 `el.addEventListener('done', fn)` 就通。解释这个现象。

**来源**：on 前缀命名禁区实录

`on` 开头的属性被编译器保留为事件监听语法糖：`ondone` 落成 `addEventListener('done')`，而不是把 `fn` 当 prop 传进组件——组件内 `let { ondone } = $props()` 收到的不是预期 prop。两种解法：回调 prop 改名（如 `handleDone`，但仍受 property 时机限制）或干脆走事件协议（组件内 dispatch CustomEvent，宿主 addEventListener）——后者才是跨框架正道。

### 5. (B) 自定义元素刚 `document.createElement` 出来还没插入 DOM，为什么给它赋 prop 是安全的，而调用它导出的方法却报 undefined？

**来源**：wrapper 生命周期文档段转述

wrapper 契约：connectedCallback 的**下一 tick**才创建内部 Svelte 组件；插入前赋的 property 会被 wrapper 暂存、组件创建时回放——所以赋值不丢。但导出方法是内部组件实例的东西，组件没建就没有方法，暂存机制只对 property 生效。要"元素一建好就能调"的函数，写进 `extend` 返回的类上（类方法在构造器原型链上，即时可用）——文档给的正是这个逃生舱。

### 6. (B) 把 Shadow 模式设成 "none" 之后，哪两样东西立刻失效？什么场景反而应该这么选？

**来源**：shadow 选项文档 + 设计系统实践讨论

失效：样式封装（scoped CSS 类名机制还在但失去 shadow 边界加持，宿主全局样式直接穿透）与 slot（没有 shadow root 就没有 slot 分配）。反选场景：设计系统需要吃宿主 CSS 变量之外的全局主题类、或需要在宿主 DOM 里做细粒度 CSS 选择器穿透（如表格单元格式组件）——牺牲隔离换样式亲和力，配套约定命名空间防冲突。

### 7. (B) 从 Svelte 4 迁移来的组件里 `<slot>` 包在 `{#if open}` 里，改造为自定义元素后发现"关着也占内存/副作用照样跑"。为什么？怎么救？

**来源**：slot 急渲染反直觉坑题

原生 DOM slot 由浏览器分配：slotted 节点在宿主解析 HTML 时就已创建，与 `<slot>` 元素在不在 DOM 无关——Svelte 组件 slot 的惰性语义（不渲染 slot 就不求值 children）在这里不存在。`let:` 数据回传同样断链（没有跨 shadow 的 slot scope）。救法：内容不由宿主 HTML 直写，改由 prop 传数据、组件内部自渲染；必须用 slot 时接受急渲染事实并把重副作用移出 slotted 内容。

### 8. (C) Svelte / Vue / React 三家把组件发布为 Web Component 的路径各是什么？Svelte 的"原生一等"体现在哪？

**来源**：三家 WC 化横向题（defineCustomElement / createCustomElement 对照）

Vue：`@vue/web-component-wrapper` 官方包 `defineCustomElement`；React：无官方路径，社区 `react-web-components` 类胶水或自建 wrapper。共同点：运行时把框架组件"翻译"成 CE，包内带着整棵虚拟 DOM/响应式适配层。Svelte：customElement 是**编译器 generate 目标**，产物本身就是 CE 构造器，无适配层；且 `$host` rune 是官方宿主访问通道。代价对比也要给：React/Vue 运行时方案可以动态改 tag/延迟注册更灵活，Svelte 编译期方案灵活性低但体积小、行为确定。

### 9. (C) 自定义元素参与原生表单（`<form>` 提交、约束校验）靠什么？Svelte 给出的方案是什么？

**来源**：extend + ElementInternals 文档示例转述

Form Association：`static formAssociated = true` + `this.attachInternals()` 拿到 ElementInternals，用 `internals.setFormValue()` 参与提交、`internals.checkValidity()/setValidity()` 进原生校验 UI。Svelte 的切入点就是 `extend` 选项——包一层构造器加静态字段与 internals，再把 internals 以 prop 喂回组件（文档示例：`let { attachedInternals } = $props()`）。加分：这解释了为什么 extend 存在——wrapper 生命周期默认够用，表单/第三方生命周期需求才动它。

### 10. (C) `<my-widget>` 内部要区分开发/生产的 shadow 可见性，官方文档给的一行写法是什么？体现了什么思路？

**来源**：shadow: ShadowRootInit 示例（DEV 条件 mode）

`shadow: { mode: import.meta.env.DEV ? 'open' : 'closed' }`——shadow 选项不只收 'open'/'none' 字符串，还能收完整 ShadowRootInit 透传给 attachShadow（clonable、delegatesFocus 都可选）。思路：编译产物把运行时环境判断留在属性值层，而不是开编译分支——Vite define 会把 import.meta.env.DEV 折叠成常量，生产包 closed 且无死代码。

### 11. (D) 公司设计系统要同时供给：自家 React 后台、政企客户的裸 HTML 门户、微信小程序 webview 页。给出组件分发方案并说明哪些走 WC、哪些不该。

**来源**：设计系统分发架构场景题

骨架答案：核心组件库双出口——ESM 包（React 后台用 `createCustomElement` 反向？不：React 后台直接用 React 版组件，WC 只给不可控宿主）；构建层用 Svelte/Vue 的 CE 编译产物打独立 custom element bundle 供裸 HTML 门户（import 即注册、无框架依赖）；小程序 webview 内是可控环境，走普通 H5 页面 + npm 包即可，**不为它付 WC 税**。判据复述：不可控宿主才 WC 化；SSR 首屏重要的一律排除 WC（shadow 在 JS 落地前隐形）。追问"多主题怎么办"：CSS 变量穿透 shadow 边界（`var()` 可继承）+ `shadow: "none"` 白名单组件兜底。

### 12. (D) 客户老系统（jQuery + 服务端模板）要嵌入一个 Svelte 5 写的交互式报表卡片，要求不引入框架运行时、可被老代码读取状态。设计跨界接口。

**来源**：遗留系统集成实战题（on/属性/事件协议取舍）

方案要点：①组件编译为 CE，省略 tag 由老系统侧统一 `customElements.define('report-card', ReportCard.element)` 控名（防与既有标签冲突）；②入参全部走显式解构 prop + `type: 'Object'` 的 attribute 通道（jQuery 拼 `setAttribute('config', JSON.stringify(...))` 可行）；③出态不用回调 prop（on 前缀陷阱 + property 时机限制），改 CustomEvent：`$host.dispatchEvent(new CustomEvent('ready', { detail: stats }))`，老代码 `addEventListener` 即听；④shadow 默认开隔离老系统样式炸弹，但全局主题色走 CSS 变量注入；⑤状态查询接口放 `extend` 类方法上（挂载前即可调，避开内部组件未建的时间窗）。收尾点题：把"跨界协议"当 API 设计做，而不是当翻译做。
