# vue-directives-teleport 面试题精选

> 共 12 题，覆盖 指令本质与钩子 / 参数与响应式 / 三分决策 / Teleport 机制 / 跨框架与安全 五类。

---

## 一、指令本质与钩子

### 1. 自定义指令在编译产物里是什么？和 v-if 有什么关系？

v-if/v-model 编译后本身就是运行时补丁（条件块补丁、`onUpdate:modelValue` props 组合）。`app.directive('focus', { mounted(el){…} })` 注册后，`v-focus` 编译成 `_withDirectives` 包裹 + 钩子调用——**指令 = 给元素挂补丁函数的命名位**，没有引擎魔法（呼应 vue-directives-teleport 第一节）。

**来源**：Vue.js — "Custom Directives"；@vue/compiler-sfc  Playground 产物

### 2. 背一下指令钩子周期，哪两个用得最多、哪两个最易被忘？

created → beforeMount → mounted → beforeUpdate → updated → unmounted。**mounted**（focus/测量/初始化第三方）与 **unmounted**（清理观察器、实例）最常用；**beforeUpdate/updated** 最易被忘——忘了 updated 参数变化就不生效（呼应 vue-directives-teleport 第一、二节）。

**来源**：Vue.js — "Directive Hooks"

### 3. unmounted 钩子里不清理会怎样？给个真实例子。

v-watermark 里的 MutationObserver、v-click-outside 里的 document 监听——元素移除后观察器/监听仍指向死元素，回调里的闭包引用让 DOM 与数据无法 GC，长列表页滚动几分钟就是几百个泄漏点。指令的 unmounted 之于指令，等于 onUnmounted 之于组件（呼应 vue-directives-teleport 第五节、vue-lifecycle）。

**来源**：Vue.js — "Directive unmounted"；Chrome DevTools Memory 泄漏排查惯例

---

## 二、参数与响应式

### 4. v-permission:admin.disable="{ code: row.x }" 里三个通道分别怎么读？

`binding.value` = 等号后的表达式值（响应式跟随）、`binding.arg` = "admin"（冒号后静态参数）、`binding.modifiers` = `{ disable: true }`（点号修饰符对象）。动态参数还有 `v-[dynArg]` 写法（呼应 vue-directives-teleport 第二节、vue-template-syntax 动态参数）。

**来源**：Vue.js — "The Directive Binding Object / Dynamic Argument"

### 5. 指令的 mounted 执行时，能拿到父容器布局（宽高）吗？updated 里做昂贵初始化对吗？

mounted 时元素已入文档，可 getBoundingClientRect/ResizeObserver——这是"为什么 focus/measure 放 mounted"的原因。updated 每次组件更新都跑，昂贵初始化该放 mounted、updated 只做"参数变了要重放的那部分"（呼应 vue-directives-teleport 第二、三节）。

**来源**：Vue.js — "Directive Hooks 时机说明"

### 6. 局部指令怎么写？和全局注册怎么选？

组件内 `const vFocus = { mounted: … }`（`v` 开头驼峰即自动解析 `v-focus`）为局部；`app.directive()` 全局。通用行为（tooltip/权限）全局一次注册，业务专用指令局部——和组件全局/局部注册同一权衡（呼应 vue-directives-teleport 第一节、vue-component-basics）。

**来源**：Vue.js — "Local Directives"

---

## 三、三分决策

### 7. "何时用指令、何时用组件、何时用组合式函数"——给出你的决策表。

纯 DOM 行为、无自身渲染（focus/拖拽/水印）→ 指令；有结构有状态有交互 UI（弹窗/日历）→ 组件；复用逻辑但不碰特定 DOM（防抖/请求）→ composable。指令的三个短板：不能渲染、难以组合、来源不透明（模板里看不出干了什么），所以别给指令塞业务状态（呼应 vue-directives-teleport 第三节、vue-composables）。

**来源**：Vue.js — "Composables vs Directives 取舍讨论"

### 8. 一个 v-lazy-load 图片懒加载指令，内部要 Observer、排队、重试，你还写指令吗？

闻到味道就该改组件：状态机一复杂，指令对象里会长出 ref、watch 甚至跨元素共享队列——指令该是"薄 DOM 补丁"。正解：`<LazyImg>` 组件 + 内部 `useLazy()` composable，指令位最多留个兼容壳。这是"三分表"的实战边界题（呼应 vue-directives-teleport 第三、五节）。

**来源**：vue-lazyload 等库的组件化演进惯例

---

## 四、Teleport 机制

### 9. <Teleport to="body"> 之后，组件的 props、events、inject 还工作吗？为什么？

全部正常。Teleport 只改变**DOM 插入位置**，组件在虚拟组件树中的父子关系不变——作用域插槽、provide/inject 解析、事件冒泡（Vue 层）都按逻辑树走。"组件树与 DOM 树分家"是理解 Teleport 的一句话钥匙（呼应 vue-directives-teleport 第四节）。

**来源**：Vue.js — "Teleport / Component tree vs DOM tree"

### 10. 弹窗总被父级的 z-index/transform 困住，除了 Teleport 还有解法吗？Teleport 新方案带来什么坑？

CSS 侧：`position:fixed` 逃离 transform 祖先、顶层堆叠上下文管理——但 transform/filter 祖先会让 fixed 失效，这是 CSS 顽疾。Teleport 一次解决，代价：SSR 需目标锚点存在于首屏 HTML、多个弹窗要规划专用容器（`to="#modals"`）、E2E 选择器要跨容器找元素（呼应 vue-directives-teleport 第四节）。

**来源**：Vue.js — "Teleport SSR 注意事项"；CSS 堆叠上下文经典问题

---

## 五、跨框架与安全

### 11. React / Svelte 有对应物吗？面试怎么横向讲清？

React：`createPortal(child, container)` 命令式等价 Teleport；无指令位，DOM 行为走自定义 hook + ref 回调。Svelte：无原生 Teleport 指令（惯用 CSS fixed/顶层挂载约定），但 **actions**（`use:tooltip` 返回 `{ update, destroy }`）与 Vue 指令的 mounted/updated/unmounted 契约几乎同构。一句话：Vue 把"元素补丁"和"DOM 传送"都做成了声明式内置（呼应 vue-directives-teleport 第二、四节、svelte-actions）。

**来源**：React 官方 createPortal 文档；Svelte 官方 Actions 文档

### 12. v-permission="…" 能保护敏感功能吗？

不能。指令最多把元素从 DOM 摘掉，数据已在手、接口仍可被直接调用——前端一切隐藏都是遮眼法。安全三件套在服务端：接口鉴权、字段级权限过滤、操作审计；前端指令只负责"不让无权限用户看见入口"这层体验（呼应 vue-directives-teleport 第三节、09-express 鉴权、OWASP 失效访问控制）。

**来源**：OWASP Top 10 — "Broken Access Control"
