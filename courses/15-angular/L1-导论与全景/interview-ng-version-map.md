# ng-version-map 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Angular v17→v22 版本演进、默认栈翻转与年代判定的题组。

### 1. (A) v17 被称为『默认栈 overhaul』——它翻转了哪五处默认值？为什么选在同一次发布集中翻转？

**来源**：转述自本关 §二大表 v17 行与 §一『五处默认值同时翻转』论

五处：① 新工程从 NgModule 改为 standalone 默认；② 模板控制流从 *ngIf/*ngFor 改为 @if/@for（编译器新增语法糖）；③ 路由注册从 NgModule 的 imports: [RouterModule.forRoot()] 改为 app.config providers 里的 provideRouter()；④ HTTP 从 HttpClientModule 改为 provideHttpClient()；⑤ signal API 引入（实验级但写进核心包）。选同一版本集中翻转的动机：Angular 团队的 RFC 分析发现用户迁移最痛苦的不是『单个 API 破坏』而是『多个独立破坏的排列组合』——如果分三个版本做，用户要经历三次 breaking、迁移代码写三遍；一次全翻，配合 codemod 一把跑完——代价集中但总成本最低。

### 2. (A) zoneless 变更检测为什么需要 signals 作为地基？没有 signals 能不能直接去掉 zone.js？

**来源**：转述自本关 §二 v18-v21 行的演进链与 §五版本节奏（机制预告 L4 详展）

zone.js 的核心价值是**拦截所有异步 API**（setTimeout/Promise.then/fetch 回调/DOM 事件），在异步完成时通知 Angular『该跑一轮脏检查了』。没有 zone 意味着必须有一个**替代通知机制**——signals 正好提供：signal 值变化→订阅者（模板绑定本身就是订阅者）精确重算，不需要『全局脏检查整棵树』。如果只有 zoneless 没有 signals，就得手动 markForCheck() 标注每一处需要刷新的组件——比 zone 更累；所以 v17 先出 signals（实验）、v18 转 stable、v21 才切 zoneless 默认——中间隔了四个版本让 signals 覆盖所有变更通知场景。一句话：**signals 是因，zoneless 是果；先建通知通道、再关掉旧广播**。

### 3. (B) 新人从 GitHub 找了个 Angular 项目当学习参考，发现 package.json 写 angular 16、模板里有 standalone: true 但也出现 @if 语法——这正常吗？怎么读？

**来源**：转述自本关 §三探针表与 §四决策树（现实中的过渡期代码）

正常。v16 时 standalone 已从 v14 实验转正（v14 引入 v15 stable v16 文档主推）所以写 standalone: true 合法；@if/@for 在 v16 后期（v16.2）以 developer preview 形式存在——少数激进项目会提前使用。读法：① package.json 的 @angular/core 版本号是硬事实——v16；② @if 出现说明作者关注了 RFC 并提前试水——代码能编译但可能缺少完整类型推断（preview 期的 @if 在 v17 正式版才完全支持 strictTemplates）；③ 结论：这是一份 v16 尾期+前瞻语法的混合工程，学概念可以但**编译行为与 v17 正式版有微妙差异**——建议找 v18+ 项目当基准。

### 4. (C) Vue 3 也经历过 Options API→Composition API 的迁移，与 Angular 的 NgModule→standalone 迁移对比：两种迁移的『共存策略』有什么根本不同？

**来源**：转述自本关 §一改版对比段与 §五 ng update 逐级策略（呼应 vue-composition-api）

Vue 3：**一个运行时内同时支持两套 API**——Options 组件和 Composition 组件可以混用、互相嵌套、共享响应式系统，迁移是纯 API 风格选择（无组织单位切换）；Angular：**两套组织单位需要桥**——NgModule 编译单元 vs standalone 编译单元在 DI 树/模板编译器上有结构差异，共存需要 importProvidersFrom() 把 NgModule 的 providers 桥到 standalone 世界，且一个组件只能选一种身份。结果：Vue 迁移可以单文件内局部改写、Angular 迁移是**改文件的组织归属**（从哪个 Module 的 declarations 里搬到独立文件）——粒度与影响面完全不同。

### 5. (D) 面试官给你看一份简历上写『精通 Angular 全版本』的候选人代码，要求你出三个判断点验证他是否真的了解 v17+ 变化——出哪三个？

**来源**：转述自本关 §三探针表的面试化应用

探针三点：① **启动方式**——让他现场写一个最小 standalone 组件并说出 app.config.ts 里需要哪些 provider（不知道 provideRouter 而说 RouterModule 的就是 v16 前经验）；② **变更检测**——问『v21 新工程里为什么 app.config.ts 没有 provideZoneChangeDetection 这一行』——答不出 zoneless 默认的就是没跟到 v21；③ **模板语法**——给一段 *ngIf + ng-template 的旧写法让他 5 分钟改成 @if + @else，看是否知道 @for 自带 empty 块与 track 语义（@for 的 track 是 Angular 与 Vue/React 最大的控制流差异点）。三关全通=至少跟到 v17；过前两关=v21 经验确认。

### 6. (A) @angular/build（v20 默认）基于 Vite，但 Angular 的模板编译器（Angular Compiler）和 Vite 的插件系统怎么集成？为什么不是直接用 vite-plugin-angular？

**来源**：转述自本关 §二 v20 行构建变化与 10-vite 包的 Vite 插件系统（呼应 vite-first-look）

@angular/build 内部是一个**定制 Vite 插件集**（不叫 vite-plugin-angular 但本质如此）：核心职责是在 Vite 的 transform 阶段调用 Angular 模板编译器把 .html 编译成 renderComponent 函数、把 component 装饰器元数据转成 Ivy 指令定义。为什么不单独发布？因为 Angular 的编译器与框架版本**强耦合**（模板编译产物是 Ivy 内部 IR，随编译器版本变）——拆成外部 npm 包会出现版本矩阵地狱（用户装 vite-plugin-angular@X 但 angular@Y 不兼容）。官方策略：编译器**内置在 @angular/build** 里，版本与 @angular/core 在同一个 release train——全家桶哲学在构建层的体现。

### 7. (B) 你的团队从 v18 升级到 v21 后，ng test 突然不跑了——报 'Karma config not found'。给 2 分钟修复步骤与长期策略。

**来源**：转述自本关 §二 v21 行 Vitest 替换 Karma 的实战后果

修复：① ng update @angular/core@21 @angular/cli@21 后跑 `ng generate @angular/core:zoneless` 和测试迁移 schematics（自动改 angular.json 的 test target 为 vitest builder）；② 删除 karma.conf.js 与 src/test.ts（旧入口），Vitest 配置走 vite.config.ts 的 test 字段或 angular.json 的 options 段；③ package.json scripts.test 从 ng test 保持不变（CLI 内部已走 Vitest）。长期策略：ng update 的 `--collections=@angular/core:migrations` 会包含 test 迁移，但**自定义 karma plugin 不会被自动搬**——升级前先清点 karma 自定义配置、找到 Vitest 等价物，否则 v21 后那些 reporter/plugin 全失效。

### 8. (C) Signal Forms（v22 stable）与 React Hook Form + Zod、Vue 的 vee-validate 对比：三者在『表单状态是 reactive 的还是 controlled 的』这条轴上各自站哪里？

**来源**：转述自本关 §二 v22 行与 14 包 za-forms、vue-forms-validation 的对照（呼应 react-forms）

三站：① **Angular Signal Forms**——表单状态就是 signal（`form()` 返回的是 signal 对象，字段值/dirty/errors 全可 computed 派生），是**响应式受控**：框架知道每个字段的当前值，变更通过 signal 通知——与 zoneless 变更检测天然对齐；② **React Hook Form**——uncontrolled 为主（ref 持有 DOM 值、不触发重渲染），校验靠 Zod schema 外挂——选择 uncontrolled 是为了避开 React 的重渲染税；③ **Vue vee-validate**——controlled（v-model 双向绑定，每次输入触发响应式更新），但 Vue 的响应式比 React 重渲染便宜得多所以 controlled 不痛。一句话：**表单架构选择是框架响应式模型的投影**——三种框架各给了不同约束，Signal Forms 的 controlled+精确通知是三者里理论最优（DOM 写入最少+类型检查最严）。

### 9. (A) v18 引入 input()/output() 函数式组件 API——它与旧 @Input/@Output 装饰器在**类型推断**上有什么具体优势？

**来源**：转述自本关 §二 v18 行与 L2 ng-comp-signals 的预告

三处优势：① **required 语义进类型系统**——`input.required<string>()` 让使用方不传这个 prop 时模板编译直接报错（@Input 的 required 需要额外 lint 规则才能检查）；② **泛型自动推导**——`output<User>()` 让 `.emit(user)` 的参数类型自动约束，旧 @Output 配 EventEmitter<User> 多一层间接；③ **model() 双向绑定合成一对一类型**——`model<string>()` 同时生成 input 和 output 两端、类型同步；旧写法要写 @Input() val: string 加 @Output() valChange = new EventEmitter<string>() 两处类型手保持——漏改一处就 type gap。加分句：函数式 API 本质是把 Angular 组件的输入输出面从『运行时反射读取装饰器元数据』变成『编译时可见的 TS 类型』——strictTemplates 能检查更多。

### 10. (D) 你负责制定团队的『Angular 版本跟进策略』：公司有两百个 Angular 工程（从 v12 到 v19 不等），要求三年内全部升到 v22+ 并保持滚动——给三阶段路线图。

**来源**：转述自本关 §五版本节奏与 ng update 逐级规则的规模化应用

三阶段：① **存量清理（6 个月）**：v12-14 的工程先判死活——不再迭代的标 EOL 冻结、不升；活跃的先 ng update 到 v16（这一步解决 AOT 默认化、ViewEncapsulation 变更等老债）；② **桥接期（12 个月）**：所有工程统一 ng update v16→v17（standalone 桥+control-flow codemod 必做）→v18（signals+inject）→v19（standalone 默认）——每步独立 PR、跑全量测试；v12-14 里重度 NgModule 的『祖传』工程这阶段做 NgModule→standalone 拆迁（按 feature 切不一次性）；③ **滚动期（持续）**：所有工程对齐 v21/22 后进入『每两个大版本跟一次』节奏（v22→v24 跟、跳过 v23 奇数版）——ng update 的自动化 schematics 让跟进成本降到最低。关键纪律：**绝不超过最新版本一个大版本**——超过就要自己补中间版本的迁移逻辑。

### 11. (B) 同事在 v19 工程里写了 `import { signal } from '@angular/core'`，IDE 报 'Module has no exported member signal'——可能的两种原因与修法。

**来源**：转述自本关 §二 v17 行 signals 实验期与 v18 stable 的版本差异

原因一：实际 @angular/core 版本是 v17.x 且 signal 在实验路径下——v17 的 signal 从 `@angular/core/primitives/signals` 导入（非公开 API、需手动开）或 `@angular/core` 但需 `--experimental-signals` flag；修法：升级到 v18+（signal 从 @angular/core 公开导出）。原因二：tsconfig 的 paths/peerDependency 冲突导致 IDE 解析到旧版 .d.ts（node_modules/@angular/core 里 version 是 v17 但 package.json 写了 ^18——npm 装错版本）；修法：删 node_modules+lock 文件重跑 npm ci。经验：signals 在 v17 存在但入口/稳定性/类型都不同——版本探针查 @angular/core 的 package.json version 字段最可靠。

### 12. (C) Angular 每年两版节奏与 Node.js LTS / TC39 提案阶段的对比：三种节奏各自对开发者的『知识保质期』影响是什么？

**来源**：转述自本关 §五版本节奏段与 §一的框架对比视角（呼应 es-proposal-stage、node-lts）

三档：① **TC39 提案阶段**（Stage 0→4）——一个特性可能五年不落地、也可能两年转正：开发者知识风险=学了 Stage 2 API 到 Stage 4 签名变了（如 Signals 提案从 Stage 1 到 Stage 2.7 API 有微调）；② **Node.js LTS**——偶数版 30 个月 Active+维护：知识保质期约等于两年半，升级压力最小；③ **Angular 每年两版**——每个大版本都有 breaking 面+弃用周期=6 个月：知识保质期最短——v14 写的 NgModel 双向绑定到 v22 已是反模式。对开发者的实际影响：Angular 要求每季看 release notes、每年跑 ng update；TC39/Node 用户每年看一次即可——**选框架也是选学习节奏**。

### 13. (D) 面试官问『你怎么向 CEO（非技术）解释为什么要花三个月升级 Angular 版本』——不许用『技术债』这个词，给 60 秒电梯演讲。

**来源**：转述自本关 §五升级策略的向上沟通化（呼应 ng-landscape q7 的总监沟通题）

框架：① **安全面**——旧版不再收安全补丁（v16 的 LTS 已于 2025 年底结束），漏洞暴露窗口每月增长；② **成本面**——新招的 Angular 开发者默认学的是新版（standalone/signals），我们的旧版代码要额外培训 3 个月——版本差越大、能招到能用的人越少、薪资溢价越高；③ **产品面**——新版 zoneless+signals 让页面响应速度提升 30%+（Lighthouse 分→SEO→转化率）；@defer 让首屏加载更快——这些是用户可感知的体验。一句话总结：**三个月升级换三年安全、招聘竞争力和产品指标提升——拖越久这三项同时恶化**。CEO 在乎的三个数字：风险敞口、人效比、转化率——别讲技术。

### 14. (A) 增量 hydration（v19 默认）与全量 SSR hydration 的区别是什么？为什么 Angular 选择默认开启增量而不是全量？

**来源**：转述自本关 §二 v19 行与 L8 ng-ssr 的预告（呼应 sig-server、kit-load-universal）

全量 hydration：服务端 HTML 到浏览器后，客户端遍历整棵 DOM 树『激活』事件监听——期间所有交互阻塞（React 经典水合的『hydration 断层』问题）；增量 hydration：客户端只『激活』用户真正交互到的部分（基于 @defer 块边界或事件触发），其余保持静态 HTML 不阻塞。Angular 选默认开启的原因：① 它已有 @defer 块作为天然的激活边界（defer 块内可以延后水合）；② signals+zoneless 的精确通知模型让『局部激活后只更新局部』成为自然行为；③ 全量 hydration 对大页面（后台管理系统 200+ 组件）的阻塞时间是秒级——增量把它降到毫秒。加分：React 18 的 Suspense streaming + selective hydration 解决同一问题但需要 Suspense 边界——Angular 的 @defer 提供了类似边界但更模板原生。

### 15. (D) 你写了一份『Angular 教程年代鉴定指南』准备发团队 wiki——设计一个五步 checklist（每步给一个探针、命中即标记年代区间），并说明为什么不用发布日期而是用代码特征。

**来源**：转述自本关 §三-四的探针表与决策树的制度化产出

五步：① 看 main.ts——`platformBrowserDynamic` = v17 前、`bootstrapApplication` = v17+；② 看 app.config.ts 或 app.module.ts——存在 app.config.ts = standalone 路线（v17+）、存在 app.module.ts = NgModule（可能仍混用但主栈旧）；③ 看模板——只有 `@if/@for` = v17+ 且 codemod 已跑；有 `*ngIf` = v17 前或过渡期；④ 看 interceptor——`class X implements HttpInterceptor` = v15 前、`withInterceptors([fn])` = v15+；⑤ 看 zone provider——有 `provideZoneChangeDetection()` = v18-20、有 `provideZonelessChangeDetection()` = v18-20 手动切换、什么都不写 = v21+。为什么不用发布日期：① 教程发布后内容可被编辑、日期不变但内容更新；② 旧内容在新框架发布后被重新上传——日期造假容易；③ 代码特征是物理事实——NgModule 就是 NgModule，不管 PDF 首页写 2026——**代码不会撒谎**。
