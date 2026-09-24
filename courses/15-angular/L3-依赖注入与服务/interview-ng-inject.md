# ng-inject 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 inject() 调用边界、constructor DI 退役、runInInjectionContext 与 provider 取舍的题组。

### 1. (A) inject() 报 NG0203 的底层机制是什么？为什么 Angular 要把 inject 限制在注入上下文？

**来源**：转述自本关 §一注入上下文规则与报错读法

NG0203 的底层：inject() 执行时需要一个 **当前 Injector 引用**——Angular 用 thread-local 的『正在构造的节点』栈帧来传递它（field initializer 在框架创建该 class 实例时被执行，栈帧里有 injector 引用）。在 ngOnInit/普通方法里调用时栈帧已弹出——没有 injector 引用→框架抛 NG0203。为什么要限制？因为 inject 必须知道『从哪一级 injector 开始查』——同一 token 在不同组件可能来自不同级（root vs element）——丢了上下文就不知道查找起点。设计取舍：用编译期/运行期的上下文约束换 DI 的灵活作用域。

### 2. (B) 新同事用 `@Injectable()` 装饰 service 但忘写 `providedIn`，编译不报错但运行时 `No provider for MyService`——两步定位根因并修。

**来源**：转述自本关 §二 constructor DI 与 provider 注册的关系

① @Injectable() 只是**给类打元数据标记**（让 Angular 知道这个 class 可被 DI 管理），不注册 provider——没有 providedIn 也没有被任何 component/config 的 providers 数组引用→注入器树里找不到；② 修法：加 `providedIn: 'root'`（最简单）或在 app.config.ts providers 里显式注册 `{provide: MyService, useClass: MyService}`。排查技巧：VS Code Angular 插件对 @Injectable 无 providedIn 且未被 providers 引用的类标黄提示。

### 3. (C) 为什么 constructor(private http: HttpClient) 里的 private 关键字很重要？field initializer 的 private http = inject(HttpClient) 里 private 的作用等价吗？

**来源**：转述自本关 §二 constructor DI 的『TS 参数属性』解释

constructor 里的 `private` 是 TypeScript 的**参数属性语法糖**——它同时做三件事：声明参数为 private + 自动 `this.http = http` 赋值。如果写成 `constructor(http: HttpClient) {}` 没有 private→参数只是局部变量、this.http 不存在。field initializer 的 private 只是**访问修饰符**（类字段可见性）——不涉及赋值（赋值是 `= inject(...)` 做的）。两者结果相同（this.http 可用且外部不可访问），但语法机制不同。

### 4. (D) 面试官问『你怎么设计一个『插件系统』让第三方贡献者能通过 DI 注册自己的 handler？』——用 Angular DI 给出方案。

**来源**：转述自本关 §四 provider vs import + multi provider 的进阶应用

利用 **multi provider**：① 定义 token `export const HANDLERS = new InjectionToken<HandlerFn[]>('HANDLERS', { multi: true, factory: () => [] })`；② 核心服务 inject(HANDLERS) 拿到所有注册进来的 handler 数组；③ 第三方 feature module 注册：`providers: [{provide: HANDLERS, useValue: myPdfHandler, multi: true}, {provide: HANDLERS, useValue: myCsvHandler, multi: true}]`；④ 运行时核心遍历 handlers 逐个尝试——新 handler 加入只需注册、核心代码零改动。加分：讨论 handler 优先级（useFactory 里排序/weight 字段）与 SSR 每请求注册隔离（route providers）。

### 5. (A) Injector.create() 与 app.config providers 的关系：app.config 里的 providers 数组最终注册在哪个 injector？

**来源**：转述自本关 §三-四 Injector.create 与 §二注入器层级

app.config providers 注册在 **Root Injector**（由 bootstrapApplication 内部创建的 EnvironmentInjector）。EnvironmentInjector 是 v14 后新增的抽象层——区别于旧的 ModuleInjector：Environment 支持 standalone providers、支持 create() 派生子环境（懒加载路由时）、支持 DestroyRef。Injector.create() 是更底层的**脱离 Angular 生命周期**的静态注入器——TestBed 内部用 EnvironmentInjector 而非 Injector.create。一句话：app.config→EnvironmentInjector(root)→component 的 NodeInjector。

### 6. (B) 同事在 field initializer 里写了 `private svc = inject(SlowService)`，组件冷启动被拖慢——分析为什么 field initializer 会立即执行以及怎么改成 lazy。

**来源**：转述自本关 §一 field initializer 合法时机与 §六 effect/inject 边界

