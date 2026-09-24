# ng-inject：注入上下文——inject() 的边界与 constructor DI 的黄昏

> 目标：搞清楚 inject() 函数在什么时候能调、什么时候报错；为什么 v14+ 主推 field initializer 里用 inject() 而 constructor 参数注入（constructor DI）在逐步退役；runInInjectionContext 的补救口；provider 与手动 import 的取舍——依赖关系可见性讨论（呼应 ng-di-core、ng-services、vite-deps-perf 显式依赖观）

## 一、inject() 的合法调用时机：注入上下文规则

```ts
@Injectable({ providedIn: 'root' })
export class MyService {
  // ✅ 合法：field initializer（在注入上下文内执行）
  private http = inject(HttpClient);
  private router = inject(Router);

  constructor() {
    // ❌ 不合法：constructor 体内调 inject()（v14 前合法但 v14+ 弃用方向）
    // const svc = inject(AuthService);  // 报错！
  }

  ngOnInit() {
    // ❌ 不合法：生命周期钩子不是注入上下文
    const svc = inject(AuthService);  // 抛 NG0203 错误
  }
}
```

**规则一句话**：inject() 只能在**构造上下文**（constructor 参数 / field initializer / 工厂函数体）里调用——因为 Angular 需要在该时刻知道『当前正在创建谁』以便走它的 injector 链。生命周期钩子/普通方法调用时上下文已丢失。

报错读法：`NG0203: inject() must be called from an injection context such as a constructor, field initializer, or explicit context (runInInjectionContext).`——NG 前缀是 Angular 错误码系统、0203 是 DI 模块的编号。

## 二、constructor DI 的黄昏：为什么 field initializer 取代了它

旧正统（v2-v17 文档）：
```ts
constructor(private http: HttpClient, private auth: AuthService) {}
```

新推荐（v14+ signal 风格）：
```ts
private http = inject(HttpClient);
private auth = inject(AuthService);
```

**为什么换**（三条应用层理由）：
1. **TS 参数属性有编译成本**：constructor(private http) 生成 `this.http = http`——class 越大 constructor 越长；field initializer 一行一依赖、与 class 声明风格一致；
2. **重构友好**：删一个依赖只需删一行 field、不用动 constructor 签名——避免 constructor 参数位置敏感 reorder bug；
3. **测试替身更灵活**：`TestBed` providers 替换对 inject() 透明；但 `new MyService(mockHttp, mockAuth)` 手动 new 需要按 constructor 参数顺序传——多了就乱。

**constructor DI 没有废**——它仍然合法；但 v22 官方教程与 `ng generate service` 模板已全面输出 inject() 风格。读旧代码认得 constructor DI、写新代码用 inject()。

## 三、runInInjectionContext：显式构造注入上下文

当你需要在**非构造时机**用 inject()（如在 effect 回调外手动 lazy 创建服务）：

```ts
import { runInInjectionContext, Injector } from '@angular/core';

@Component({...})
export class App {
  private injector = inject(Injector);

  onClick() {
    // 点击时才需要的服务——手动创建上下文
    const svc = runInInjectionContext(this.injector, () => inject(ExpensiveService));
    svc.doWork();
  }
}
```

适用场景：动态创建组件（createComponent 传入 injector）、工厂内条件注入、一次性延迟加载。注意：runInInjectionContext 内 inject 的实例**不缓存**——每次调用都走 injector 查找，但 providedIn:'root' 的仍是单例（因为 injector 本身缓存了 root 实例）。

## 四、NodeInjector 与 createInjectionContext：更底层的口

`Injector.create([...])` 可脱离组件树创建独立注入器：

```ts
const injector = Injector.create({
  providers: [
    { provide: AuthService, useValue: mockAuth },
    { provide: HttpClient, useClass: HttpBackend },
  ],
});
const svc = runInInjectionContext(injector, () => inject(MyService));
```

用途：纯单元测试里不想起 TestBed 完整环境、脚本式 DI 组装。这是 DI 体系的『逃生舱』——日常业务代码极少用到。

## 五、provider vs 手动 import：依赖关系的可见性取舍

两种获取依赖的方式：
```ts
// A：DI provider（运行时解析）
private auth = inject(AuthService);

// B：手动 import（编译期静态绑定）
import { format } from './utils';
```

**区别在可见性与可替换性**：
- DI provider：① 依赖关系**在运行时由框架解析**——同一 class 可以被不同 injector 层级注入不同实现（多态）；② 测试可替换（providers useValue mock）；③ 代价：间接性（看代码不知道实际拿到的实例来自哪里）；
- 手动 import：① 编译期确定、tree-shaking 友好；② 不可替换（除非 jest.mock 路径拦截）；③ 适合纯函数/无状态工具。

**Angular 社区约定**：有**状态/生命周期/副作用**的依赖用 DI（HttpClient/Router/业务 Service）；**纯函数/常量/无状态**工具直接 import（格式化函数/验证器/常量表）。14 包 sig-auth 里 React 用 Context 手搓的事在 Angular 里一条 provider 搞定。

## 六、inject() 在 effect / computed 里的特殊行为

```ts
@Injectable({ providedIn: 'root' })
export class DataComponent {
  private http = inject(HttpClient);  // ✅ field initializer

  constructor() {
    effect(() => {
      // ❌ inject(SomethingElse) 在 effect 回调里不合法（不是注入上下文）
      // 但 this.http 已经在 field 里 inject 了，effect 里直接用即可
      const data = toSignal(this.http.get('/api'), { initialValue: [] });
    });
  }
}
```

computed() 同理——它的执行体不在注入上下文里。需要服务引用？在 field 里提前 inject、闭包捕获 this。

## 七、与 Solid/Vue 的 inject 对照

| 特性 | Angular inject() | Solid useContext() | Vue inject() |
|------|-----------------|-------------------|-------------|
| 作用域 | Injector 层级（root/route/element） | 渲染树（组件嵌套） | 组件嵌套树 |
| 时机限制 | 注入上下文内 | 任意（setup 阶段） | setup 阶段 |
| 可替换性 | TestBed / providers 数组 | 手动传 Provider 组件 | provide/inject 配对 |
| 类型安全 | InjectionToken<T> 泛型 | 取决于 createContext<T> | InjectionKey<T> symbol |

Angular 独有的是**独立于渲染树的层级**（Route Injector/Platform Injector）——这让 SSR 每请求隔离（L8 ng-ssr 关）成为可能，也是 14 包『模块单例债』在 Angular 里的正解。

> 🚀 下一站：L4 响应式——把 inject() 与 signal/effect 的交互细节在 ng-signals 关展开。
