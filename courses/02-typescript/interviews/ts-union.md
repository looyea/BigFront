# 面试题 · 联合、交叉与可辨识联合

1. **联合类型的成员访问规则？**
   只能访问**所有成员的公共部分**。想访问独有属性必须先**类型收窄**。

2. **什么是类型收窄（narrowing）？常见手段？**
   typeof 守卫、instanceof、in 操作符、可辨识标签、相等判断、自定义类型谓词 `x is T`、控制流（if/switch/循环）分析。

3. **可辨识联合（discriminated union）为什么强？**
   ```ts
   type Shape = { kind:'circle'; r:number } | { kind:'rect'; w:number; h:number };
   function area(s: Shape) {
     switch (s.kind) {
       case 'circle': return Math.PI * s.r**2;
       case 'rect': return s.w * s.h;
       default: const _: never = s; // 加了新 kind 忘处理，编译期报错
     }
   }
   ```
   穷尽性检查（exhaustiveness）是 TS 的一大杀器。

4. **交叉类型 `A & B` 常见用法与陷阱？**
   - 用于 mixin、组合对象。
   - 陷阱：若 A.x: string、B.x: number，则 A&B 的 x 是 never（无值同时既字符串又数字），编译器不会提前警告。

5. **`never[]` 与 `undefined[]` 分别什么时候出现？**
   空数组推断 `never[]` 常见于严格模式；解决方法是显式标注 `const arr: T[] = []`。

6. **`NonNullable<T>` 与 `T extends null|undefined ? never : T` 的等价关系？**
   前者是官方工具类型，后者是展开式。作用是剥离 null/undefined。

7. **类型谓词 `x is T` 与普通 boolean 返回值的区别？**
   谓词能触发调用点的**类型收窄**；返回 boolean 则不会。写自定义守卫必须用 `is`。
   ```ts
   function isString(x: unknown): x is string { return typeof x === 'string'; }
   ```

8. **什么是协变 / 逆变？为什么函数参数是逆变的（strictFunctionTypes）？**
   - 协变：子类型 → 子类型（数组/返回值）
   - 逆变：子类型 → 父类型（函数参数）
   `strictFunctionTypes` 让函数**参数**按逆变检查，比早期双向协变更安全。
