# 面试题 · 箭头函数与 this 的词法绑定

1. **箭头函数和普通函数在 this 上的差别？**
   箭头函数**没有自己的 this**，它沿词法作用域链向上找第一个非箭头函数的 this 并绑定，且**永远无法被 call/apply/bind 改变**。

2. **箭头函数还有哪些「没有」？**
   没有 arguments、没有 prototype、没有 new.target，不能当构造函数（new 会抛错），不能作为对象方法（this 会指向外层而不是对象）。

3. **下面代码输出什么？为什么？**
   ```js
   const obj = {
     a: 1,
     get() { return () => this.a; }
   };
   const fn = obj.get();
   console.log(fn());
   console.log(fn.call({ a: 99 }));
   ```
   - 都输出 `1`。因为 `get()` 里的箭头函数在**执行 get 时**捕获了 obj 作为 this，call 无法改写。

4. **什么时候该用箭头、什么时候不该？**
   - 用：回调、纯函数式映射（map/filter/reduce）、需要继承外层 this 的场景（如 React 类组件事件处理）。
   - 不用：对象方法、原型方法、构造函数、需要动态 this 的函数（如 addEventListener 中 handler 的 this 应为元素本身时，用 function 或直接接 event 参数）。

5. **rest 参数和 arguments 的区别？**
   rest 是真数组、只包含定位之后的参数、可以被解构和 spread；arguments 是类数组对象、包含所有实参、箭头函数中不可用。

6. **默认参数的陷阱**：`function f(x = 1) { return arguments.length; }`，`f(undefined)` 返回什么？
   返回 1（arguments 反映的是**实际传入的**参数数量，与默认值无关）；但 x 是 1。这题体现「arguments 与形参脱钩」的语义。
