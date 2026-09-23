# 面试题 · 闭包

> 本关所有面试题**均整理自公开的互联网题库与工程师访谈**，每题末尾给出来源链接（点击可读原文）。题目文本已用中文重新表述，代码示例为业界广泛流传的**通用范例**。
> 建议：**先自己答，再点开来源核对**。

---

**1）用你自己的话解释什么是闭包；给出一个 5 行以内的最小示例。**
- 参考要点：函数 + 创建时所在的词法环境；`counter()` 返回一个 `() => ++n` 就是最小形态。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 1；GreatFrontEnd《50+ Must-know JavaScript Interview Questions》Closure 段。

---

**2）以下代码打印什么？说明每一步。**
```js
let count = 0;
(function immediate() {
  if (count === 0) {
    let count = 1;
    console.log(count);
  }
  console.log(count);
})();
```
- 参考要点：打印 `1` 与 `0`。IIFE 是闭包，捕获外层 count=0；if 块内 `let count = 1` 遮蔽外层，所以第一行 1；块结束后 count 回到外层版本，第二行 0。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 3 的变体。

---

**3）下面代码打印什么？三种修法你都写得出吗？**
```js
for (var i = 0; i < 3; i++) {
  setTimeout(function log() { console.log(i); }, 1000);
}
```
- 参考要点：打印 `3 3 3`。三种修法：`let i` / IIFE 捕获 / setTimeout 第三参数。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 4（同一题型在多份题库流传）。

---

**4）以下代码 `log()` 会输出什么？为什么不是 `Count is 3`？如何改？**
```js
function createIncrement() {
  let count = 0;
  function increment() { count++; }
  let message = `Count is ${count}`;
  function log() { console.log(message); }
  return [increment, log];
}
const [increment, log] = createIncrement();
increment(); increment(); increment();
log();
```
- 参考要点：输出 `Count is 0`。`message` 只在初始化时求值一次，之后 count 变了 message 不会自动更新。修法：把 message 改成 getter 函数或在 log() 里现算。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 5。

---

**5）用闭包重构一个「栈数据结构」，让外部**无法**直接改 items 数组。**
- 参考要点：把 items 挪到 createStack() 内部为 `const items = []`，只返回 `{ push, pop }`；push/pop 是闭包共享 items。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 6。

---

**6）实现 `multiply(a, b?)`：两个参数直接返回乘积；只传一个则返回一个函数，稍后接收第二个参数。**
```js
multiply(4, 5); // 20
const double = multiply(2);
double(5);      // 10
```
- 参考要点：判断 `b === undefined` 决定返回值 vs 返回闭包。核心考察：候选人是否理解闭包**捕获 number1** 是自然结果。
- 来源：dmitripavlutin.com《7 Interview Questions on JavaScript Closures》问题 7。

---

**7）在 React Hooks 里，为什么 `useEffect(() => { setInterval(() => setCount(count + 1), 1000) }, [])` 每秒都把 count 设成 1？给出至少 2 种修法。**
- 参考要点：effect 依赖数组为空 → 只跑一次 → 闭包永远捕获首次渲染的 count=0。修法：`setCount(c => c + 1)` 函数式更新；把 count 加进依赖数组；用 useRef 存最新值；改用 useReducer。
- 来源：Dan Abramov《A Complete Guide to useEffect》（overreacted.io）；React 官方 FAQ「Why does useEffect see stale props and state」。

---

**8）闭包会导致内存泄漏吗？举 2 个真实泄漏场景，并说明如何修。**
- 参考要点：会。典型：① DOM 事件监听器捕获被移除的 DOM 节点；② setInterval 里闭包引用大数组、忘了 clearInterval。修法：addEventListener 用 once 或手动 removeEventListener；组件卸载清理 effect 的 return；WeakMap 缓存。
- 来源：MDN《Closures》内存段；Mem0/Firebase 类博客「JavaScript memory leaks」专题。

---

