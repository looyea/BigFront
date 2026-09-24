# ng-capstone 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕毕业项目综合应用、自查清单与进阶路线的题组。

### 1. (D) 毕业项目核心要求：用 authGuard + HttpInterceptor + signal store 实现完整的登录→保护路由→登出流程。口述完整链路。

**来源**：转述自本关 §一功能需求 + §二自查清单

链路：① 用户提交登录表单 → HttpClient POST /api/login → 成功 → AuthService._user.set(data) + localStorage 存 JWT → router.navigate(returnUrl)；② 受保护路由 canActivate: [authGuard] → authGuard inject AuthService → isLoggedIn() signal → true 放行；③ 每次 HTTP 请求经过 authInterceptor（函数式）→ inject AuthService → 从 _user() 拿 token → clone 请求加 Authorization: Bearer xxx；④ 登出：AuthService.logout() → _user.set(null) + localStorage.removeItem → router.navigate('/login')；⑤ 其他标签页：storage event → signal 同步 → authGuard 下次导航拦截。

### 2. (B) 毕业项目 SSR 部署后发现：登录状态 A 用户看到了 B 用户的数据——怎么排查？

**来源**：转述自本关 §三防泄漏 + L8 ng-ssr §五 DI 隔离

根因：provideServerRendering 未正确配置 → 所有请求共享同一 root injector → signal store 跨请求泄漏。排查：① 确认 app.config.server.ts 有 provideServerRendering()；② 确认 AuthService 是 providedIn:'root'（per-request injector）；③ 检查是否有模块级变量在 service 外面。修复：把 server config 用 mergeApplicationConfig 合入。

### 3. (A) 毕业项目为什么要求「无 NgRx」——signal store 在什么场景下确实不够用？

**来源**：转述自本关 §一技术要求 + §二自查清单 ng-ngrx 行

要求目的：验证 80% 场景 signal store 足够——避免「学了 NgRx 什么项目都上」的惯性。确实不够的场景：① 需要时间旅行调试（复杂状态流出问题要回放）；② 乐观更新 + 自动回滚中间件；③ 多团队共享同一份 state 且需要强约束 action 协议。毕业项目是单人/小团队 CRUD 后台——三条都不触发。

### 4. (D) 毕业项目三层架构设计：画出 core/shared/features 的文件树（至少到第二层目录），标注每个文件的职责。

**来源**：转述自本关 §三项目骨架

见本关 §三推荐结构——核心原则：core 放跨 feature 单例（AuthService/ThemeStore/guards/interceptors）；shared 放可复用 UI（按钮/表格/管道/模型）；features 各自治（私有 service + routes + components）。依赖方向：features → core/shared，禁止横向。

### 5. (C) 毕业项目与 14 包 sig-capstone 的毕业项目需求相同但技术栈不同——对比两者实现的核心差异。

**来源**：转述自本关 §五与 14 包 sig-capstone 对照

- **14 包**（vanilla signals + RxJS + 手写 DI）：状态管理手写 store 类、路由用自定义 hash router 或 page.js、表单手写、HTTP 用原生 fetch 手写 wrapper。
- **15 包**（Angular 全家桶）：service + signal、provideRouter 内置、Reactive Forms / Signal Forms、HttpClient + 拦截器。
结论：14 包让你理解底层原理、15 包让你体验框架如何抽象这些原理。两者知识 1:1 映射。

### 6. (B) 毕业项目 budgets 报错 initial > 500KB——列举三条优化手段。

**来源**：转述自本关 §四技术要求 + L9 ng-perf §五优化清单

① 检查是否所有 feature 都做了 loadChildren——漏配的 feature 打在主包里；② 第三方重库（如 ECharts/Moment）改为按需引入或 @defer；③ shared 组件确认 barrel 没拉整个模块——直接 import 单文件。验证：`ng build --prod --source-map` → Bundle Analyzer 可视化。

### 7. (A) 毕业项目里 @for track 的正确实践：为什么要求所有 @for 必须有稳定 track 表达式？

**来源**：转述自本关 §二自查清单 ng-directives/ng-templates 行

Angular v17+ @for **强制**写 track 表达式（编译报错否则）。要求稳定 track（如 item.id）的原因：① 性能——DOM 复用；② 正确性——index track 在列表增删时绑定的表单控件/焦点/动画错位。毕业项目每个列表必须 track by 后端返回的唯一 id。

### 8. (D) 面试官让你现场给「带权限的 CRUD」设计完整 Angular 技术方案（5 分钟白板）——你怎么组织？

**来源**：转述自本关 §一~§三综合

