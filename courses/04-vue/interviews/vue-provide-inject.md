# vue-provide-inject 面试题精选

> 共 12 题，覆盖 机制 / 响应式 / key 与类型 / 默认值与作用域 / 设计边界 五类。

---

## 一、机制

### 1. `provide`/`inject` 是什么？和 props 有什么区别？

依赖注入：祖先 `provide(key, val)`，其后代任意深度 `inject(key)` 取值，**不必逐层 props 透传**。props 是**父子直连、显式契约**；inject 是**跨多层、隐式依赖**。查找沿组件树向上，最近 provider 生效（呼应 vue-provide-inject 第一、五节）。

**来源**：Vue.js — "Provide / Inject"、"Dependency Injection"

### 2. inject 的查找规则和作用域链/原型链有什么相似之处？

沿父链向上逐层找同名 key，找到即用、找不到继续上抛到根，类似 JS 作用域链/原型链的回溯查找。中间层可以不感知被注入的数据，只当"管道"（呼应 vue-provide-inject 第一节、ES 包作用域链）。

**来源**：Vue.js — "provide/inject 层级查找"、社区 — "DI in Vue"

---

## 二、响应式

### 3. `provide('x', obj.value)` 和 `provide('x', obj)` 有何不同？为什么后者才对？

`.value` 取的是**当时的快照**，之后祖先再怎么改，后代拿到的都是旧值（不响应）。provide **ref/reactive 本身**，后代 `.value` 读取时才纳入依赖收集，才随源更新（呼应 vue-provide-inject 第二节、vue-reactivity-theory）。

**来源**：Vue.js — "Reactivity with provide/inject"

### 4. 用 provide/inject 传了一个 reactive 对象，后代能直接改它吗？有什么隐患？怎么更稳妥？

技术上能改（同一对象引用），但**破坏单向数据流**、来源混乱、难追踪。稳妥做法：provide `{ state, actions }`，把变更收敛到 provider 里的函数（可加校验/日志），后代只调 action（呼应 vue-provide-inject 第二节、vue-pinia 的 action 思想）。

**来源**：Vue.js — "best practice / mutation via functions"

---

## 三、key 与类型

### 5. 为什么用 Symbol 做 inject key 而不用字符串？

字符串 key 全局无命名空间，两个独立开发的组件/库都用 `'theme'` 会**互相串**（错误注入）。`Symbol()` 每次唯一，作为 key 天然隔离（呼应 vue-provide-inject 第三节）。

**来源**：Vue.js — "Injection Key Considerations / Symbol"

### 6. `InjectionKey<T>` 在 TS 项目里解决什么？给个用法。

让 key 携带**值的类型**：`const KEY: InjectionKey<Ref<User>> = Symbol()`。provide 时校验类型，inject 时自动推断 `Ref<User> | undefined`，无需手动断言（呼应 vue-provide-inject 第三节、02-ts generics/泛型标签）。

**来源**：Vue.js — "Typing provide/inject / InjectionKey"

---

## 四、默认值与作用域

### 7. `inject(key, defaultValue, treatDefaultAsFactory)` 三个参数分别什么意思？

`key` 查找键；`defaultValue` 没找到 provider 时返回它；`treatDefaultAsFactory=true` 时把默认值**当函数调用**取其返回（用于默认值是对象/需要工厂的情况）。给默认值可让组件"脱离 provider 也能降级运行"（呼应 vue-provide-inject 第四节）。

**来源**：Vue.js — "inject / 默认值与 factory"

### 8. 怎么强制"某个后代必须在有 provider 的祖先下使用"？

注入后判空并抛错（fail fast）：`const x = inject(KEY); if (!x) throw new Error('missing provider')`。或提供合理默认值做优雅降级，视组件是"必须成对使用（如 FormItem 依赖 Form）"还是"可独立使用"而定（呼应 vue-provide-inject 第四节、node-config 启动校验）。

**来源**：Vue.js — "provide/inject in component libraries / FormItem"

---

## 五、设计边界

### 9. provide/inject 什么时候是"好用解耦"，什么时候是"反模式"？

解耦：主题、i18n、路由实例、成对父子组件（Form/FormRow）等**横切关注点/配置**。反模式：把大量业务状态塞进注入当"全局变量"，导致数据流**隐式、跨任意层、难以追踪和测试**。能 props 显式传就优先显式（呼应 vue-provide-inject 第五节、vue-state-patterns）。

**来源**：社区 — "When to use provide/inject vs props vs store"

### 10. Vue 的 provide 和 React 的 Context、Angular DI 有什么异同？

都是"祖先向后代注入依赖、跳层传递"。差异：Vue 的 provide 沿组件树**按 key 向上找最近 provider**、天然支持响应式（传 ref）；React Context 靠 `useContext` 且值变化触发消费组件重渲染；Angular 是模块级 DI + 令牌。三者都要警惕"隐式依赖难追踪"（呼应 vue-state-patterns）。

**来源**：社区 — "provide/inject vs Context API vs DI"

### 11. provide/inject 和 Pinia（全局 store）该如何选？

同一份数据若只在**一棵子树**内共享、且与树的层级结构相关（组件库内部协作）→ provide/inject（局部、显式挂树、可被不同子树各自覆盖）；若**跨页面/跨兄弟、全局业务状态** → Pinia（单例、devtools、持久化）。Pinia 本身也用了插件式注入（呼应 vue-provide-inject 第五节、vue-pinia）。

**来源**：Vue.js — "provide/inject vs state management"、Pinia 文档

### 12. provide 能在 setup 之外的异步回调里调用吗？为什么？

不能（可靠地）。`provide` 依赖**当前组件实例**，必须在 `setup`/生命周期同步阶段调用。异步回来时"当前实例"上下文已丢失，注入会挂不上。需要动态值就 provide 一个 ref，之后改 ref.value（呼应 vue-provide-inject 第一节、vue-watch interview 第 8 题、vue-composables effectScope）。

**来源**：Vue.js — "provide must be called synchronously in setup"
