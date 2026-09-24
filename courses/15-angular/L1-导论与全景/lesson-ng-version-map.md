# ng-version-map：版本演进地图——17→22 该信哪份教程

> 目标：拿到一张六行大表，每行钉住一个版本的『改了什么 / 废了什么 / 默认值变了什么』；学完能 30 秒内判断一份代码/教程属于哪个年代；本包以 v22（2026.06）为事实底（呼应 ng-landscape 四次改版、ng-first-app 版本探针）

## 一、为什么版本地图是 Angular 的『生存技能』而不是『历史课』

React 的 API 七年没大改（useState 从 2019 到今天一样写）；Vue 3 兼容性做了 Composition API 渐进；Svelte 5 runes 是唯一的 breaking 节点。Angular 不同——**v17 那次默认栈 overhaul 让 2023.11 前后的教程事实上互不兼容**：组织单位（NgModule vs standalone）、控制流（*ngIf vs @if）、启动方式（bootstrapModule vs bootstrapApplication）、拦截器（class vs function）、变更检测（zone vs zoneless）——五处默认值同时翻转。所以学 Angular 的第一课不是写 Hello World，而是学会『打开一份代码先判断年代』——这就是版本探针。

## 二、六版本大表（v17→v22，每年两版取偶数主发布）

| 版本 | 发布 | 核心新增 | 默认值翻转 | 废/降级 |
|------|------|----------|-----------|---------|
| **v17** | 2023.11 | @if/@for/@switch 新控制流；defer 块；路由新语法（`loadComponent` 替代 `loadChildren`+`import()`）；`provideRouter()` | 新 CLI 生成 standalone 工程；signal 实验（`signal()`/`computed()`/`effect()`） | NgModule 不再是默认推荐（仍可 import） |
| **v18** | 2024.06 | `input()`/`output()`/`model()` 函数式组件 API 预览；`viewChild()`/`contentChild()` 查询函数；zoneless 预览（`provideZonelessChangeDetection()`）；inject() 在更多上下文合法 | signal 标记 **stable**；`@angular/core/rxjs-interop`（toSignal/toObservable）转正 | 旧 `@Input/@Output` 装饰器仍可用但不再是文档首选 |
| **v19** | 2024.11 | **组件默认 standalone**（可省 `standalone: true` flag）；增量 hydration（`@defer`+`provideClientHydration()` 默认开）；TestBed 换代（standalone 组件测试无需 declarations） | 新工程 `standalone` 不再出现在脚手架代码里 | `NgModule` 标记维护态（不删但不给新特性） |
| **v20** | 2025.05 | **`@angular/build`（Vite 内核）成为默认 builder**；signals 组合稳定收尾（`patch()`/`untracked()`/`@if` signal 自动订阅）；SSR 引擎 `@angular/ssr` v20 重写；路由 `withComponentInputBinding()` 文档主推 | zoneless **实验**（`provideZonelessChangeDetection` 进稳定 API 面）；CLI 命令简化（ng update 能跨版本自动迁） | Webpack builder 降级为兼容层（仍可用，不再获新特性） |
| **v21** | 2025.11 | **zoneless 成为新工程默认**（不写任何 zone provider）；**Vitest 替换 Karma** 成 `ng test` 默认运行器；Signal Forms 预览（`form()`/`formField()`） | `ng new` 产物：无 zone.js polyfill、无 Karma 配置、无 `standalone: true` 行 | Karma/Jasmine 旧配置不再出现在脚手架（存量工程仍可用） |
| **v22** | 2026.06 | **Signal Forms 转正**（`form()` 成 stable API）；`@defer` 触发器扩展；编译器对 `@for` track 的自动推断优化 | 新工程默认带 `@if/@for` 而非 `*ngIf` 的模板 codemod 已跑过——教程里再看到 `*ngIf` 就是旧年代的标志 | AngularJS 升级桥（`@angular/upgrade`）正式冻结 |

## 三、五枚版本探针速查（30 秒判断年代）

拿到一份代码/教程，按顺序扫这五处——全中就是 v17+，有旧就是旧教程：

