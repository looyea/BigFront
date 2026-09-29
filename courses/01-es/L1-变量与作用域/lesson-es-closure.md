# 闭包深入与应用（Closure）

> 目标：**能背出闭包的正式定义、能识别 4 种常见闭包模式、能在面试白板上现场用闭包重构一段全局变量**。这是 JS 面试出现频率最高的话题之一，也是 Vue/React 响应式与 Hook 的心智基础。

---

## 一、什么是闭包？给一个精确到无歧义的定义

**闭包 = 函数 + 该函数被创建时所处的词法环境（[[Environment]]）的引用**。

拆开讲三件事：
1. **词法作用域**：函数**书写时**所在的作用域决定了它能看见哪些变量；这与函数**运行时从哪被调用**无关。
2. **环境随函数一起被捕获**：即使外层函数已经返回，其变量对象依然被内层函数「拖」着不被回收。
3. **槽位而非快照**：闭包捕获的是**变量本身（binding）**，不是值的一份拷贝。外层改了值，内层能立刻看到。

```js
// 目的：最小闭包——inc/get 共享同一个词法环境的 n（捕获的是 binding 不是快照）
function counter() {
  let n = 0;
  return {
    inc: () => ++n,
    get: () => n,
  };
}
const c = counter();
c.inc(); c.inc();
console.log(c.get()); // 2 —— n 这个 binding 被 inc/get 共享
```

---

## 二、闭包不是新东西——它一直藏在这些地方

| 模式 | 闭包在哪里 |
| --- | --- |
| 回调函数 | `setTimeout(() => doSomething(local))` |
| 数组方法 | `arr.map(x => x * factor)`，`factor` 从外层捕获 |
| 防抖/节流 | `debounce(fn, wait)` 内部 `timer` 变量 |
| 模块模式（IIFE + 返回值） | 私有变量藏在闭包里 |
| React Hooks | 每次渲染都产生**新的闭包**，捕获本次的 props/state |
| Vue 3 组合式 API | `setup()` 里 return 的函数就是闭包集合 |
| 柯里化与偏应用 | `add(1)(2)`，中间的 `1` 被闭包留住 |

**换句话说**：只要一个函数引用了非它自己参数与局部之外的自由变量（free variable），它就是闭包。

---

## 三、四种最常见的闭包工程模式

### 3.1 私有变量 / 模块模式

```js
// 目的：IIFE + 闭包实现模块模式——把私有状态藏在闭包词法环境里，只暴露接口
const User = (() => {
  const users = new Map();          // 外部完全看不到
  return {
    add: (id, name) => users.set(id, name),
    get: (id) => users.get(id),
    count: () => users.size,
  };
})();

// ✅ 应用：通过暴露的接口操作私有 Map
User.add(1, 'Ann');                  // 写入
console.log(User.get(1));            // 'Ann'
console.log(User.count());           // 1
// ❌ 反面：想直接拿私有变量——根本拿不到
console.log(User.users);             // undefined（users 不在返回对象上，闭包私有）
// console.log(users);               // ❌ ReferenceError: users is not defined
```

现代替代：ESM 模块本身就自带「未 export 即私有」；类里 `#field` 更严格。IIFE 版仍然常见于老库。

### 3.2 缓存 / 记忆化（memoize）

```js
// 目的：用闭包持有 cache，实现「相同入参只算一次」的记忆化
function memoize(fn) {
  const cache = new Map();               // 缓存挂在闭包里
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);   // ✅ 命中缓存直接返回，跳过计算
    const v = fn.apply(this, args);
    cache.set(key, v);
    return v;
  };
}

// ✅ 应用：慢函数只算一次
let calls = 0;
const slowAdd = memoize((a, b) => { calls++; return a + b; });
slowAdd(1, 2);   // 首次真正计算 → calls=1，返回 3
slowAdd(1, 2);   // 命中缓存 → calls 仍为 1，返回 3
console.log(calls); // 1（相同入参第二次没有重新调用被包装函数）
// ❌ 注意：JSON.stringify 作 key，对含函数/undefined/键顺序不同的对象会误判；大对象作参数还会内存泄漏（应改 WeakMap）
```

