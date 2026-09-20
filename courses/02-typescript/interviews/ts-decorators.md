# ts-decorators 面试题精选

> 共 12 题，覆盖 **装饰器本质 / 老版与标准之争 / 类与方法装饰器 / DI 与元数据反射 / 参数装饰器 / 工程取舍** 六类。

---

## 一、装饰器本质

### 1. 用一句话解释装饰器是什么？它和普通高阶函数包装（`fn = wrap(fn)`）有何异同？

装饰器是"在声明处用 `@` 应用的高阶函数，于该声明定义时运行，可替换/增强目标或登记元数据"。与普通高阶函数包装**内核相同**（都是"接收一个东西、返回加工后的东西"），差别在**书写位置与执行时机**：装饰器贴着声明、在类定义阶段自动触发、有固定参数协议（老版 `(target,key,descriptor)`、新版 `(value,context)`），且能作用于方法/字段/参数这类"无法用普通赋值优雅包装"的目标。代价是它依赖 class 语法、需要编译开关、控制流被"藏"进元编程，可调试性不如显式 `const memo = memoize(fn)`（呼应第六节）。

**来源**：TC39 — "Decorators proposal"; TypeScript Handbook — "Decorators"

---

## 二、老版与标准之争

### 2. `experimentalDecorators` 打开的"老版装饰器"和 TS 5.0 的"标准装饰器"到底差在哪？为什么不能混用？

- **老版（Legacy，TS 长期实现）**：类装饰器 `(target)`、方法 `(target, key, descriptor)`、访问器同、字段 `(target,key)`、参数 `(target,key,index)`；配合 `emitDecoratorMetadata` 写 `design:*` 元数据。
- **标准（Stage 3）**：统一签名 `(value, context)`，`context` 带 `name/kind/static/private/access/addInitializer`，用 `Symbol.metadata`/`context.metadata` 累积元数据，**没有参数装饰器**、也没有 `emitDecoratorMetadata`。
不能混用：一个项目里由 `experimentalDecorators` 决定用哪套语义，二者函数签名与运行模型完全不同，库若为老版写（NestJS/TypeORM）你开标准版就**直接坏**。这也是当下生态割裂的最大痛点。

**来源**：TypeScript 5.0 — "Decorators (standard)"; Angular blog — "why we stayed on legacy decorators"

### 3. 为什么 NestJS/Angular/TypeORM 至今还用老版装饰器而不迁到标准版？

因为它们重度依赖两项老版才有的能力：① **参数装饰器**（`@Inject(token)`、Angular `@Optional()`、NestJS `@Body()/@Param()`）——标准 Stage 3 目前不含参数装饰器；② **`emitDecoratorMetadata` 的类型反射**（把构造参数类型写成 `design:paramtypes`），DI 靠它"按类型自动解析依赖"。迁到标准版会丢这两项，框架得改成显式 token 传递或 codegen，破坏性极大。所以 Angular 明确宣布长期支持 TS 版装饰器、NestJS 亦绑定老版语义。选型含义：用这些框架就**必须** `experimentalDecorators: true`（呼应 ts-project）。

**来源**：Angular — "Decorator support decision"; NestJS docs — "Dependencies / injection"

---

## 三、类与方法装饰器

### 4. 写一个类装饰器把被装饰的类"注册"进一个容器；再说明它如何"返回子类来增强"原类。

```ts
const container: Record<string, new (...a:any[])=>any> = {};
function injectable(name?: string) {
  return function <T extends new (...a:any[])=>any>(Ctor: T): T {
    container[name ?? Ctor.name] = Ctor;
    return Ctor;                 // 原样返回
  };
}

function withTimestamp<T extends new (...a:any[])=>any>(Ctor: T) {
  return class extends Ctor { created = Date.now(); };  // 返回子类 = 增强
}
```
类装饰器收到构造签名（呼应 ts-classes 第 8 题）：**side-effect 登记**（DI/路由/实体表）时原样返回；**增强**时返回继承并加成员的新类。TS 里"返回类型"要写成 `T` 或合适的构造签名，否则类型层面丢失原类成员——返回 `void` 会让 `new` 出来的实例类型变 `any`（老版特性）。

