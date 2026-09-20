# 面试题 · ES2018→ES2024 新语法巡礼

1. **可选链 `?.` 和空值合并 `??` 的取舍？**
   - `a?.b` 仅在 a 为 null/undefined 时短路，等价 `a == null ? undefined : a.b`。
   - `x ?? 'def'` 只在 null/undefined 用默认值；`||` 会把 0 / '' / false / NaN 也当假值。
   组合使用：`obj?.a?.b ?? 'fallback'`。

2. **`??=`、`||=`、`&&=` 是？**
   逻辑赋值运算符（ES2021）。例：`a ??= 1` 相当于 `a = a ?? 1`，但仅在 a 为 null/undefined 时才执行右侧。

3. **`Promise.allSettled` 和 `Promise.any` 分别解决什么？**
   - allSettled：想要「不管怎样都要看完所有结果」。
   - any：只要有一个成功就行（竞速容灾）。

4. **String.prototype.replaceAll / matchAll 有什么用？**
   - replaceAll：替换所有匹配，不需要正则；正则参数必须是全局 /g 否则报错。
   - matchAll：迭代所有正则匹配，带捕获组；替代 while + exec 的老写法。

5. **结构化克隆 structuredClone 和 JSON 深拷贝差别？**
   structuredClone 支持 Date/RegExp/Map/Set/ArrayBuffer/循环引用；不支持函数、Symbol、DOM 节点、原型链。JSON 更弱，Date 会变字符串。

6. **Array.prototype.at(i) 好在哪？**
   支持**负索引**（`arr.at(-1)` 取最后一个），字符串同样有。

7. **Object.hasOwn(obj, key) 与 in、hasOwnProperty 有何区别？**
   - `in` 会查原型链。
   - `hasOwnProperty.call` 绕开 obj 上被覆盖的 hasOwnProperty。
   - `Object.hasOwn`（ES2022）是外置函数、更安全，等价后者。

8. **Top-level await（ES2022）能用在哪儿？**
   ESM 模块顶层。CJS 与 `.js` 未启用 type:module 时不行。常用于异步初始化配置、动态 polyfill。

9. **WeakRef / FinalizationRegistry（ES2021）为什么需要？**
   在缓存池等场景中，避免强引用阻止 GC；但规范明确不保证一定回调，不能当资源清理用。

10. **ES2024 里的 `ArrayBuffer.prototype.transfer` 与 `structuredClone` 有什么关系？**
    transfer 让 ArrayBuffer 的所有权可以「转移」给新 buffer（旧的 detach），比克隆零拷贝更快，配合 send 消息特别有用。
