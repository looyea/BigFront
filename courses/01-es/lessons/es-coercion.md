# 隐式转换与 == 规则

> 目标：**说清 ToPrimitive 三步走、== 的完整算法、`+` 运算符的双重身份**；能现场推 `[] + {}`、`{} + []`、`[![]] == 1`；养成「一律 ===」的工程习惯。

---

## 一、抽象运算：规范层就三块基石

规范里所有「隐式转换」最终都归到 3 个抽象操作：

1. **ToPrimitive(value, hint)**：把 object 变成 primitive。
2. **ToNumber(value)**：变成 number（可能 NaN）。
3. **ToString(value)**：变成 string。

**ToPrimitive 三步走**（这是所有隐式转换的源头）：
1. 若已有 `Symbol.toPrimitive` → 调用它，返回 primitive 即结束。
2. `hint === 'string'`（如 String(obj)、模板字符串）：先 `toString()`，若得 primitive 就返回；否则再 `valueOf()`。
3. `hint === 'number'` 或默认（算术运算）：先 `valueOf()`，若得 primitive 就返回；否则再 `toString()`。
4. 两步都没得到 primitive → `TypeError`。

**Object 默认的 valueOf** 返回自己（不是 primitive），**默认的 toString** 返回 `[object Object]`——所以 `Number({})` = `Number('[object Object]')` = `NaN`。

---

## 二、`+`：JavaScript 里最精神分裂的运算符

**规则**：只要**两侧任一**是 string（或 ToPrimitive 后是 string），走字符串拼接；否则走数字相加。

```js
1 + 2         // 3
'1' + 2       // '12'
1 + '2'       // '12'
1 + true      // 2 (true→1)
'1' + true    // '1true'
[] + 1        // '1' ([] → '' + 1 → '1')
[] + []       // ''
{} + 1        // 在语句位置：{} 被解析成空块，1 单独求值 → 1
             // 在表达式位置（如 console.log({} + 1)）：'[object Object]1'
[1] + [2]     // '12' (each → '1', '2')
[1,2] + [3]   // '1,23' (join with comma)
null + 1      // 1 (null → 0)
undefined + 1 // NaN (undefined → NaN)
1 + Symbol()  // TypeError（唯一硬禁：Symbol 不参与任何算术）
```

**⚠️ 关于 `{} + 1` 的经典谣言**：网上常有人说得 2 或 0 或 `[object Object]1`——真相是**取决于运行环境把 `{}` 解析成语句块还是对象字面量**：
- 在 REPL / Node 中直接输入 `{} + 1` → 得到 `1`（前面 `{}` 被解析成空块，剩下 `+1` = 1）。
- 写 `console.log({} + 1)` 或 `({} + 1)` → 得 `'[object Object]1'`。
- 浏览器 devtools 里输入 `{} + 1` → 得 `0`（有些引擎把空块丢弃后 `+1` 又被解析成 `+` 一元运算符后跟 1，实际行为不同版本有差异）。

**结论**：别再记这个具体值，记住**它是解析歧义**，写代码请用括号消歧。

---

## 三、其他运算符：一律先 ToNumber

`- * / % ** 位运算 一元 + 一元 -` 全部**只走数字**。

```js
'5' - '3'      // 2
'5' * '2'      // 10
true + false   // 1
[] - 1         // -1 ([]→''→0)
[] * 2         // 0
+'42'          // 42（一元 + 是显式转 number 的写法）
-'42'          // -42
+true          // 1
+null          // 0
+undefined     // NaN
+[1,2]         // NaN（→ '1,2' → Number('1,2') = NaN）
+{}            // NaN
```

**工程小贴士**：`+x` 与 `Number(x)` 结果一样，但更短；不过 **可读性不如 `Number(x)`**。Terser 常把 `Number(x)` 压成 `+x`，反过来别在源码里炫技。

---

## 四、`==` 完整算法（14 步，值得背一次）

`x == y`：

1. 类型相同 → 走严格相等（=== 的规则）。
2. `null == undefined` → true（**这是唯一让 null/undefined 相等**的规则；其他跟任何值都不等）。
3. Number vs String → 把 String 转 Number 再比。
4. 任一侧是 Boolean → 双方 ToNumber 再比。
5. 一侧是 Number/String/Symbol/BigInt，另一侧是 Object → Object ToPrimitive（默认 hint）再比。
6. 两侧都是 BigInt vs Number → 数学比较。
7. 其他组合（比如 Object vs Object）→ 只有同一引用才 true。

**经典翻车题**：

