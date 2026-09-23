# vue-project-architecture 面试题精选

> 共 12 题，覆盖 A 目录与分层 / B 逻辑复用与状态 / C 错误与插件 / D 类型与纪律类。

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
