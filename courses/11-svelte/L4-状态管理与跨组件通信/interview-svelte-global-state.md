# svelte-global-state 面试题精选

> 共 15 题，覆盖 A 模块单例模式 / B 持久化与工程化 / C SSR 与 HMR / D 状态选型总览。

## 一、模块单例模式（A 类）

### 1. Svelte 5 里不装任何库怎么做全局状态？
`.svelte.js` 模块导出含 runes 的对象（或工厂产出的单例），组件 import 后直接读写——ES 模块单例给"全局"，`$state` 字段给"响应"。没有 Provider、没有钩子、没有 selector（呼应 svelte-global-state 第一节）。
**来源**：Svelte 官方文档 — Runes in module files

### 2. 为什么 import 进来的 `$state` 字段能在任意组件里响应？
runes 是**词法作用域的信号**，不隶属某个组件实例：读字段的那段模板/effect 建立依赖，写字段的那处代码触发通知——组件只贡献"读者"身份，不贡献"所有者"（呼应 svelte-reactive-runes 第五节）。
**来源**：Svelte 5 官方博客 — runes 作用域设计

### 3. `$state` 和 `$state.raw` 在全局态里怎么选？
购物车列表、toast 队列这类"整体替换或浅层变更"用 `$state.raw` 省代理开销，更新时换引用；要 `cart.items[i].qty++` 细粒度字段响应的用 `$state`（呼应 svelte-reactive-runes 浅深层话题）。
**来源**：Svelte 官方文档 — $state.raw

### 4. 对象字面量导出的全局态，怎么让内部状态不被外部乱改？
getter 暴露只读口 + 方法收口写：`return { get count(){return count}, inc(){...} }`；或者私有 `#` 字段的 class 实例。契约同 Pinia 的 actions 思路，只是零框架（呼应 svelte-global-state 第二节）。
**来源**：Svelte 官方文档 — class 与 runes / 封装惯例

## 二、持久化与工程化（B 类）

### 5. 给全局态加 localStorage 持久化，写在哪？
初始化时**同步读** localStorage 作 `$state` 初值；写回放模块顶层 `$effect`——依赖字段每次变化自动落盘（可加防抖）。`$effect` 在 `.svelte.js` 顶层合法（呼应 svelte-global-state 第三节）。
**来源**：Svelte 官方文档 — 模块中的 effect；社区 persisted 模式

### 6. 跨标签页同步怎么做？
监听 `window` 的 `storage` 事件（同域其他标签页写入时触发），在回调里 set 本地 `$state`；注意跳过本页自身写入避免回环。仍是零库（呼应 svelte-global-state 第三节延伸、quiz q5）。
**来源**：MDN — Web Storage API storage 事件

### 7. 全局态模块怎么组织才不像大泥潭？
按**领域拆模块**（cart.svelte.js / auth.svelte.js），模块内"state+derived+actions"三区分明；组件只 import 领域模块、不互相摸对方内部；需要多实例/可测就导出工厂再产单例（呼应 svelte-global-state 第二节）。
**来源**：Svelte 官方 — 状态管理指南（组合式模块）

## 三、SSR 与 HMR（C 类）

### 8. 模块级 `$state` 单例上 SSR 会出什么事故？为什么？
**跨请求状态泄漏**：Node 进程里模块只初始化一次，所有用户共享同一份可变对象——A 用户写购物车，B 用户刷新就看到。纯客户端 SPA 无此问题，一上 SSR 就是安全事故（呼应 svelte-global-state 第四节②、svelte-stores 第四节坑 3）。
**来源**：SvelteKit 官方文档 — State 一节（"module-level state is shared"）

### 9. 那 SSR 项目的"全局态"正确姿势是什么？
三档：① 页面数据走 `load` + `$app/state`（每导航/请求重建）；② 确需跨组件共享就工厂+`setContext` 每请求实例；③ 服务端初始态经 devalue 序列化、客户端水合为局部态。口诀：**"全局"只存在于客户端会话，不存在于 Node 进程**（呼应 svelte-global-state 第四节表、12-sveltekit）。
**来源**：SvelteKit 官方文档 — state 管理建议

### 10. Vite HMR 为什么会清掉全局态？怎么救？
热更新=模块重新执行，单例被重建。把实例存入 `import.meta.hot.data`，重载时先取旧实例——数据跨 HMR 存活（呼应 svelte-global-state 第四节①、10-vite HMR 原理）。
**来源**：Vite 官方文档 — import.meta.hot.data

## 四、状态选型总览（D 类）

### 11. 给你一个新 Svelte 5 项目，画出状态选型决策树。
组件私有→`$state`；父子两三跳→props/`$bindable`+提升；树内环境量→context；真全局且纯客户端→`.svelte.js` runes 模块；异步流源→readable store；SSR 页面数据→load+`$app/state`。每层都问一句"能不能更少共享"（呼应 svelte-global-state 第五节汇总表、svelte-context 第六节）。
**来源**：Svelte 官方状态管理指南（综合）

