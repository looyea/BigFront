# vue-class-style-transition 面试题精选

> 共 15 题，覆盖 class/style 绑定 / Transition 机制 / TransitionGroup 与 FLIP / 工程实践 四类。

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

---

## 补充（新专题 13-15）

### 13. 父组件给子组件根元素传 class，子组件自己也有 class，还有子组件内部再合并的动态 class——三者的合并规则与隔离边界？

Fallthrough 的 class/style 是 **合并 不 覆盖**（同 一 元素 上 父 传 + 子 自身 class 拼接，去重 交给 浏览器）；但 合并 只 发生 在「子 组件 **单 根 且 根 是 元素**」时——多根/fragment 根 会 警告 并 丢 属性（要 手动 `:class="$attrs.class"` 指定 落点，本关 多根 题 的 机制 面）。隔离 边界：scoped style 下 父 的 类 作用 到 子 根 元素 是 **允许 的**（子 根 同时 带 父 作用域 哈希），但 父 想 精准 打击 子 **内部** 元素 只能 靠 ① 子 暴露 的 props/类名 契约 ② :deep() 选择器——:deep 是 打破 封装 的 借 刀 口，业务 样式 里 出现 它 说明 组件 API 设计 缺 了「样式 挂钩 点」这一 层（命名 类 契约 优于 :deep）。

**来源**：Vue 文档《Attribute Inheritance》class/style 合并规则；scoped 样式与 :deep 使用边界官方说明。

### 14. 过渡时长判定：Vue 怎么知道 CSS transition/animation 结束了？主动删除元素会出什么问题？

getTransitionInfo 解析 **computed style**：transition 取 最长 delay+duration，animation 取 duration+iteration，多 个 属性 并 存 时 取 更 长 者；然后 监听 transitionend/animationend 且 校验 `event.target === el` 且 propertyName 匹配（防 子 元素/无关 属性 冒泡 提前 结束）。监听 的 代价：事件 丢 发（标签 页 挂起、display 突变）→ 元素 永远 留 在 DOM（「关 不掉 的 弹窗」真 根因 之一），所以 提供 `:duration="{ enter: 300, leave: 200 }"` 显式 兜底 与 when 属性。主动 删（remove 节点/v-if 直 接 翻）绕过 了 过渡 状态机：leave 钩子 不 跑、nextTick 里 的 清理 逻辑 悬空——「动画 库 配 Vue」正解 是 让 Vue 管 增删 时机（onBeforeLeave/onLeave 里 交给 GSAP，done() 回调 交还 控制 权，本关 JS 钩子 题 的 完整 闭环）；nextOuter 场景 用 `<Transition>` 包 路由 视图 时 别 在守卫 里 手动 操作 DOM。

**来源**：Vue 源码 runtimeTransition/nextFrame 与 getTransitionInfo 注释；官方过渡文档《JavaScript 钩子》done 回调协议。

### 15. 动画的性能账本：哪些属性可以安全高频动画化？列表 FLIP 为什么必须配 transform 而不是 top/margin？

合成 友好 名单：transform/opacity/filter（不进 layout/paint，直接 走 合成器，主线程 卡 也 不 掉 帧）；几何 属性（width/height/top/left/margin）每 帧 触发 layout→重排 传染 全 页——FLIP 的 精妙 正 在 此：First-Last-Invert-Play 把「位置 变化」换算 成 起点 的 `transform: translate/scale` 再 播 回 零，用 合成 层 动画 模拟 布局 动画。工程 红线：① will-change 只 在 动画 前 挂、结束 摘（常驻=合成层 爆炸 吃 显存）；② 大量 元素 同时 动画（TransitionGroup 长 列表）要 限制 并发（窗口 外 的 项 跳过，本包 性能 关 虚拟 列表 的 动画 分支）；③ prefers-reduced-motion 媒体 查询 给 无障碍 降级（动画 是 前庭 障碍 用户 的 生理 不适 源）；④ Vue 的 FLIP 实现 依赖 精确 getBoundingClientRect（Invert 阶段 强制 同步 布局），列表 越大 单 帧 测量 越 贵——这是「FLIP 不是 免费」的 账。

**来源**：MDN 合成层/prefers-reduced-motion；Flip the Grid（Paul Lewis）FLIP 技术文章与 Vue TransitionGroup move-class 实现。
