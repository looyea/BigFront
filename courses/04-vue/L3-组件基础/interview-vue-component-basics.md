# vue-component-basics 面试题精选

> 共 15 题，覆盖 props / emits 与 v-model / slot / attribute 透传 / 组件设计 五类。

---

## 一、props

### 1. 为什么 Vue 坚持"props 单向数据流"，子组件不能直接改 prop？

单向流让数据变化**可追溯**：状态归父组件所有，子只读。若子能改，多个子共享同一父状态时会互相打架、难定位来源。要"改"就 emit 让父改，或本地拷一份（呼应 vue-component-basics 第二节、vue-state-patterns）。

**来源**：Vue.js — "Props / One-Way Data Flow"、Vue Style Guide

### 2. prop 校验有哪几种方式？引用类型的 default 为什么必须是函数？

运行时 `type/required/default/validator`；或 `<script setup>` 的类型化 `defineProps<{...}>()` + `withDefaults`。数组/对象 default 必须 `() => []`，否则**所有组件实例共享同一个引用**，一个实例改动会污染其它（呼应 vue-component-basics 第二节）。

**来源**：Vue.js — "Prop Validation / default factory"

### 3. 父模板里 `:post-title` 对应子组件的哪个 prop？命名规则？

对应 `props.postTitle`。DOM 模板大小写不敏感，故推荐模板里写 kebab-case、JS 里用 camelCase，Vue 自动转换（呼应 vue-component-basics 第二节）。

**来源**：Vue.js — "Prop Naming / Case Sensitivity"

---

## 二、emits 与 v-model

### 4. 子组件如何通知父组件？为什么不推荐子直接改父的响应式对象？

通过 `emit('event', payload)` 上抛，父监听处理。子直接改父传入的对象（尤其 reactive）虽"能生效"，但破坏了单向流与可追溯性，等于偷偷改别人的状态；应 emit 事件由父决定如何改（呼应 vue-component-basics 第三、二节）。

**来源**：Vue.js — "Custom Events / emit"

### 5. 组件上的 `v-model` 底层是什么？`defineModel` 解决了什么？

默认是 `:model-value` prop + `@update:model-value` 事件的语法糖。`defineModel()`（3.4+）把这个 prop+event 对封装成一个可读写 ref，省去手写 props/emits，天然支持多值 `v-model:x` 与修饰符（呼应 vue-component-basics 第五节）。

**来源**：Vue.js — "Component v-model / defineModel"

### 6. `v-model` 能绑多个值吗？带修饰符子组件怎么感知？

能：`v-model:title` + `v-model:content` → `defineModel('title')` 等。修饰符 `v-model.trim`：`const [val, mods] = defineModel()`，`mods.trim` 即布尔，子按需处理（如 `.lazy` 改触发时机）（呼应 vue-component-basics 第五节）。

**来源**：Vue.js — "v-model Arguments and Modifiers"

---

## 三、slot

### 7. 默认插槽、具名插槽、作用域插槽分别解决什么？

默认插槽=直接子内容；具名插槽 `#name`=多个内容落点；作用域插槽=子组件把内部数据（如列表 item）通过 `<slot :item>` 传给父的模板，让**父决定怎么渲染、子决定渲染什么数据**。三者覆盖"布局 vs 数据"的不同分工（呼应 vue-component-basics 第四节）。

**来源**：Vue.js — "Slot / Named / Scoped Slots"

### 8. slot 里的表达式在哪个组件的作用域求值？

在**父组件**作用域（内容归父编译）；作用域插槽里的 `item` 则是子通过 slot props 传出来的、在父模板里可用的局部变量。理解这点才能解释"插槽内容能用父的数据、看不到子的私有状态"（呼应 vue-component-basics 第四节）。

**来源**：Vue.js — "Slot Content / Compilation Scope"

---

## 四、attribute 透传

### 9. 什么是 fallthrough attributes？多根组件为什么要手动绑 `$attrs`？

父传的非 prop attribute（class/style/id/原生事件）会自动合并到组件**单个根元素**上。多根没有唯一落点，Vue 无法猜，故告警并要求 `<div v-bind="$attrs">` 指定；`inheritAttrs:false` 关闭默认透传、把 `$attrs` 手动绑到内部元素（呼应 vue-component-basics 第六节）。

**来源**：Vue.js — "Attribute Fallthrough / $attrs / inheritAttrs"

---

## 五、组件设计

### 10. 全局注册和局部注册组件怎么选？全局注册有什么代价？

优先局部（`<script setup>` import 自动注册）：便于 tree-shaking、来源清晰。全局注册适合极少数通用基础组件（`<BaseIcon>`）；代价是**打进主包、无法按需摇树**、模板里看不出组件来源（呼应 vue-component-basics 第一节、10-vite tree-shaking）。

**来源**：Vue.js — "Component Registration / Global vs Local"、Vue Style Guide

### 11. 什么时候该拆一个新组件？如何设计 props/emits 接口？

