# ts-classes 面试题精选

> 共 12 题，覆盖 **class 类型语义 / 可见性与私有 / 抽象类与接口 / 泛型类与构造签名 / 结构化 vs 名义 / 访问器与 this** 六类。

---

## 一、class 类型语义

### 1. TypeScript 的 class 相比 ES 原生 class 多了什么？编译后哪些会消失？

TS 在 ES class 语法上叠加**类型层**：成员类型注解、`public/private/protected` 可见性、`readonly`、`abstract`、`implements`、泛型类、参数属性、装饰器。编译（类型擦除，呼应 ts-intro）后，**类型注解、可见性、`abstract`、`implements`、泛型参数、`readonly`、参数属性的"类型部分"** 全部消失——参数属性会额外生成 `this.x = x` 赋值语句（这是唯一带运行时代码的语法糖之一）。留下的运行时结构就是普通 ES class。想运行时真私有必须用 ES `#field`，而非 TS `private`。

**来源**：TypeScript Handbook — "Classes"; Effective TS — Item 39

---

## 二、可见性与私有

### 2. `private`、`protected`、`public` 的访问范围分别是什么？它们有运行时效果吗？

`public`（默认）任意处可访问；`protected` 类内 + 子类内；`private` 仅类内。三者**都只有编译期效果**，`tsc` 之后产物里没有任何访问限制，JS 侧 `obj.anyPrivateField` 照样读得到。要"运行时也禁止"用 ES 私有字段 `#name`（编译目标支持时原样保留、或降级成 `WeakMap`）。实践：`private` 表达"这是内部实现、外部别依赖"，同时它会**改变类型兼容规则**（第 6 题）。TS 4.3 起还有 `#private` 字段与 `private` 可并存的写法（`declare` 字段用于仅类型不生成的场景）。

**来源**：TypeScript Handbook — "Modifiers"; MDN — "Private class fields"

### 3. 什么是"参数属性（parameter property）"？`useDefineForClassFields` 开启后字段初始化语义有什么坑？

参数属性是在构造参数前写可见性修饰符（`constructor(private readonly x: number){}`），TS 自动"声明字段 + 赋参值"。坑在 `useDefineForClassFields`（`target: ES2022`+ 默认 true）：字段改用 `Object.defineProperty` 语义（`[[Define]]`）而非赋值（`[[Set]]`）。后果：① 派生类字段初始化会**覆盖**基类构造器里对同名字段的赋值；② `declare field: T`（仅声明不初始化）变得必要，否则会被 `undefined` 覆盖；③ 依赖 setter 的初始化写法失效。迁移老代码遇到"字段莫名变 undefined"常与此有关（呼应 ts-project、ts-migration）。

**来源**：TypeScript 3.7/4.0 — "useDefineForClassFields"; TS Wiki — "breaking changes"

---

## 三、抽象类与接口

### 4. 抽象类和接口该如何选？何时必须用抽象类？

都能"约定子类要实现什么"。选**接口**当只需要"形状契约"、要能被任意无关类型隐式满足、一个类要实现多个时。选**抽象类**当你需要：① 提供**共享的具体实现**（普通方法/字段初始化，接口不能有实现体）；② 表达"这是一族类型的部分实现基类"的名义关系（含 `private`/`protected` 时其兼容是名义的，可防止无关类冒充）；③ 构造器逻辑。经验："能接口就别抽象类"（呼应 ts-interface 优先接口），但需要复用实现或做模板方法模式时，抽象类不可替代。二者可结合：抽象类 `implements` 接口。

**来源**：TypeScript Handbook — "abstract classes vs interfaces"; Effective TS — Item 39

### 5. `implements` 会影响类的类型兼容性或产生运行时代码吗？

都不会。`implements Draggable` 只是**编译期**让 TS 检查"该类是否具备 `Draggable` 要求的全部成员"，缺了就在 `class` 行报错。它不改变任何运行时行为（擦除后消失），也不改变类型兼容——因为 TS 本就是结构化判断，类只要形状对就与接口兼容，`implements` 与否无关。它的价值是"提前把违约暴露在声明处"，以及作为文档。注意 `implements` 不能带实现、不能实现"值"（如 enum/class 的静态侧），只能实现类型形状（呼应 ts-interface、ts-declarations 的 declare）。

**来源**：TypeScript Handbook — "implementing an interface"

---

## 四、泛型类与构造签名

### 6. 为什么含 `private` 成员的类，即使 public 形状完全相同也互不兼容？这带来什么好处与坏处？

TS 结构化类型对 `private`/`protected` 开了例外：两个类型要在这些成员上兼容，必须**声明自同一处**（同一继承链）。好处：能模拟"名义类型"——`class UserId{private _b:0}` 与 `class OrderId{private _b:0}` 形状一样也不许互换，防串号（同 ts-advanced 品牌类型的思路，只是用类实现）。坏处：单元测试/mock 里想用一个"形状相同"的假对象替换真类实例会报错，得改成 `interface` 依赖或 `as unknown as`。设计取舍：需要跨实现替换就依赖 `interface`（面向接口而非具体类），需要名义防护才用带 private 的类/品牌。

**来源**：TypeScript Specification — "type compatibility / private & protected"; Effective TS — Item 39

### 7. `Stack<T>` 泛型类相比 `Stack<any>` 或运行时判类型，价值在哪？类型参数为何不能用在 static 上？