**来源**：NestJS — "@Injectable"; TypeScript Handbook — "Class Decorators / return value"

### 5. 方法装饰器如何实现 `@memoize`（缓存返回）？老版和标准版分别怎么拿到 descriptor/value？

老版：
```ts
function memoize(target:any, key:string, d:PropertyDescriptor) {
  const orig = d.value as Function; const cache = new Map();
  d.value = function (...a:any[]) {
    const k = a[0]; if (!cache.has(k)) cache.set(k, orig.apply(this,a));
    return cache.get(k);
  };
}
```
标准版：`(value, ctx)` 里 `value` 就是原方法、直接返回替换函数：
```ts
function memoize<T extends Function>(value:T, _ctx): T {
  const cache = new Map();
  return function (this:any,...a:any[]) { /* 同上 */ } as T;
}
```
老版靠**改 descriptor.value**、新版靠**返回新函数**。都丢失了原方法精确签名（缓存后 key 只取部分参数是常见近似），生产用记得 `this` 绑定与 key 策略（呼应 ts-functions、ts-classes 第 10 题 this）。

**来源**：lodash memoize; TC39 — "method decorator example"

---

## 四、DI 与元数据反射

### 6. 详细讲清 NestJS 的"按类型自动注入"从代码到运行时经历了什么。

编译期：`@Injectable()`（类装饰器）标记该类为 provider；`emitDecoratorMetadata` 把 `constructor(private a: A, private b: B)` 的参数类型编译成 `Reflect.defineMetadata('design:paramtypes', [A, B], UserService)`。运行时：DI 容器实例化 `UserService` 前读 `design:paramtypes` 得到 `[A,B]`，各自去容器解析（有则复用、无则递归 new），再 `new UserService(aInstance, bInstance)`。若某参数用 `@Inject(TOKEN)` 指定 token，则参数装饰器先记录"第 index 位用 TOKEN 解析"，覆盖"按类型"默认。核心：泛型擦除下类型本不可得，是 `emitDecoratorMetadata` **主动把类型当元数据留到了运行时**（呼应 ts-generic-constraints 第 7 题、ts-decorators 第四节）。

**来源**：NestJS — "Providers / injection"; reflect-metadata; emitDecoratorMetadata 文档

### 7. 没有 `emitDecoratorMetadata` 时，装饰器还能做 DI 吗？替代方案是什么？

能，只是"按类型自动解析"没了，得换成**显式携带标识**：① **token/字符串标识**——`@Inject('HTTP')` 或工厂注册 `provide: 'HTTP', useFactory: ...`，不依赖类型反射（Angular 新式 `inject(TOKEN)`、NestJS 接口/抽象类作 token 走 `@Inject`）；② **构造器令牌当值传**——把要注入的东西作为真实值/工厂传入（呼应 ts-generic-constraints 第 7 题 `new ()=>T`）；③ **函数式 DI / codegen**——用生成代码显式列出依赖，避免反射。这也提示：`emitDecoratorMetadata` 是"魔法"的来源之一，关掉它反而更易 tree-shake、更少运行时黑箱（标准版路线正是想摆脱对类型反射的依赖）。

**来源**：Angular — "InjectionToken / inject()"; NestJS — "custom providers / tokens"

---

## 五、参数与字段装饰器

### 8. 参数装饰器（老版）单独能用吗？为什么它通常要和类装饰器配合才生效？

参数装饰器 `(target, key, index)` **只被调用、不能替换参数**，它的唯一作用是**登记元数据**（如把"第 index 个参数绑定 token X"写进一个数组元数据）。它必须配合一个**类装饰器/方法读取方**（`@Injectable()` 或框架启动时）去**读取并执行**这些登记的元数据，才能产生实际效果——单独贴 `@Inject` 而没有类级收集，什么都不会发生。同理字段装饰器 `@Column()` 也要 ORM 在实体注册时遍历读取。理解"装饰器写元数据、另一个收集者读元数据"这套两阶段模型，是看懂 Nest/TypeORM/class-validator 的钥匙（呼应 ts-decorators 第五节）。

