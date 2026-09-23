# svelte-context 面试题精选

> 共 15 题，覆盖 A API 语义 / B 响应式本质 / C 模式实战 / D 跨框架对照。

## 一、API 语义（A 类）

### 1. setContext / getContext 的使用规则是什么？
两者都必须在**组件初始化期的同步代码**中调用：`setContext(key, value)` 在祖先组件的 `<script>` 里注入，后代任意深度 `getContext(key)` 取用。不能延迟到 onMount/事件回调；查找沿**模板树**向上，就近的同名 key 胜出（呼应 svelte-context 第一、六节）。
**来源**：Svelte 官方文档 — setContext / getContext

### 2. getContext 拿不到值时会抛错吗？
不会，返回 `undefined`；推荐传第二参给 fallback：`getContext(key, {})`。需要"必须存在"的强约束时，自己包装成抛错版（createContext 辅助函数模式）（呼应 svelte-context 第二节）。
**来源**：Svelte 官方文档 — context fallback

### 3. key 用字符串有什么问题？标准解法？
字符串是全局命名空间，两个库都用 `'theme'` 就会互踩。标准解：模块导出的 **Symbol 或唯一对象**作 key；TS 圈进一步封装 `createContext()` 把 key 与类型绑在一处（呼应 svelte-context 第二节）。
**来源**：Svelte 官方示例 — TypeScript context 模式

## 二、响应式本质（B 类）

### 4. context 是响应式的吗？换个值会发生什么？
**context 本身不是**：再次 `setContext` 同名 key 不会通知已取值的后代，已 `getContext` 的引用也不会变。正确姿势是注入**持有 $state 字段的对象**——外壳不换、内部字段活，读者按字段级更新（呼应 svelte-context 第一节铁律 2）。
**来源**：Svelte 官方文档 — context 非响应式说明

### 5. 为什么传 $state 对象的字段能跨组件响应？
runes 是词法作用域的信号系统：`$state` 对象的字段是信号，**任何**代码读到它（不管在不在本组件）都建立依赖。context 只是把对象引用送到后代手里，响应性本来就在对象上（呼应 svelte-reactive-runes、svelte-global-state 第一节）。
**来源**：Svelte 5 官方博客 — runes 跨边界响应

### 6. 能把函数放进 context 吗？放 DOM 引用呢？
函数可以且常见（`register`、`open`、`validate`）；DOM/组件实例引用也合法但注意生命周期——后代销毁后父若还持有引用要能判空。context 值不限类型，它只是依赖注入通道（呼应 svelte-context 第三节）。
**来源**：Svelte 官方文档 — context 值类型

## 三、模式实战（C 类）

### 7. 说说"context 注册模式"以及它的典型应用。
父 `setContext` 一个带 `register/unregister` 的集合，子组件初始化时 `getContext` 后把自己登记进去——表单字段组（Form/FormInput）、Tabs 面板注册、复合组件 `<Tabs.List>` 路线都是这个骨架。它替代了 Vue 里靠 `$parent` 链或事件总线的做法（呼应 svelte-context 第三节、L3 挑战题）。
**来源**：Vue/React 复合组件通行模式在 Svelte 的落地（Headless UI 思路）

### 8. 独立 `mount()` 出去的组件为什么 getContext 失败？怎么办？
context 沿**组件树**（模板嵌套）查找，独立挂载是新树根，链上没人 set。对策：挂载时手动传 props，或用 `mount(Component, { props })` 把值带进去，或干脆用全局状态模块（呼应 svelte-context 第六节、svelte-global-state）。
**来源**：Svelte 官方文档 — 应用接口 mount 与 context 边界

### 9. context 和 props、全局 store 的选型边界？
两三层直连 → props（显式接口）；组件树内的"环境量"（主题、表单域、密度）→ context；跨页面/持久/组件树之外 → `.svelte.js` 全局模块或 store。判据是**语义**："这是树的环境，还是应用的数据？"（呼应 svelte-component-composition 第四节、svelte-global-state 第五节）。
**来源**：Svelte 官方 — 状态管理指南

## 四、跨框架对照（D 类）

### 10. 和 Vue 的 provide/inject 逐项对比一下。
语义几乎同构：provide≈setContext、inject≈getContext（含默认值）。差异：① Vue 也要求 setup 期同步 inject；② 响应式传递上 Vue 惯传 ref/reactive，Svelte 惯传 $state 对象——思路一致："外壳不可换、内核要 reactive"；③ Vue 的 provide 在选项式还有 `this.$provide` 逃生（呼应 vue-component-basics、svelte-context 第五节）。
**来源**：Vue/Svelte 官方文档对照

### 11. React Context 的痛点是什么？Svelte 如何避开？
痛点：Provider value 是**引用比较**，一变整棵消费子树重渲染（要 memo 拆 Provider 优化）；样板多（createContext+Provider+useContext 三件套）。Svelte：无 Provider 组件、注入的是信号对象，更新精确到**字段读者**，天然免掉"Context 性能课"（呼应 svelte-context 第五节、react-context）。
**来源**：React 官方文档 — Context 性能注意事项；Svelte 对照

