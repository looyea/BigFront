# svelte-stores 面试题精选

> 共 15 题，覆盖 A store 基础 / B 派生与惰性 / C runes 时代的定位 / D 生态对照。

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

---

## 补充（新专题 13-15）

### 13.  store 凭什么是"可响应"的？$ 前缀自动订阅在组件里是怎么工作的？

响应根源：store 是"值 + 订阅者集合"的发布者——subscribe(fn) 登记一个回调并通常立即用当前值调用它，set/update 遍历调用所有订阅者；这就是"可响应"的全部机制（一个极简 pub/sub，没有 Proxy 没有 signal）。$ 前缀编译行为：组件里写 $count 时，编译器自动在组件初始化时 count.subscribe(v => 内部变量 = v)、在组件销毁时自动 unsubscribe——$count 读的是这个内部镜像变量；对 writable 写 $count = x 编译成 count.set(x)。所以既有题"订阅/退订时机"答案是"组件挂载订、销毁退，全自动"。深层：$ 语法只对"编译期已知是 store 的变量"生效，且一个组件里每个 store 变量各生成一对订阅/退订。加分句：把 store 讲成"框架外的独立 pub/sub 约定"就懂了两件事——① 它能脱离组件用（get/set），② 它与 runes 是两套系统（signal vs 订阅），这也是为什么 Svelte 5 里 store 与 $state 需要桥接 API（toStore/toValue，呼应既有桥接题）而非天然互通。

**来源**：Svelte store contract 文档；auto-subscription 编译行为；readable 启动函数

### 14.  Svelte 5 已经有 runes 了，store 还需要吗？给出你的工程答案与迁移判断。

诚实答案：多数新项目用 runes（$state/$derived + .svelte.js 模块）即可覆盖 store 的场景，store 不再是首选。但 store 仍有不可替代价值的场景：① 需要"脱离组件生命周期手动订阅/退订"（第三方集成、Web Component 外部、命令式取值 get）；② 成熟生态库仍以 store 为 API（表单库、某些状态库）；③ 需要 store 独有的高级组合（custom store 的启动函数做懒订阅、可写派生的 set 回调）；④ 跨 runes/非 runes 边界的桥接（toStore/toValue，既有桥接题）。迁移判断：store 是"订阅模型（推）"、runes 是"信号模型（拉 + 细粒度）"，更新粒度差异大——store 整体 set 会让所有 $store 消费者重算（粗），runes 字段级更细（既有"更新粒度差异"题）；把 store 迁 runes 时警惕"每次 set 一个对象→所有订阅者全更新"换成 $state 字段级。与 Pinia/Zustand 对照（既有题）：Svelte 的"官方 store 只是约定 + runes 内置"哲学让它不需要重型状态库。加分句：成熟回答是"runes 优先，store 当作一种『可手动订阅的独立响应源』在需要跨边界/手动生命周期时才用"——把 store 从"默认状态方案"降级为"特定模式工具"，才是 Svelte 5 时代的准确定位（呼应既有"Svelte 5 官方对 store 定位"题）。

**来源**：Svelte 5 runes 与 store 共存说明；derived/store 桥接；既有"还需要 store 吗"工程答案深化

### 15.  自定义 store 怎么写？启动函数的懒执行、销毁清理、以及防坑要点。

自定义模板：返回 { subscribe }（必要时加 set/update），通常用 readable(value, start) 写——start(set) 在"第一个订阅者出现"时调用、返回的 stop 在"最后一个订阅者退订"时调用（懒启动 + 自动清理，对应既有"启动函数返回的函数何时执行"题）。典型实现：定时器 store（start 里 setInterval 写值、stop 里 clearInterval）、可轮询 API store、WebSocket store（连上推消息、无人订阅断开）。防坑三件套（对应既有"经典坑"题）：① 无人订阅时 derived 不重算（懒）——别指望没订阅者时它还保持最新；② 直接改 store 内部对象再 set 同引用不会触发（要新对象/展开）；③ 多个独立"全局 store"散落各模块难追踪——用工厂函数参数化 + 明确作用域。SSR 注意：模块级 store 单例跨请求泄漏（与 global-state 同源风险）。加分句：自定义 store 的美处在"生命周期跟着订阅数走"——最后一个消费者走了它就自动清理（无泄漏），这一点 runes 的 $effect 也能做到（cleanup），但 store 是"数据源级别的自动回收"更适合封装"外部世界的数据流"（呼应既有"自定义 store 怎么写"题）。

**来源**：readable/writable 工厂源码；custom store start stop 生命周期；经典坑讨论
