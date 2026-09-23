# vue-component-basics 面试题精选

> 共 12 题，覆盖 props / emits 与 v-model / slot / attribute 透传 / 组件设计 五类。

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
