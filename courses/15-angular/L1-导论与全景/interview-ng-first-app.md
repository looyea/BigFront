# ng-first-app 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 standalone 启动、providers 装配树、工程骨架四层与版本探针的题组。

### 1. (A) bootstrapApplication 和旧的 platformBrowserDynamic().bootstrapModule 有什么本质区别？为什么 Angular 要换掉后者？

**来源**：转述自本关 §三启动层与版本探针段

本质区别是**装配单位**：platformBrowserDynamic 以 NgModule 为根装配单元——AppModule 的 declarations/imports/providers 三层表决定了整个应用的依赖图；bootstrapApplication 以**组件+providers 数组**为根——standalone 组件自带 imports 字段声明自己需要什么，不再有全局注册表。换掉的原因是：NgModule 把『谁用什么』集中到模块层，改一个组件的依赖要改NgModule，编译单元不独立、增量编译不友好（ViewEngine 时代改一组件全量重编）；standalone 把依赖声明下放到组件自身，配合 Ivy 的局部编译天然对齐——所以 v9 Ivy → v14 standalone 实验 → v17 默认是同一因果链的三步。面试答到『把编译单元与组织单元对齐』这一层就超纲通过。

### 2. (A) app.config.ts 的 providers 数组里通常有哪几类提供者？各举一例并说出它的生命周期作用域。

**来源**：转述自本关 §三应用层注释与 L3 DI 的预告

三类：① **框架能力装配**——provideRouter(routes) 注册路由表、provideHttpClient(withFetch()) 注册 HTTP 客户端，它们用 makeEnvironmentProviders 把多个 provider 打包成一组，生命周期=root injector（全应用单例）；② **变更检测策略**——v21 起默认 zoneless 不写；v18-20 若手动 provideZonelessChangeDetection() 也是 root 级；③ **业务全局服务**——{provide: AuthService, useClass: AuthService, providedIn: 'root'}（通常写在服务自身装饰器里不占 app.config 行），同样是 root 单例。加分点：组件级 provider 写在 @Component({providers:[...]}) 里、作用域限该组件子树——app.config 只放全局。

### 3. (B) 同事从旧教程复制了一段 import { AppModule } from './app/app.module' 的代码塞进 v21 新工程，编译直接报错——给出你的修复步骤和给同事的说明。

**来源**：转述自本关 §三版本探针（bootstrapModule 识别法）与 §四 standalone 革命

修复：① 删除 app.module.ts（NgModule 文件）；② 把 AppModule 的 declarations 列表里的组件改为各自 standalone: true（v19+ 可省 flag）；③ 把 AppModule 的 imports 数组里用到的 Material 模块/ CommonModule 改为各组件自己 imports；④ 把 AppModule 的 providers 搬到 app.config.ts 的 providers 数组；⑤ main.ts 恢复 bootstrapApplication(App, appConfig)。给同事的说明：v17 后 standalone 是默认路径、NgModule 是兼容层；v21 新工程没有 NgModule 脚手架——旧教程代码直接粘进新工程必炸；建议看 angular.dev（新版官方站）而不是老的 angular.cn 翻译版。

### 4. (B) ng serve 跑起来后浏览器 4200 端口一片空白、控制台报 'No components found for route ""'——最可能的原因是什么？怎么修？

**来源**：转述自本关 §二骨架四层与 §三 provideRouter 配置

最可能原因：app.routes.ts 里Routes 数组是空的或没有匹配 '' 的默认路由——provideRouter(routes) 拿到了路由表但表里无 match。修法：在 app.routes.ts 里加一条 { path: '', component: HomeComponent }（或 redirectTo 到有内容的路由）。变体：如果用了 loadComponent 懒加载但文件路径写错——路由匹配到但组件加载失败也是白屏；用 Chrome Network 面板查 chunk 请求 404 定位。追根：本关把 app.routes.ts 划到应用层，路由表空=应用层装配不完整。

### 5. (C) 拿 Angular 的 bootstrapApplication(App, appConfig) 与 Vue 的 createApp(App).mount('#app')、React 的 createRoot(...).render(<App/>) 对比：三者装配模型的根本差异是什么？

**来源**：转述自本关 §三启动层与四框架对照视角（呼应 vue-app-create、react-first-app）

差异在『装配的显式程度与集中位置』：Vue createApp 只管挂载、全局能力用 app.use(plugin) 逐个注册（渐进式）；React createRoot 纯渲染，全局能力完全交给外部（Context/Provider 散落在 JSX 树里）；Angular bootstrapApplication(App, appConfig) 把**根组件与全局 providers 一次性交给框架**——appConfig 就是集中装配清单。一句话：Angular 让启动入口『声明完整依赖图』，Vue/React 让启动入口『只启动』、装配后续逐步补。这背后是应用框架与 UI 库的哲学分歧：前者假定框架管理全栈、后者假定开发者自由拼装。