```js
0 == ''         // true   都是数字侧 0
0 == '0'        // true
false == '0'    // true   双方 ToNumber：0 == 0
false == null   // false  null 只能等于 undefined
false == []     // true   []→'' →0；false→0
'' == []        // true   同上
'' == {}        // false  {}→'[object Object]'
[] == []        // false  引用不同！
1 == [1]        // true   [1]→'1'→1
[1] == [1]      // false  两个引用
```

**⚠️**：`[] == false` 是真，`[] == ![]` 也是真（`![]` = false，`[] == false` = true），面试最爱问。

---

## 五、`===` 的规则更朴素

- 两侧类型不同 → false（不做任何转换）。
- 类型相同：
  - primitive：值等 → true（`NaN !== NaN`，`+0 === -0` 例外）。
  - object：**同一引用**才 true。

想按值比较对象 → 用 `Object.is` 处理 ±0/NaN 特例、手写深比较、或用 `lodash.isEqual`。

**`Object.is(x, y)` 与 `===` 的差别只在**：
- `Object.is(NaN, NaN) === true`
- `Object.is(0, -0) === false`

---

## 六、Boolean 上下文（真值 / 假值）

**8 个假值（falsy）**：`false`、`0`、`-0`、`0n`、`''`、`NaN`、`null`、`undefined`。
**其他一切都是真值**（包括 `[]`、`{}`、`'0'`、`' '`）。

```js
if ([]) { ... }        // true：[] 是真值
Boolean([]) === true   // 但 [] != true, [] == true → true? 都是 true，因为 ToNumber([]) = 0, ToNumber(true) = 1
                       // 更正：[] == true → false; [] == ![] → true（因 ![] = false）
```

工程实践：判空数组/对象**永远不要 `if (arr)`**（永远是真），要 `arr.length > 0`。

---

## 七、显式转换的正确写法

| 目标 | 推荐写法 | 避免写法 |
| --- | --- | --- |
| to Number | `Number(x)` | `+x`, `parseInt(x)`（不带基数）, `x * 1` |
| to String | `String(x)` 或 `` `${x}` `` | `x + ''` |
| to Boolean | `Boolean(x)` 或 `!!x` | 依赖 if 隐式 |
| to Int | `Math.trunc(x)` / `x \| 0`（32 位内） | `parseInt(x)` 不传基数 |

**`parseInt('0x10')` 得 0**（老规范）或 16（新规范部分环境）——传基数 `parseInt('0x10', 16)`；`parseInt('12px')` = 12 是它的隐藏技能也是坑。**优先 `Number('12')`**。

---

## 八、工程守则（三条硬规矩）

1. **一律 `===`**：ESLint `eqeqeq: ['error', 'always', { null: 'ignore' }]` 允许 `== null` 简写。
2. **别写 `[] + {}` 这种依赖 ToPrimitive 的表达式**：显式 `String(arr)` 或 `arr.join('')`。
3. **模板字符串比 `+` 拼接安全**：`${a}${b}` 明确走字符串路径。

---

## 九、自检清单

- [ ] 说出 ToPrimitive 的三步顺序与 hint 的两种取值。
- [ ] 默写 `+` 与其他算术运算符在转换上的差别。
- [ ] 说出 `==` 的 14 步算法里的关键 5 条。
- [ ] 现场推导 `[] == ![]` 为什么是 true。
- [ ] 说出 `Object.is` 与 `===` 的两个差别。
- [ ] 列出 8 个 falsy 值。
- [ ] 说出为什么工程上强制 `===`，并给出你打算引入的 ESLint 配置。

---

## 🚀 部署预告（本关点到，细节在 L10）

**构建工具怎么对待隐式转换？**

1. **Terser / esbuild 会做「数字转换压缩」**：把 `Number(x)` 压成 `+x`，把 `String(x)` 压成 `x+""`——**功能等价但源码可读性差**。反过来说，你源码里 `+x` 的写法，压缩器不会改回去，运行时开销一致。
2. **`parseInt(x)` 不带基数的 bug 会被 ESLint / TS 编译期抓**——CI 里必须开这些规则；否则线上偶发的八进制解析（`parseInt('010')` = 8）你到部署后才发现。
3. **Babel `@babel/plugin-transform-for-of` 在把 `for..of` 降级时**会插入 `Symbol.iterator` 检查，这些检查在旧引擎里会走隐式转换路径——这也是**降级产物变臃肿**的原因之一。**尽量用 `Array.prototype.forEach` 或普通 `for`**，构建产物更小。
4. **运行时 profiling**：`x == y` 在 V8 里比 `x === y` 多几道 ToPrimitive 分派——热循环里差别不小。生产火焰图上看 `Number::EqualValue` 频繁出现，八成是隐式转换搞的鬼。

细节在 L10 `es-build` 展开。**你现在只需要记住**：**每一次隐式转换都是一次跨抽象层的函数调用——理解它、避开它、必要时显式**。
