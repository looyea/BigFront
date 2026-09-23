# 类、继承与面向对象的类型

> 目标：掌握 TypeScript 在 ES  class 之上叠加的**类型能力**——成员可见性（`public`/`private`/`protected`）、`readonly`、抽象类与抽象方法、实现接口 `implements`、静态成员、构造签名 `new () => T`、`get`/`set` 访问器、以及类与结构化类型系统的微妙关系（`private` 破坏结构兼容）。这些是 NestJS、Angular、以及一切 OOP 风格 TS 代码的地基（呼应 03-nodejs、ts-frameworks）。

---

## 一、TS 给 class 加了什么

ES 已有 `class`（`constructor`、`extends`、`super`、`#private`、`static`、`get/set`——呼应 ES class 关）。TS 在其上加的是**类型层**：字段/方法类型注解、可见性修饰符、`abstract`、`implements`、泛型类、`readonly`、参数属性。关键认知：**TS 的 `private`/`protected` 只在编译期生效，擦除后不存在**（呼应 ts-intro）；真正的运行时私有是 ES 的 `#field`。

```ts
class Point {
  constructor(public x: number, public y: number) {}  // 参数属性：一行声明+赋值
  toString() { return `(${this.x}, ${this.y})`; }
}
```

`public x: number` 写在构造参数上叫**参数属性（parameter property）**，自动声明字段并赋值，省去 `this.x = x` 样板。

---

## 二、可见性：public / private / protected

```ts
class Bank {
  public balance = 0;        // 默认即 public
  private vaultKey = "secret";   // 仅类内可访问（编译期）
  protected auditLog: string[] = [];  // 类内 + 子类可访问
  withdraw(n: number) { this.balance -= n; this.audit(); }
  private audit() { /* ... */ }
}
class Vault extends Bank {
  show() { return this.auditLog; }   // ✓ protected 可访问
  // peek() { return this.vaultKey; } // ✗ private 不可
}
```

三档严格度：`private` < `protected` < `public`（可访问范围）。要点：
- 都是**编译期**约束，编译产物里字段照样能被 JS 访问（要硬私有用 `#field`）；
- `private`/`protected` 会**破坏结构化类型兼容**——见第六节，这是 TS 类最反直觉之处。

---

## 三、readonly 与静态成员

```ts
class Config {
  readonly version = "1.0";        // 只能在声明处/构造器内赋值
  static defaultHost = "localhost";// 静态：属于类本身，不属于实例
  static create() { return new Config(); }  // 静态工厂
}
const c = new Config();
// c.version = "2";  // ✗ readonly
Config.defaultHost;  // 通过类名访问静态成员
```

`readonly` ≈ 字段级"只读属性"（编译期，呼应 ts-object-types `Readonly`、ts-utility `Readonly<T>`）。`static` 成员挂在类构造函数对象上，`Config.create()` 是常见"静态工厂 / 命名构造"模式；泛型类里静态成员**不能**用类的类型参数（静态作用域看不到实例的类型参数）。

---

## 四、抽象类与 implements

```ts
abstract class Shape {
  abstract area(): number;              // 抽象方法：无实现，强制子类给出
  describe() { return `area=${this.area()}`; }  // 普通方法可复用
}
// new Shape();  // ✗ 抽象类不能实例化
class Circle extends Shape {
  constructor(private r: number) { super(); }
  area() { return Math.PI * this.r ** 2; }   // 必须实现抽象方法
}

interface Draggable { drag(): void; }
class Win implements Draggable {   // implements：约束类必须满足接口形状，不引入类型
  drag() {}
}
```

`abstract` 类"不能被 new、专为被继承"，可含**已实现**的共享方法（这是它和 interface 的关键差异——interface 不能有实现体）。`implements` 只是"编译期检查该类具备接口要求的全部成员"，并**不**让类成为接口的子类型来源（TS 结构化，本来形状对就行，呼应 ts-interface）。

---

## 五、泛型类与构造签名

```ts
class Stack<T> {
  private items: T[] = [];
  push(x: T) { this.items.push(x); }
  pop(): T | undefined { return this.items.pop(); }   // 呼应 ts-basics 数组 pop 返回 |undefined
}
const s = new Stack<number>();   // 显式类型实参

// 类的"构造签名"：描述能 new 出 T 的东西（呼应 ts-generic-constraints 第 7 题构造器令牌）
type Ctor<T> = new (...args: any[]) => T;
function makeAndLog<T>(C: Ctor<T>): T { const x = new C(); console.log(x); return x; }
```

泛型类把"容器元素类型"参数化（`Stack<T>`、`EventEmitter<EventMap>`）。`new (...) => T` 是构造签名类型，是"把类当值传递 + 保留实例类型"的标准手段，DI 框架的 token、mixins 全靠它（呼应 ts-decorators）。抽象类的构造签名用 `abstract new () => T`。

---

## 六、类与结构化类型的微妙：private 让兼容变名义

```ts
class A { private secret = 1; x = 2; }
class B { x = 2; }              // 与 A 的 public 形状相同
let a: A = null as any;
// a = new B();   // ✗ B 没有 A 的那个 private secret
```

TS 默认结构化（"长得一样就算同一类型"，呼应 ts-object-types），但**带 `private`/`protected` 成员的类之间不能互相赋值，除非来自同一继承链**——因为私有成员是"名义"的、别的类无法持有同一个私有声明。这是"鸭子类型里混入名义类型"的唯一例外，也是把 `interface` 字段设成 `private` 模拟品牌/名义类型的原理（呼应 ts-advanced 第 6 题）。想跨类结构兼容就别用 `private`。

---

## 七、访问器、索引签名与 `this`

```ts
class Temp {
  private _c = 0;
  get f() { return this._c * 9 / 5 + 32; }   // getter：像属性一样读
  set f(v: number) { this._c = (v - 32) * 5 / 9; }  // setter
}
```
`get`/`set` 访问器在类型上表现为一对读写类型（可不对称：读 `number` 写 `string` 需 `get`/`set` 各自注解，TS 4.3 起允许）。类方法里的 `this` 默认按"所在类实例"推断；作为回调丢失 `this` 时，用箭头函数字段或 `this: void` 参数处理（呼应 ts-functions `this` 参数）。`noImplicitThis`（呼应 ts-strict）会抓住裸 `this` 指向不明的 bug。

---

## 八、自检清单

- [ ] TS 的 `private` 和 ES 的 `#field` 有什么本质区别（编译期 vs 运行时）？
- [ ] 参数属性 `constructor(public x: T)` 省了什么？
- [ ] 抽象类和接口都能"强制子类实现"，差别在哪？
- [ ] `implements` 会改变类的类型兼容性吗？为什么？
- [ ] 为什么含 `private` 成员的两个"public 形状相同"的类互不兼容？
- [ ] `new (...args:any[]) => T` 构造签名有什么典型用途？

---

## 🚀 部署预告

- 把"类当值传递 + 构造签名"用到极致，就是下一站 **ts-decorators** 的 `@injectable` / NestJS 控制器——类 + 装饰器 + DI token 是后端 TS 框架的骨架（呼应 03-nodejs、ts-frameworks）；
- 类只是代码组织手段之一，下一关 **ts-modules** 讲 `import`/`export`、命名空间、`esModuleInterop` 等"如何跨文件组织与共享类型"（呼应 ts-declarations）；
- `private` 破坏结构兼容这一"名义例外"，和 ts-advanced 品牌类型一脉相承，遇到"想强制类型不可互换"时优先想到它们。

下一关进入 **ts-modules**：模块化、导出导入与常见互操作坑。