### 6. (A) 本关说 angular.json 的 budgets 是『框架内置的 size-limit』——它的工作机制是什么？与 14 包 sig-size 里 size-limit + CI 的组合有何异同？

**来源**：转述自本关 §五工程层 budgets 段（呼应 sig-size 体积门禁）

机制：budgets 数组里每条有 type（initial/anyComponentStyle/allScript 等）与 threshold（maximumWarning/maximumError），ng build 在生成 bundle 后逐条计算体积、超标即时报错——与构建耦合、不依赖外部工具。异同：size-limit 是独立 CLI 工具，支持 gzip/brotli 模式、能精确到 entrypoint 粒度、需手动接 CI 管道；budgets 是框架内置、只算原始大小（不算 gzip）、粒度到 type 级但开箱即用——两者互补：budgets 做日常开发守门、size-limit 在 CI 里做 gzip 精确预算。相同哲学：**把体积当回归项而不是优化项**——超标=构建失败=不可上线。

### 7. (B) 你让新人用 ng new 建了一个项目、打开 app.config.ts 发现没有 provideZoneChangeDetection 这一行，他问『我是不是漏了什么』——怎么回答？

**来源**：转述自本关 §三 providers 数组注释与版本指纹（v21 zoneless 默认）

回答：没漏。v21 起 zoneless 是新工程的默认变更检测策略，不再需要显式写 provideZoneChangeDetection 或 provideZonelessChangeDetection——**什么都不写就是 zoneless**。只有当你需要兼容旧行为（比如某第三方库依赖 zone.js 的异步拦截）时，才手动添加 provideZoneChangeDetection()。这本身就是枚版本探针：app.config 里 zone provider 的有无=工程创建年代——旧教程看到没有 zone 会以为工程配错了，实际是新版本更干净了。

### 8. (D) 面试官给你一份 2024 年中（约 v18）的 Angular 工程代码，要求升级到 v22——列出 app.config.ts 和 main.ts 需要动的地方，不讨论业务组件。

**来源**：转述自本关 §三-五的骨架知识组合应用（升级剧本呼应 ng-version-map 预告）

app.config.ts：① 若原 provideZoneChangeDetection() 存在——评估是否切换 zoneless（v21+ 默认，但若有 zone.js 依赖需先排查）；② 检查 provideHttpClient 是否仍用旧版 withXSRF 参数写法——v18+ 已有新 API；③ 路由提供者可加 withComponentInputBinding()（v16+ 新，省路由参手动 subscribe）。main.ts：① v18 已是 bootstrapApplication 则无需改——若发现 platformBrowserDynamic 说明工程实际更旧先升 standalone；② 检查 polyfills 数组——v18+ zone.js polyfill 可移除（升级 zoneless 的前提）。总结：升级工程骨架比升级组件安全得多（改动面小、影响全局），所以**骨架先升、组件后搬**——与 sig-migrate 的『共存地基→桥→切流』三段论同构。

### 9. (A) 本关说『组件即入口不再有 NgModule』——那 standalone 组件的 imports 数组和 NgModule 的 imports 数组到底做了什么不同的事？

**来源**：转述自本关 §四组件层与 NgModule 的对比段

NgModule.imports 做的是**模块级共享**——导入一个模块等于把它 declarations 里的所有可导出东西注册进本模块的编译范围，同模块内所有组件自动可用；standalone 组件的 imports 数组做的是**组件级私有**——只导入本组件模板里真正用到的那些依赖（其他指令/组件/管道），不影响兄弟组件。结果差异：NgModule 下改组件模板不触发兄弟重编译；standalone 下每个组件是独立编译单元，配合 Ivy 局部编译实现真正的增量构建——imports 从组织工具（『谁归我管』）变成了依赖声明（『我用谁』）。

### 10. (C) v20 起 @angular/build（Vite 内核）替代 Webpack 做默认 builder——对日常开发体验的两个最直观变化是什么？与 10-vite 包的知识有何关联？

**来源**：转述自本关 §五第二处与 §六第三件小事（呼应 vite-first-look、vite-deps-perf）

直观变化：① **冷启动**——Webpack 大工程首次 ng serve 可能几十秒、@angular/build 基于 Vite 的 esbuild 预构建降到秒级；② **HMR 粒度**——改一个组件模板→Vite 的模块热替只换那个组件的渲染函数、其余组件状态保留（旧 Webpack 时代 HMR 更粗可能刷全页）。与 10-vite 关联：@angular/build 本质是 Angular 官方在 Vite 上包装了一层 Angular 编译器集成（模板编译/样式封装/DI 元数据收集），开发者无需配 vite.config 但有 Vite 性能——这与 Nuxt 3 用 Vite、SvelteKit 用 Vite 同属『各框架把 Vite 收进自己脚手架』的 2024-2026 大趋势（呼应 kit-project-structure、nuxt-vite）。

### 11. (B) ng build 报 budget exceeded for initial——但你确认业务代码没多、只是升级了 Angular 版本。给两步排查思路。