**注意**：Map 会强引用参数与结果——若参数是大对象，闭包就成了内存泄漏源。用 WeakMap（只能对象键）替代。

### 3.3 防抖 & 节流

```js
// 目的：debounce/throttle 都靠闭包长期持有 timer / last 状态——这是它们能"记住"上次调用的根本原因
function debounce(fn, wait = 200) {
  let timer;                              // timer 是闭包变量
  return function (...args) {
    clearTimeout(timer);                  // 每次触发都撤销上一颗定时器，只在"停下来"后才执行
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, wait = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn.apply(this, args); }  // 每 wait 毫秒最多放行一次
  };
}

// ✅ 应用：同一个 debounce 实例对高频事件只留最后一次
const onResize = debounce(() => console.log('resized'), 200);
window.addEventListener('resize', onResize);   // 连点 N 次，停 200ms 后只打印一次
// ❌ 反面：每次触发都新建 debounce，闭包 timer 各自独立 → 去抖彻底失效
window.addEventListener('resize', () => debounce(render, 200)()); // 每次都新建 timer，render 被反复调用
```

面试常追问：**为什么用 function 而不是箭头？** → 因为要保留调用方的 `this`。

### 3.4 柯里化 & 偏应用

```js
// 目的：用闭包累积已传参数，凑够 fn.length 才真正调用——这就是柯里化
const curry = (fn) =>
  function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);   // 参数凑齐才执行
    return (...more) => curried.apply(this, args.concat(more));   // 没凑齐：闭包留住已传参数，返回新函数
  };

const add3 = curry((a, b, c) => a + b + c);
add3(1)(2)(3);      // 6
add3(1, 2)(3);      // 6
// ❌ 注意：靠 fn.length 判断"凑齐"，对含默认值/剩余参数的函数不可靠
const bad = curry((a, b = 2) => a + b);  // bad.length 只有 1（默认参数不计入 length）
bad(10);            // 立即返回 12，而不是等待第二个参数——柯里化在此「提前触发」
```

---

## 四、闭包最经典的面试翻车：循环 + 异步

```js
// 目的：闭包经典翻车——var 只有一个 i 槽位，三个回调共享它
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
}
// ❌ 实际输出 3 3 3：回调执行时循环早已结束，那个唯一的 i 已是 3

// ✅ 修法 1：let（for 每轮新建绑定）
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i));   // 0 1 2
// ✅ 修法 2：IIFE 用形参把当轮 i 的快照固化成独立作用域
for (var j = 0; j < 3; j++) ((k) => setTimeout(() => console.log(k)))(j); // 0 1 2
// ✅ 修法 3：setTimeout 第 3 个起的参数会传入回调
for (var m = 0; m < 3; m++) setTimeout((k) => console.log(k), 0, m);       // 0 1 2
```

三种修法：
1. **let**：`for (let i = 0; ...)`，靠 per-iteration binding。
2. **IIFE 捕获快照**：`(j => setTimeout(() => console.log(j)))(i)`。
3. **setTimeout 第三参数**：`setTimeout((j) => console.log(j), 0, i)`。

追问：**为什么 var 版本三个回调共享一个 i？** → 三个箭头函数闭包指向的都是**同一个函数作用域槽位 i**；循环结束后那个槽位是 3。

---

## 五、闭包与内存：什么时候是「泄漏」？

浏览器/Node 的 GC 会把「还从可达对象能引用到的闭包」保留。真正的泄漏模式：

- **DOM 节点被闭包捕获**：事件处理器捕获了局部 `bigNode`，节点从 DOM 移除但闭包还活着 → 节点无法回收。
- **长期存在的定时器 / 观察者**：`setInterval` 里闭包持有大数组，忘记 clear。
- **memoize 的 cache 无界增长**：见 3.2。
- **`console.log(某函数)`**：在 Chrome DevTools 打开的情况下，会让被打印对象活更久（这是 devtools 特性，不是应用泄漏）。

