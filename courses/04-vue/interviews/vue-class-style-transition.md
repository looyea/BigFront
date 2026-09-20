# vue-class-style-transition 面试题精选

> 共 12 题，覆盖 class/style 绑定 / Transition 机制 / TransitionGroup 与 FLIP / 工程实践 四类。

---

## 一、class / style 绑定

### 1. `:class` 有哪几种写法？分别在什么时候用最合适？

**对象语法** `{ active: isActive }` 适合"类名 ↔ 布尔条件"映射；**数组语法** `[base, isActive ? 'a' : '']` 适合并列多个类；两者可**混合** `[cls, { active: flag }]`；类多时可把对象抽成 `computed`。数组里的假值会被忽略（呼应 vue-class-style-transition 第一节）。

**来源**：Vue.js — "Class and Style Bindings / Object & Array Syntax"

### 2. `:style` 绑定里键能写驼峰吗？厂商前缀要自己加吗？值为 null 会怎样？

可以写驼峰 `fontSize`（也支持带引号连字符 `'font-size'`）。`transform`、`user-select` 等 Vue 会**自动加 -webkit- 等前缀**。值为 `null`/`false` 时该声明被**跳过**，方便条件性覆盖（呼应 vue-class-style-transition 第二节）。

**来源**：Vue.js — "v-bind:style / Autoprefixing"

### 3. 怎样用组件里的 JS 状态去改一个 CSS 自定义属性（--变量）？

用方括号键：`:style="{ '--main-color': theme }"`，CSS 里 `color: var(--main-color)`。这比堆一堆 class 更适合"主题色/尺寸"这类数值化样式（呼应 vue-class-style-transition 第二节、vue-sfc 的 CSS v-bind）。

**来源**：Vue.js — "Binding CSS Variables"、"v-bind in CSS"

### 4. 组件根元素上，父传下来的 class 和组件自身的 class 会冲突吗？

不会互相覆盖，Vue 会**自动合并**（fallthrough attrs 的一部分）。这让外部能给组件加装饰类而无需组件额外声明 prop（呼应 vue-component-basics 的 attribute 透传）。

**来源**：Vue.js — "Attribute fallthrough / class 合并"

---

## 二、Transition 机制

### 5. `<Transition>` 的六个类名分别代表什么阶段？

进场：`v-enter-from`（起始）→ `v-enter-active`（全程）→ `v-enter-to`（结束）；离场：`v-leave-from` → `v-leave-active` → `v-leave-to`。`*-active` 用来放 transition/animation 定义，Vue 在合适时机自动增删这些类。`name` prop 替换前缀 `v-`（呼应 vue-class-style-transition 第三节）。

**来源**：Vue.js — "Transition Classes / 类名生命周期图"

### 6. `<Transition>` 默认怎么知道动画何时结束？不准时怎么办？

通过读取元素 computed style 的 transition/animation 时长，或监听 `transitionend`/`animationend`。混合 transition 与 animation、或第三方不可靠时用 `type` 指定、或 `:duration` 显式给时间，或走 JS 钩子手动 `done()`（呼应 vue-class-style-transition 第四、五节）。

**来源**：Vue.js — "Explicit Transition Duration / type"

### 7. `<Transition>` 和 `<TransitionGroup>` 有何本质区别？

`<Transition>` 只包**单个**元素/组件的进出场；`<TransitionGroup>` 用于 `v-for` **列表**的增删，且额外处理"因其它项进出导致的**位置移动**"（`v-move` 类）。TransitionGroup 要求每个子项唯一 key（呼应 vue-class-style-transition 第五节、vue-conditional-list）。

**来源**：Vue.js — "TransitionGroup / List Transitions"

---

## 三、FLIP 与列表动画

### 8. `<TransitionGroup>` 的 FLIP 是怎么实现"列表元素平滑换位"的？

FLIP = First-Last-Invert-Play：记录移动前位置(First)，DOM 更新后量出新位置(Last)，用 transform 把元素**反向位移回旧位置**(Invert)，再过渡到 0(Play)。Vue 通过 `v-move` 类 + `getBoundingClientRect` 自动完成，默认开启 `disableTransition=false`，无需手写（呼应 vue-class-style-transition 第五节）。

**来源**：Vue.js — "FLIP 技术 / move-class"、社区 — "FLIP animations"

### 9. 为什么 `<TransitionGroup>` 强制子项要有 key，否则动画会错乱？

列表换位/增删时，Vue 要靠 key 在新旧集合间**正确匹配同一项**，才能算出它从哪到哪并做 FLIP。没 key 或用 index，匹配错位，动画就把错误的元素当作"移动"，出现乱飞/闪跳（呼应 vue-conditional-list 第五节）。

**来源**：Vue.js — "TransitionGroup requires keys"

---

## 四、工程实践

### 10. 页面路由切换淡入淡出怎么写？为什么常配 `mode="out-in"`？

用 `<Transition>` 包住 `<component :is="Component">`（通过 `RouterView` 的 `v-slot` 拿到当前组件）。`mode="out-in"` 让旧页面先离场、新页面再进场，避免两个页面同时存在导致布局重叠/闪烁（呼应 vue-class-style-transition 第六节、vue-router）。

**来源**：Vue Router — "Transition / RouterView slot"、Vue.js — "Transition mode"

### 11. 频繁动画/`:style` 改动影响性能，有哪些注意点？

避免每帧改触发**重排**的属性（width/top），优先 `transform`/`opacity`（走合成层）；长列表动画别对全部项跑；谨慎用 `will-change` 且用完撤销；用 `v-show`+transition 而非反复 `v-if` 挂载重组件（呼应 vue-performance、DOM/CSS 重排重绘）。

**来源**：社区 — "transform vs layout / compositor animations"

### 12. 动画库（GSAP/Lottie）与 Vue 过渡如何集成？为什么不能只靠 CSS 类？

在 `<Transition>` 的 `@enter`/`@leave` 钩子里调用库创建动画，并在库的完成回调里调用 Vue 给的 `done()`，Vue 才会认为结束并清理。复杂时序、缓动、SVG/多属性联动是 CSS 难以表达的，故走 JS 钩子（呼应 vue-class-style-transition 第四节）。

**来源**：Vue.js — "JavaScript Hooks & Animation Libraries"
