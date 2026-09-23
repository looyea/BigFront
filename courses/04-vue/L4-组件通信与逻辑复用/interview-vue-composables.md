# vue-composables 面试题精选

> 共 15 题，覆盖 概念与约定 / 返回值与响应式 / 组合与参数 / 作用域清理 / 与 mixin/库 五类。

---

## 一、概念与约定

### 1. 什么是组合式函数？它和"普通工具函数""组件"的区别？

以 `use` 开头、内部使用**响应式 API/生命周期**的函数，用来复用"有状态的逻辑"。比普通工具函数多了响应式与副作用；比组件少了模板、专管逻辑。它是 Vue 3 Composition API 复用的基本单元（呼应 vue-composables 第一节）。

**来源**：Vue.js — "Composables / Why Composables"

### 2. 为什么组合式函数必须在 setup（或另一个 composable / effectScope）里同步调用？

因为内部的 `onMounted`/`watch`/`computed` 等需要**当前组件实例或作用域**来登记生命周期与自动清理。异步回调里调用，实例上下文已丢，钩子绑不上、清理失效（呼应 vue-composables 第一节、vue-provide-inject interview 第 12 题、vue-lifecycle）。

**来源**：Vue.js — "Composables setup context"

---

## 二、返回值与响应式

### 3. 组合式函数应该返回 ref 还是 reactive？解构的坑怎么避？

优先返回**一组 ref**（解构安全、语义清楚）。若返回 reactive 对象，`const {a}=useX()` 会丢响应；需要打包对象时用 `toRefs(state)` 返回，使每个字段仍是 ref（呼应 vue-composables 第二节、vue-reactivity-theory 第六节）。

**来源**：Vue.js — "Returning refs vs reactive"

### 4. 一个组合式函数可以被多个组件同时调用吗？状态会共享吗？

每次调用都创建**一套新的局部状态**（各自的 ref），互不干扰——这正是复用逻辑而非共享状态。若要跨组件共享同一状态，得把 ref 提到模块作用域（单例）或用 store/inject（呼应 vue-composables、vue-pinia）。

**来源**：Vue.js — "Shared vs local state in composables"

---

## 三、组合与参数

### 5. "组合式函数可以套组合式函数"体现在哪？给个例子。

`useUser(id)` 内部调用通用的 `useFetch(url)`，再包一层业务语义；`useFetch` 内部又用了 `watch`/`computed`。层层组合形成清晰的数据/逻辑分层，这也是它胜过 mixin 的地方（呼应 vue-composables 第三节）。

**来源**：Vue.js — "Composing Composables"

### 6. 想让参数既支持 `ref` 又支持普通值，怎么处理？

用 `toValue(src)`/`unref(src)` 归一读取；若要在响应式追踪里跟随 ref 变化，把参数放进 `computed`/`watch` 源。这样 `useX(1)` 与 `useX(someRef)` 都能用（呼应 vue-composables 第三节）。

**来源**：Vue.js — "Accepting ref and plain values / toValue"

---

## 四、作用域与清理

### 7. `onScopeDispose` 和组件里的 `onUnmounted` 有何不同？

`onUnmounted` 只在有组件实例时有效；`onScopeDispose` 在**任意活跃 effectScope**（包括组件作用域、`effectScope()` 手动创建、Pinia 等）结束时触发，让组合式函数"无论在哪被调用"都能登记清理（呼应 vue-composables 第四节、vue-watch 第六节）。

**来源**：Vue.js — "effectScope / onScopeDispose"

### 8. 用 `effectScope` 能避免什么真实问题？（比如 SSR/单例）

组件外的常驻组合式逻辑（全局定时器、订阅）若不收在作用域里，会随模块生命周期长存 → **内存泄漏、SSR 跨请求串状态**。`scope.run(...)` 收集、`scope.stop()` 一次性释放，SSR 里"每请求一个 scope"尤其关键（呼应 vue-composables 第四节、vue-ssr-nuxt、node-deploy-perf）。

**来源**：Vue.js — "effectScope usage / SSR per-request scope"

---

## 五、与 mixin、通用库

### 9. 组合式函数相比 mixins 到底好在哪？逐条说。

① **来源显式**：`const {x}=useX()` 一眼看到出处，mixin 的 `this.x` 不知来自谁；② **无命名冲突**：各返回各的，不像 mixin 合并进同一实例相互覆盖；③ **可传参、可组合**；④ **易单测**：就是普通函数；⑤ **TS 推断好**（呼应 vue-composables 第五节）。

**来源**：Vue.js — "Why not Mixins"、"Composition API FAQ"

### 10. 一个组合式函数什么时候该做成"单例（共享状态）"？怎么做？

当多个组件要共享**同一份**状态（如全局 toast、主题、当前用户）时。做法：把状态 ref 提到**模块作用域**，函数只读写它 → 所有调用者共享（"Vue 3 单例 composable"）。注意 SSR 下模块级状态是**跨请求共享**的，需慎用（呼应 vue-composables 第四节、vue-pinia、vue-ssr-nuxt）。

**来源**：Vue.js — "Singleton in a Composable"、社区 — "global state without a store"

### 11. 为什么说"能用 composable 表达的逻辑就别塞进 store"？

store 适合**跨页面/跨兄弟的全局业务状态**。局部的、只服务一个组件/子树的逻辑（鼠标追踪、表单校验、防抖取数）用 composable 更内聚、可测试、无全局污染。二者互补，别把所有东西都往 Pinia 里灌（呼应 vue-composables、vue-pinia、vue-state-patterns）。

**来源**：Pinia 文档 — "When to use a store"、社区 — "composables vs store"

