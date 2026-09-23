# 面试题 · ES2018

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）对象 spread `{ ...obj }` 与 `Object.assign({}, obj)` 的差别？**
- 参考要点：① spread **不触发 setter**（走 CreateDataPropertyOrThrow），assign 触发（走 [[Set]]）；② 都会被 Proxy `set` trap 拦截，但 spread 更"直白"；③ spread 只能建**新对象**，assign 可修改 target；④ spread 支持 Symbol 键与 getter 求值——**都支持**。**面试答**：主要差别是「是否走 setter」。
- 来源：MDN；StackOverflow；Dr. Axel Rauschmayer 2ality。

---

**2）什么是 `for await...of`？给一个 Node 流处理场景。**
- 参考要点：AsyncIterable 的语法糖——每次 `next()` 返回 Promise，`for await` 自动 await 再进循环体。**Node 场景**：
  ```js
  for await (const chunk of fs.createReadStream('big.txt')) {
    process(chunk);
  }
  ```
  Readable 从 Node 10+ 原生实现 `Symbol.asyncIterator`。
- 来源：MDN；Node.js stream 文档；TC39 asynchronous-iteration 提案。

---

**3）`Promise.prototype.finally` 里 throw / return 会怎样？**
- 参考要点：**throw**：覆盖上游状态，整条链变 rejected；**return**：**不吞**上游 value 或 reason，只走清理逻辑；**返回 Promise**：等它 settle 才继续。设计原则：finally **不改变链的结果**。
- 来源：MDN；ECMA-262 §27.2.4.6。

---

**4）什么是命名捕获组？怎么读结果？**
- 参考要点：`/(?<year>\d{4})-(?<month>\d{2})/` —— 结果 `m.groups.year` / `m.groups.month`；也能直接解构 `const { year, month } = m.groups`。**取代** `m[1]` 的可读性飞跃。
- 来源：MDN 正则命名捕获组；TC39 提案；RegExp 官方文档。

---

**5）正则 `s` / `m` / `y` / `u` 标志分别是什么？**
- 参考要点：`s`（dotAll）：`.` 匹配 `\n`；`m`（multiline）：`^` `$` 匹配每行首尾；`y`（sticky）：从 `lastIndex` 开始必须匹配；`u`（unicode）：按码点匹配、启用 `\p{...}`。**ES2018 加了 `s`**。
- 来源：MDN 正则标志。

---

**6）什么是 lookbehind？给两个例子。**
- 参考要点：`(?<=X)Y` 前面必须是 X（正向）；`(?<!X)Y` 前面不能是 X（负向）。例：`(?<!\$)\d+` 匹配不带 $ 前缀的数字；`(?<=\p{L})'(?=\p{L})` 匹配单词中间的撇号。**⚠️** Safari 16.4 才支持——工程上常避免。
- 来源：MDN lookbehind；caniuse；Safari 官方博客。

---

**7）`\p{Script=Han}` 与 `\p{Emoji}` 是什么？**
- 参考要点：**Unicode Property Escape**——按 Unicode 字符类别匹配；必须配 `u` 标志。`\p{Script=Latin}` 匹配拉丁字母、`\p{White_Space}` 匹配空白、`\P{...}` 取反。终于不用手写 `[\u4e00-\u9fff]`。
- 来源：TC39 regexp-property-escapes 提案；unicode.org/reports/tr18。

---

**8）ES2018 为什么被称为「async/await 补票年」？**
- 参考要点：ES2017 引入 async/await，但**没有**：① `for await...of`（异步迭代）→ 直到 ES2018；② `Promise.finally`（链式清理）→ 直到 ES2018。对象 spread 也长期是 babel 插件 → 2018 标准化。**这一年把异步生态与对象操作补齐**。
- 来源：TC39 提案时间线；2ality ES2018 总结文章。

---

**9）对象 rest `const { pwd, ...rest } = user` 是浅拷贝还是深拷贝？**
- 参考要点：**浅拷贝**——`rest` 新建对象但属性值仍是引用（嵌套对象共享）。**pwd 不会被拷进去**（被解构走了）。**追问**：性能上比 `delete clone.pwd` 更好——只遍历一次。
- 来源：MDN；2ality。

---

**10）**以下代码打印什么？**
```js
const a = { x: 1, get y() { return 2 } };
const b = { ...a };
console.log(b.x, b.y, Object.getOwnPropertyDescriptor(b, 'y'));
```
- 参考要点：`b.y` 是**求值后的 2**——spread 触发 getter 拷贝**值**，不保留 getter 描述符。`getOwnPropertyDescriptor(b, 'y')` 得到 `{ value: 2, writable: true, enumerable: true, configurable: true }`。
- 来源：MDN spread；StackOverflow 高票。

---

**11）**如何在没有 `for await` 的环境实现「异步迭代」？**
- 参考要点：手写 while 循环 + `await it.next()`：
  ```js
  const it = asyncIterable[Symbol.asyncIterator]();
  while (true) {
    const { value, done } = await it.next();
    if (done) break;
    process(value);
  }
  ```
  Babel 降级时产物就是这个模式（regenerator）。
- 来源：MDN；Babel regenerator 产物。

---

**12）**现场手写：用对象 spread 实现一个 `patchObj(target, patch)`——嵌套对象**递归合并**。**
- 参考要点：
  ```js
  function deepMerge(target, patch) {
    const out = { ...target };
    for (const k of Object.keys(patch)) {
      const tv = target[k], pv = patch[k];
      out[k] = (isPlainObj(tv) && isPlainObj(pv)) ? deepMerge(tv, pv) : pv;
    }
    return out;
  }
  const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  ```
  **追问**：为什么不用 `Object.assign` 递归？—— assign 只浅合并一层，遇到嵌套对象直接覆盖。
- 来源：Redux combineReducers 源码思想；MDN。
