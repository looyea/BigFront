# 面试题 · 泛型与工具类型

1. **`<T extends U>` 约束的作用？**
   保证 T 至少有 U 的形状，让函数体里可以安全访问 U 上的成员。

2. **`keyof`、`typeof`、`in` 组合的经典用法？**
   ```ts
   function get<O extends object, K extends keyof O>(o: O, k: K): O[K] { return o[k]; }
   ```
   keyof typeof obj 是从对象字面量派生「属性名联合」的标准套路。

3. **实现 `Partial<T>`、`Required<T>`、`Pick<T,K>`、`Omit<T,K>`。**
   ```ts
   type Partial<T> = { [P in keyof T]?: T[P] };
   type Required<T> = { [P in keyof T]-?: T[P] };
   type Pick<T, K extends keyof T> = { [P in K]: T[P] };
   type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
   ```
   面试几乎必考一个。

4. **条件类型与 infer 关键字？**
   ```ts
   type ElementType<T> = T extends (infer U)[] ? U : T;
   type ReturnType2<T> = T extends (...a:any) => infer R ? R : never;
   ```
   infer 让你在**类型模式匹配**里「挖出」一个未知类型。

5. **分布式条件类型是什么？**
   裸类型参数在条件类型中会自动分配到联合的每个成员：`T extends U ? X : Y`，当 T = A|B → (A 分支)|(B 分支)。用 `[T] extends [U]` 可以关闭分布式。

6. **映射类型如何加修饰符？**
   ```ts
   type Readonly2<T> = { readonly [P in keyof T]: T[P] };
   type New<T, K extends keyof any> = { [P in K as `get_${string & P}`]: () => T[P] };
   ```
   `as` 子句用于**键重命名**（TS 4.1+）。

7. **什么是「模板字面量类型」？**
   ```ts
   type Route = `/${string}`;
   type Greeting = `hello ${'world'|'ts'}`;   // 'hello world' | 'hello ts'
   ```
   用于路由、事件名、CSS 变量等字符串模式约束。

8. **泛型默认值和推断顺序？**
   从左往右推，显式提供部分时会剩下默认值。默认值中可用前面已确定的 T，如 `<T, K extends keyof T = keyof T>`。
