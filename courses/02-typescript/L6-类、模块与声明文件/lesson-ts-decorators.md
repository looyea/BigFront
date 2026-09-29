# 装饰器：类与成员的元编程

> 目标：理解装饰器（Decorator）这一"贴在 class/方法/属性/参数上的高阶函数"——它如何在**定义期**修改或附加元数据。分清 TS 老版 `experimentalDecorators`（NestJS/Angular 依赖、配 `emitDecoratorMetadata`）与 TC39 标准装饰器（TS 5.0、Stage 3）两套语义，读懂 `@injectable`、`@Controller`、`@Column` 背后的机制，并知道何时该用、何时该避（呼应 ts-classes 构造签名、ts-frameworks、03-nodejs/NestJS）。

---

## 一、装饰器是什么

装饰器 = **一个函数，前面加 `@` 贴在声明上，在该声明被定义时运行，可读取/修改被装饰的目标**。语法早于 TS（源自 Babel 提案），TS 提供两种实现：

```ts
// 目的：写一个标准（TC39）方法装饰器，在定义期把 fetch 换成"带日志"的版本
// 注：标准装饰器需 TS 5.0 默认语义；老版 experimentalDecorators 签名不同（见第二节）
function logged(target: any, ctx: ClassMethodDecoratorContext) {
  // 返回的新函数会替换原方法：先打日志，再用 apply 调原实现（保留 this 与参数）
  return function (this: any, ...args: any[]) {
    console.log("call", ctx.name);          // ctx.name 即被装饰成员名 "fetch"
    return (target as Function).apply(this, args);  // 转调原方法，返回其结果
  };
}

class Svc {
  @logged fetch() { return "data"; }        // 定义期 fetch 已被换成带日志的版本
}

// ✅ 应用：调用被装饰方法时，先输出日志再拿到原返回值
new Svc().fetch();   // 控制台打印: call fetch   （表达式值为 "data"）
```

装饰器分五类作用对象：**类装饰器、方法装饰器、属性（字段）装饰器、访问器装饰器、参数装饰器**。

---

## 二、两套装饰器：老版 vs 标准（务必分清）

| | 老版 `experimentalDecorators` | TC39 标准（TS 5.0+，默认语义） |
|---|---|---|
| 开关 | `tsconfig` 设 `"experimentalDecorators": true` | 不开了即用新版 |
| 签名 | `(target, propertyKey, descriptor)` / 参数装饰器 `(target, key, index)` | `(value, context)`，context 含 `name/kind/addInitializer` 等 |
| 元数据 | 配 `emitDecoratorMetadata` + `reflect-metadata` 反射类型 | 用装饰器自己 `context.metadata` / `Symbol.metadata` |
| 用户 | NestJS、TypeORM、老 Angular | 新库、Lit、部分构建器 |
| 参数装饰器 | 有（`@Inject`、`@Body()`） | Stage 3 暂未含参数装饰器 |

关键：**NestJS/Angular/TypeORM 目前仍基于老版**——它们靠 `emitDecoratorMetadata` 把参数的"设计期类型"写进 `Reflect.defineMetadata("design:paramtypes", ...)`，DI 才能据此自动注入（第四节）。所以用这些框架时 `experimentalDecorators: true` + `emitDecoratorMetadata: true` 是必需项（呼应 ts-project）。

---

## 三、类装饰器：注册与增强

```ts
// 目的：用类装饰器工厂把类"定义即注册"进一个容器（DI/路由表/实体表的常见形态）
const registry = new Map<string, Function>();
function register(name: string) {          // 装饰器工厂（带参装饰器都是"工厂返回装饰器"）
  return function <T extends new (...a:any[]) => any>(Ctor: T) {
    registry.set(name, Ctor);             // side-effect：把构造器存进 registry
    return Ctor;                            // 可返回新类替换原类（这里原样返回）
  };
}

@register("user") class User { }            // 定义即注册进 registry

// ✅ 应用：容器能按名字取回构造器并实例化
registry.get("user");        // => User 的构造器（Function）
new (registry.get("user") as any)();  // => 创建一个 User 实例
// ❌ registry.get("admin");  // => undefined：未注册过的名字取不到（不是报错而是空值，消费前需判空）
```

类装饰器接收构造签名 `new (...a)=>T`（呼应 ts-classes 第 8 题），要么**side-effect 登记**（DI 容器、路由表、实体表），要么**返回子类做增强**（mixins，如给类加方法）。带参数的 `@register("x")` 是"装饰器工厂"——先调用工厂拿到真正的装饰器函数（TS 语法要求）。

---

## 四、DI 的真实机制（NestJS 风格）

