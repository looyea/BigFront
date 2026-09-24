# ng-arch 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕三层架构、依赖方向纪律、barrel 禁令、Nx monorepo 与 lint 约束的题组。

### 1. (A) 解释 Angular 三层架构 core/shared/features 的依赖方向铁律，给出违反时的后果。

**来源**：转述自本关 §一依赖规则

铁律：features → core/shared（单向）；core ↛ features；shared ↛ core/features；features/A ↛ features/B。违反后果：① 循环 import → 编译失败或运行时 undefined（因为模块还没加载完）；② 主包膨胀（feature 间直接 import 导致懒加载边界失效）；③ 无法独立拆分/复用 feature lib（Nx 迁移成本剧增）。

### 2. (B) 新人写了 `import { UserService } from '../../features/users/users.service'` 在 orders feature 的组件里——你会怎么 code review？

**来源**：转述自本关 §一与 §六 lint 规则

首先 lint 应该直接拦住（@nx/enforce-module-boundaries 或 @angular-eslint）——如果没被拦住说明 lint 配置有漏洞。review 意见：① 如果 UserService 真的跨 feature → 提升到 core/；② 如果只是需要一个用户名字段 → 让 orders 通过自己的 API 获取；③ 绝不允许 feature 横向 import——否则 orders 的懒加载 chunk 里会包含 users 整个模块。加分：展示 lint 报错截图。

### 3. (C) Angular 官方风格指南的 barrel 禁令与 React 社区的 `components/index.ts` 惯例有什么冲突？你站哪边？

**来源**：转述自本关 §五 barrel 禁令

React 社区 barrel 广泛使用因为 webpack/Vite 对 ESM barrel 做了 tree-shaking 优化（Vite 的 rollup treeshake 可穿透 barrel）。Angular 历史上用 Webpack 对 CommonJS barrel tree-shaking 较差——v20 切到 Vite 后改善。但官方仍推荐避免 barrel：① 减少 IDE 自动 import 误导（barrel 让人以为可以 import anything）；② 明确 import 路径利于依赖图分析。我站「窄 barrel 只导出公共 API、feature 内部不 barrel」折中方案。

### 4. (D) 面试官让你设计一个 30 人团队、5 个产品线共享组件库的 Angular 架构——给出目录结构和隔离策略。

**来源**：转述自本关 §六 Nx 形态与 §七依赖图纪律

Nx monorepo：`apps/{product-a, product-b, ...}` + `libs/{core, shared-ui, features/*}`。产品线间不直接 import 彼此 features；共享层放 `libs/shared-ui` 和 `libs/core`（多应用复用）。每个 lib 有 `project.json` 带 tags `["scope:shared", "type:ui"]`。lint 规则约束 `type:app-product-a` 不能 import `type:app-product-b`。构建：`nx affected --target=build` 增量。加分：提到 Nx 的 module boundary 图可视化 + 自动 CODEOWNERS。

### 5. (A) 解释「延迟 feature 边界」的含义——为什么 feature 的 service 不应该出现在 app.config.ts 的 providers 里？

**来源**：转述自本关 §九延迟 import 原则

如果 `providers: [UserService]` 写在 app.config → 主包必须 import UserService → 它的整个 feature 代码链被打进 initial bundle。正确做法：UserService 用 `providedIn: 'root'`（注册到 root injector 但只在首次 inject 时才拉代码）或在 feature 路由的 providers 里声明。配合 loadChildren 懒加载 → feature 代码只在导航时加载。

### 6. (B) 团队发现 dist/main.js 超过 2MB 且 budgets 报错——用架构角度列举三种瘦身策略。

**来源**：转述自本关 §五+§九与 L9 ng-perf 预算知识

① **feature 懒加载**：检查是否所有 features 都用了 loadChildren——没懒加载的 feature 全打在主包里；② **shared 组件 tree-shake**：确认 barrel 没把不需要的组件拉进来；③ **第三方库拆分**：如 echarts/moment 等用 dynamic import 按需加载。加分：提到 `@defer` 可以延迟组件内非首屏块。

### 7. (C) 对比 Angular 的 DI 层级（root/module/component）与 React 的 Context Provider 嵌套：谁更适合大型项目的依赖管理？

**来源**：转述自本关 §一与 L3 ng-di-core 知识

Angular DI 有**内置层级树**——root（单例）→ feature injector（路由级）→ component injector（组件私有）——注入者不需要知道提供方在哪一层。React Context 需要**手动嵌套 Provider**——深层消费要知道 Context 定义在哪——30 人项目 Context 树极易出错。结论：Angular DI 在大型项目有结构性优势（编译期类型 + 层级解耦）；React 靠库（Zustand/jotai）补位。

### 8. (D) 设计一个「组件库团队」的 Angular lib 结构：对外发布 npm 包、内部按组件分目录、支持按需引入——给出 project.json 和 public-api.ts 示例。

**来源**：转述自本关 §六 Nx libs 与 §五窄 barrel

