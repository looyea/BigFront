# L3 · 解构与展开运算符

> 🎯 目标：熟练地从数组/对象里"取出"数据，用展开运算符做**不可变更新**——这是 React 状态管理的基本功。

## 一、数组解构

```js
const [first, second] = [10, 20];
const [a, , b] = [1, 2, 3];       // 跳过元素
const [x, ...rest] = [1, 2, 3, 4]; // rest 收集剩余 => x=1, rest=[2,3,4]
const [p = 1, q = 2] = [];         // 默认值 => p=1 q=2
```

经典技巧——交换变量：

```js
let left = 1, right = 2;
[left, right] = [right, left]; // 无需临时变量
```

## 二、对象解构

```js
const { name, age } = { name: '小明', age: 18, city: '北京' };

// 重命名 + 默认值
const { name: userName, role = 'guest' } = { name: '小红' };

// 嵌套解构
const { address: { city } } = { address: { city: '上海' } };
```

函数参数里解构极其常用（Vue/React 组件 props 都是这套路）：

```js
function draw({ color = 'red', size = 10 } = {}) {
  return `${color}-${size}`;
}
draw();            // 'red-10'（参数默认空对象，避免 undefined 报错）
draw({ size: 2 }); // 'red-2'
```

## 三、展开运算符 `...`

展开是解构的"逆运算"——把一个可迭代对象**摊平**。

```js
const arr1 = [1, 2], arr2 = [3, 4];
const merged = [...arr1, ...arr2];        // [1,2,3,4]

const base = { a: 1, b: 2 };
const next = { ...base, b: 99, c: 3 };    // { a:1, b:99, c:3 } 后者覆盖前者
```

## 四、为什么"不可变更新"如此重要

React 靠**引用变化**判断要不要重渲染。直接改原对象：

```js
state.items.push(newItem); // ❌ 引用没变，React 可能不更新视图
```

正确姿势是生成新数组/新对象：

```js
setState({ items: [...state.items, newItem] }); // ✅ 新引用
```

> 补充：`{...obj}` 是**浅拷贝**。嵌套对象要逐层展开，或用 `structuredClone(obj)` 做深拷贝（Node 17+ / 现代浏览器内置）。

## 五、动手示例

- `es-destructure/01-spread.js` —— 浅拷贝陷阱与深拷贝

```bash
node courses/01-es/examples/es-destructure/01-spread.js
```

完成「本关小测」+ `homework/L3.md` 即可挑战 L4。