### 12. Svelte 4 时代 context 只能配 store 才能响应，为什么？Svelte 5 改了什么？
Svelte 4 没有 runes，组件外的普通对象没有响应性，注入 `$settable store` 才能广播变化；Svelte 5 的 `$state` 是**词法级、可跨文件**的信号，于是"传普通响应对象"成为正统，store 从必需品降级为可选（呼应 svelte-stores 第三节）。
**来源**：Svelte 5 迁移指南 — context 与 runes

---

## 补充（新专题 13-15）

### 13.  context 是响应式的吗？换一个值 vs 改容器内部字段，两种情况下的更新传播差别是什么？

机制澄清：setContext(key, value) 存的是一次性的 value；如果你在初始化时 setContext 了一个 $state 对象，后代 getContext 拿到的是同一个"代理对象"，读它的字段是响应式的（字段变→所有读了该字段的后代更新）——但如果你重新 setContext 一个"新对象"换掉整个值，已 getContext 的后代不会自动切到新对象（context 本身不是可订阅的信号槽，Svelte 5 里注入点不做响应式重解析）。因此"响应式"的正确姿势是：传一个内部字段会变的 $state 对象、或传 store（writable，后代用 $store 订阅）——用"容器的稳定 + 内容的响应"实现传播，而非"换容器"。与 Vue 对照：Vue 的 provide/inject 同样注入值，要响应式也是注入 ref/reactive；区别在 Vue 对注入值本身可做响应式（inject 到 ref 变化会更新），Svelte 侧重"注入的引用不变、其内部响应"。加分句：一句话记牢——"context 传引用不传快照，响应靠引用内部的 signal，不靠重新 setContext"——把"我想让 context 变"翻译成"我往 context 里放的东西内部要会变"，这是 Svelte context 与所有"依赖注入 + 响应式"框架共同的解法（对应既有"换个值会发生什么"题的精确回答）。

**来源**：Svelte context 与 runes 文档；响应式 context 讨论；Vue provide/inject 对照

### 14.  说说 context 注册模式（provider/consumer 注册），它的典型应用与相对 props 的优势？

模式定义：祖先 setContext 一个"带方法 + 内部集合"的对象（如 Form 提供 { register(field), unregister(id), submit() }），后代（各 Field）在初始化时 getContext 拿到它并调用 register 把自己登记进去——形成"父持有一组子的引用/能力"，无需 props 逐层穿。典型应用：① Form 收集所有 Input 做统一校验/提交（既有 Form/Input 自动接入题）；② Menu/Tabs 的父子项注册（Group 知道有哪些 Item、管理 activeId 与键盘导航）；③ 设计系统里主题/配置下发 + 组件自报。相对 props 优势：解耦"容器"与"深层成员"的中间层（避免 drilling）、支持"数量动态的子"（N 个字段不用 N 个 prop）、可实现"子反过来调用父能力"（父暴露方法）。注意：注册的对象里放函数与 store 合适，别放 DOM 引用（生命周期与 SSR 问题，呼应既有"能放函数吗/放 DOM 引用吗"题）。加分句：注册模式把"context 当依赖注入容器"用——祖先提供的是"服务（方法 + 集合）"而非"数据"，子向服务注册自己，这让组件间是"面向能力协作"而非"面向 props 透传"，是实现复杂 headless 组件（表单、组合框、数据表格）的地基（对应 context 关"注册模式典型应用"题的体系化）。

**来源**：context registry pattern；表单/菜单/设计系统实践；headless 组件内部机制

### 15.  context、props、全局 store/module state 三者的选型边界？key 冲突怎么防？

三者边界：① props——明确的父子单向数据，类型最好、最显式，优先用；② context——"一对多的祖先→后代"且中间层不关心内容（穿透式），或注册模式（跨层能力注入），作用域限于某棵组件子树（局部、可多实例、SSR 安全）；③ 全局 store/.svelte.js 单例——真正跨页面/跨无关子树、生命周期超出任何单一祖先（主题、认证、全局通知），但要防单例的 SSR 泄漏与测试污染。选型口诀："能用 props 不用 context，能用 context 不用全局"——作用域越小越安全（可组合、可多实例、无泄漏）。key 冲突：字符串 key 在多个第三方组件库间会撞名（两个库都用 "form"）——标准解法用 Symbol() 或导出一个唯一对象作 key（把 key 定义在提供方的模块里导出给消费方，形成"同源自洽"，对应既有"字符串 key 问题与解法"题）。加分句：这题考的是"作用域最小化"这一工程原则的落地——context 的价值恰在"它有边界（一棵树）"，遇到"我好像要全局 context"时往往是信号："这块状态该不该升级成模块 store 或该拆到别处"，能感知这个升级时机是架构嗅觉（对应 context 关选型边界题的总纲）。

**来源**：状态作用域选型；context key Symbol 约定；库间 context 隔离
