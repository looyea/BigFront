# ng-di-core 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Angular DI 四级注入器树、四种 provider、InjectionToken 与 standalone providers 分布的题组。

### 1. (A) providedIn:'root' 与在 app.config.ts 的 providers 数组里注册同一个服务，行为上有什么差异？

**来源**：转述自本关 §二单例归属与 §五 standalone providers 分布图

行为结果相同——都是注册在 Root Injector、都是全局单例。差异在**注册时机与 tree-shaking**：providedIn:'root' 是服务**自注册**（服务文件被 import 时自动进 root），app.config 注册是**手动集中**；关键区别：tree-shaking——如果 providedIn:'root' 的服务从未被 inject，Angular 编译器知道可以从 bundle 里摇掉（v9 Ivy 后支持）；写在 app.config providers 里的服务因为 providers 数组是 side-effect 入口，摇不掉。最佳实践：业务服务用 providedIn:'root' 自注册、配置/常量/mock 替换写在 app.config。

### 2. (A) 组件级 providers: [CounterService] 与 providedIn:'root' 的 CounterService 在同一组件树里的冲突如何表现？谁优先？

**来源**：转述自本关 §二 DI 查找规则（向上冒泡、就近优先）

组件级 Element Injector 注册的 provider 遮蔽（shadow）上层的 Root Injector——`inject(CounterService)` 从当前 Element Injector 查找、**找到即返回不再往上走**。结果：该组件子树拿到的 CounterService 是组件级新实例（各自独立计数），不是全局单例。兄弟组件没有 providers:[CounterService] 的仍拿 root 那个实例。这是**有意的多实例模式**（编辑器 Tab 每个实例各自一份 state）；也是**常见 bug**（团队不小心在组件里写了 providers 导致服务不再全局共享）。

### 3. (B) 启动时报 'NullInjectorError: No provider for HttpClient!'——给出三步排查与最可能原因。

**来源**：转述自本关 §二查找规则与 §五 provideHttpClient

排查三步：① app.config.ts 的 providers 里有没有 `provideHttpClient(...)`——漏了就是最可能原因（新工程默认有、手动删除或被合并覆盖）；② 用了 providedIn:'root' 的服务 inject(HttpClient) 但该服务被 new 出来（非 DI 创建——如测试里 `new MyService()` 而没走 TestBed）→ 它没有注入上下文；③ 懒加载 chunk 里有独立 Root Injector（NgModule 旧路由 lazy loaded）——那个子 injector 没注册 HttpClient。最可能修复：`providers: [provideHttpClient(withFetch())]` 加入 app.config.ts。

### 4. (C) Angular InjectionToken 与 React createContext / Vue provide-inject 三种『依赖传递』机制在作用域粒度上有什么异同？

**来源**：转述自本关 §四 InjectionToken 与 React Context 对照段

相同：都是给非 class 的值一个类型安全的 key。不同：① **注册位置**——React Provider 必须出现在 JSX 渲染树某一层、Vue `provide()` 在 setup 里且作用域自动到子组件树；Angular token 注册在 app.config（root）或 component providers（element 子树）或 route providers——独立于模板/渲染；② **消费方式**——React `useContext(Ctx)` 只能在函数组件里、Vue `inject(key)` 在 setup；Angular `inject(TOKEN)` 在任何**注入上下文**（constructor / field initializer / effect / 工厂函数）里；③ **覆盖语义**——Angular 子 injector 同 token 遮蔽父（就近优先）；React 嵌套同名 Provider 也是内层覆盖外层。关键差异总结：React/Vue 的依赖流与渲染树耦合、Angular 的依赖流与渲染树解耦。

### 5. (D) 面试官给一个需求：『多环境配置（dev/staging/prod）+ 运行时 feature flag 动态开关』——用 DI 设计 provider 方案。

**来源**：转述自本关 §三 useValue/useFactory 与 §四 InjectionToken 的组合应用

方案：① 定义两个 token：`APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG')`（静态环境配置 apiUrl/uploadUrl 等）、`FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS')`（运行时动态）；② app.config.ts 注册：`{provide: APP_CONFIG, useValue: environment}`（构建时替换环境文件）、`{provide: FEATURE_FLAGS, useFactory: () => inject(FlagService).flags}`（异步拉取后 signal 暴露）；③ FeatureFlagService 用 providedIn:'root' 自注册、内部 signal + HttpClient 拉 /api/flags；④ 组件用 `inject(APP_CONFIG)` 拿编译时常量、`inject(FEATURE_FLAGS)` 拿动态 signal。加分：说清为什么不用 useValue 给 flags——因为它是异步获取的、用 useFactory + async 或 service+signal 才能延迟到位。

