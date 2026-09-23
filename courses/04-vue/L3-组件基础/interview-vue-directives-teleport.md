# vue-directives-teleport 面试题精选

> 共 15 题，覆盖 指令本质与钩子 / 参数与响应式 / 三分决策 / Teleport 机制 / 跨框架与安全 五类。

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

---

## 补充（新专题 13-15）

### 13. v-memo 和自定义指令都能「跳过更新」，编译器和运行时指令各自的成本边界在哪？

v-memo 走 **编译 产物**：deps 未 变 时 直接 复用 旧 vnode 子树（连 diff 入 口 都 不 进），但 它 每 次 渲染 仍 要 **求值 deps 数组**（`v-memo="[item.id===selected]"` 的 比较 是 O(deps) 常数 小）——收益 = 子树 diff 成本 - deps 求值 成本，子树 越 大 越 值。指令 的 updated 钩子 则 **每 次 宿主 组件 更新 都 跑**（指令 没 有 「deps 未 变 跳过」机制，除非 自己 缓存 binding.value 做 浅 比较——所 以 规范 写法 第 一 行 永远 是 `if (binding.value === binding.oldValue) return`）。两者 不 是 同 类 工具：v-memo 治 「列表 大 子树 重复 diff」，指令 「跳过」只是 防 自己 的 DOM 副作用 重 放。面试 落点：给 出 「先 找 重复 渲染 源（props 下 钻/槽 位 重 执 行），再 谈 手 段」的 顺序——v-memo 掩盖 架构 问题 时 要 警惕（该 拆 组件/该 memo 数据 却 贴 补丁）。

**来源**：Vue v-memo 文档与源码 withMemo 实现；自定义指令 updated 触发时机官方说明。

### 14. 弹窗组件不 Teleport 也能用（fixed+高 z-index），给一份「什么时候必须 Teleport」的判定清单。

必须 搬 的 四 个 信号：① 祖先 有 `transform/filter/perspective`（fixed 的 包含 块 被 改写 → 弹窗 跟 着 卡片 动，CSS 无 解 只 能 换 父 级）；② 祖先 `overflow:hidden` + 无法 保证 滚 动 容器 恰好 到 顶（裁 切）；③ z-index 分层 体系 崩 坏（组 件 库 弹 层 和 业务 sticky 头 打 架，根 治 是 「弹 层 挂 body + 独立 层 上下文」而 不 是 数字 竞赛）；④ 需要 跨 路由/跨 模板 存活（确认 框 在 触发 者 卸载 后 还 要 存 在——配 独 立 挂载 或 Teleport 到 全局 target）。不 搬 的 代价：焦点 管理 与 事件 回 归（focus trap 要 自己 管 Tab 循 环，键盘 操 作 用 户 出 得 去 弹窗），且 body 级 弹窗 的 滚动 锁 与 背景 颜 色 覆盖 不 到 fixed 祖先——「Teleport 不 是 免 费 的 修 复，它 把 层 级 问题 换 成 了 上下文 问题」（样式 继承 断 了：scoped 类 名 仍 活 但 CSS 变量 继 承 链 变 了，主题 变量 要 从 :root 重 新 供 给）。

**来源**：MDN position:fixed 包含块规范；社区「transform 破坏 fixed」实证；a11y dialog focus-trap 通行实践。

### 15. 让第三方库（如地图/富文本）与 Vue 响应式和平共处：容器、实例、状态三层各自怎么管？

容器 层：`ref` 拿 DOM 后 **onMounted 才 new 实例**（SSR 分支 跳过），容器 本身 绝 不 让 库 当 根 重 建——配 `<div>` 静态 存 在，库 只 填 内 部。实例 层：实例 对象 **绝 不 进 响应式**（`ref(markRaw(instance))` 或 shallowRef+markRaw——富文本 实例 被 reactive 深 代理 后 内部 this 全 乱，是 「Vue3 迁移 炸 组件 库」头 号 事故，本包 响应式 关 markRaw 题 的 实战 版）。状态 层：库 的 事 件（onChange/zoomend）→ 单向 同步 到 Vue 状态；Vue 状态 → `watch` 调 库 API 下发，**双 向 都要 防 回环**（程 序 性 调 setZoom 会 再 触 发 库 change → 再 watch → 死 循，防 线：flag 短路 或 比较 目标 值 再 决 定 是否 调 API）。生命 周期：destroy 在 unmounted（KeepAlive 场景 要 deactivate 暂 停、activate 唤 醒，有 些 库 无 resume 就 重建）；resize 用 ResizeObserver 挂 容器（window resize 漏 内 部 布 局 变 化）。

**来源**：Vue 文档 markRaw/shallowRef 与 第三方库集成；Element/地图类库 Vue3 迁移 issue 中的代理事故记录。
