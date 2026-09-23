# vue-project-architecture 面试题精选

> 共 15 题，覆盖 A 目录与分层 / B 逻辑复用与状态 / C 错误与插件 / D 类型与纪律类。

## 一、目录与分层（A 类）

### 1. 你如何组织一个中大型 Vue 3 项目的目录？为什么倾向 features？
按业务领域切 `features/*`，每个 feature 自带 components/store/composables/api 与一个 `index.ts` 出口，通用的沉到 `shared`。相比按类型(layers)切，feature 自包含让"改一个需求只看一个目录"、能整体删除、耦合低。原则：先放 feature，出现第二个使用者再上提到 shared（呼应 vue-project-architecture 第一节）。
**来源**：Vue School / Anthony Fu — 项目结构与 feature 组织、《前端工程化》领域分层

### 2. 什么是 barrel 文件？它的好处和潜在代价？
`index.ts` 只 re-export 模块对外 API，形成公共边界，内部可随意重构。好处是收敛依赖面、便于 mock；代价是若滥用（处处大 barrel）会影响 tree-shaking 与循环依赖排查。宜按 feature 粒度建出口（呼应 ts-modules 显式导出）。
**来源**：Basarat Ali Syed — Barrel files anti-pattern、TypeScript 文档 modules

### 3. 容器组件与展示组件分离还有意义吗？`<script setup>` 时代怎么落地？
仍有意义但别教条：核心是分清"谁拥有/获取数据（容器）"和"谁只根据 props 渲染、抛 events（展示）"。`<script setup>` + composables 让容器变薄——composable 拿数据、组件绑定即可。价值在于展示组件可复用、易测（呼应 vue-project-architecture 第二节、vue-testing）。
**来源**：Dan Abramov — Presentational and Container Components、Vue 组合式实践

## 二、逻辑复用与状态（B 类）

### 4. composable 和 store 的边界怎么划？各放哪个目录？
composable 是"可复用的局部逻辑/状态"，每个调用点各持一份（useMouse、useDebounce）；store 是"跨组件共享的单例状态"（登录用户、购物车）。复用逻辑放 `composables`，共享状态放 `store`。混用会导致要么到处 new、要么到处全局化（呼应 vue-composables、vue-pinia-basics、vue-state-patterns 第五节）。
**来源**：Vue.js 官方文档 — 组合式函数 vs 状态管理、Pinia 文档

### 5. 为什么说"过度全局化"是反模式？有哪些信号？
把所有状态塞 store/全局，会带来耦合飙升、测不动、SSR 水合污染。信号：一个组件 import 了五个不相干 store、改一处到处联动、某状态有多个散落写入点。判据是"作用域多大状态放多小"（呼应 vue-project-architecture 第七节、vue-state-patterns）。
**来源**：Vue.js 风格指南 — 状态管理、《Scaling JavaScript》

### 6. 共享但又想保留单向数据流，跨子树怎么传？
优先 props/events；深子树用 provide/inject 且传响应式源、写操作收敛在 provider 的方法里；真正全局业务才上 store。用 InjectionKey 给 inject 建立类型化、Symbol 防 key 冲突（呼应 vue-provide-inject 第三、六节）。
**来源**：Vue.js 官方文档 — provide/inject、InjectionKey

## 三、错误与插件（C 类）

### 7. Vue 应用的错误处理分几层？分别抓什么？
三层：`app.config.errorHandler`（全局，组件渲染/生命周期/监听器未捕获错误统一入口，做上报）；`onErrorCaptured`（父抓子孙，做局部降级 UI，返回 false 停止上抛）；异步/接口错误在 action 或 try/catch 就地处理。路由另有 `router.onError`（chunk 加载失败）。思路等同 Node 的"别让错误静默 + 分层兜底"（呼应 vue-project-architecture 第四节、node-async-errors、exp-patterns）。
**来源**：Vue.js 官方文档 — 错误处理、onErrorCaptured

