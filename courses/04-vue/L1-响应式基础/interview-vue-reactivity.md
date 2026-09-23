# vue-reactivity 面试题精选

> 共 15 题，覆盖 响应式理念 / ref / reactive / computed / 解构与转换 五类。

---

## 一、响应式理念

### 1. Vue 3 的响应式到底是什么？它解决了什么问题？

响应式 = 框架**自动追踪数据被谁用到、并在数据变化时精准更新对应视图**。你只声明"状态→视图"的映射，改状态即触发重渲染，无需手动操作 DOM。底层靠在**读取时收集依赖、写入时通知更新**实现（Proxy + effect，呼应 vue-reactivity-theory）。它解决了命令式 DOM 更新难维护、易漏更新的问题。

**来源**：Vue.js — "Reactivity Fundamentals"、Vue — "How Reactivity Works"

### 2. Vue 3 为什么从 Object.defineProperty 换成 Proxy？

- `defineProperty` 只能拦截**已存在属性**的读写，**新增/删除属性、数组索引变化**侦测不到，需 `$set/$delete` 补丁；
- `Proxy` 代理**整个对象**，能拦截 get/set/has/deleteProperty/ownKeys 等，天然支持动态属性与数组，性能与完整性更好（呼应 vue-reactivity-theory、ES 包 Proxy）。

**来源**：Vue.js — "Reactivity in Depth (Proxy vs defineProperty)"、MDN — "Proxy"

---

## 二、ref

### 3. `ref` 和 `reactive` 有什么区别？分别在什么场景用？

- `ref`：可包**任意类型**，返回带 `.value` 的对象；模板自动解包。适合单个值、可能被整体重新赋值的场景。
- `reactive`：只用于**对象**，返回深度 Proxy，无需 `.value`。适合一组相关、不需整体替换的状态。
团队常统一优先 `ref`，规避 `reactive` 的解构/替换坑（呼应 vue-reactivity 第二、三节）。

**来源**：Vue.js — "ref() vs reactive()"、Vue Composition API FAQ

### 4. 为什么 `ref` 在 `<script>` 里要写 `.value`，模板里不用？

`.value` 是 ref 对象上被 getter/setter 拦截的真实属性，脚本里必须显式访问才触发依赖追踪/更新。模板编译时 Vue 对顶层 ref 做了**自动解包**（编译成 `.value`），所以模板里直接写变量名即可（呼应 vue-reactivity 第二节）。

**来源**：Vue.js — "Unwrapping Refs / .value"

### 5. `ref` 里放一个对象时，属性是深层响应式的吗？

是。`ref(obj)` 内部对 `obj` 用 `reactive`（Proxy）做**深层代理**，`refObj.value.a.b` 改了也会触发更新。若要只代理一层，用 `shallowRef`（呼应 vue-reactivity 第二节、vue-reactivity-theory）。

**来源**：Vue.js — "shallowRef / deep reactivity of ref"

---

## 三、reactive

### 6. `reactive` 对象的两个经典坑是什么？

1. **解构丢响应性**：`const { x } = state` 得到普通快照，需 `toRefs`；
2. **不能整体替换**：`state = reactive({...})` 会切断原引用、丢失响应，重置要就地 `Object.assign(state, ...)`（呼应 vue-reactivity 第三节）。

**来源**：Vue.js — "reactive() caveats / Destructuring"

### 7. 为什么不能直接给 reactive 变量重新赋值？

`reactive` 返回的是一个新 Proxy 对象，你的变量存的是对它的引用。整体 `state = {...}` 只是让**本地变量指向普通对象**，模板/effect 依赖的仍是旧 Proxy，响应链断裂。要换内容应就地修改（`Object.assign`/逐键删改）（呼应 vue-reactivity 第三节坑 2）。

**来源**：Vue.js — "reactive() Limitations"

---

## 四、computed

### 8. `computed` 相比把表达式写成 `methods` 有什么优势？

`computed` **有缓存**：依赖不变时读取直接返回上次结果，不重复计算；而方法在每次重渲染都会执行。对开销大的派生（过滤/归约大数组）尤其明显。computed 还是**惰性**的——没人读就不算（呼应 vue-reactivity 第四节）。

**来源**：Vue.js — "Computed vs Methods"

### 9. computed 能异步吗？可写的 computed 怎么写？

getter 里直接 `await` 会让 computed 变成 Promise、依赖追踪失效——**computed 本身不适合异步**（异步派生用 `watch`/`watchEffect` 或 `vue-async-suspense` 的数据获取，呼应 vue-watch）。可写：`const x = computed({ get: () => ..., set: v => ... })`。

**来源**：Vue.js — "Writable Computed / async computed pitfall"

### 10. "派生值用 computed，副作用用 watch"，为什么？