当出现**可复用 UI 片段**或**独立职责/状态边界**时拆。接口设计：props 表达"输入配置"、emits 表达"向外发生的动作"、slot 表达"可被父定制的内容"；保持 props 少而明确、事件命名动词化，避免把内部实现泄漏成一大堆 prop（呼应 vue-state-patterns、vue-composables）。

**来源**：Vue Style Guide — "Component file names / Strongly Event & Prop Names"

### 12. 组件"隐式契约"（如子依赖父提供的 context）有什么风险？

靠 `$parent`、直接改父状态、约定外部一定传某 prop 等，都是脆弱耦合。应显式化：props/emits 声明、或 `provide/inject`+`InjectionKey`（呼应 vue-provide-inject）、或组合式函数返回。显式依赖更可测、可复用、不易在重构时崩（呼应 vue-testing、node-modules 显式依赖）。

**来源**：Vue.js — "provide/inject"、社区 — "Prop drilling vs composition"

---

## 补充（新专题 13-15）

### 13. 组件拆分有没有「行数红线」？给你的拆分时机判断框架和拆错的两种代价。

拆 分 信号（与 行数 无关）：① 出现 **独立 状态域**（一 块 UI 有 自己 的 一组 ref+事件，互相 不 读 对方 中间 态）；② 模板 出现 「注释 分 段」（`<!-- 搜索栏 -->` 之 类 的 自然 段落）；③ 逻辑 复用（两 处 相似 但 样式 不同 → 其实 该 抽 组合式 函数 而 非 组件）；④ 团队 边界（该 区域 由 另 一 人 负责，接口 化 = props/emits 契约）。拆 错 代价 A（过 碎）：props drilling 链 变 长、事件 转发 层层 透传、一 次 交互 穿 5 个 组件（调试 断点 分散），性能 甚至 因 浅 比较 开销 变 差；代价 B（过大）：单 组件 状态 互相 纠缠、任何 小 改 动 全 部 重 渲染、review 冲突 高发。校验 方法：给 组件 起 不 出 名（「XX 容器 中 间 件」）或 说 不 清 它 的「一件事」= 拆 错；「删 掉 它 页面 少 什么」答 不 出 = 不 该 存 在。

**来源**：Vue 风格指南《组件规模》；社区对「行数红线」的反思（component size / single responsibility 讨论）。

### 14. 全局注册、app.use 插件内注册、按需局部导入三种组件引入方式怎么选？tree-shaking 角度各有什么后果？

局部 导入（SFC 里 import）是 **默认 正 解**：静态 可 分析，未 用 即 摇，组件 名 冲突 显式 暴露。全局 注册 的 合理 领地：① 真正 全局 的 基础 件（Btn/Icon/Empty 等 设计 系统 原语，配 unplugin-vue-components 自动 导入 更 佳——写 起来 像 全局，编译 后 其实 是 局部 import，两 全 其 美）；② 运行 时 才 决定 的 组件（动态 模板/低代码 渲染 器，必须 真 全局）。代价 清单：全局=放弃 tree-shaking（所有 注册 组件 进 主 包，除非 异步）、失去 IDE 跳转 与 类型 校验（模板 里 是 陌生 标签）、命名 冲突 静默 覆盖；插件 内 批量 注册 要 在 install 里 逐个 app.component 并 文档 化 清单——「装了 插件 页面 里 凭空 多 一 批 标签」是 onboarding 杀手。SSR 追加：全局 注册 发生 在 createApp 外 会 跨 请求 污染（本包 SSR 关 同 源 题 的 组件 版）。

**来源**：Vue 组件注册文档；unplugin-vue-components 设计说明；Vite tree-shaking 对全局注册的盲区。

### 15. v-model 在组件上的默认约定从 value/input 到 modelValue/update:modelValue 是怎么演进的？为什么改？

Vue 2：`value` prop + `input` 事件——问题：原生 表单 元素 的 value/input 语义 会 被 组件 **转发 污染**（组件 上 的 `@input` 到底 是 原生 事件 还是 v-model 通道？fallthrough 到 内部 input 时 双 份 监听），且 `value` 名 与 业务 常 用 名 撞 车。Vue 3 改 `modelValue` + `update:modelValue`：① 命名 空间 隔离（v-model 是 **协议 名** 不 是 元素 属性，配 参数 v-model:xxx 后 天然 多 值，value/input 体系 做 不 到）；② 与 修饰符/自定义 指令 语义 一致。3.4 的 defineModel 把 「prop+emit 手写 协议」收 成 一 行，本质 是 同一 协议 的 语法 糖（本关 defineModel 题）。迁移 提醒：老 代码 `modelValue` 直 接 当 prop 名 写 在 模板 会 和 习惯 打架——业务 组件 优先 语义 名（v-model:price），裸 v-model 只 给 「就 是 一 个 值」的 通用 输入 件。

**来源**：Vue 3 迁移指南 v-model（value/input 到 modelValue 的 breaking change 动机）；v-model 参数文档。
