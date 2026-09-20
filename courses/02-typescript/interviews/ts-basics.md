# 面试题 · TypeScript 基础类型与类型推断

1. **any、unknown、never 有什么区别？**
   - any：关闭类型检查，**任何操作都通过**，不推荐。
   - unknown：类型安全的 any，**必须先收窄**（typeof/instanceof/in）才能使用。
   - never：不可能出现的值；用于穷尽性检查（switch default）、抛不出返回的函数、递归条件类型终止。

2. **type 和 interface 的差别？什么时候用哪个？**
   - 都能声明对象类型、都能 extends/implements。
   - interface 可**声明合并**（同名 interface 字段自动合并，适合扩展库类型）；type 可以用联合、交叉、映射、条件、工具类型等。
   - 惯例：对外暴露的公共 API 用 interface；内部复杂类型运算用 type。

3. **`as const` 干什么？**
   把类型收窄到最具体的字面量：数组变只读元组、对象属性变只读字面量类型。常用于枚举式的常量表：
   ```ts
   const DIRS = ['up','down'] as const;      // readonly ['up','down']
   type Dir = typeof DIRS[number];            // 'up' | 'down'
   ```

4. **类型断言 `<T>x` 与 `x as T`、`x as unknown as T` 的边界？**
   as 只在**存在继承关系**时允许。跨无关类型必须先 `as unknown as T`。断言是「骗过编译器」，运行时不发生任何检查——滥用是灾难。

5. **什么是类型擦除？为什么运行时看不到类型？**
   TS 编译为 JS 时类型注解会被移除。所以 `if (x is User)` 不存在；运行时判断必须用 `typeof` / `instanceof` / 自定义类型谓词。

6. **`void`、`undefined`、`null` 的区别？**
   - void：函数没有返回值。
   - undefined：变量已声明未赋值。
   - null：显式「无对象」。strictNullChecks 下，null/undefined 都不属于其他类型。

7. **函数重载 vs 联合参数，你会怎么选？**
   签名关系复杂（不同参数不同返回）用重载；只是「几种类型都接受」用联合类型；参数是有限字面量用枚举/联合字面量。

8. **写出一个函数签名的严格版**：`function pick(obj, keys)` 输入类型应保证 keys 是 obj 的 key 且返回值是子对象类型。
   ```ts
   function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { ... }
   ```