泛型类让"容器元素类型"随实例参数化：`Stack<number>` 的 `push` 只收 number、`pop` 返回 `number|undefined`，编译期防错装、免手动断言（对比 `<any>` 完全放弃检查，呼应 ts-any-unknown）。擦除后运行时拿不到 `T`，所以类内不能 `new T()` / `x instanceof T`——要"类型当值"必须走构造签名参数（第 8 题）。`static` 属于"类对象本身"、在所有实例之外，而 `T` 是"每个实例化时确定的"，静态作用域无法绑定到某个 `T`，故禁止引用（要用泛型得写成泛型静态方法 `static create<U>(...):Stack<U>`）。

**来源**：TypeScript Handbook — "Generic Classes"; StackOverflow — "static cannot use class type parameter"

### 8. 解释"构造签名 `new (...args)=>T`"在依赖注入里的作用，以及为何需要 `abstract new`。

DI 框架把"要实例化的类"当值注册与注入，构造签名 `new (...a:any[])=>T` 既描述"可被 new、产出 T"，又让 TS 从传入的具体类反推出实例类型 `T`，于是 `container.resolve(UserService)` 的返回类型是 `UserService` 而非 `any`（泛型擦除下的"类型令牌"，呼应 ts-generic-constraints 第 7 题）。当注册的是抽象类（不能直接 new，但其具体子类能）时，普通 `new ()=>T` 不接受抽象构造签名的值，需要 TS 4.2 的 `abstract new (...a)=>T` 来正确描述"能 new 出 T 的类（可能抽象）"，用于基类约束与 mixin 类型。

**来源**：Angular DI / NestJS providers; TS 4.2 — "abstract construct signatures"; type-fest — Constructor

---

## 五、访问器与 this

### 9. `get`/`set` 访问器在类型系统里如何表现？读写类型能不一样吗？

`get f()` 让 `f` 像只读属性一样出现在类型里（`number`），`set f(v)` 允许赋值。TS 4.3 起 `get` 与 `set` 可有**不同**类型（读 `number`、写 `string` 也合法），此前要求一致。坑：① 访问器有副作用/计算成本，调用方却当"字段"用，易被误放进热路径；② `useDefineForClassFields` 下基类 setter 可能不被派生类字段初始化触发（呼应第 3 题）；③ `readonly` 与 setter 冲突。类型上表现为对象的属性签名，可用 `Object.getOwnPropertyDescriptor` 语义理解。装饰器关会再讲访问器装饰（呼应 ts-decorators）。

**来源**：TypeScript 4.3 — "separate read/write types for accessors"; Handbook — "Getters/Setters"

### 10. 类方法作为回调传递时 `this` 丢失，有哪些标准解法？`noImplicitThis` 帮了什么？

`const f = obj.method; f()` 里 `this` 不再是 obj（脱离绑定，呼应 ES this 关）。解法：① 箭头函数字段 `method = () => { /* this 词法绑定到实例 */ }`（Babel/TS class fields）；② 传参时 `.bind(obj)` 或包一层 `() => obj.method()`；③ 用装饰器 `@bind` 自动绑。`noImplicitThis`（strict 家族一员）会在 `this` 可能为 `undefined`/隐式 any 的位置报错，逼你显式处理——比"运行时 undefined 崩了才发现"早一步（呼应 ts-strict）。类型层面还可给函数标 `this: void` 明确"此函数不依赖 this"，防止误用。

**来源**：TypeScript — "This types / this: void"; Effective TS — Item 40

---

## 六、工程综合

### 11. mixin（混入）在 TS 里怎么用类型表达？为什么需要 `abstract new` 或交叉类型？

mixin 是"接收一个基类、返回加了新成员的派生类"的函数：
```ts
type Ctor = abstract new (...args:any[]) => {};
function Timestamped<T extends Ctor>(Base: T) {
  return class extends Base { createdAt = Date.now(); };
}
class Service {}
class MyService extends Timestamped(Service) {}   // MyService 同时有 Service 成员 + createdAt
```
关键是构造签名约束入参基类、返回的新类类型用 `extends Base` 让 TS 把两者成员**交叉**起来。抽象基类作为 mixin 目标时必须用 `abstract new`（普通 `new` 不收抽象类）。多个 mixin 叠加用连续 `extends MixinA(MixinB(Base))`，成员类型自动合并（呼应 ts-interface 交叉、ts-generic-constraints）。

**来源**：TypeScript Handbook — "Mixins"; TS — "class expressions extending generic base"; type-challenges

### 12. 在函数式/组合式（Vue3、React hooks）大行其道的今天，你怎么看 TS class 的定位？

看场景而非站队。**适合 class**：NestJS/Angular 等以"类 + 装饰器 + DI"为骨架的框架（装饰器天然作用于类/成员，呼应 ts-decorators）；确有"继承 + 共享实现 + 名义身份"需求的领域模型（`Error` 子类、状态机、插件基类）；需要构造签名当令牌传类型的地方。**优先函数/组合**：纯数据变换、React/Vue 组件逻辑、无状态工具——函数组合通常比深继承更可测、更好 tree-shake、避 `this` 坑（呼应 ts-functions、ts-frameworks）。原则：TS class 是"类型化的运行时组织工具"，用它的理由是"需要运行时类语义（继承/DI/实例身份）"，而非"看起来 OOP"。滥用继承（脆弱的基类、深层次）反而是负债。

**来源**：Effective TS — Item 39/43; Angular/NestJS docs — "why classes"; React — "Composition over Inheritance"