### 6. (A) useFactory 里为什么不能直接调用 inject()（v14 前）？v14+ 的 change 是什么？

**来源**：转述自本关 §三 useFactory 示例与 ng-inject 关预告

v14 前：工厂函数的执行上下文**不是注入上下文**——必须通过 deps: [OtherService] 参数声明依赖再由 DI 注入；直接在工厂里 inject() 会报 injection context 错误。v14+：Angular 允许 factory 函数体内调用 inject()——因为 factory 执行被包裹在 `runInInjectionContext` 里了（框架内部实现变更）。这简化了工厂写法（省 deps 数组），但本质不变：工厂在**首次被 inject 时**执行一次、返回的实例被缓存。

### 7. (B) 同事在组件里写 `private svc = new AuthService(http)`——手动 new 而不是 inject(AuthService)，引发两个连锁 bug。指出它们。

**来源**：转述自本关 §二 DI 查找规则与 §六测试替换

Bug 一：AuthService 里的 HttpClient 是 undefined——因为你 new 时传入的 `http` 是 `this.http` 还没注入的字段（手动 new 绕过了 DI 构造链）；Bug 二：测试无法替换——`inject(AuthService)` 走 DI 拿 mock，但 `new AuthService()` 直接创建真实例、TestBed 的 useValue mock 对它无效。修法：改为 `private svc = inject(AuthService)`——框架自动解析其内部 HttpClient 依赖且测试时可替换。

### 8. (C) Angular 的 DI 容器与 Java Spring 的 IoC 容器对比：三级作用域（singleton/request/session 之于 root/route/element）能一一对应吗？

**来源**：转述自本关 §二四级注入器树与后端 IoC 常识对比

不完全对应。Spring singleton=容器级唯一（≈ Angular root）、prototype=每次 new（≈ Angular 没有内建等价——组件级是『每个组件实例一个』不是『每次 inject 一个』）；Spring request/session 作用域≈ Angular 的 Route Injector（路由激活期间单例）——但 Angular 没有『每次 HTTP 请求一个』的概念（因为它是客户端 SPA、一次页面生命周期只有一个 root）。关键差异：Spring 是**服务端长驻进程**需要多用户隔离、Angular 是**浏览器单用户**——所以 Angular 不需要 request scope 但多了 element scope（组件级隔离）给 UI 状态用。面试答到『单用户不需要请求作用域但需要视图作用域』这一层就算理解到位。

### 9. (A) 路由级 providers: [DashboardService] 的生命周期是什么？跟 providedIn:'root' 的行为差异在哪？

**来源**：转述自本关 §二 Route Injector 段

生命周期：路由激活时 Route Injector 创建、providers 数组里的实例化发生；用户导航离开该路由（且该路由不被 reuse）→ Route Injector 销毁 → DashboardService 实例销毁（onDestroy/DestroyRef 回调触发）。与 providedIn:'root' 的区别：root 是**应用启动时首次 inject 创建、直到应用销毁**；Route 是**进路由创建、离开路由销毁**——天然适合页面级状态管理（进入 Dashboard 重置、离开自动清理）。加分：路由 reuse 策略（RouteReuseStrategy）会让 providers 实例跨导航存活——这是高级定制点。

### 10. (D) 一个 Angular 工程里 ThemeService 被 50 个组件 inject。设计一个『开发模式切换 mock』方案：ng serve 用真服务、ng test 自动用 mock、ng build 用真服务且 mock 文件被 tree-shake 掉。

**来源**：转述自本关 §六 DI 测试与 §三 useClass/useValue 组合

方案：① 环境文件 environments/ 目录：`environment.ts`（dev）和 `environment.test.ts`——environment.test.ts 里 `providers: [{provide: ThemeService, useClass: MockThemeService}]`；② angular.json configurations.test.fileReplacements 把 environment.ts 替换为 environment.test.ts；③ tsconfig.spec.json 里 `MockThemeService` 在 `src/testing/` 目录、tsconfig.app.json 的 exclude 排掉它——ng build 产物不含 mock；④ ThemeService 自身 providedIn:'root' 但测试时 app.config 的 providers 遮蔽了它（component/test providers 优先级 > root）。结果：开发/生产零 mock 代码进 bundle、测试自动替换无需每文件手配。

### 11. (B) 懒加载路由子模块里的一个服务需要与主模块共享——但 providedIn:'root' 后它在子模块 lazy loaded 时被重复实例化了。可能的原因？

