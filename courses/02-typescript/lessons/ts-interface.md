# L2 · interface 与 type 别名

> 🎯 目标：用 `interface`/`type` 描述对象和函数的"形状"，掌握可选属性、只读属性，并知道两者如何取舍。

## 一、给对象建模

```ts
interface User {
  readonly id: number;   // 只读，创建后不可改
  name: string;
  age?: number;          // 可选属性（问号）
}

const u: User = { id: 1, name: '小明' }; // age 可省略
// u.id = 2;  // ❌ 只读报错
```

## 二、type 别名也能干同样的活

```ts
type ID = string | number;        // 给类型起别名
type Point = { x: number; y: number };
type Handler = (e: Event) => void; // 函数类型
```

## 三、interface vs type，怎么选？

| | `interface` | `type` |
| --- | --- | --- |
| 扩展方式 | `extends` | `&`（交叉） |
| 同名声明合并 | ✅ 自动合并 | ❌ 报错 |
| 能表示联合/元组/映射 | ❌ | ✅ |

经验法则：**描述对象/类的形状用 `interface`；需要联合、元组、工具类型运算时用 `type`。** 团队协作中二者大多可互换，别在选型上内耗。

## 四、继承与交叉

```ts
interface Animal { name: string }
interface Dog extends Animal { bark(): void }   // interface 继承

type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;                      // type 用交叉
```

## 五、索引签名（描述"字典"对象）

```ts
interface StringMap {
  [key: string]: string;   // 任意字符串键 → 字符串值
}
const headers: StringMap = { 'Content-Type': 'application/json' };
```

## 六、动手示例

- `ts-interface/01-shape.ts` —— 用 interface 描述一条"课程"数据

```bash
node courses/02-typescript/examples/ts-interface/01-shape.ts
```

完成「本关小测」+ `homework/L2.md` 进入 L3。
