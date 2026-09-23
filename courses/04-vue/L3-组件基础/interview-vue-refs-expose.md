# vue-refs-expose 面试题精选

> 共 15 题，覆盖 模板 ref 与时机 / useTemplateRef / 函数与数组 ref / defineExpose / 设计判断 五类。

---

## 一、模板 ref 与时机

### 1. 模板 ref 什么时候能用？为什么 setup 里立刻 `el.value.focus()` 会报错？

ref 在元素**挂载后**才被赋值，`setup` 执行时 DOM 尚未创建，`el.value` 是 `null`，直接调用会抛错。应在 `onMounted`（或 `nextTick` 之后）访问（呼应 vue-refs-expose 第一、六节、vue-lifecycle 第二节）。

**来源**：Vue.js — "Template Refs / timing"

### 2. `<script setup>` 里没有 `this.$refs`，那怎么拿引用？

用与 `ref="name"` 同名的 `ref` 变量（自动绑定），或 Vue 3.5 的 `useTemplateRef('name')`。选项式才有 `this.$refs`；组合式靠 `<script setup>` 顶层变量名匹配（呼应 vue-refs-expose 第一、二节）。

**来源**：Vue.js — "Script Setup / useTemplateRef"

---

## 二、useTemplateRef

### 3. `useTemplateRef` 和"同名普通 ref 变量"有什么区别，为什么官方推荐前者？

同名 ref 变量是一种隐式魔法，容易和"恰好叫这个名字的普通 ref"混淆、且 TS 推断为 `any`/需要手动标注。`useTemplateRef('input')` 显式声明"我要模板里 ref=input 的那个"，意图清晰、**自动推断元素类型**，避免命名冲突（呼应 vue-refs-expose 第二节、02-ts）。

**来源**：Vue.js — "useTemplateRef（3.5）"、Vue 3.5 Release Notes

---

## 三、函数与数组 ref

### 4. v-for 列表里怎么拿到所有渲染项的 DOM 引用？

用**函数 ref** 或数组 ref：`:ref="el => refs[i]=el"` 按下标/key 存进对象或数组。函数 ref 在元素创建时收到 el、销毁时收到 null，可据此维护映射；虚拟滚动/动态列表推荐按 **key 存 map** 而非依赖数组顺序（呼应 vue-refs-expose 第三、六节）。

**来源**：Vue.js — "Dynamic v-for refs / Function refs"

### 5. 函数 ref 的典型用途？它和生命周期清理有什么关系？

在挂载时 `init(el)`、卸载时收到 `null` 做 `dispose()`，把第三方组件/图表/滚动的生命周期绑到元素存在性上——比在 `onMounted/onUnmounted` 里靠 ref 更贴近"这个元素本身"的创建销毁（呼应 vue-refs-expose 第三节、vue-lifecycle 第二节）。

**来源**：Vue.js — "Function Refs / El contents change"

---

## 四、defineExpose

### 6. 为什么 `<script setup>` 组件父拿不到实例，要 defineExpose？设计动机是什么？

`<script setup>` 编译为闭包，内部绑定默认**不暴露**，保护封装、防止父组件随意改子内部状态破坏单向数据流。`defineExpose` 让子**主动**声明"对外公开的 API"（一般是方法），是刻意的封装边界（呼应 vue-refs-expose 第四节、vue-component-basics 单向流）。

**来源**：Vue.js — "<script setup> 封闭性 / defineExpose"

### 7. 父组件调用子组件方法有哪几种方式？各自利弊？

① `ref` + `defineExpose` 命令式调用（`child.value.submit()`）：直接但耦合、破坏声明式，慎用；② props + emit：数据驱动，首选；③ `v-model`/`defineModel`：双向同步状态；④ `provide/inject`：跨层。除 imperative 场景（focus/播放/validate）外应优先 ②③（呼应 vue-refs-expose 第四、五节、vue-provide-inject）。

**来源**：Vue.js — "Parent-Child Communication"、社区 — "$refs vs props/emits vs provide/inject"

### 8. `defineExpose` 应该暴露什么？举一个反例。

应暴露**行为（方法）**而非一堆内部状态。反例：`defineExpose({ form, errors, loading, ... })` 把子内部全开放，父到处读写 → 退化成命令式耦合、无法重构。正例：只 `defineExpose({ validate, reset })`（呼应 vue-refs-expose 第四节）。

**来源**：Vue.js — "defineExpose"、社区 — "组件公开 API 设计"

---

## 五、设计判断

### 9. "能用数据驱动就别用 ref"——给出三个应改用状态而非 ref 的场景。

改样式→`:class`/`:style`；改文本/显隐→插值/`v-if`；同步父子值→props/emits/v-model；"渲染后做事"→`watch(flush:'post')`/`nextTick`。这些都是"绕开响应式模型手动操作 DOM"的坏味道（呼应 vue-refs-expose 第五节）。

**来源**：Vue.js — "Declarative Rendering"、Vue Style Guide

### 10. 需要"输入框自动聚焦"，用 ref 合理吗？为什么？

合理。`focus()` 是无法用状态表达的**命令式 DOM API**，正是模板 ref 的正当用途之一：`onMounted` 后 `el.value?.focus()`。与"改样式/文本"不同，聚焦没有声明式等价物（呼应 vue-refs-expose 第五节）。

