# L6 · 你该知道的现代糖精（ES2018→ES2024）

> 🎯 目标：认识近几版标准里"出现频率最高"的语法糖，让你读现代开源代码不再发怵。ES 每年 6 月发布新版，这里挑真正改变写法的讲。

## 一、可选链 `?.`（ES2020）

安全地读取深层属性，中间任一环是 `null/undefined` 就直接返回 `undefined` 而**不报错**：

```js
const city = user?.address?.city;        // 不用一层层 if 判断
const top = list?.[0];                   // 可选元素访问
const val = obj.getMethod?.('x');        // 可选调用：不是函数就不调用
```

## 二、空值合并 `??`（ES2020）

只在**左边是 `null` 或 `undefined`** 时取右边。区别于 `||`：

```js
0 || 10        // 10  ❌ 把合法的 0 也当成"假值"
0 ?? 10        // 0   ✅ 只兜住 null/undefined
'' ?? '默认'   // ''
```

设置默认值时优先用 `??`，避免 `||` 误伤 `0 / '' / false`。

## 三、逻辑赋值 `||= &&= ??=`（ES2021）

```js
config.timeout ??= 3000;   // 等价于 config.timeout = config.timeout ?? 3000
```

## 四、`Promise.allSettled`（ES2020）与 顶层 `await`

`allSettled` 见 L5。**顶层 await** 允许你在 ESM 文件最外层直接 `await`，不必包在 async 函数里（Node 模块、Vite 配置里很常见）。

## 五、`Array.prototype.at()`（ES2022）

支持负索引，一行取倒数元素：

```js
const arr = [1, 2, 3];
arr.at(-1);  // 3（旧写法 arr[arr.length - 1]）
arr.at(0);   // 1
```

## 六、Class 字段与私有 `#`（ES2022）

```js
class Counter {
  count = 0;              // 公有字段（以前必须在 constructor 里赋）
  #secret = 'hidden';     // 私有字段，外部无法访问
  inc() { this.count++; return this.#secret; }
}
```

Vue3 组合式、很多库的源码都用到 class 字段语法。

## 七、对象方法 + `Object.hasOwn`（ES2022）

```js
Object.hasOwn(obj, 'name');   // 比 'name' in obj / obj.hasOwnProperty 更安全
```

## 八、往后还会遇到什么

- **Record & Tuple、管道 `|>`、模式匹配**：仍在提案阶段（Stage 1-3），尚未进入稳定标准。学习时**以官方 TC39 与 MDN 为准**，不要照抄过网上的"ES20xx"教程语法——这也是本课程反复强调"警惕幻觉/过时信息"的原因。

## 九、动手示例

- `es-modern/01-sugar.js` —— 上面这些糖的最小可运行演示

```bash
node courses/01-es/examples/es-modern/01-sugar.js
```

🏆 完成「本关小测」+ `homework/L6.md`，你就**通杀了 JavaScript 基础包**，正式进入 TypeScript！
