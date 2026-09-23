# svelte-global-state 面试题精选

> 共 12 题，覆盖 A 模块单例模式 / B 持久化与工程化 / C SSR 与 HMR / D 状态选型总览。

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