```ts
// 目的：示意 NestJS 风格 DI——类装饰器打标记、参数装饰器指定注入 token
// 注：本节为老版 experimentalDecorators 语义，需配 emitDecoratorMetadata，不能用 node 类型擦除直接跑
@Injectable()                         // 类装饰器：打元数据标记为"可注入"
class UserService {
  constructor(
    @Inject(REPO) private repo: Repo, // 参数装饰器：指定注入 token（REPO 是提供者令牌）
    private http: HttpService,        // 无 @Inject → 靠 emitDecoratorMetadata 反射出 HttpService
  ) {}
}
// 容器读到这份元数据后，等价于帮你 new UserService(container.get(REPO), container.get(HttpService))
```

老版装饰器 + `emitDecoratorMetadata` 会把 `constructor` 各参数的**类型**编译期记录为 `design:paramtypes`（一个构造函数数组）。运行时 DI 容器读这份元数据 + 参数装饰器存的 token，就知道"该 new/查哪个 provider 塞进哪个位置"——这正是"泛型擦除下运行时拿不到类型"问题的破解：类型信息被装饰器**主动写进了元数据**（呼应 ts-generic-constraints 第 7 题构造器令牌）。没有 `emitDecoratorMetadata`，基于类型的自动注入就失效。

---

## 五、方法 / 字段 / 访问器装饰器

```ts
// 目的：示意方法/字段/访问器装饰器的三类典型包装（@readonly/@cache/@logGetter 为示意，需自行实现）
// 注：同样是老版/自定义装饰器语义，不能直接用 node 跑；重点看"装饰器贴在哪类成员上"
class Repo {
  @readonly id!: string;              // 字段装饰器：把 id 设为只读（addInitializer 里 defineProperty）

  @cache                              // 方法装饰器：缓存返回值（同参二次调用直接命中缓存）
  expensive(n: number) { /* 耗时计算 */ return n * n; }

  @logGetter                          // 访问器装饰器（呼应 ts-classes 第 9 题 get/set）：get 被读时打日志
  get fullName() { return `${this.first} ${this.last}`; }
}
```

方法/访问器装饰器典型用途：`@memoize`、`@debounce`、`@throttle`（呼应 ES 防抖节流）、AOP 式 `@log`、权限 `@Roles("admin")`、校验 `@IsEmail()`（class-validator，呼应 Express L5）。字段装饰器多用于 ORM 列映射 `@Column()`、序列化 `@Expose()`——它们**只登记元数据**、不改值，真正行为在库运行时读元数据执行。

---

## 六、装饰器 vs 别的元编程手段

- **vs 高阶函数包装**（`once(fn)`、`useMemo`）：装饰器在**声明处**、语法更贴；但依赖 class 语法与开关，且新版/老版语义割裂。纯函数场景直接 `const memo = memoize(fn)` 更清晰、无框架锁定（呼应 ts-functions）。
- **vs 显式注册**（`router.get("/x", handler)`）：装饰器"就地声明 + 自动收集"更 DRY，但控制流被推迟、调试更难（元数据是"魔法"来源）。
- **vs 宏 / codegen**（babel 宏、`tsc` 插件、构建期生成）：装饰器是运行时行为，codegen 是编译期。能用普通函数/组合表达清楚的，别上装饰器——它是可读性与"魔法"的权衡（呼应 ts-advanced 第 12 题"别炫技"）。

---

## 七、自检清单

- [ ] 装饰器本质是什么函数、什么时候运行？五类作用对象？
- [ ] 老版 `experimentalDecorators` 与 TS 5.0 标准装饰器签名差异？为何 NestJS 仍用老版？
- [ ] `emitDecoratorMetadata` + `reflect-metadata` 如何让 DI "按类型自动注入"？
- [ ] `@register("x")` 这种带参装饰器为什么是"工厂返回装饰器"？
- [ ] 字段装饰器和类装饰器分别常用于什么（元数据登记 vs 注册/增强）？
- [ ] 什么情况下应该用普通高阶函数而不是装饰器？

---

## 🚀 部署预告

- 装饰器 + `emitDecoratorMetadata` 依赖的 `experimentalDecorators`、`target`、`useDefineForClassFields` 等选项，属于 **L7 ts-project** 的 `tsconfig.json` 全解；
- 类 + 装饰器 + DI 的完整落地在 **ts-frameworks**（NestJS）与 09-express 的后端组织方式呼应；
- 装饰器"写元数据、运行时读"的模式，与 ts-declarations 第 12 题"从值推断类型 / 代码生成"同属"让静态与动态同源"的工程哲学。

下一关进入 **L7 配置、严格模式与迁移**——**ts-project**：`tsconfig.json` 全解与工程结构。