若某状态能由其它状态**纯计算**得出，就该用 computed（自动追踪、缓存、无同步 bug），而不是用 watch 手动 `onChange 时赋值`（易漏触发、造成两份状态不同步）。只有当变化要触发**副作用**（请求、DOM、打点、第三方同步）才用 watch（呼应 vue-reactivity 第四节、vue-state-patterns）。

**来源**：Vue.js — "Computed vs Watchers"、社区 — "avoid synchronizing derived state"

---

## 五、解构与转换

### 11. `toRef` 与 `toRefs` 有什么用？和 `reactive` 解构什么关系？

它们把 reactive 对象的属性转成**保持联动的 ref**：`toRef(state,'x')` 得单个 ref、`toRefs(state)` 得所有属性的 ref 映射。用于"既要解构给 setup 返回/组合式函数，又不丢响应性"（呼应 vue-reactivity 第三、五节）。

**来源**：Vue.js — "toRef / toRefs"

### 12. 拿到 reactive 对象的原始（非代理）目标怎么做？为什么有时需要？

`toRaw(proxy)` 返回被代理的原始对象。读取/临时用于**脱离响应式**的场景（如把大对象塞进不需要追踪的地方、和第三方库交互避免 Proxy 开销/兼容问题）。注意：混用原始与代理访问同一数据易踩坑，应只在确有必要时用（呼应 vue-reactivity-theory、vue-performance shallowRef）。

**来源**：Vue.js — "toRaw"、MDN — "Proxy target"

---

## 补充（新专题 13-15）

### 13. ref 为什么选择 .value 这个"丑"设计而不是其他方案？社区尝试过什么替代？

JS 没有运算符重载/引用类型原语：基本类型要响应式必须包成对象，.value 是「对象容器」的诚实暴露。替代尝试：① 编译器魔法 type:"ref" 宏（Vue 2  Composition API RFC 时代提出，被否决——同一变量在引用/解包间切换让人无法肉眼判断响应性，且破坏标准 JS 工具链）；② Signals 流派（Solid/Preact 用函数调用 signal() 做显式解包，Vue 团队评估后认为 .value 与对象语义更一致）；③ props 解包响应性（3.5 前不可能，3.5 shallowReactive props 让解构近乎无痛）。设计代价换来了：TS 精确、IDE 通用、无编译器方言——Vue 的哲学「就是 JS」在此体现。

**来源**：Vue Composition API RFC（type: ref 宏提案与被拒记录）；Vue 3.5 release notes shallowReactive props 动机。

### 14. reactive 对 Map/Set 集合的响应式怎么实现的？和数组索引行为有何不同？

集合走「 instrumentation」：Vue 为 Map/Set 提供专门 拦截层（get 包装查 collection 类型缓存到 target 的 iterators 并 track("size")/track key；set/add/delete/clear 触发对应 key 与 size 的 trigger）。差异点：① 数组/对象 的 index/属性直接赋值能被 Proxy 捕获；Map.set(k,v) 是**方法调用**，Proxy 的 get 拿到的是 Vue 包装后的 拦截方法 而非 原始 方法——不然 size/迭代器依赖 全丢。② size 是「聚合依赖」：新增/删除键要通知订阅 size 的 effect，v-for 集合同理。③ WeakMap/WeakSet 不支持（迭代语义不满足）。坑：拿 .get 出来单独调用仍响应（绑定在代理），但 JSON.stringify 集合要 手动 转换；高频简单 KV 场景 用 普通 对象+shallow 手动 触发 反而更快（本关 大 数据 题 的 延伸）。

**来源**：Vue 源码 reactivity/collectionHandlers.ts 设计；官方 API 文档「reactive 对 Collection 类型 的 支持」说明。

### 15. 父子组件共享一个 reactive 对象 vs 各自 ref+双向 watch 同步，两种模式的工程后果？

共享对象：写 起来 爽（谁 都 能 改），后果=变更 无 单点（5 个 组件 改 同一 字段 时 调试 靠猜）、无法 拦截（没有 emit 这类「显式 出口」做 校验/日志）、测试 要 构造 整个 对象。watch 同步：两条 数据 各 有 主人，同步 逻辑 集中 但 有 时序 成本（回环 触发、flush 时机、初始 对齐）——复杂 场景 变成「分布式 状态 同步」噩梦。正解 是 第三条 路：状态 归 父（或 store），子 组件 拿 props+emit 或 拿 一个 **带 方法 的 API**（暴露 mutation 语义 的 函数集，比如 useCounter 返回 readonly state + increment），「共享 行为 不 共享 可变 引用」。判据：谁 能 写 这份 数据 必须 能 一屏 数 完。

**来源**：Vue 风格指南《props-down events-up》；Pinia 文档「state 应通过 actions 变更」的取舍说明。