**9）说出 3 种 JS 里表达「私有」的方式，并比较。**
- 参考要点：① IIFE 闭包（真私有，但一个模块/一份实例）；② 下划线命名约定（伪私有，可访问）；③ `#field` 语法（真私有，运行时品牌检查，性能与工具链最好）；④ Symbol 属性（半私有，能 `getOwnPropertySymbols` 反射）。
- 来源：TC39 Private class fields 提案；2ality《Private property syntax in JavaScript》。

---

**10）以下代码打印什么？说明闭包与「绑定 vs 值」的关系。**
```js
function make() {
  let x = 0;
  return {
    set: (v) => { x = v; },
    get: () => x,
  };
}
const o = make();
o.set(10);
console.log(o.get());
```
- 参考要点：打印 10。set/get 共享**同一个 x 绑定**，谁改都可见。闭包不是「快照拷贝」，这是最容易答错的地方。
- 来源：MDN《Closures》；GreatFrontEnd《50+》Closure 段。

---

**11）什么是「闭包过度捕获」（closure over-capture）？V8 层面有什么影响？怎么避免？**
- 参考要点：箭头/普通函数会捕获它所在的整个外层作用域。若外层函数里有大对象但内层不用，V8 有 Context 优化能剔除未用变量；但**eval / with / 动态作用域操作**会阻断优化。避免：把内层函数提到外层，或让内层通过参数接收需要的值。
- 来源：v8.dev《Free variables and context》；Paul Irish / Addy Osmani《High Performance JS》演讲。

---

**12）现场手写 `memoize(fn)`：能缓存结果，能被外部清缓存，参数含对象时避免内存泄漏。**
- 参考要点：闭包持有 Map 缓存；返回函数挂载 `.cache` 与 `.clear()`；对象参数用 WeakMap 或对键做结构化哈希。**追问点**：如何处理 `this`、如何与柯里化配合。
- 来源：You Don't Know JS（Kyle Simpson）闭包卷；lodash.memoize 源码；多份中文面试题库。

---

**13）`counter()` 返回 `{ inc, get }` 时，为什么两个方法共享 n？连续调用 `counter()` 两次呢？**
- 参考要点：同一次 `counter()` 调用产生的两个函数携带同一个 [[Environment]] 引用，所以共享；而每调用一次工厂就新建一套词法环境，两个实例状态完全独立——这就是「模块实例化」的雏形。**追问**：和 ESM 单例模块的区别（工厂可以多实例，模块天然单例）。
- 来源：MDN《Closures > 独立命名空间/Creating closures in loops》；You Don't Know JS 闭包章经典例题的转述。

---

**14）「闭包持有大对象」和「闭包捕获整个外层作用域」是一回事吗？DevTools 怎么定位？**
- 参考要点：不完全是：现代 V8 的 Context 只把**实际被引用的自由变量**搬进闭包环境，未被引用的大对象正常回收；但 `eval/with` 会阻断这个优化。排查用 heap snapshot 对比两次快照，顺 retained 路径找 Context/闭包链上的大数组、detached DOM；处置：提函数、改参数传递、用 WeakRef/主动置 null。
- 来源：v8.dev《Free variables and context》；Chrome DevTools《Memory》面板文档的转述。

---

**15）React 里 useRef 与函数式更新分别怎么解闭包旧值问题？防抖函数为什么要存进 ref/useMemo？**
- 参考要点：每次渲染的函数携带该次 state 快照的闭包；函数式更新把「读最新值」交给 React，useRef 提供跨渲染可变的盒子。防抖实例若不用 ref/useMemo 固定，每次渲染都新建 → 定时器永远清不到上一个，等于没防抖；卸载时在 cleanup 里取消 pending 调用。**追问**：dev 严格模式双执行对闭包状态的影响。
- 来源：React 官方博客《A Complete Guide to useEffect》；Dan Abramov 关于 debounce + useRef 的社区高频答疑的转述。