**来源**：Vue.js — "Template Refs 用例"

### 11. ref 拿到子组件实例和拿到 DOM 元素，`.value` 分别是什么类型？

`ref="el"` 标在**原生元素**上 → `.value` 是 DOM 元素；标在**组件**上 → `.value` 是该组件的公开实例（`defineExpose` 内容 + 内置实例属性）。所以调用前要知道自己拿的是哪种，方法来源不同（呼应 vue-refs-expose 第一、四节）。

**来源**：Vue.js — "Accessing Template Refs / DOM vs Component"

### 12. `<Suspense>`/异步组件下 ref 时机有什么额外注意？

异步组件解析完成后才渲染，其内部/自身 ref 在解析+挂载前都是 `null`；`v-if` 切换、动态组件替换也会重置 ref。凡"可能还没有"的 ref 都要判空，并在依赖它动作前 `await nextTick()` 或等组件出现（呼应 vue-refs-expose 第六节、vue-async-suspense）。

**来源**：Vue.js — "Async Component / ref timing"

---

## 补充（新专题 13-15）

### 13. 模板 ref 拿子组件「实例」在 script setup 下被刻意收窄成只能 defineExpose——这个设计给库作者和普通业务各带来什么连锁后果？

给 库 作者：暴露 面 = API（instance 不再 是 黑盒 接口），倒逼 出 显式 契约——Element Plus 等 库 的 `暴露 focus/validate/scrollTo` 方法 集 就是 组件 API 文档 本身，类型 用 `InstanceType` 不 再 可靠（要 `Ref<typeof Comp>` + 官方 导出 的 实例 类型）；代价：老 代码 习惯 的 `ref.value.$el/form 内部 状态` 全 断，迁移 期 出现 大量「透传 式 defineExpose」（暴露 一 堆 内部 东西）= 收窄 形 同 虚设。给 业务：正向 后果=组件 重构 不 怕 外部 掏 内部（封装 真正 成立）；负 面=调试 时 「控制台 打 不 开 内部」（devtools 仍 可）；最 佳 实践：暴露 **动词** 不 暴露 状态（validate() 而 非 form 对象），配 「能 用 props/emit/v-model 表达 就 不 开 方法 口」的 阶梯（本关 调用 子 方法 方式 题 的 判据 版）。

**来源**：Vue 文档 defineExpose 与 script setup 封闭性说明；Element Plus 组件实例 API 设计。

### 14. ref 指向 v-if 元素、异步组件、Suspense 三种场景时，「什么时候能拿到非 null」分别是什么规则？

v-if：false 期间 ref=null（渲染 出 去 后 的 最 早 可靠 读取 点 = 该 次 更新 的 `flush:post`/nextTick，本关 时序 题）——比 这 更 稳 的 是 干脆 用 函数 ref（挂载 即 通知，免 时序 推理）。异步 组件（defineAsyncComponent）：解析 完成 前 模板 ref 一直 null，loading 兜底 组件 还会 先 占 位——要 「就绪 通知」用 组件 内 emit 事件 或 onLoaded 回调，别 轮询 ref。Suspense：默认 插槽 挂 载 时机 整体 延迟 到 异步 依赖 resolve，ref 可用 点 = Suspense 的 `@resolve` 事件（外部 监听）而 非 宿主 组件 mounted——这 是 本包 async-suspense 关 与 ref 关 的 接缝 题；通用 防线：所有 「ref 到手 就 初始化」（观察 器/图表）改用 函数 ref 或 watch(ref) 驱动，把 null→非 null 当 状态 迁移 处理，一 劳 永 逸 掉 时机 玄学。

**来源**：Vue 异步组件 onLoaded 文档；Suspense resolve 事件与 template ref 时序 issue 结论。

### 15. 「拿 DOM 引用做测量/定位」类需求（滚动定位、元素尺寸、浮层对齐）的组件化方案光谱：从 ref 手写到浏览器原生 API 到组合式抽象。

底 层 手写：ref + getBoundingClientRect + scrollIntoView，问题 在 **窗口 resize/滚动/字体 加载 后 的 重 测量** 全 要 自己 管。原生 升级：`IntersectionObserver`（可见 性 触发，懒 加载/曝光，本包 指令 关 v-lazy 的 引擎）、`scrollIntoView({behavior:smooth})`/`scroll` 事件 配 `getComputedStyle` 慎用（强制 同步 布局，循环 里 读 rect 写 style = layout thrash 教科书，读 写 分 离/用 transform 替代 top）。组合 式 抽象：VueUse 的 useIntersectionObserver/useTemplateRef + onScopeDispose 自动 拆 观察 器——「生命 周期 绑定」这 一 层 才 是 库 的 真正 价值（本关 函数 ref 清理 题 的 库 化 终 局）。浮层 对齐 单独 点名：popper.js/floating-ui 用 「策略 层 计算 + position:fixed 渲染 层」，不 自己 碰 宿主 组件 的 ref，接口 是 传 锚 元素——锚 元素 从 哪 来（ref？事件 target？）才 是 组件 该 关心 的。判据：测量 逻辑 出现 在 两 个 组件 里 就 抽 `useMeasure`，别 复制 rect 数学。

**来源**：MDN IntersectionObserver/getBoundingClientRect；VueUse useIntersectionObserver 设计；floating-ui 文档架构篇。
