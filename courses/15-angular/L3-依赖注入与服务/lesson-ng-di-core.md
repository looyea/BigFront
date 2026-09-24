# ng-di-core：DI 体系——注入器树、provider 与 token

> 目标：理解 Angular 依赖注入的『四级注入器树』如何决定单例归属；掌握四种 provider 写法（useValue/useClass/useFactory/useExisting）与 InjectionToken 配置模式；standalone 时代 providers 的分布图（app.config vs component）——这是 React 没有的框架级能力（呼应 sig-auth、react-context、ng-first-app）

## 一、为什么 Angular 有 DI 而 React 没有『框架级』DI

React 的『依赖传递』是 Context + Provider 手工组装（14 包 sig-auth 里你手写了四种实现）——本质是把『谁提供什么值』写进 JSX 树。Angular 的 DI 是**框架内建、独立于渲染树**的服务容器：你在 class 里声明『我需要什么』，框架在运行时按类型/token 查找并注入实例——**谁提供什么值**写在 provider 注册处、**谁消费什么值**写在注入处——两端解耦。收益：组件重构（移动/删除）不影响服务注册；测试时用 `{provide: X, useValue: mock}` 一行替换全树依赖。

## 二、四级注入器树：单例归属由谁决定

```
Platform Injector（createPlatformApplication 创建，极少手工用）
  └─ Root Injector（app.config.ts providers → bootstrapApplication 创建）
       └─ Route Injector（provideRouter 的每条路由 resolve/providers 可挂）
            └─ Element Injector（@Component({providers:[...]}) 组件级）
```

**查找规则**：`inject(X)` 从当前 Element Injector **向上冒泡**查找——谁注册了 X 的 provider 谁就返回实例；找不到则抛 `NullInjectorError: No provider for X!`。

**单例归属**：
- `providedIn: 'root'`（@Injectable 里）→ 注册在 Root Injector → 全应用单例（最常见）；
- `@Component({providers: [X]})` → 注册在 Element Injector → **每个组件实例各一个 X**（局部隔离）；
- Route providers（`{path:'dash', providers: [DashboardService]}`）→ Route Injector 作用域 → 同一模块内共享、路由切换销毁。

## 三、四种 provider 写法

```ts
// 1. useClass（默认——注入时 new 一个实例）
{ provide: AuthService, useClass: AuthServiceImpl }

// 2. useValue（注入一个固定值——配置/DOM/mock）
{ provide: API_BASE, useValue: 'https://api.example.com' }

// 3. useFactory（懒创建、可组合其他 provider）
{ provide: TOKEN_STREAM, useFactory: (auth: AuthService) => auth.token$, deps: [AuthService] }
// standalone 写法更常见：
{ provide: TOKEN_STREAM, useFactory: () => inject(AuthService).token$ }

// 4. useExisting（别名——两个 token 指向同一个实例）
{ provide: NewNameService, useExisting: LegacyService }
```

何时用哪种：
- useClass：接口/抽象类多实现切换（`provide: Logger, useClass: ProdLogger` vs `useClass: MockLogger`）；
- useValue：配置常量、boolean flag；
- useFactory：依赖其他 provider 才能构造、或需要条件创建；
- useExisting：重命名/兼容——两个 token 一个实例（不 new 两次）。

## 四、InjectionToken：非 class 类型的 provider key

Angular DI 的 provider key 通常是 class 类型（`inject(AuthService)`），但当你想注入一个**值/接口/函数**时 class 不存在或不够用——InjectionToken 补这个位：

```ts
// 定义 token（单独文件 tokens.ts）
export const AppConfig = new InjectionToken<{apiUrl: string; debug: boolean}>('AppConfig');

// 注册
providers: [
  { provide: AppConfig, useValue: { apiUrl: 'https://...', debug: false } },
]

// 消费
const config = inject(AppConfig);
```

Token 的泛型参数给 TypeScript 类型推断——`inject(AppConfig)` 返回 `{apiUrl: string; debug: boolean}`。

**与 React Context 的对照**：React 的 `createContext<Config>(...)` 等价于 InjectionToken——但 Context 必须挂在 JSX Provider 组件上、每个消费组件要 `useContext(Ctx)`；DI 的 token 注册一次全局可 inject（root 作用域）、不需要出现在渲染树。

## 五、standalone 时代 providers 的分布图

```ts
// app.config.ts —— 全局 providers（root 作用域）
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: AppConfig, useValue: environment },  // 配置类
    // 业务服务通常不写这里——用 providedIn:'root' 自注册
  ],
};

// dashboard.component.ts —— 组件级 providers
@Component({
  selector: 'app-dashboard',
  standalone: true,
  providers: [DashboardState],   // 只在 dashboard 子树里单例
})
export class Dashboard { ... }
```

**分布原则**：
- **全局单例**（AuthService/ThemeService）→ `@Injectable({providedIn: 'root'})` 写在自己文件里，不占 app.config 行；
- **配置型**（API_URL/Feature Flags）→ app.config.ts 里 `useValue` 注入；
- **feature 级状态**（DashboardState/EditorState）→ 组件级 `providers: [X]`——子树销毁时一起销毁；
- **路由级**→ route config 的 `providers: []` 数组——同模块内组件共享。

## 六、DI 与测试：框架级收益最明显的地方

```ts
// 被测组件依赖 AuthService（用 HttpClient）
// 测试里：
TestBed.configureTestingModule({
  imports: [ LoginComponent ],
  providers: [
    { provide: AuthService, useValue: { login$: of(true), logout: vi.fn() } },
  ],
});
```

一行替换全树依赖——不需要 wrapper Provider 组件、不需要 mock 整个 Context。对比 React Testing Library：要手动包一层 `<AuthContext.Provider value={mock}>`；对比 Svelte：直接 `$mocked.store.set(...)` 改全局 store（没有作用域隔离）。Angular DI 的作用域隔离 + token 替换 = **企业测试效率的框架级红利**。

> 🚀 下一关：服务与业务分层——『状态就是 service』的 signal 封装模式与 BehaviorSubject 时代的迁移姿势。