field initializer 在 class **实例化时立即执行**（JS 语义——constructor 之前所有 field 依次求值）；Angular 创建组件实例时所有 field init 同步跑——`inject(SlowService)` 触发该服务 useClass/useFactory 创建。若 SlowService 初始化耗时（如解析配置/预建缓存），组件渲染就被阻塞。改 lazy：① getter 包一层缓存：`private _svc?: SlowService; get svc() { return this._svc ??= this.injector.get(SlowService); }`（注意 getter 里不能用 inject()——不是构造上下文，但 `this.injector.get()` 可以）；② @defer 让组件本身延迟创建→field init 也延迟。

### 7. (C) Angular inject() 与 SolidJS 的 createContext/useContext 对比：两者在『作用域边界』上有什么本质不同？

**来源**：转述自本关 §七与 Solid/Vue inject 对照段（呼应 solid-context）

Solid 的 createContext 依赖**渲染树**——Provider 组件包住的子组件才能 useContext 拿到值；作用域=JSX 嵌套层级。Angular 的 DI 作用域=**注入器层级**（root/route/element）——与组件嵌套有重叠（element 天然沿父组件链）但 route/root 层完全独立于渲染树。关键差异：Solid context 是**单向向下传递**（Provider 父→Consumer 子），Angular DI 是**双向注册/消费分离**（providers 在 A 级注册、B/C/D 任何 inject 点消费——不必是子节点）。这使得 Angular 可以做『兄弟组件通过共享父 providers 通信』——Solid context 做不到（要提到共同祖先 Provider）。

### 8. (D) 面试官让你 5 分钟讲清『为什么 provider 数组里用 multi:true 而不是注册一个数组对象』——给出三条 multi 独有优势。

**来源**：转述自本关 §三 provider 四种写法与 multi 机制

① **增量注册**：多个模块/component 各自 `multi: true` 添加 handler——不需要一个中央汇总数组；新增 feature 只加一行 provider 不改别人。② **类型安全 + 解耦**：每个 provider 只知道 token 和自己的实例——不知道还有谁注册了同 token；数组方式需要所有人 import 同一个数组文件（耦合）。③ **注入顺序可控**：Angular 保证 multi providers 按注册顺序（父 injector 先于子 injector）组成数组——可以设计优先级。数组方案需手动 concat/push——没有框架保证顺序与生命周期（数组引用何时被 GC？multi provider 跟随 injector 销毁）。

### 9. (B) 一个组件用了 `private auth = inject(AuthService)` 但单测里报 `NG0200: The inject() function must be called within an injection context`——最可能的测试写法错误。

**来源**：转述自本关 §一注入上下文在测试中的保证（呼应 ng-testing）

最可能原因：测试里**直接 new 组件实例**而非通过 TestBed：
```ts
// ❌ 错误：直接 new 时 field initializer 无注入上下文
const comp = new MyComponent();
```
正确：
```ts
// ✅ TestBed 创建时框架设好注入上下文
const fixture = TestBed.createComponent(MyComponent);
const comp = fixture.componentInstance;
```
TestBed 走 Angular 的组件创建流程——创建时栈帧里有 injector→field init 里 inject 合法。另一种：用了 `TestBed.inject(MyComponent)` 这种不存在的方法也会报——TestBed 只用于 create 组件、拿服务用 `TestBed.inject(AuthService)`。

### 10. (A) 本关说『Angular DI 独立于渲染树』——具体到 SSR 场景，这个独立性带来什么实际收益？

**来源**：转述自本关 §五-七 DI 与渲染树解耦的 SSR 应用（预告 L8 ng-ssr）

SSR Node 进程同时处理多个 HTTP 请求。如果 DI 与渲染树耦合（像 React Context），你需要为每个请求创建一棵独立的虚拟渲染树并塞 Provider——成本高且与客户端代码分叉。Angular 独立于渲染树意味着：可以在请求到达时**创建一个请求级 EnvironmentInjector**（派生自 Platform Injector）→ 该请求内所有 inject() 自动走这个新 injector → 请求结束后销毁整个 injector——与渲染流程正交、不需要给每请求建一棵组件树。这是 @angular/ssr 做『每请求 DI 隔离』的框架基础。

### 11. (C) 为什么 Angular 官方弃用 forwardRef() 而 React 社区大量使用 cyclic dependency workaround？

**来源**：转述自本关 §五循环依赖处理与 React 模块循环引用的对比（呼应 sig-migrate）