### 12. 对比 React：为什么 React 社区离不开状态库而 Svelte 常常不需要？
React 的响应单元是"组件函数重跑"，跨组件共享必须借钩子+引用比较（Context 粗粒度、Zustand selector）——库补的是**语言缺的信号层**；Svelte 5 的 `$state` 本身就是可脱离组件存在的信号，模块单例天然充当 store，库的剩余价值只在 devtools/时间旅行/持久化预设这些**工程配件**（呼应 svelte-overview 第二节、react-context、svelte-global-state 第一节）。
**来源**：Svelte 5 官方博客 + React 官方">You might not need a state manager"讨论对照

---

## 补充（新专题 13-15）

### 13.  模块级 $state 单例在 SSR 下会出什么事故？Svelte 项目里"全局态"的正确姿势是什么？

事故：Node 进程是长驻的，模块顶层 $state 单例在所有请求间共享——用户 A 的请求把购物车/登录态写进单例，用户 B 的请求读到 A 的数据（跨用户数据泄露，是 SSR 最严重的安全事故，对应既有"SSR 单例最大风险"题）。正确姿势分层：① 请求级数据放"每请求实例"——SvelteKit 用 load 返回的 data + $page.data（官方数据通道，天然 per-request，对应既有"SSR 首屏数据通道"题），或每次请求 new 一份 state；② 真·全局且无身份的数据（主题、构建常量）才允许模块单例；③ 判据——"这块状态是否携带『当前用户/当前请求』身份"，有则绝不模块单例。手动 SSR（非 Kit）：自己在请求处理里创建 app 级 state 容器并靠 context 下传，切勿 import 一个顶层 $state 直接用。加分句：这题的通用原则是"服务端的全局 = 所有用户的共享"——凡是从 SPA 时代『模块单例当全局状态』的习惯带到 SSR，都是隐患；能主动讲出"我在 SSR 项目里规定请求态一律走 load/context、模块单例只放无身份 UI 偏好"，说明你把 SSR 安全当工程纪律而非事后补救（呼应既有 SSR 事故题的制度化）。

**来源**：SvelteKit state 泄漏文档；module singleton SSR 危害；per-request state 模式

### 14.  开发时 Vite HMR 热更新把全局购物车清零了，官方推荐的保命手段与原理？

成因：改 .svelte.js 全局模块会触发该模块重新执行——顶层 $state 被重新初始化，之前的值丢失（对应既有"热更新清零官方保命手段"题）。手段：① 用 import.meta.hot.data 跨模块重载存值（HMR 提供的"存活槽"，模块热更新前后读写同一 hot.data，把状态挪进去）；② 或把全局状态初始化做成幂等（已存在就不覆盖）；③ 组件级状态靠 Svelte 的 HMR（保留组件实例 state， runes 下组件热更默认保状态，对应 tooling 关"保留组件状态"题）。原理：HMR 是"替换模块但不想丢运行状态"的机制，import.meta.hot 是模块和自己的过去通信的唯一通道。工程注意：hot.data 只治开发（生产无 HMR），别把业务持久化混进 HMR 保命逻辑（持久化用 localStorage，热更保命用 hot.data，两码事）。加分句：能把"开发期状态丢失（HMR）"与"运行期状态持久化（storage）"分成两条正交的问题讲，说明你分得清工具链行为与产品行为——很多人用一个 localStorage hack 去"修 HMR 清仓"是混淆了二者（呼应既有 HMR 清仓题的正解）。

**来源**：Vite HMR 与模块状态；import.meta.hot 实践；Svelte HMR 状态保留

### 15.  给你一个新的 Svelte 5 中大型项目，画一遍全局状态选型与组织决策，并说明如何防"大泥潭"。

决策树（先问三问）：① 携带请求/用户身份吗？→ 是：走 Kit load + $page.data / context，禁模块单例；② 有几个互不相干的消费点、跨不跨路由？→ 单组件内：局部 $state；父子：props；跨层少量：context；广泛共享且无身份：模块 $state 单例；③ 要持久化/跨标签页/时间旅行？→ 是：加持久化层或引入 store 库。组织防泥潭：① 按 feature 分模块（cart.svelte.js、auth.svelte.js）而非一个 giant store.js；② 每模块导出"工厂或带方法的对象"而非裸 $state（封装内部、外部只能通过方法改，可追踪变更源，对应工厂函数题）；③ 派生用 $derived 就近定义、别到处读原始 state；④ 建立"谁可以写这个状态"的单向约定（写走 action/方法，读走 derived）。度量：全局模块数量与每模块消费者数要监控——一个 state 被 20 个组件读写就是拆分信号。加分句：这份决策树最值钱的是"升级触发条件 + 降级回收机制"——能说出"我们先局部、出现第 3 个消费者才提升到全局、并能一键降回"的团队，才真正掌控了状态蔓延（呼应既有"画出状态选型决策树"题的体系化落地）。

**来源**：Svelte 状态组织最佳实践；feature-slice 前端架构；既有"状态选型决策树""模块怎么组织不像大泥潭"题整合
