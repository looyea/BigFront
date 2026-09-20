# L4 作业：数据拆解

> 覆盖本阶段 4 关：`es-destructure`、`es-object-api`、`es-array-api`、`es-string-unicode`。
> 提交方式：读代码题直接答；手写实现放 `homework/L4.answers.js`。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.**
```js
const { a, b = 2, c: d } = { a: 1, c: 3 };
console.log(a, b, d);
```

**A2.**
```js
const arr = [1, , 3];
console.log(arr.map(x => x + 1).length, arr.map(x => x + 1)[1]);
console.log([...arr]);
```

**A3.**
```js
const o = {};
Object.defineProperty(o, 'x', { value: 1 });
Object.defineProperty(o, 'y', { value: 2, enumerable: true });
console.log(Object.keys(o), JSON.stringify(o));
```

**A4.**
```js
const a = Object.freeze({ n: 1, arr: [2] });
a.arr.push(3);
console.log(a.arr.length, a.n);
```

**A5.**
```js
const users = [{ name: 'Ann', age: 20 }, { name: 'Bob', age: 25 }];
const names = users.map(({ name }) => name);
console.log(names);
```

**A6.**
```js
const list = [10, 1, 5];
console.log(list.sort(), list.sort((a,b)=>a-b));
```

**A7.**
```js
console.log([1, [2, [3, [4]]]].flat(2));
console.log([1, , 2].flatMap(x => [x, x]));
```

**A8.**
```js
console.log([undefined, null, 0, '', false, NaN].filter(Boolean));
```

**A9.**
```js
console.log('hello'.at(-2), 'hello'.indexOf('l', 3), 'hello'.replace('l', 'L'));
```

**A10.**
```js
console.log('👨‍👩‍👧'.length, [...'👨‍👩‍👧'].length);
```

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · groupBy(arr, fn)**：不传 fn 时按 `String(x)` 分组；返回**普通对象**（`Object.create(null)` 版另附）。

**B2 · deepFreeze(obj)**：递归冻结；处理循环引用（WeakSet）。

**B3 · uniqueMap(arr, keyFn)**：按 keyFn 去重，**保留第一次**出现的对象；不用 Set 只用 Object。

**B4 · chunk(arr, size)**：把数组按 size 切成块；处理 size 为 0 / 负数 / 大于长度三种边界。

**B5 · truncate(str, maxGraphemes)**：按**字素簇**截断（可用 Intl.Segmenter）；不用 Intl 时给出**近似**方案 `[...str]` 并说明它对 emoji 家庭仍不准。

---

## 三、场景改造（20 分）

给定接口返回的**用户列表**：
```js
const data = {
  data: [
    { id: 1, name: 'Ann', roles: ['admin','user'], meta: { active: true, last: '2026-01-01' } },
    { id: 2, name: 'Bob', roles: [], meta: { active: false, last: '2026-02-02' } },
    { id: 3, name: 'Cid', roles: ['user'], meta: undefined },
  ],
};
```

请**一行解构 + 一次链式操作**得到：

1. **活跃 admin 用户名列表**（`['Ann']`）；
2. **按 role 分组**得到 `{ admin: [user1], user: [user1, user3] }`；
3. 若 `data` 为 undefined 也不能抛错（默认值兜底）。

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：`Object.assign({}, src)` 与 `{...src}` 与 `structuredClone(src)` 的差别？给一个「**只有 structuredClone 才能胜任**」的场景。

**Q2**：`for-in` / `for-of` / `forEach` / 普通 `for` 遍历数组，各自的适用场景与性能排序。

**Q3**：为什么 `'á'` 有两种可能的表示？给出你在**搜索输入框**里应对的具体方案。

---

## 五、拓展挑战（12 分，选做）

写一个 `deepUpdate(obj, ['a', 'b', 0], newValue)`——按**路径数组**在**不可变**语义下更新嵌套字段，返回新对象，其他字段与**源**共享引用（浅层共享 OK）。

```js
const src = { a: { b: [{ x: 1 }, { x: 2 }] } };
const next = deepUpdate(src, ['a', 'b', 1, 'x'], 99);
console.log(src.a.b[1].x, next.a.b[1].x);   // 2, 99
console.log(next.a.b[0] === src.a.b[0]);     // true（未改动路径复用引用）
```

**追问**：Immer 是怎么用 Proxy 让你写「伪可变」代码而产物仍不可变的？

---

## 我的答案（作答区）

（待补）