**来源**：转述自本关 §二注入器层级与懒加载的 injector 关系

原因：该服务实际没有正确 providedIn:'root'——如果写成 `@Injectable()` 无 providedIn 字段且注册在 lazy 模块的 providers: [TheService]——每个 lazy chunk 有**独立的子 injector**（Route Injector 在 lazy 层）→ 每个 lazy 模块一份实例。修法：改成 `@Injectable({providedIn: 'root'})` 自注册到 Root Injector——所有模块共享。排查技巧：Chrome Console 里 `ng.getInjector(ComponentInstance)` 沿链向上找哪一级有该 token。

### 12. (C) 为什么 React 生态最终演化出了 Jotai（基于 atom 的依赖注入替代方案）？它与 Angular DI 的抽象层级差在哪？

**来源**：转述自本关 §一『框架级 DI vs Context 手搓』论（呼应 za-core、sig-scenarios）

React 没有框架级 DI——Context 是渲染树内的值广播、每次换 Provider 包一层重渲染。Jotai atom 本质是『全局可组合的 signal + 隐式依赖图』——用模块系统做依赖注册（atom 导出来就能用）、用闭包做作用域隔离（Provider 可限定 atom 值作用域）。它与 Angular DI 的抽象层级差：① Angular DI 管的是『服务生命周期』（单例创建/销毁/作用域冒泡）——面向 OOP class；② Jotai atom 管的是『值的派生与订阅』——面向函数式不可变 state。Angular 用 DI 解决『谁提供什么服务』、Jotai 用 atom graph 解决『谁依赖什么值』——两者正交但目标重叠（依赖传递与状态共享）。一句话：DI 是『实例注册表+解析器』、atom 是『值图+订阅器』。

### 13. (A) 同一 token 注册在三个层级（root / route / element），inject 返回哪一个？如果 root 用 useClass、element 用 useFactory 呢？

**来源**：转述自本关 §二查找规则『谁注册谁返回、就近优先』

返回 element 级（最近的那一级）——Angular 从当前 Element Injector 开始找、找到即返回不再向上。token 相同但 provider 写法不同不影响优先级——只看注册层级不看 provider 类型。所以 root=useClass（全局实例 A）、element=useFactory（工厂产 B）→ 该组件子树拿 B、其他组件拿 A。这是设计特性：允许在子树里用工厂创建特殊配置覆盖全局默认（如 Logger 全局 ConsoleLogger、在某个调试组件里用 useFactory 注入 VerboseLogger）。

### 14. (D) 设计一个 Angular 插件/微前端场景：宿主 app 用 DI 注入一个 HostService，子 app（独立 Angular 工程）需要拿到宿主的 HostService 实例——给两种桥接方式。

**来源**：转述自本关 §二注入器树与独立 Angular 工程的跨应用 DI 现实

方式一（运行时传递）：子 app 通过 ng Module Federation / single-spa 加载时，宿主把自己的 Injector 实例挂到全局（`window.__HOST_INJECTOR__ = this.injector`）；子 app 的 app.config providers 里 `{provide: HostService, useFactory: () => window.__HOST_INJECTOR__.get(HostService)}`——工厂在子 app root injector 创建时执行、从宿主拿实例。方式二（接口约定）：不传 injector 而传 service 实例本身——`bootstrapApplication(ChildApp, { providers: [{provide: HostService, useValue: hostSvcInstance}] })`——宿主在 mount 子 app 时把实例传入。加分：讨论接口契约管理（两 app 独立版本时 interface 漂移风险）与 NestJS 式 token 字符串约定。

### 15. (B) TestBed 测试一个组件，报 'No provider for ActivatedRoute'——三种修法各自的适用场景。

**来源**：转述自本关 §六 DI 测试替换与路由服务的 inject 场景

修法一：`providers: [{provide: ActivatedRoute, useValue: {snapshot: {params: {id: '1'}}}}]`——只需 mock 用到的那几个字段，适合单元测试。修法二：`imports: [RouterTestingModule.withRoutes([{path:':id', component: TestHost}])]`——完整路由环境但内存中不真跳转，适合集成测试。修法三：`providers: [provideRouter([])]`（v16+ 函数式路由 provider）——只满足 inject(Router) 不报 No provider、不测路由行为，适合组件逻辑与路由耦合度低时快速绕过。选择标准：测路由数据消费（params/queryParams）用一、测导航行为用二、只是依赖链路过（不测路由）用三。