Angular forwardRef 在 DI 层 lazy 解析——运行时发现两个 class 互引才延迟注入。问题：掩盖设计缺陷（循环说明拆分粒度错误）、运行时才暴露（编译期 TS 能检测到 module import 循环但 DI 不能）、且 SSR/AOT 下行为微妙。Angular 官方策略：用 lint 规则 + DI 设计原则推开发者**拆出第三方**——从源头消除循环。React 的循环 import（A 引 B、B 引 A）是 **ESM 模块系统**问题而非 DI 问题——没有框架级容器管谁创建谁——社区用 lazy require / 接口注入 / 事件总线 workaround。本质：Angular 有 DI 容器所以可以在架构层解决；React 没有 DI 所以循环只能在模块系统层凑。

### 12. (D) 设计一个『可插拔日志系统』：核心代码 inject(Logger) 拿当前环境的 Logger 实现（dev=ConsoleLogger、prod=RemoteLogger、test=MockLogger），给出 Angular DI 的完整实现方案。

**来源**：转述自本关 §三 useClass/useFactory + §五 provider vs import + 测试替换（呼应 ng-di-core §六）

```ts
// 1. 接口（非 class——用 InjectionToken）
export const LOGGER = new InjectionToken<Logger>('LOGGER');
export interface Logger { log(msg: string): void; }

// 2. 三种实现
@Injectable() export class ConsoleLogger implements Logger { ... }
@Injectable() export class RemoteLogger implements Logger { ... }

// 3. 各环境 app.config.ts
// environment.providers = [{provide: LOGGER, useClass: ConsoleLogger}]
// production.providers = [{provide: LOGGER, useClass: RemoteLogger}]

// 4. 消费
@Injectable({providedIn:'root'})
export class OrderService {
  private logger = inject(LOGGER);
  placeOrder() { this.logger.log('order placed'); }
}

// 5. 测试
TestBed.configureTestingModule({
  providers: [{provide: LOGGER, useValue: {log: vi.fn()}}]
});
```
加分：解释用 InjectionToken<Logger> 而非 `inject(Logger)`——因为 Logger 是 interface 无 class 实体、TS interface 编译后不存在不能做 DI key。

### 13. (B) ngInject 在 @defer 块里的组件中调用——有没有时序陷阱？

**来源**：转述自本关 §一时序与 ng-templates @defer 延迟加载

没有陷阱。@defer 只延迟组件的**创建时机**（首次满足触发条件才实例化），一旦创建就走正常 DI 流程——field init 里的 inject() 合法且有完整上下文。真正的时序注意：@defer 块内组件的 field init 比普通组件**更晚**执行——如果它的 service 被兄弟非 defer 组件的 effect 读取，defer 组件还没创建、该 service 的实例化也还没触发。但这不是 inject 报错而是『defer 内组件还不存在』的问题。

### 14. (D) 面试官问『你的 50 个 service 的工程怎么做 code review 防止有人不小心在 ngOnInit 里写 inject()』——给出自动化方案。

**来源**：转述自本关 §一 inject 上下文限制的工程化防御

方案：① **ESLint 自定义规则**：检测 `inject(` 调用出现在 constructor/field initializer/useFactory **之外**时 error——社区有 `@angular-eslint` 插件但缺此规则，可 fork 加一条 `no-inject-outside-injection-context`；② **Angular 编译器检查**（提案阶段）：strictTemplates 不检查 class body、但 Angular Language Service 在 IDE 里对非法位置 inject() 有黄色下划线——开 editor 警告→CI lint 时 `ng lint --max-warnings=0` 卡住；③ **Code Review checklist**：项目 CONTRIBUTING 写『inject 只允许出现在 field initializer 与工厂函数里』+ PR template 勾选项。最硬防线是 ①——把规则写进 lint 就不用人脑记。

### 15. (A) v14 起 useFactory 里允许 inject()——它与 v14 前 deps: [X, Y] 的旧写法在**执行时序**上有什么差异？

**来源**：转述自本关 §三 useFactory 与 v14 inject 变更

v14 前 `deps: [X, Y]`：DI 框架先解析 X、Y（递归创建 X 和 Y）→ 然后把它们作为**函数参数**传入 factory → factory 执行。执行顺序是**声明序**（deps 数组从左到右）。v14+ 工厂里 `inject(X)`：框架把工厂包进 runInInjectionContext → 工厂执行时 inject(X) **按需解析**——如果 X 已被缓存（root 单例之前创建过）直接返回、不重复创建。差异：**lazy 程度**不同——deps 数组是 eager（工厂调用前全部解析）、inject 是 factory 内按需（可能走到条件分支就不 inject 某个服务）。性能影响：条件工厂（只在 debug 模式才创建 MockLogger）用 inject 更高效。