### 8. 插件（app.use）适合封装什么？和 provide 有何区别？
插件给整个 app 装能力/全局单例（pinia、router、i18n、埋点、全局指令），`install(app)` 里注册。provide 是"某棵子树内的依赖注入"，作用域局部。需要全局就用插件/一次根 provide，需要子树隔离用 provide/inject（呼应 vue-project-architecture 第五节、vue-provide-inject）。
**来源**：Vue.js 官方文档 — 插件、app.use

### 9. 懒加载路由 chunk 加载失败（发版后旧页面点新路由 404）怎么处理？
`router.onError` 捕获动态 import 失败，或给异步组件 `defineAsyncComponent` 的 `onError`/重试。常见做法：检测到 chunk 失败提示刷新或 `location.reload(true)`，配合构建产物带 hash 避免命中旧缓存（呼应 vue-router-guard-lazy 第六节、vue-deploy 的 hash/CDN、10-vite）。
**来源**：Vue Router 文档 — 导航失败、rollup 动态 chunk 加载失败实践

## 四、类型与纪律（D 类）

### 10. 如何把"类型检查"纳入工程流程？它和单元测试是一回事吗？
不是一回事：`vue-tsc`/TS 做的是编译期静态类型检查（不跑代码），Vitest 做的是运行时行为断言。二者互补，都应进 CI（pre-commit / pipeline）。props/emits 用类型声明式宏拿到模板级检查（呼应 vue-project-architecture 第六节、ts-strict、vue-testing）。
**来源**：Vue.js 官方文档 — vue-tsc / 类型检查、TypeScript 手策

### 11. 环境变量与配置在架构里该放哪？为什么不是全局 store？
构建期注入的配置用 `import.meta.env`（Vite，只有 `VITE_` 前缀会暴露到客户端），运行期常量用普通模块导出。它们是"读多写零、跨端固定"的值，塞 store 反而增加无谓响应式与全局耦合（呼应 vue-project-architecture 第五节、node-config、vue-deploy）。
**来源**：Vite 文档 — 环境变量与模式、Node Twelve-Factor 配置外置

### 12. 多人协作时，你用哪些"规范"降低架构腐化？
ESLint + `eslint-plugin-vue`/Prettier、约定式目录与命名（useXxx、feature 自包含）、barrel 出口、类型化组件、错误与日志约定、Commit/分支规范、`vue-tsc` + Vitest 进 CI。规范的价值是让"正确的做法最省事"，而非靠自觉（呼应 ts-project、node-deploy-perf 的工程化）。
**来源**：Vue.js 风格指南（官方 Priority Rules）、eslint-plugin-vue 文档

---

## 补充（新专题 13-15）

### 13. 一个 50+ 页面的后台系统要「架构重组」，你的迁移方法论（不重写）：边界识别、共存策略、推进节奏与止血指标。

边 界 识 别：以 **导 航 树 + 数据 流 向** 画 初 版 feature 候 选（后 台 天 然 按 业 务 对 象 分 层，菜单 就 是 组 织 结构 的 地 图），找 出 共 享 核（鉴 权/布 局/通 用 组件/请 求 封装）；共 存 策 略：新 目 录 结构 与 旧 结构 同 仓 并 存，**功 能 迁 移 以 「改 动 即 迁」为 主**（谁 因 业 务 改 到 哪 个 旧 文 件，谁 就 连 带 迁 入 新 结 构 并 补 测 试，旧 树 只 减 不 加 是 唯 一 铁 律），专 项 大 迁 移 只 做 骨 干（布 局/请 求 层，改 一 处 收 益 全 局）。节 奏：先 立 「约 束」（ESLint 禁 新 代 码 import 旧 深 层 路 径，本关 题 的 止 血 操 作 版）再 谈 「迁 移」；里 程 碑 用 比 例 不 用 日 历（旧 结 构 感 染 率 下 降 曲 线）。止 血 指 标：旧 文 件 新 增 行 数=0（CI diff 规 则 卡）、重 复 代 码 检 测 同 比 下 降、异 常 监 控 里 归 属 清 晰 度（报错 能 定 位 到 feature 而 不 是 utils 垃 圾 场）。战 争 阴 面：架 构 组 装 的 真 正 死 因 是 「双 结构 并存 期 的 认知 负 担」——新 人 不 知 去 哪 写 代 码，README 一 张 「此 处 发 生 了 什 么」地图 与 示 范 feature（第 一 个 完 整 迁 完 的 样 板 间）比 任 何 规 范 文 档 有 效。

