# svelte-stores 面试题精选

> 共 12 题，覆盖 A store 基础 / B 派生与惰性 / C runes 时代的定位 / D 生态对照。

## 一、store 基础（A 类）

### 1. Svelte store 的本质？它凭什么是"可响应"的？
store 只是实现了 `subscribe(method)` 协议的**普通对象**，本身不响应；响应来自编译器对 `$x` 前缀的魔法——组件顶层注入 `x.subscribe(v => $temp = v)` 的镜像变量，销毁时自动退订。是"约定 + 编译"而非运行时系统（呼应 svelte-stores 第一节）。
**来源**：Svelte 官方文档 — Stores 总览

### 2. writable / readable / derived 三者分工？
`writable`：可 `set/update`；`readable`：只有启动函数能 `set`（外部只读），且**惰性**——有订阅者才启动、全退订执行清理；`derived`：从上游计算，同样惰性（呼应 svelte-stores 第一、二节）。
**来源**：Svelte 官方文档 — readable/derived 的 start 函数

### 3. `$count = 5` 为什么不行？
`$count` 是订阅镜像变量，赋值无意义且编译器禁止；写要 `count.set(5)` / `count.update(c => ...)`。这条报错常考（呼应 svelte-stores 第四节坑 1）。
**来源**：Svelte 编译器错误 — "Cannot assign to ... because it is not a variable"

### 4. 组件外（拦截器、工具函数）怎么读写 store？
`import { get } from 'svelte/store'` 后 `get(count)` 一次取值（内部订阅即刻退订，不留监听），写则直接 `count.set()`——store 对象在模块里就是单例（呼应 svelte-stores 第一节）。
**来源**：Svelte 官方文档 — get

## 二、派生与惰性（B 类）

### 5. derived store 没人订阅时上游变了会重算吗？
不会——derived 惰性求值，首个订阅者到来时才补算最新值，之后随上游推送。这防止"没人看的计算白烧 CPU"（呼应 svelte-stores 第二节）。
**来源**：Svelte 官方文档 — derived 惰性语义

### 6. 怎么做"可写的派生"（如华氏度写回摄氏）？
`derived` 传对象配置：`{ get(set){...}, set(value, get){ 拿上游 .set() } }`——get 把上游映射给订阅者，set 把新值换算写回上游。$-前缀组件里就能对 `$fahrenheit` 双向绑定（呼应 svelte-stores 第二节）。
**来源**：Svelte 官方文档 — setting derived stores

### 7. 自定义 store 怎么写？
就是返回一个含 `subscribe` 的对象：内部私状态 + `set/update/dispose` 收口，常见套路是 `writable` 做底座再包 API（如带撤销历史的 `createUndoStore`）。官方称之为"custom store"（呼应 svelte-stores 第一节）。
**来源**：Svelte 官方文档 — custom stores

## 三、runes 时代的定位（C 类）

### 8. Svelte 5 还需要 store 吗？给出你的工程答案。
默认不需要：局部 `$state`、跨组件 `.svelte.js` 模块、树内环境量 context。仍选 store 的三场景：① 源本身是异步流（WebSocket/定时器→readable 的启动/清理模型）；② Svelte 4 存量与依赖 store 的生态库；③ 需要 `get()` 式命令式读取的纯脚本层。混用有官方桥 `toStore`/`fromStore`（呼应 svelte-stores 第三、四节）。
**来源**：Svelte 5 官方博客 — runes 取代 store 的推荐

### 9. `$state` 和 store 能互相转吗？有什么坑？
能：`toStore(state, get)`、`fromStore(store)`。坑在混合风格：把 store 对象塞进 `$state` 里会破坏两边语义；`$`-前缀镜像不可赋值的老坑在混用链路上依旧（呼应 svelte-stores 第三、四节）。
**来源**：Svelte 官方文档 — store bridges

### 10. store 与 runes 的更新粒度差异？
store 整值推送：set 一个新对象，所有订阅者收到整体（值相等性检查仅 `!==`）；runes 字段级信号：`$state` 对象的每个属性独立追踪，模板里读哪个字段就依赖哪个字段（呼应 svelte-reactive-runes、svelte-performance L6）。
**来源**：Svelte 官方文档 — store 与 runes 对比

## 四、生态对照（D 类）

### 11. 拿 Pinia 对比一下 Svelte 的状态方案。
Pinia：defineStore 集中式，state/getters/actions，devtools 完善，必须装。Svelte 5：全局态=一个 `.svelte.js` 模块（零依赖零样板），派生=$derived，副作用=$effect；代价是没有内建 devtools/time-travel，需要自己接。Vuex 式"mutation"在两边都不存在（呼应 svelte-global-state 第一节、vue-state-patterns）。
**来源**：Pinia/Svelte 官方文档设计对照

### 12. Zustand 和 Svelte store 很像，谁更适合 React 迁移过来的团队？
机制神似（模块单例+订阅）。迁移团队写 Svelte 5 建议直接用 runes 模块：Zustand 的 `create` selector 等价物是模板读字段——本来就细粒度，无需 selector；`getState/setState` 等价物是普通读写。把"useStore 思维"翻译成"import 一个响应对象"即可（呼应 svelte-global-state、react-custom-hooks）。
**来源**：Zustand 官方文档与 Svelte runes 对照（社区迁移指南）
