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
const User = (() => {
  const users = new Map();          // 外部完全看不到
  return {
    add: (id, name) => users.set(id, name),
    get: (id) => users.get(id),
    count: () => users.size,
  };
})();
```

现代替代：ESM 模块本身就自带「未 export 即私有」；类里 `#field` 更严格。IIFE 版仍然常见于老库。

### 3.2 缓存 / 记忆化（memoize）

```js
function memoize(fn) {
  const cache = new Map();               // 缓存挂在闭包里
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const v = fn.apply(this, args);
    cache.set(key, v);
    return v;
  };
}
```

**注意**：Map 会强引用参数与结果——若参数是大对象，闭包就成了内存泄漏源。用 WeakMap（只能对象键）替代。

### 3.3 防抖 & 节流

```js
function debounce(fn, wait = 200) {
  let timer;                              // timer 是闭包变量
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, wait = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn.apply(this, args); }
  };
}
```

面试常追问：**为什么用 function 而不是箭头？** → 因为要保留调用方的 `this`。

### 3.4 柯里化 & 偏应用

```js
const curry = (fn) =>
  function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...more) => curried.apply(this, args.concat(more));
  };

const add3 = curry((a, b, c) => a + b + c);
add3(1)(2)(3);      // 6
add3(1, 2)(3);      // 6
```

---

## 四、闭包最经典的面试翻车：循环 + 异步

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
}
// 3 3 3
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
class Counter {
  #n = 0;                 // ES2022 私有字段，外部拿不到
  inc() { this.#n++; }
  value() { return this.#n; }
}
```

与「函数 + 闭包」版相比，class 私有字段：
- **优势**：语义更明确，工具链支持好，性能略优（V8 有 fast path）。
- **劣势**：需要 class 骨架；无法像闭包那样「一个变量被多个函数共享而不挂 this」。

现代工程更倾向：**状态少 & 关系复杂 → 闭包；状态多 & 方法多 → class + #field**。

---

## 七、React Hooks 里的闭包陷阱（面试高频追问）

```jsx
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