**修法**：把不捕获大对象的分支独立成非闭包函数；用 WeakMap/WeakRef；组件卸载时清理订阅。

---

## 六、闭包 + 类字段 vs #private

```js
// 目的：用 class 私有字段 #n 达成与「闭包私有变量」等价的封装
class Counter {
  #n = 0;                 // ES2022 私有字段，外部拿不到
  inc() { this.#n++; }
  value() { return this.#n; }
}

// ✅ 应用
const ct = new Counter();
ct.inc(); ct.inc();
console.log(ct.value()); // 2
// ❌ 反面：外部无法访问私有字段——是语法级拦截
// console.log(ct.#n);   // ❌ SyntaxError: Private field '#n' must be declared in an enclosing class（解析期即报错）
console.log(ct.n);       // undefined（私有的 #n 与普通属性 .n 是两回事，不是同一字段）
```

与「函数 + 闭包」版相比，class 私有字段：
- **优势**：语义更明确，工具链支持好，性能略优（V8 有 fast path）。
- **劣势**：需要 class 骨架；无法像闭包那样「一个变量被多个函数共享而不挂 this」。

现代工程更倾向：**状态少 & 关系复杂 → 闭包；状态多 & 方法多 → class + #field**。

---

## 七、React Hooks 里的闭包陷阱（面试高频追问）

```jsx
// 目的：React 经典闭包陷阱——effect 依赖数组为空时只跑一次，setInterval 里的回调捕获了本次渲染的旧 count
function Timer() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1);         // ❌ 闭包捕获的是本次渲染的 count
    }, 1000);
    return () => clearInterval(id);
  }, []);                          // 依赖数组为空 → effect 只跑一次，count 永远是 0
  return <>{count}</>;
}
```

修法：
1. `setCount(c => c + 1)` 函数式更新，不读闭包里的 count。
2. 把 `count` 加进依赖数组（每秒都会重建 interval，浪费）。
3. 用 `useRef` 存最新值 + 定时器只跑一次。

**Vue 3 里的 setup** 每次组件实例化只跑一次，闭包捕获的是响应式 ref/reactive 本身，**读取永远拿最新值**，因此没有这个陷阱。这是 Vue/React 面试的经典比较题。

---

## 八、自检清单

- [ ] 用一句话说出闭包的定义，并区分「函数」和「闭包」的语义差异。
- [ ] 手写 `debounce` / `throttle` / `memoize` 三个最常见的闭包工具。
- [ ] 解释 `for (var i) setTimeout(...)` 为什么打印 3 3 3，给出至少 2 种修法。
- [ ] 说出至少 3 种导致内存泄漏的闭包形态和对应的防御方法。
- [ ] 说出 React `useEffect` 里为什么闭包会「捕获旧值」，给出 3 种修法。
- [ ] 说出闭包与 class 私有字段的取舍。

---

## 🚀 部署预告（本关点到，细节在 L10）

**闭包在构建阶段会被怎么处理？**

1. **Terser / esbuild minifier** 会把只在闭包内使用的短生命变量做 **inliner**：把 `const x = 1; return () => x;` 直接内联成 `return 1`。前提是他们能证明 `x` 没被外部改。
2. **Rollup 的 scope hoisting** 把多个模块的顶层作用域拼到一起，闭包嵌套减少 → 运行时上下文查找更快，产物更小。
3. **V8 的上下文（Context）分配**：一个闭包会分配/复用一张 Context 表；如果你写了一个大函数、里面有 100 个闭包共享同一个外层作用域，那这张 Context 就变成大对象，GC 压力大。**拆小函数**在**运行时内存层面**是有意义的。
4. **sourcemap 与调试**：生产包 terser 会重命名闭包里的变量（`a`, `b`, `c`），DevTools 里读栈要看 sourcemap 才能对上原变量名。**部署时必须一起发布 .map 文件**（或托管到内部错误监控）。

这些细节会在 L10 `es-build`、`es-publish` 里展开。**你现在只需要记住**：**闭包不只是语言层特性，它是构建工具与运行时共同优化的对象。**
