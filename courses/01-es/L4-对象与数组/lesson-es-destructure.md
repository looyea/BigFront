# 解构：从数组与对象里优雅地取数据

> 目标：**掌握数组解构、对象解构、嵌套解构、参数解构、计算键解构、默认值 6 种形态**；能读懂 Vue/React 源码里所有花式解构；理解「解构是模式匹配」而非「拷贝」。

---

## 一、什么是「解构」

**解构（Destructuring）** 是一种**赋值语法左侧的「模式」**：右侧是一个可迭代对象或属性对象，左侧按**形状**把值分发到变量里。

```js
const arr = [1, 2, 3];
const [a, b, c] = arr;             // 数组解构：按下标
const obj = { x: 10, y: 20 };
const { x, y } = obj;               // 对象解构：按 key
```

**关键理解**：数组解构靠**位置**，对象解构靠**属性名**。二者底层机制完全不同——数组走迭代器协议，对象走 [[Get]]。

---

## 二、数组解构：位置 + 迭代器

```js
const [first] = [1, 2, 3];               // first = 1
const [, second] = [1, 2, 3];            // second = 2（跳过用逗号）
const [a, ...rest] = [1, 2, 3, 4];      // rest = [2,3,4]
const [p = 1, q = 2] = [];               // p=1 q=2（默认值：undefined 触发）
const [x, y] = [y, x];                   // 交换变量（配合 TDZ 会翻车，见下）
```

**依赖迭代器协议**：任何 `[Symbol.iterator]` 的都能数组解构——数组、字符串、Set、Map、NodeList、arguments、TypedArray、生成器。

```js
const [a, b, c] = 'hi👋';               // 'h', 'i', '👋'（按 code point）
const [k, v] = new Map([['a', 1]]).entries().next().value; // ['a', 1]
```

**⚠️ 交换变量的 TDZ 陷阱**：
```js
let x = 1, y = 2;
[x, y] = [y, x];   // ✅
let [a, b] = [1, 2];
[a, b] = [b, a];   // ❌ ReferenceError（右侧 b/a 在左侧 a/b 声明之前不存在）
```

---

## 三、对象解构：key + `[[Get]]`

```js
const { host, port } = server;             // 同名简写
const { host: h, port: p } = server;       // 重命名
const { host = 'localhost', port = 80 } = {}; // 默认值（右侧 undefined 触发）
const { length, ...rest } = 'hello';       // rest 收集剩余可枚举自有属性
```

**⚠️ 顶层解构不能省 `;`**：
```js
const a = 1
{ b } = { b: 2 }        // ❌ SyntaxError 或者被解析成块
const c = 1
;({ d } = { d: 2 })     // ✅ 加分号 + 括号（因为 { 在语句开头会被当块）
```

**⚠️ 声明与赋值分离**：
```js
let x;
({ x } = { x: 42 });      // 必须括号包住整个对象字面量
console.log(x);            // 42
```

---

## 四、嵌套解构（**工程最常用**）

```js
const config = {
  server: { host: 'localhost', port: 8080 },
  db: { url: 'pg://...', pool: { min: 2, max: 10 } },
  tags: ['a', 'b', 'c'],
};

const {
  server: { host, port = 80 } = {},             // 嵌套对象 + 默认值兜底
  db: { pool: { max } },                          // 二层嵌套
  tags: [firstTag, ...others],                    // 数组嵌数组
} = config;
```

**关键**：`server: { host } = {}` 里的 `= {}` 是**整个嵌套模式**的默认值——避免 `server` 为 undefined 时报错。**这是 React Query / SWR 数据消费的必备写法**：
```js
const { data: { users = [] } = {} } = response;
```

---

## 五、参数解构：**函数签名的解构**

```js
function draw({ x = 0, y = 0, r = 1 } = {}) { /* ... */ }
draw();               // 全默认
draw({ x: 5 });       // x=5, y/r 默认

const MapPoint = ({ lat, lng: [lng1, lng2] }) => lng1 + lng2;

// 数组解构参数（React 自定义 Hook 核心）
const [count, setCount] = useState(0);
function useToggle(init = false) {
  const [on, setOn] = useState(init);
  return [on, () => setOn(v => !v)];
}
const [dark, toggleDark] = useToggle();
```

