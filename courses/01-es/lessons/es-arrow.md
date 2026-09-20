# L2 · 箭头函数与 this 的词法绑定

> 🎯 目标：会写箭头函数，理解「没有自己的 this」到底是什么意思，知道什么时候**不该**用它。

## 一、语法速写

```js
const add = (a, b) => a + b;          // 单表达式，隐式 return
const square = x => x * x;            // 单参数可省括号
const greet = name => {               // 多行要带 {} 和显式 return
  const msg = `Hi, ${name}`;
  return msg;
};
```

> ⚠️ 常见坑：`const f = () => { name: 'x' }` 会被解析成函数体而非对象字面量，返回 `undefined`。返回对象要加括号：`() => ({ name: 'x' })`。

## 二、模板字符串（顺带学会）

箭头函数常和模板字符串一起出现：

```js
const user = { name: '小明', score: 92 };
console.log(`${user.name} 的分数是 ${user.score >= 60 ? '及格' : '不及格'}`);
```

`${}` 里可以放**任意表达式**，这是它优于字符串拼接的关键。

## 三、默认参数与 rest 参数

```js
function connect(host = 'localhost', port = 3306) {
  return `${host}:${port}`;
}
connect();            // 'localhost:3306'

function sum(...nums) {   // rest：把剩余实参收集成数组
  return nums.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3, 4);     // 10
```

## 四、核心：this 的词法绑定

普通函数的 `this` 由**调用方式**决定（谁调用指向谁）；箭头函数的 `this` 由**定义时所在的上下文**决定，且无法被 `call/apply/bind` 改变。

```js
const timer = {
  second: 0,
  start() {
    // 普通函数：this 丢失，指向全局/undefined
    // setInterval(function () { this.second++; }, 1000); // ❌

    // 箭头函数：this 继承自 start()，即 timer
    setInterval(() => { this.second++; }, 1000); // ✅
  },
};
```

一句话记忆：**箭头函数没有自己的 this，它向外"借"。** 在 Vue/React 的事件处理、`map/filter` 回调里，这正是你想要的。

## 五、什么时候不要用箭头函数

- 对象方法（需要 `this` 指向对象本身时，如上面 `start()`）；
- 构造函数（箭头函数没有 `prototype`，不能 `new`）；
- 需要 `arguments` 对象的场景（改用 rest 参数）。

## 六、动手示例

- `es-arrow/01-this.js` —— 对比普通函数与箭头函数的 this

```bash
node courses/01-es/examples/es-arrow/01-this.js
```

做完记得完成「本关小测」与 `homework/L2.md` 作业。
