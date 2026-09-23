# svelte-context 面试题精选

> 共 12 题，覆盖 A API 语义 / B 响应式本质 / C 模式实战 / D 跨框架对照。

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