**来源**：转述自本关 §五工程层 budgets 的实战应用

Step 1：**跑 ng build --stats 或 webpack-bundle-analyzer 等价工具**（@angular/build 用 source-map-explorer 或 npx vite-bundle-visualizer）看 initial chunk 里谁涨了——大概率是框架运行时自身体积变化（Angular 每个大版本可能引入新 polyfill 或扩展核心包体积）或 zoneless 切换后新增依赖。Step 2：**查 CHANGELOG 或 ng update 输出的 breaking changes 列表**——Angular 升级时 budgets 默认阈值不自动调整，框架团队知道新版本体积涨了但把选择权留给用户：要么调高 threshold、要么做 tree-shaking（移除未用 Material 模块/旧指令的 imports）。核心判断：框架体积合理增长 vs 你的工程有死代码——前者调阈值、后者清 imports。

### 12. (D) 面试官问『你怎么向一个从未接触过 Angular 的 React 开发者用 5 分钟解释 ng new 产物的骨架？』——设计一段口述。

**来源**：转述自本关 §二四层结构的『翻译』应用（面试场景=知识迁移能力测试）

口述框架：『React 项目里 main.tsx 只挂一个 <App/>，全局 Provider 散写在 App 的 JSX 里——Angular 把这两步合成一步：main.ts 把 App + 一张装配清单(appConfig) 一起交给 bootstrapApplication；装配清单里列的东西（路由表、HTTP 客户端、变更检测策略）在 React 项目里分别是 react-router、axios/fetch、Re-render 策略——Angular 把它们做成框架正字并集中在 app.config 注册。你写的业务组件等价于 React 函数组件加了一个 selector（等于 JSX 的标签名）和 imports（等于你的函数组件用到哪些子组件要列出来——React 里 import 就自动能用、Angular 里必须显式写进 imports 数组才能出现在模板）。最外层 angular.json 管构建配置——类比 vite.config，但多了体积门禁和 SSG/多环境 profiles。』——关键是把 Angular 概念逐个翻译到 React 对应物。

### 13. (A) strictTemplates 开了之后，模板里哪些写法会从『静默通过』变成『编译报错』？给三个典型场景。

**来源**：转述自本关 §五第三处 tsconfig 注释（strictTemplates 红利段）

三场景：① **属性不存在**——<app-user [userNam]="x"/>（拼错 Input 名）→报『Property 'userNam' does not exist』；② **类型不匹配**——[value]="count" 而目标 Input 声明为 string、count 是 number →报类型不兼容；③ **事件 $event 类型漏推**——(click)="onSave($event)" 而 onSave 签名接收 MouseEvent 但按钮模板上下文中 $event 是 Event →报类型不兼容。这些在 strictTemplates 关闭时都是运行时静默或 undefined——开启后全推到编译阶段。Angular 模板不再等于 untyped string：它现在是类型系统的一部分。

### 14. (C) 有人说『standalone 之后 Angular 的组件和 React 函数组件长得一样了』——给两点相同、两点不同。

**来源**：转述自本关 §四组件层与 React 组件的同异对比（呼应 react-fc-hooks、vue-sfc）

相同：① 都是『自声明依赖、无全局注册表』——React 的 import 即注册、Angular 的 imports 数组即注册；② 都是组件即最小编译单元——不用先包一层 Module 或 Wrapper。不同：① Angular 组件仍是 class + 装饰器（虽然模板语法与生命周期钩子已大幅简化），React 函数组件是纯函数 + hooks 调度；② Angular 模板是 HTML+绑定语法的编译产物（有严格类型检查），React JSX 本质是 JS 表达式（TSX 类型检查覆盖不到动态属性名）——standalone 让组织形式趋同但渲染模型和类型边界仍然不同。

### 15. (D) 你被安排搭团队脚手架：要求新同事 ng new 之后『零配置就能跑 lint + test + build 三连 CI』——给出 angular.json 和 package.json 层面的配置清单。

**来源**：转述自本关 §五工程层与 §六部署预告的脚手架应用

angular.json 层：① budgets 按团队基准设 maximumError（initial 3MB 量级、anyComponentStyle 50kB）——超标直接 build fail；② configurations.production 确保 optimization:true + aot:true；③ architect.test 配好 Vitest（v21+ 默认）的 include/exclude 规则（排除 e2e 目录）。package.json 层：① scripts 里加 "ci": "ng lint && ng test --no-watch && ng build --configuration production"；② devDependencies 锁 @angular-eslint 版本与 angular/core 对齐；③ husky/lint-staged 配 pre-commit hook 跑 ng lint 的 changed-files 模式。加分：Angular 的 ng add @angular-eslint/schematics 一条命令把 eslint 规则集与 Angular 模板 lint 集成——不需要手写 eslintrc 里的 Angular plugin（全家桶又一红利：脚手架命令链闭合）。