白板结构：① 路由层：懒加载 + canMatch(roleGuard) 保护 admin 路由；② 服务层：CrudService（signal store + HttpClient + 分页）；③ 组件层：ListComponent (@for + track) + FormComponent (Signal Forms) + DetailComponent；④ 拦截器：authInterceptor（Bearer token）+ errorInterceptor（401 → logout）；⑤ 模板：@if 控制按钮可见性（hasPermission signal）。五层从 URL 到 DOM 一条线。

### 9. (C) 毕业项目做完后进阶方向：什么时候该深挖 NgRx / 编译器 / 测试 / 全栈？

**来源**：转述自本关 §四进阶路线图

- **NgRx 深水区**：加入有 30+ 人团队的企业 Angular 项目 / 维护已有 NgRx 代码库。
- **编译器/Internals**：想做框架贡献 / 造 DSL / 深度性能优化。对标 13 包式深挖。
- **测试专题（17 包）**：QA 文化重的团队 / 做组件库需要全面测试基座。
- **网络/PWA/ServiceWorker（18 包）**：离线优先应用 / CDN 边缘部署 / 极致性能。
- **Nx monorepo + Nest BFF**：全栈 TypeScript 组织。

### 10. (B) 毕业项目 E2E 主流程测试中 Playwright 跑过但 CI 环境失败——常见原因？

**来源**：转述自本关 §三骨架与 §四记分卡

① CI 没装 Playwright 浏览器（`npx playwright install --with-deps`）；② SSR 服务启动延时——测试在 server listen 前就跑 → CI 需加 `timeout` 等 port ready；③ 环境变量差异（localStorage 在 CI headless 有时序差异）；④ 数据库 mock 不一致——本地用了 seeded 数据、CI 的 mock server 没配。

### 11. (A) 毕业项目中 HttpInterceptorFn 的链式执行语义是什么？多个拦截器之间如何交互？

**来源**：转述自本关 §一+L5 ng-http 知识

`withInterceptors([a, b, c])` → 请求链：a → b → c → Backend → c → b → a → 组件。每个 interceptor 接 `(req, next)`——调 `next(req)` 传下去、不调就短路（不发请求）。可以在传下去前 clone 改 req（加 header）、在 next() 返回后改 res。注意：拦截器执行顺序是**数组顺序**——auth 在 logging 前加 token。

### 12. (D) 设计一个「四框架版本」的毕业项目对比实验：同一需求用 Angular/Vue/React/Svelte 各实现一遍——你怎么控制变量？

**来源**：转述自本关 §五对照与全课程知识

控制变量：① 功能清单完全相同（登录+CRUD+守卫+SSR+主题）；② 不用各自的全家桶（只允许 router + state + HTTP 三类能力）；③ 记录代码行数/配置文件数/第三方依赖数；④ 记录开发时间/首次 build 时间/budgets 对比；⑤ 部署环境相同。结论维度：起步速度、代码量、性能、可维护性。

### 13. (B) 毕业项目 Lighthouse 报告 Accessibility 只有 75 分——列举三个 Angular 特有的修复点。

**来源**：转述自本关 §三骨架与 CDK a11y 知识

① 所有 @for 列表的交互元素需要 **aria-label 或可见文字**（Angular 模板里 `aria-label="删除"`）；② Material 组件缺 `aria-describedby` 关联错误提示 → 用 `ariaControlsFor`（CDK）；③ 路由切换焦点不转移 → 用 CDK A11y 的 `FocusTrap` + 导航完成后 `Element.focus()` on 新页面标题。

### 14. (A) 毕业项目为什么用 CanMatch + loadChildren 组合而不是直接 canActivate？从 bundle 角度解释。

**来源**：转述自本关 §一权限需求 + L6 guards §三 CanMatch

CanActivate = 先下载 chunk → 再拒绝 → chunk 被浪费在用户网络缓存里但从不使用。CanMatch = **先判断 → 不匹配就不下载** → 非管理员用户的浏览器完全不接收 admin chunk。效果：① 减小用户实际下载量；② 隐藏管理功能存在性（network 面板看不到 admin.js → 一定安全加分）。

### 15. (D) 终题：27 关学完后你对「框架选型」的认知发生了什么变化？给一个五句话以内的框架选型方法论。

**来源**：转述自本关 §四进阶路线 + §ng-compare 收官判词综合

方法论五句：① **团队规模和寿命决定约定强度**（20 人 10 年 → Angular，5 人 2 年 MVP → React/Vue）；② **性能需求决定编译深度**（极致首屏 → Svelte/Solid，够用 → 其他三家）；③ **生态决定拼装成本**（需要特殊库如数据可视化 → React 生态最大）；④ **全栈/SSR 需求看官方方案成熟度**（Next/Nuxt/Angular SSR/SvelteKit 各自最熟）；⑤ **没有最好的框架只有最匹配的项目**——四把尺子量一遍新框架就够。