### 12. 像 VueUse 这类库的组合式函数有哪些值得学习的设计？

参数支持 ref/值（`toValue`）、返回命名 ref、自动随作用域清理、SSR/环境安全、按文件拆分可 tree-shake、选项对象可扩展。团队沉淀自己的 `composables/` 时应遵循同样契约（呼应 vue-composables 第六节、vue-project-architecture、10-vite tree-shaking）。

**来源**：VueUse 文档 — "Functions best practices / SSR"

---

## 补充（新专题 13-15）

### 13. 设计一个 useFetch 级组合式函数的完整检查清单：参数、返回、竞态、缓存、SSR 各定什么政策？

参数：URL/option 全 收 `MaybeRefOrGetter`（内 部 toValue 归 一，响 应 式 源 变 了 自动 重 新 请 求——这 条 是 VueUse 红利 题 的 落地）；返回：`{ data, error, status, isFetching, execute, refresh, abort }` **全 ref + 动作 函数**，绝 不 返 reactive 整 体。竞 态：请 求 序 号/AbortController 双 保险，旧 请 求 回 来 丢 弃（本包 watch 竞 态 题 的 组 合 式 封 装 位）；重 试 政 策：指数 退避 + 上限，`execute` 与 「源 变 化 自动 执 行」要 可 分开 关（手动 模式 给 搜索 按 钮 场 景）。缓 存：key 策略（url+参 规范 化）、SWR 式 stale 标记、同 key 并 发 去 重（inflight Map）——缓 存 一 开 就 要 同时 给 `refresh` 强 刷 入 口，否 则 调 试 地 狱。SSR：await 版 本 配 Suspense/useAsyncData 语义（服 务 端 执 行 一 次 + 结果 序 列 化 注 水，客 户 端 hydrate 后 不 重 复 请 求），isLocal 判 断 决 定 「谁 负 责 首 次 发 起」；这 一 段 就 是 Nuxt useAsyncData 存 在 的 理由——自 研 useFetch 先 问 要 不 要 同 构，不 要 才 省 事。

**来源**：VueUse useFetch 源码结构与文档；Nuxt useAsyncData 设计说明（payload 注水）。

### 14. 「组合式函数变全局状态」的临界点在哪？升级为 store 的判断清单，以及升错方向的两种代价。

升 级 信 号（任 满 二 条）：① 两 个 **无 祖先 关系** 的 组件 树 段 要 同 一 份 状 态（单例 化 的 第 一 步 就 是 状 态 出 了 组 件 树）；② 需 要 在 **组件 外** 读 写（路 由 守 卫/axios 拦截 器/事 件 总 线）；③ 需 要 devtools 时 间 旅 行/持久 化/SSR 注 水 这 些 基 础 设 施；④ 变更 规 则 复 杂（多 处 写 要 约 束 成 单 点）。升 级 手 法：`useXxxStore` 单 例 化（作 用 域 外 部 module 级 ref 或 Pinia），**组合 函数 保 留 作 为 store 的 门面**（组 件 面 前 API 不 变）。升 错 代价 A（该 store 不 store）：module 级 裸 ref 单例 逃 逸 SSR 请求 隔离（两 用 户 串 数 据，本包 SSR 关 状 态 污 染 题 的 组 合 式 版）且 无 devtools 可 观 测；代价 B（该 组 合 函数 却 全局 store）：store 里 塞 满 「只 有 一 个 组件 用」的 派 生/副作用，全局 命名 空间 垃 圾 + 任 何 人 都 能 dispatch 它（封 装 边 界 消 失，测 试 要 起 store 才 能 测 局 部 逻辑）。最 终 判 据：状 态 的 **可见 范围** 和 **变更 入 口 数** 决 定 层，不 是 代 码 好 不 好 看。

**来源**：Vue 文档组合式函数与状态管理边界；Pinia 文档「何时用 store」取舍说明。

### 15. 组合式函数文件的「军规级」约定审查：命名、导出形状、副作用、可取消性四关各查什么？

命 名：use 前 缀 + 名 词 说 事（useEventListener 不 是 getListener）；**不 要 叫 xxxComposable/useXxxHook**（React 混 叫 传 染）。导 出 形 状：函数 单 导 出（default 在 组 合 式 生态 是 反 模式，tree-shaking 与 重 命 名 都 受 害）；返 回 对 象 而 非 元 组（React 习 惯 的 `[a, b]` 在 Vue 社 区 被 弃——命 名 解 构 是 ref 到达 模板 的 保 险 丝）。副 作 用：内部 只 允 许 「响应 式 订阅 + 生命 周期 注册」这 类 **作用 域 内** 副 作 用；全 局 监 听/定时 器 必须 挂 作 用 域 清理（onScopeDispose 一 定 存 在——查 「起 了 不 停」的 第 一 眼）；不 允 许 请 求 副 作 用 裸 飞（发 请 求 必 配 abort 通 道）。可 取 消/可 控制：暴露 的 动 作 动词（pause/resume/reset/execute）要 与 返 回 的 状态 名 形 成 闭环（有 isPending 就 该 有 cancel）；参数 支 持 `MaybeRefOrGetter` 或 明 确 不 支 持 并 写 进 类 型（boolean 参数 过 多 = 该 拆 options 对 象）。附 加 硬 件：一 个 `.test.ts` 用 裸 `effectScope` 就 能 测（无 需 mount 组件）是 组 合 式 函数 的 健 康 检 查——测 不 动 = 已 耦 定 组件 生命 周期，降 格 为 「组件 内 私有 逻辑」就 不 要 冠 use。

**来源**：Vue 组合式函数风格指南（命名/返回约定）；VueUse 源码结构作为事实标准。