**为什么要给参数默认 `= {}`**：`draw()` 不传任何实参时，右侧是 `undefined`，解构 undefined 会抛 TypeError；`= {}` 是**形参**的默认，让整个模式走默认值分支。

---

## 六、计算键与动态属性名

```js
const key = 'token';
const obj = { [key]: 'abc', type: 'Bearer' };
const { [key]: tokenValue } = obj;      // tokenValue = 'abc'
console.log(tokenValue, obj.type);
```

**用途**：Redux 里根据 action.type 分发时；把接口返回的 id 直接取出。

---

## 七、解构不是拷贝：与「赋值」的对比

| 写法 | 语义 |
| --- | --- |
| `const b = a.x` | 读一次 `a.x` |
| `const { x } = a` | 读一次 `a.x` 存到变量 x |
| `const { x, y } = a` | 读一次 `a.x` 和 `a.y` |
| `const b = { ...a }` | 遍历所有可枚举自有属性，**新对象** |
| `const { x, ...rest } = a` | 读 `a.x`；把 rest 拷成**新对象** |

**追问**：解构一个 getter 会怎样？→ **触发一次 getter**（因为底层就是 [[Get]]），拿到的值是普通数据。

---

## 八、常见坑与最佳实践

1. **`const { a } = obj;` 与 `if (!a) throw ...`** —— 校验逻辑分离；ESLint `prefer-destructuring` 建议同一 obj 取多字段用解构。
2. **数组解构 3 元以上别忘命名**：`const [host, port, proto] = url.split(':')` 比 `url.split(':')[0]` 可读性高一个量级。
3. **rest 只在最后一个位置**：`const { a, ...rest, b } = obj` ❌ SyntaxError。
4. **解构 null/undefined 会抛错**：`const { a } = null` ❌。除非有默认值：`const { a } = obj ?? {}` 或 `const { a } = obj || {}`。
5. **解构 vs Object.assign**：Object.assign 是**合并/写入**；解构是**读取分发**。方向相反。
6. **React Hook 的解构**：`useState`、`useReducer`、`useContext` 返回元组/对象，全靠解构消费——这是**新工程 90% 的解构来源**。

---

## 九、自检清单

- [ ] 说出数组解构依赖的**协议**是什么（迭代器协议），能举出 3 种可被数组解构的内置对象。
- [ ] 手写「顶层解构 + 默认值 + 重命名 + rest」四合一。
- [ ] 解释 `const { data: { users = [] } = {} } = res` 的两层默认值分别兜住什么。
- [ ] 手写「参数解构 + 默认参数 + 嵌套 + 数组参数解构」的函数签名。
- [ ] 说明 `[a, b] = [b, a]` 为什么会 ReferenceError。

---

## 🚀 部署预告（本关点到，细节在 L10）

**解构在构建/降级时会发生什么？**

1. **Babel `@babel/plugin-transform-destructuring`**：数组解构降级成 `var _arr = [...]; var a = _arr[0]; var b = _arr[1];`；对象解构降级成 `var a = obj.a; var b = obj.b;`。**产物体积膨胀 20-40%**——target 是 ES2015+ 关掉即可。
2. **迭代器降级**：数组解构默认走 `[Symbol.iterator]` 的 `next()`——老环境开销更大；Babel `loose: true` 模式下直接用 `_arr[0]` 索引读，**性能与语义都要注意**（如 Set 用 loose 会挂）。
3. **Tree-shaking**：`const { a } = mod` 若 a 是纯值可被摇掉未引用；如果右侧是 getter 或含副作用（比如 `require` 触发），摇不掉。
4. **Vue/React 源码里的解构**：编译产物大量使用**数组解构**（`useState` 返回 `[v, s]` 直接解构），所以现代浏览器 target 下**别关掉解构降级**以外的插件。

细节 L10 `es-build` 展开。**你现在只需要记住**：**解构读起来优雅，Babel 降级后其实是一堆 `var` 赋值——target 决定要不要花这份体积。**
