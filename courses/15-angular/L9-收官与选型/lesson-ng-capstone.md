# ng-capstone：毕业项目与进阶路线——全栈后台一次走完

> 目标：用本包技术栈独立实现带登录守卫、CRUD、表单、状态、SSR 的管理后台（对照 14 包 sig-capstone 的记分卡纪律做四框架版终战）；自查清单 27 关；进阶方向：NgRx 深水区、编译器/internals（13 包式深挖）、17 测试专题包与 18 网络专题包的衔接点预告（呼应 ng-capstone 定位、sig-roadmap）

## 一、毕业项目需求清单

用 **Angular v22 + standalone + signals + zoneless + Signal Forms + SSR** 实现一个管理后台：

### 功能需求
1. **登录页**：Reactive Forms / Signal Forms + authGuard + JWT（HttpHeaders 拦截器注入 token）
2. **Dashboard**：路由懒加载 + 图表（@defer on idle）+ 数据 resolver
3. **用户 CRUD**：列表分页 + 新建/编辑表单 + 删除确认（CanDeactivate）
4. **权限系统**：角色守卫（CanMatch）+ 侧边栏菜单 signal store 驱动
5. **主题切换**：signal store + localStorage 持久化 + CSS 变量
6. **SSR**：@angular/ssr + TransferState + 增量 hydration

### 技术要求
- 三层架构：core/shared/features
- budgets 门禁：initial < 500KB
- 单元测试覆盖 core services + shared pipes
- E2E 覆盖登录→CRUD→登出主流程
- 无 NgRx（验证 signal store 够用）

## 二、自查清单（27 关对应）

| 关卡 | 检查点 | 完成 |
|------|--------|------|
| ng-landscape | 能说清 Angular 四次大改版解决了什么问题 | ☐ |
| ng-first-app | bootstrapApplication + app.config providers + standalone 骨架 | ☐ |
| ng-version-map | 看 package.json 版本号秒判哪些 API 可用 | ☐ |
| ng-templates | @if/@for/@switch + 四种绑定 + @let | ☐ |
| ng-comp-signals | input()/output()/model()/viewChild() 函数式 API | ☐ |
| ng-directives | 自定义结构指令 + host 绑定 + track 策略 | ☐ |
| ng-di-core | 四种 provider + InjectionToken + injector 层级 | ☐ |
| ng-services | signal store 三件套 + 服务粒度 | ☐ |
| ng-inject | inject 上下文限制 + 构造器 DI vs inject() | ☐ |
| ng-signals | signal/computed/effect/untracked/patch 全 API | ☐ |
| ng-rx-bridge | toSignal/toObservable + 何时保留 RxJS | ☐ |
| ng-zoneless | zoneless 原理 + markForCheck 兜底 + effect 调度 | ☐ |
| ng-forms | FormBuilder typed + 异步校验 + FormArray | ☐ |
| ng-signal-forms | form(model) API + 与 Reactive Forms 对比 | ☐ |
| ng-http | provideHttpClient + 函数式拦截器 + retry/timeout | ☐ |
| ng-router-core | Routes 树 + 懒加载 + 重定向 + 通配 | ☐ |
| ng-router-guards | CanMatch/CanActivate/CanDeactivate + sig-auth 实现 | ☐ |
| ng-router-data | ResolveFn + input binding + TransferState + 滚动 | ☐ |
| ng-state-services | signal store 封装 + 持久化 + 何时上 NgRx | ☐ |
| ng-ngrx | 五件套概念 + @ngrx/signals + 选型判据 | ☐ |
| ng-arch | 三层目录 + 依赖方向 + barrel 禁令 + Nx | ☐ |
| ng-ssr | 增量 hydration + DI 隔离 + prerender | ☐ |
| ng-testing | Vitest + TestBed + signal store 纯测 + E2E 分工 | ☐ |
| ng-lib-ui | Material/CDK + 样式封装 + Web Components 集成 | ☐ |
| ng-perf | budgets + @defer + zoneless 性能面 + DevTools | ☐ |
| ng-compare | 四框架对照表 + 选型三轴 + 收官判词 | ☐ |
| ng-capstone | 本自查清单全勾 = 通过 | ☐ |

## 三、项目骨架推荐结构

```
src/
├── app/
│   ├── core/
│   │   ├── auth/          (AuthService + authGuard + authInterceptor)
│   │   ├── theme/         (ThemeStore)
│   │   └── http/          (通用 error interceptor)
│   ├── shared/
│   │   ├── components/    (PageHeader, ConfirmDialog, SkeletonLoader)
│   │   ├── pipes/         (FileSize, RelativeTime)
│   │   └── models/        (ApiResponse<T>, Page<T>)
│   ├── features/
│   │   ├── auth/          (LoginComponent)
│   │   ├── dashboard/     (DashboardComponent + Charts @defer)
│   │   ├── users/         (UserList, UserDetail, UserForm, users.routes)
│   │   └── settings/      (ThemeSwitch, ProfileForm)
│   ├── app.routes.ts
│   ├── app.config.ts
│   └── app.component.ts
├── main.ts
├── main.server.ts
└── server.ts
```

## 四、进阶路线图

| 方向 | 内容 | 衔接包 |
|------|------|--------|
| NgRx 深水区 | Store/Effect 高级模式、Entity、Data | 本课 §ng-ngrx 延伸 |
| 编译器/Internals | Ivy → Signal-based reactivity 编译器、Template DSL | 13 包式深挖 |
| 测试专题 | 高级 TestBed 模式、Component Harness、Vitest 插件 | 17 测试包 |
| 网络/性能 | HTTP 缓存策略、Service Worker、PWA、Core Web Vitals | 18 网络包 |
| 全栈 | @angular/ssr + Nest BFF + Nx monorepo | 12 包（SvelteKit 对照） |
| 设计系统 | CDK 造组件库、a11y、主题架构 | 本课 §ng-lib-ui 延伸 |

## 五、与 14 包 sig-capstone 的对照

14 包毕业项目用 vanilla signals + RxJS + DI 手写；本包毕业项目用 Angular 全家桶完成**相同需求**——验证「框架给你什么 vs 你给框架什么」。两者需求一致确保知识可迁移。

记分卡：
- 功能完整度 40%
- 代码质量（架构/命名/lint 通过）30%
- 性能（budgets 达标/Lighthouse > 90）15%
- 测试覆盖（单元 > 80%、主流程 E2E 通）15%