| 探针 | v17 前（2023.11 之前） | v17-20（过渡期） | v21+（新默认） |
|------|----------------------|-----------------|---------------|
| 启动方式 | `platformBrowserDynamic().bootstrapModule(AppModule)` | `bootstrapApplication(App, appConfig)` | 同左 |
| 组织单位 | `@NgModule({declarations,imports})` | 混用：standalone 组件 + 残留 NgModule | 纯 standalone，`NgModule` 不出现 |
| 模板控制流 | `*ngIf`/`*ngFor`/`ng-template` | `@if`/`@for` 新语法共存 `*ngIf` | 只有 `@if`/`@for`/`@switch`/`@defer` |
| 拦截器 | `class AuthInterceptor implements HttpInterceptor` + `HTTP_INTERCEPTORS` | `withInterceptors([fn])`（v15+函数式） | 函数式唯一路径 |
| zone provider | `import 'zone.js'` in polyfills + `provideZoneChangeDetection()` | 手动选装 `provideZonelessChangeDetection()` | **什么都不写**（zoneless 即默认） |

附加探针：`HttpClientModule`（NgModule 时代注册 HTTP）→ v17+ 改用 `provideHttpClient()`；组件类名 `AppComponent`（旧 CLI）→ v20+ 简化为 `App`。

## 四、『该信哪份教程』决策树

```
教程发布时间 ≥ 2024-01？
├─ 是 → 大概率 v17+，但还要看是否覆盖 v18 signals / v21 zoneless 等新默认
│       ├─ 文中出现 signal()/computed() 且说"实验阶段" → 2024 上半年写的，当时 v17/v18 交界
│       ├─ 文中说 zoneless 是默认 → 2025.11 之后
│       └─ 文中用 form() / signalInput → v22（2026.06）之后最新
└─ 否 → 先查是否有 NgModule / *ngIf / HttpClientModule / class 拦截器
        → 命中任何一个 = 旧栈教程，学概念可以，抄代码不行
```

**唯一可靠事实底**：angular.dev（新版官方文档站，2024 上线替换 angular.io 旧路径部分）+ 各版本 CHANGELOG + RFC 仓库——第三方博客/视频/书籍都有『发布即过时』的风险。本包所有事实底以 angular.dev v22 为准。

## 五、版本节奏与 ng update：为什么『逐级升』是铁律

Angular 版本节奏：**每年 2 个主版本（5 月/11 月），每主版本 6 个月 Major 支持 + 12 个月 LTS**。v17→v22 = 三年六个大版本——ng update 保证**相邻两个大版本**的自动迁移（v20→v21 可以、v17→v21 需逐级 v17→v18→v19→v20→v21）。为什么不能跳级？因为每个大版本都有独立的 schematics 迁移集（v17 做 control-flow codemod、v19 做 standalone 默认翻转、v21 做 zoneless 切默认），跳过一步=后一步的 codemod 假设不成立。实战建议：**永远不超过最新版本一个大版本**——留一个版本的 LTS 缓冲。

## 六、本包各关的版本锚点速查

| 关 | 主要版本锚点 |
|----|-------------|
| L2 组件与模板 | @if/@for（v17）、input()/output()（v18 stable v19+）、viewChild()（v18） |
| L3 DI | inject()（v14 起但 v18 扩边界）、standalone providers（v17） |
| L4 signals 与 zoneless | signal/computed/effect（v17 实验→v18 stable→v20 收尾）、zoneless（v18 预览→v21 默认） |
| L5 表单 | Reactive Forms（v2+）、Signal Forms（v21 预览→v22 stable）、函数式拦截器（v15） |
| L6 路由 | provideRouter/withX（v16）、FunctionalGuard（v15）、withComponentInputBinding（v16） |
| L7 状态 | signal store 模式（v17+ 自然产物）、NgRx（独立库版本另计） |
| L8 工程 | @angular/ssr v20 重写、Vitest 默认 v21、增量 hydration v19 |
| L9 性能/选型 | @defer v17、budgets v2+ 但 @angular/build 改变产物结构 v20 |

> 🚀 下一站：L2 正式进入组件与模板——从 @if/@for 新语法开始把『旧星号』彻底赶出你的肌肉记忆。三关走完后你写出的 Angular 组件和 v22 官方模板一字不差。
