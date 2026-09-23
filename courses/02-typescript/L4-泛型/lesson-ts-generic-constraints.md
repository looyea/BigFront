# 泛型约束

> 目标：**用 `extends` 给类型参数加约束**，让泛型在"适配多类型"的同时能安全访问成员；掌握 `keyof` 约束、`extends` 默认组合、约束多类型参数关系、以及"类型令牌 / 构造器签名"等常见约束技巧。

---

## 一、为什么需要约束

裸 `T` 对编译器"一无所知"，不能访问任何属性（上一关已见）。`extends` 声明"`T` 至少长这样"，于是 `T` 上就有了该形状的成员可用：

```ts
interface HasLength { length: number }

function longest<T extends HasLength>(a: T, b: T): T {
  return a.length >= b.length ? a : b;   // ✓ 约束里承诺了 length
}
longest("abc", "fo");       // string 有 length ✓
longest([1, 2], [1]);       // 数组有 length ✓
// longest({}, {a:1});      // ✗ 没有 length
```

约束本质：把 `T` 的"值域"从"所有类型"缩小到"`HasLength` 的子类型"。函数体内可按 `HasLength` 用，函数体外保留调用者的**精确**类型（返回 `"abc"` 仍是 `string` 不是 `HasLength`）。

---

## 二、`keyof` 约束——属性名安全访问

TS 最著名的惯用法：确保第二个参数是第一个对象的有效键，并让返回类型精确到该属性：

```ts
function get<O extends object, K extends keyof O>(obj: O, key: K): O[K] {
  return obj[key];
}

const user = { name: "Ada", age: 36 };
get(user, "name");    // string（O[K] = typeof user['name']）
get(user, "age");     // number
get(user, "nope");    // ✗ "nope" 不在 keyof typeof user
```

- `keyof O` 得到 O 所有键的字面量联合（`"name" | "age"`）；
- `O[K]`（索引访问类型）得到该键对应的值类型；
- 于是"传错键名"编译即失败、返回类型自动精确——这是很多工具类型和库 API 的骨架（呼应 ts-utility）。

`keyof` 常用于从对象字面量派生联合：`type Keys = keyof typeof config;`（呼应 ts-object-types）。

---

## 三、约束之间的关联

多类型参数可用 `extends` 表达相互关系：

```ts
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}

// 用第一个参数决定第二个的合法范围
function setProp<O extends Record<string, unknown>, K extends keyof O>(
  obj: O, key: K, val: O[K]
): void { obj[key] = val; }
```

`K extends keyof O` + `val: O[K]` 保证"键与值类型对应"——写 `setProp(obj,'age','x')` 会报错，因为 `age` 键要求 `number`。

---

## 四、约束的其它形态

```ts
// 约束到函数签名
function once<T extends (...args: any[]) => any>(fn: T) { /* ... */ }

// 约束到构造器（"类型令牌"，绕过擦除拿到运行时构造器）
function create<T>(ctor: new () => T): T { return new ctor(); }
class Point {}
create(Point);          // T 推断为 Point ✓

// 约束到抽象类/组件类
function bind<T extends abstract new (...a: any) => any>(cls: T) { /* ... */ }

// 多个约束用 &：T extends A & B
```

构造器约束 `new () => T` 是泛型擦除下"把类型信息作为值传入"的标准技巧（呼应 ts-generic 第 9 题、ts-classes）。

---

## 五、约束 + 默认类型参数

```ts
function pick<T, K extends keyof T = keyof T>(obj: T, keys?: K[]): Pick<T, K> {
  // 不传 keys 时默认取全部键（K 默认 keyof T）
  const ks = (keys ?? Object.keys(obj)) as K[];
  const out = {} as Pick<T, K>;
  for (const k of ks) out[k] = obj[k];
  return out;
}
```

注意默认里可以引用**前面已确定的类型参数**（`K extends keyof T = keyof T`），顺序敏感（呼应 ts-generic 第 8 题）。

---

## 六、约束会让"字面量不拓宽"

`T extends string` 会保留调用时传入的字面量类型（抑制拓宽），常用于精确返回：

```ts
function makeConst<T extends string>(s: T): T { return s; }
const v = makeConst("hello");   // v: "hello"（不是 string）
```

配合模板字面量约束还能校验字符串形状（`T extends `/${string}``，路由前缀等，见 ts-mapped）。

---

## 七、常见坑：约束后仍访问不到成员

```ts
function bad<T extends object>(o: T, k: string) {
  // return o[k];   // ✗ k 是普通 string，TS 不知它是 keyof T
}
function good<T extends object>(o: T, k: keyof T) {
  return o[k];       // ✓
}
```

访问 `obj[key]` 要求 `key` 类型是 `keyof T`，否则"任意字符串"不被允许索引。这是从 `any`/JS 迁来最容易忘的一条（也受 `noImplicitAny` 索引检查影响，见 ts-strict）。

---

## 八、自检清单

- [ ] 裸 `T` 为什么不能访问属性？`extends` 改变了什么、没改变什么（调用者视角）？
- [ ] `get<O, K extends keyof O>(o: O, k: K): O[K]` 每一部分各起什么作用？
- [ ] 如何表达"键与值类型对应"的 setProp？
- [ ] 泛型擦除下，怎样用一个构造器参数拿到运行时类型信息？
- [ ] 默认类型参数能引用前面的类型参数吗？顺序有要求吗？
- [ ] 为什么 `o[k]` 里 `k: string` 不行、`k: keyof T` 才行？

---

## 🚀 部署预告

- `keyof` + 索引访问是**几乎所有内置工具类型（Pick/Omit/Record/Partial）与 ORM/请求库类型安全**的根基（呼应 ts-utility、Prisma/Express）；
- 构造器约束/类型令牌是 DI 容器、序列化、`Response<T>` 反序列化分派的常用手法（呼应 03-nodejs、框架课）；
- 当"输出类型要**根据输入类型计算**"时，`extends` 就不够了——需要**条件类型 + infer**，正是下一关。

下一关 **ts-conditional-infer**——条件类型与 `infer`，让类型能"如果…就…"并从结构中"挖出"类型。
