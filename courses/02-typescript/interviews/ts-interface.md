# 面试题 · 接口与面向对象

1. **interface 与 type 的 extends/implements 差别？**
   interface 可以 extends 多个；type 用交叉 &。class 只能 implements interface（或 type 描述的对象形状）。

2. **什么是结构化类型（structural typing / duck typing）？**
   TS 只比较**形状**，不比名字：只要一个对象有接口要求的所有成员，就视为实现该接口。所以不需要 `implements` 也是兼容的。

3. **可选属性 `?` 与 `| undefined` 的差别？**
   - `prop?: string`：属性可以不存在。
   - `prop: string | undefined`：**必须**存在，但可以显式给 undefined。
   `exactOptionalPropertyTypes: true` 会让这个差别更严格。

4. **readonly 与 const 的区别？**
   readonly 是属性级；const 是变量绑定级。readonly 仅在编译期有效，运行时可通过反射绕过。

5. **什么是索引签名？**
   ```ts
   interface Dict { [k: string]: number }
   ```
   描述「未知键、已知值类型」的对象。同时有具名键时，具名键类型必须能被索引签名类型覆盖。

6. **如何写一个 class 私有字段？TS 的 private 和 ES2022 的 # 有什么区别？**
   - `private x`：**只在编译期有效**，运行时有这个属性。
   - `#x`：ES2022 原生私有字段，运行时也无法访问（外部抛 SyntaxError），支持 WeakMap 语义。

7. **抽象类 abstract 与 interface 的取舍？**
   abstract 可以带实现、字段、构造函数；interface 只能声明形状。多态基类用 abstract，跨层级契约用 interface。

8. **接口的声明合并典型用例？**
   扩展第三方：`declare module 'express' { interface Request { user?: User } }`，让 `req.user` 有类型。
