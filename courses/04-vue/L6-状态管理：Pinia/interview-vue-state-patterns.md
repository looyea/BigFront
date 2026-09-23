# vue-state-patterns 面试题精选

> 共 12 题，覆盖 状态分类 / 单向数据流 / 派生与冗余 / 提升与工具选型 / 可预测性 五类。

---

## 一、状态分类

### 1. Vue 里的"状态"大致分几类？各自该放在哪里？

① **组件局部 UI 状态**→组件内 `ref`；② **可复用的局部逻辑状态**→composable（每调用一份）；③ **跨组件/页面共享业务状态**→Pinia store；④ **一棵子树内共享**→provide/inject；⑤ **服务端数据缓存**→store 或数据层(Query)。核心：**作用域多大，状态就放多小**（呼应 vue-state-patterns 第一节）。

**来源**：Vue.js — "State Management / 局部 vs 共享"、Pinia — "When to use a store"

### 2. "复用逻辑"和"共享状态"是一回事吗？分别用什么？

不是。复用逻辑=同一段有状态行为在多处各跑一份 → **composable**；共享状态=多处读**同一份**数据 → **store**（或单例 composable/inject）。把"只是逻辑复用"的东西塞进全局 store 是无谓耦合（呼应 vue-state-patterns 第五节、vue-composables interview 第 4、11 题）。

**来源**：Vue.js — "Composables vs Store"

---

## 二、单向数据流

### 3. 解释 props-down / events-up，以及为什么写操作要收敛一处。

数据靠 props 自上而下流动，子要变更就 emit 事件交回父处理（谁拥有状态谁负责改）。写操作散在多个子组件里会导致"同一状态多处改、难追踪"；收敛到一处（父/ provider action / store action）才可预测、可加日志校验（呼应 vue-state-patterns 第二节、vue-component-basics、provide-inject interview 第 4 题）。

**来源**：Vue.js — "One-Way Data Flow"、Vue Style Guide

### 4. 组件 v-model 是"真正的双向绑定"吗？

不是。它是"props 向下传值 + emit 向上报变更"的**语法糖**（`modelValue` + `update:modelValue`），数据流本质仍单向。多值 `v-model:x`、修饰符同理。理解这点就不会误以为能跨组件随意"双向同步"（呼应 vue-state-patterns 第三节、vue-component-basics 第五节）。

**来源**：Vue.js — "Component v-model"

---

## 三、派生与冗余

### 5. 什么是 single source of truth？为什么"复制一份再 watch 同步"是反模式？

一份信息应只有**一个权威来源**。把它复制成多份、再用 watch/手动赋值保持一致，会出现：漏同步初始值/某条路径、更新顺序 bug、内存多份、难追踪。派生值应**用 computed/getter 现算并缓存**，不另存（呼应 vue-state-patterns 第四节、vue-watch interview 第 2 题、vue-reactivity 第四节）。

**来源**：社区 — "Single Source of Truth / derived state"、Vue 文档 "computed"

### 6. 那什么时候"本地复制一份状态"是合理的？

**有意为之的编辑副本**：如表单草稿——拷贝一份供本地编辑，提交成功后再回写源。关键是它是"有意的分叉 + 明确回写点"，而非"两常态同步的镜像"。要能清楚回答"谁是真相、何时合并"（呼应 vue-state-patterns 第四节准则 3）。

**来源**：Vue.js — "v-model / 表单本地副本"

### 7. 列表有 total/page/筛选条件，哪些是状态、哪些是派生？

page、筛选条件、原始数据是**状态**（真相）；"当前页要显示的那几条""过滤后的数组""是否可下一页"是**派生**（computed）。把派生当状态存就会不同步（呼应 vue-state-patterns 第四、五节、pinia getters）。

**来源**：社区 — "state vs derived data"

---

## 四、提升与工具选型

### 8. "状态提升"是什么？什么时候从"提升到父"升级到"store"？

两个组件共享状态 → 提到**共同父**持有、props+emit 交互。当：① 父层级很高/跨多个页面；② 多处都要读写且互相不相关；③ 需要持久化/时间旅行/devtools——就升级到 Pinia（或子树内用 inject）。别过早全局化（呼应 vue-state-patterns 第五节）。

**来源**：React/Vue 通用 — "Lifting State Up"、Pinia — "When to use a store"

### 9. provide/inject、Pinia、props/emits 三者选型怎么决断？

父子直连、契约清晰 → **props/emits**；跨**多层但局限一棵子树**（组件库内部协作）→ **provide/inject**；**跨页面/兄弟、全局业务态** → **Pinia**。三者是"共享半径"递增，不是互相替代（呼应 vue-state-patterns 第一、二节、provide-inject 第五节、pinia interview 第 11 题）。

**来源**：Vue.js — "provide/inject vs store"

### 10. 服务端返回的数据（列表/详情）该直接塞进组件 ref 吗？有什么更好组织？

单个页面局部用可以；但被多处共享/需要缓存、失效、去重时，集中到 store 或数据层（如 TanStack Query）更好：统一 loading/error/缓存键、避免到处复制同一份接口结果（呼应 vue-state-patterns 第一、四节、vue-composables 第三节）。

**来源**：社区 — "Server state vs client state / TanStack Query"

---

## 五、可预测性

### 11. 一次重构后发现某状态有 5 个写入点、散在 4 个组件，这说明什么？该怎么办？

说明数据流已失控（不可预测、易竞态）。应把写入**收敛**到拥有该状态的单元（store action / 共同父的函数），其余只读 + 触发 action。这也是引入 Pinia/getter 的时机信号（呼应 vue-state-patterns 第二节、第六节）。

**来源**：Pinia — "Why Actions"、社区 — "可预测数据流"

### 12. 把筛选/分页同步到 URL query 有什么价值？和 store 冲突吗？

价值：可分享、可刷新保持、后退可用、SEO 友好——**URL 是天然的、可序列化的状态**。不冲突：URL 作为"可分享状态"的权威源，组件/store 读取它并与之双向同步（用 `router.replace`）。要防的是把它又复制成第三份镜像（呼应 vue-state-patterns 第四节、vue-router-nested-dynamic 第五节）。

**来源**：社区 — "URL as state"、Vue Router — "query 状态"