**来源**：NestJS — "@Param/@Body 如何被解析"; class-validator — "decorator metadata storage"

### 9. 字段/属性装饰器为什么"改不了字段初始值"？它实际能做什么？

老版字段装饰器 `(target,key)` 只能读写该属性的**元数据**（原型上的记录），拿不到实例、也没有 initializer 控制权——因为字段是在 `constructor` 里对每个实例赋值的，装饰器在**类定义期**运行、那时根本没有实例。所以 `@Column()` 只做"列名/类型/约束"登记，映射在运行时由库遍历实例 + 元数据完成。标准版更规范：用 `context.addInitializer` 在**每个实例初始化时**注入逻辑（可真正 defineProperty / 设只读）。想"改默认值"要么靠 `useDefineForClassFields` 语义（呼应 ts-classes 第 3 题），要么库在实例化后回填。

**来源**：TC39 — "field decorator / addInitializer"; TypeORM — "@Column"

---

## 六、工程取舍与坑

### 10. 装饰器为什么被批"魔法太重"？哪些具体代价让团队犹豫？

① **控制流隐藏**——行为发生在"库读取元数据"的时刻，不在你看到的调用处，调试要跨反射层；② **两套语义割裂**——老版/标准不兼容，库选型绑死编译开关（第 2、3 题）；③ **依赖 class**——与函数式/组合式主流（hooks、Vue setup）气质不符；④ **`this`/绑定/顺序坑**——多个装饰器求值顺序"从内到外、自下而上"、执行顺序另有讲究，`useDefineForClassFields` 还会改字段装饰行为；⑤ **类型反射拖慢启动、不利摇树**。所以除框架强约束（Nest/Angular/TypeORM）外，业务代码普遍倾向显式函数/组合替代（呼应 ts-advanced 第 12 题、ts-frameworks）。

**来源**：社区 — "decorators considered harmful / magic"; Angular 迁移讨论

### 11. 求值顺序题：多个装饰器叠加 `@A @B method(){}`，谁先执行？返回值的装饰器能替换方法吗？

**装饰器表达式自上而下求值**（先算 `A`、再算 `B`，即拿到各自的装饰器函数），但**作为函数应用是自下而上**——离方法最近的 `B` 先执行、其结果（若返回新 descriptor/函数）再交给 `A`。老版：方法装饰器若 `return descriptor` 会覆盖；返回 `undefined` 则原地修改的 descriptor 生效。标准版：每个装饰器接收上一个的返回值作为 `value`，可链式替换。字段/访问器同理有明确顺序规定。面试点：记住"**靠近声明的先应用**"，且"**返回值会替换、或需显式原地改**"（老版最易踩"改了 descriptor 却因返回 void 被忽略"的坑，第 4 题）。

**来源**：TC39 — "decorator evaluation order"; TypeScript Handbook — "Multiple decorators"

### 12. 让你在新项目里就是否引入装饰器做技术决策，你会怎么选？

分三类。**跟着框架走**：选 NestJS/Angular/TypeORM 就接受老版装饰器 + `experimentalDecorators`/`emitDecoratorMetadata`（这是框架价签，团队文档写清调试方法）。**能不用就不用**：纯前端函数式（React hooks / Vue 组合式）或 Node 服务里，优先高阶函数、显式注册表、codegen、`satisfies`/泛型推断来表达"横切关注点"（缓存、日志、校验），更透明可测（呼应 ts-advanced、ts-functions）。**自研库慎用**：一旦发布就绑死用户编译开关与两套语义。总原则：装饰器解决的是"声明处元编程 + 集中登记"，只有在"就地声明比显式调用更 DRY 且团队能驾驭其魔法"时才用，否则显式优于隐式（呼应 ts-mapped 第 12 题"可读性优先"）。

**来源**：Angular/NestJS 官方要求; 社区 — "composition over decorators"; Effective TS — Item 43