**来源**：绞杀者模式（Strangler Fig）在遗留前端迁移中的实践；增量架构演进（parallel run / branch by abstraction）文献。

### 14. "插件 vs 组合式函数 vs provide"三种「封装可复用能力」的架构选型：各自的生命周期与依赖注入语义差异。

本质 对 照：插 件（app.use）= **应 用 级 单 例 + 启 动 装 配 时 间 点**，没 有 实 例 隔离（多 根/多 路 由 实 例 共 用 同 一 份，SSR 跨 请 求 风 险 源，本包 组件 关 全局 注册 题 的 延 续），合 适 全 局 横 切（审 计 上报/权 限 装 配/UI 库 注 册）；组 合 式 函数=**作 用 域 级 + 调 用 时 间 点**，天 然 实 例 隔离 与 可 测（无 全 局 状 态 时），合 适 局 部 复 用；provide=**树 段 级 + 层 级 覆 盖**，实 例 级 上 下 文 设 计（本包 inject 关 组件 库 案 例 的 归 位 端）。三 者 可 以 组 合：库 的 最 佳 形 态=插件 装 配 + provide 传 实 例 化 上 下 文 + 导 出 组合 函 数 消 费 端（Pinia 本 身 就 是 这 个 三 层 结构 的 示 范 品：createPinia 插 件、每 作 用 域 activePinia、useStore 消 费）。选型 误 用 的 修 复 信 号：把 「只 服 务 一 个 模 块」的 能 力 注 进 了 全 局 插件（该 降 为 feature 内 组合 函 数）；相 反 的 「页 面 级 配 置 依 然 全 局 单 例」在 多 标 签 页/多 空 间 需 求 到 来 时 集 体 爆 炸（改 造 代 价 最 高 的 技 术 债 之 一，本关 过 度 全局 化 题 的 收 尾 账）。

**来源**：Pinia 源码的插件/provide 组合结构；库设计（app.use 与实例隔离权衡）社区总结。

### 15. 前端项目的「依赖方向」治理：为什么 utils/shared 会腐烂？用依赖图与准入制度给出替代方案。

腐 烂 机 制：utils 是 **无 主 之 地**——没 有 业 务 所 有 者 就 没 有 删 除 者，所 有 人 往 里 扔（重 复 的 dateFormat 五 个 版 本），且 任何 feature 都 import 它 → 改 一 行 全 仓 重 新 渲染（HMR 与 CI 双 震 惊）；共 享 池 的 健 康 前 提 = 有 主（owner 明确）+ 有 门 槛（进 入 需 求 评 审：两 个 以 上 真 正 消费 者 + 公 开 API 稳 定 承 诺）。替代 方 向：① 「先 feature 内 重 复，三 次 法 则 后 再 提 取」（重 复 远 好 于 错 误 抽 象，本包 组件 关 拆 分 题 的 镜 像 句）；② 分层 禁 向：shared → features 永 不 可 逆（依 赖 图 检 查：dependency-cruiser/ESLint layers 规 则 程 序 化，「简 单 的 分 层 约 束 + 机 器 执 行」胜 过 复 杂 习 惯 手 册）；③ 共 享 组 件 库 单 开 包（甚 至 仓 库）迫 使 版 本 化 与 契 约 存 在；④ 定 期 「迁 出」：utils 里 只 有 一 个 消费 者 的 东 西 回 归 feature（制 度 化 的 新 陈 代 谢，写 进 团 队 季 度 清 单 才 会 真 正 发 生）。

**来源**：dependency-cruiser/ESLint import 分层规则；shared utils 腐化与三次法则的社区共识。