```
libs/design-system/
├── src/
│   ├── lib/
│   │   ├── button/
│   │   ├── modal/
│   │   └── data-table/
│   └── index.ts       ← public-api（只 export 组件类）
├── ng-package.json    ← ng-packagr 配置
└── project.json       ← { "targets": { "build": { "executor": "@nx/angular:package" } } }
```
`index.ts` 只导顶层 API：`export { ButtonComponent } from './lib/button/button.component'`。用户 `import { ButtonComponent } from '@myorg/design-system'` → tree-shaking 只拉需要的。

### 9. (A) 解释 providedIn: 'root' vs providedIn: FeatureModule vs 组件级 providers 三种注册方式对 bundle 的影响。

**来源**：转述自本关 §九 + L3 DI 知识

- `providedIn: 'root'`：Angular 编译器在 tree-shake 时**只有被注入的地方 import 了该 service 的 type token** 才保留代码——不是无条件打进主包。
- `NgModule({ providers: [...] })`：NgModule 被 import 时所有 providers 无条件包含——即使没人用。
- 组件 `providers: [...]`：只有该组件被加载时才包含——天然跟随懒加载 chunk。
最佳实践：feature 私有 service 用 providedIn:'root'（tree-shakeable）或组件级 providers（更严格作用域）。

### 10. (B) 同事把 `AuthService` 从 core 移到了 shared——结果所有 feature 都能 import 它了——为什么这是反模式？

**来源**：转述自本关 §二 core vs §三 shared 定位

shared 层定位是**纯 UI/工具**——不含业务逻辑。AuthService 是业务单例（有 HTTP 调用、token 管理、用户状态）→ 应留在 core。如果放 shared → shared 变成「什么都有」的垃圾堆 → 分层意义消失 → 新人不知道放哪。反模式：shared 里有 service 意味着它其实是 core 或 feature 的职责。

### 11. (D) 面试官让你解释「为什么 features 之间不能直接 import，但可以通过事件总线/路由参数间接通信」——给一个实际场景和两种方案对比。

**来源**：转述自本关 §一与 §六 循环依赖处理

场景：orders feature 完成下单后需要 users feature 刷新积分。方案 A（❌ 直接 import）：orders inject UserStore → 编译过但违反依赖规则。方案 B（✅ 事件总线）：orders dispatch `OrderCompleted` → users 监听并更新积分。方案 C（✅ 共享 store）：`core/points.service.ts` 被两者 inject。推荐 C——显式数据流 + 单一真相源。加分：提到 Angular EventEmitter / RxJS Subject / NgRx action 三种事件机制。

### 12. (A) 在 v17+ standalone 组件时代，NgModule 还剩什么用？对架构分层有什么影响？

**来源**：转述自本关 §九与 L1 ng-first-app standalone 知识

NgModule 剩余用途：① 第三方库（老组件库）仍以 NgModule 发布——用 `importProvidersFrom()` 桥接；② StoreModule.forRoot/forFeature（NgRx）；③ 极少数需要 module 级 providers 隔离。对分层影响：以前每个 feature 有 UsersModule 做隔离边界；现在边界由**目录 + lint 规则**定义（更灵活但更需纪律）。

### 13. (C) Angular 架构里 feature 的入口是路由配置而非 Module 声明——这和 Vue/Nuxt 的 pages/ 目录约定有什么本质异同？

**来源**：转述自本关 §四 feature 入口与 §十对照 Nuxt/SvelteKit

同：都以「路由」为 feature 的天然边界——路由不到 = 代码不加载。异：Angular 的 Routes 数组是手动配置——灵活但需要人保证路由与目录对应；Nuxt 的 `pages/` 文件系统即路由——约定强但灵活度低（动态路由靠文件名）。Angular 的优势：一个 feature 可以有多条路由入口、auxiliary routes；Nuxt 一个文件只能是一条路径。

### 14. (B) 项目从 NgModule 单体迁移到 standalone + 三层架构——列出迁移步骤和风险点。

**来源**：转述自本关 §九+§十二与 L1/L2 standalone 知识

步骤：① `ng generate @angular/core:standalone`（自动迁移脚本）逐级（bootstrap → standalone components → remove NgModules）；② 拆分 SharedModule → 把声明的组件/管道变 standalone + exports 处改为直接 import；③ 每个 feature 加 routes.ts 配 loadChildren；④ 配置 @angular-eslint 边界规则。风险：第三方库仍是 NgModule（需 importProvidersFrom）；迁移中间态混合 NgModule 和 standalone 容易混乱。

### 15. (D) 面试官问「20 人团队 3 条产品线共享组件库——你会选 Nx 还是 Turborepo？Angular 生态下哪个更成熟？」

**来源**：转述自本关 §六 Nx 生态

在 Angular 生态 Nx 更成熟：① 深度集成 Angular CLI（ng add @nrwl/nx）；② 内置 @nx/angular:ngrx/@nx/angular:library generator；③ enforce-module-boundaries 是 Angular 社区事实标准；④ Nx Cloud 提供分布式缓存与 affected 构建。Turborepo 对 Angular 无专属插件——通用 monorepo runner。结论：Angular 圈选 Nx 几乎没有争议；跨 JS 全栈（Next + Angular）可选 Turborepo 或 Nx（两者都能跑任何 JS 项目）。
