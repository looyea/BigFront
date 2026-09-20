# L4 · 泛型入门

> 🎯 目标：理解泛型就是"类型的参数"，让你写的函数/接口能适配任意类型，同时**保留**类型信息，而不是退回 `any`。

## 一、为什么需要泛型

先看没有泛型的问题：

```ts
function firstOf(arr: any[]): any { return arr[0]; }
const x = firstOf([1, 2, 3]); // x 是 any，类型信息丢了 ❌
```

用泛型 `T` 把"进来的类型"传出去：

```ts
function firstOfT<T>(arr: T[]): T { return arr[0]; }
const y = firstOfT([1, 2, 3]);   // y 推断为 number ✅
const z = firstOfT(['a']);       // z 推断为 string  ✅
```

`T` 是一个占位类型，调用时由实参**自动推断**填入。

## 二、泛型约束 `extends`

限定 `T` 至少满足某种形状：

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
longest('abc', 'fo');     // 字符串有 length，OK
longest([1, 2], [1, 2, 3]); // 数组也有 length，OK
```

## 三、泛型接口与类型别名

```ts
interface Box<T> {
  value: T;
  unwrap: () => T;
}
const b: Box<number> = { value: 1, unwrap: () => 1 };
```

Vue3 的 `Ref<T>`、React 的 `useState<T>` 本质都是泛型接口/泛型函数。

## 四、默认类型参数

```ts
function create<T = string>(v: T): T[] { return [v]; }
```

## 五、多个类型参数

```ts
function pair<K, V>(k: K, v: V): [K, V] { return [k, v]; }
pair('id', 42); // [string, number]
```

> 心智口诀：**看到 `any` 想要退场，就用 `T` 顶上。** 泛型让"复用"和"安全"兼得。

## 六、动手示例

- `ts-generic/01-generic.ts` —— 泛型函数 + 泛型接口

```bash
node courses/02-typescript/examples/ts-generic/01-generic.ts
```

完成「本关小测」+ `homework/L4.md`，最后一关讲工程配置。
