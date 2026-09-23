# vue-provide-inject 面试题精选

> 共 15 题，覆盖 机制 / 响应式 / key 与类型 / 默认值与作用域 / 设计边界 五类。

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

---

## 补充（新专题 13-15）

### 13. 用 provide/inject 做「组件库的表单 item 联动」（Form 提供、FormItem/Input 消费）的完整设计：key、类型、校验触发链怎么搭？

Key：`export const formContextKey: InjectionKey<FormContext> = Symbol('form')`——库 内 部 Symbol 不 怕 撞、类型 参数 让 消费 端 拿 到 精确 shape；Context 形状：`{ model, rules, addField(field), removeField(name), validateField(name), emitEvent }`——**下发 方法 集 + 响应式 model 引用**，字 段 组件 mounted 时 `addField` 注 册 自己（name→rules/value 解析 函数），Form 统 管 校 验 调度（失 焦 校 单 字段、提交 遍 历 注册 表）。为 什么 不 props 逐 层：FormItem 可 能 嵌 在 Grid/Card 里，props 穿 层 要 经 过 无 关 组件；为 什么 不 Pinia：这 是 **实例 级** 关系（一 页 两 个 表单 要 各 自 独 立），全局 store 反而 要 手动 隔离 作 用 域——「provide/inject 的 甜 区 = 树 作 用 域 的 实例 级 上下 文」正 在 此（本关 定位 题 的 设计 级 答案）。坑 位 预告：字 段 组件 被 v-if 卸 载 必 须 removeField（否 则 校 验 表 幽灵 字 段）、inject 不到 时 抛 「must be used inside <Form>」 友 好 错 误 而 不 是 静默（本关 强制 存 在 题）。

**来源**：Element Plus form 源码（provide formContextKey + fields 注册表）；Vue 文档组件库上下文实践。

### 14. provide 的值什么时候会触发后代更新？「provide 一个 ref 的 .value」「provide 整个 ref」「provide 普通值后想改」三种写法的后果分别是什么？

触 发 更新 的 唯 一 通道：注入 方 **读 到 了 变化 的 响应式 源**。写 法 一 `provide(key, obj.value)`：下发 的 是 快照（解 引用 的 普通 对象），父 组 件 再 换 obj.value 也 与 之 无 关——静默 失 效 派；写 法 二 `provide(key, obj)`（ref 本 体）：注入 方 `const x = inject(key)` 后 模板 `{{ x }}` 自动 解 包/`x.value` 读 写 都 响应，**这 是 正 解**；改 值 语 义：父 `obj.value = 新值` 全员 更 新，子 写 `obj.value` 则 反 向 污染 父（要 只 读 就 `provide(key, readonly(obj))`，写 操 作 另 行 provide 方法）。写 法 三 provide 普通 值 后 想 改：provide **不 是 响应式 API**，再 调 一 次 provide(key, 新值) 只 影 响 此 后 新 挂载 的 注入 者（已 注入 的 不 追 更），且 官方 未 定义 这 种 用法——要 变 就 从 一 开 始 provide ref/reactive。深 一 层 机制：provide 维护 的 是 key→value 的 **普通 Map**，响应 全 靠 value 自身 是 响应式 源（本关 两 道 响应 题 的 统一 原理 版）。

**来源**：Vue provide/inject 文档「不要把 provide 的值写成 computed/ref.value」警示；源码 provideApi 的 Map 存储结构。

### 15. 微前端/多实例场景下 inject 拿到 undefined 或「别的 app 的 provider」，两 class 故障的根因与防御。

故障 A（拿 不 到）：provider 和 consumer 之 间 插 了 **不 转 发 上下文 的 边界**——函数 式 组件 包 装/异步 组件 loading 占 位/HOC 式 包裹 都 会 断 链（provide 沿 **组件 树** 不 沿 DOM 树，Teleport 却 仍 通 过 逻辑 树 保 住 注入——本关 Teleport 题 的 镜像 确认）；防御=注入 失 败 即 抛 带 组件 名 的 错 误（库 必 备）+ 单测 覆盖 嵌套 组合。故障 B（拿 错）：**两 份 Vue 副本** 时 Symbol 虽然 全 局 注册 表 唯 一 但 appContext 不同，同 Symbol 也 跨 不 了 应 用 边界——多 Vue 实例/微 前端 子 应 用 想 共 享 上下 文 只能 走 显式 通道（props/事件/qiankun 的 全局 状态 管理），别 指望 inject 穿 app；npm 依赖 里 出现 两 份 vue（peer 未 对齐）时 连 官方 注入（RouterRouteKey）都 会 失 联——dedupe 检查 是 这 类 玄学 的 第 一 步。升 级 判 据：跨 树 段/跨 实例 就 不 该 用 provide/inject（它 的 契约 边界 就 是 单 app 单 组件 树）。

**来源**：Vue 文档 provide/inject 边界说明；qiankun/微前端上下文传递实践；npm dedupe 与双 Vue 实例 issue 模式。
