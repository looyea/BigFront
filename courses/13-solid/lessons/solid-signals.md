# createSignal：getter/setter 元组与"读即订阅、写即通知"

> 目标：把第一根支柱落到最小 API 上——`createSignal` 返回的 getter/setter 元组、为什么读值必须写成函数调用 `count()`、setter 的**值相等短路**、以函数形式更新、以及最坑的一类问题：**哪些写法会悄悄丢失响应**（解构、提前求值、脱离追踪作用域）。这是理解后一关"自动追踪"的前置（呼应 solid-effect-tracking、solid-overview、svelte-reactive-runes）

## 一、signal 就是一个"会通知人的变量"

官方比喻很准：signal 像"一个可变变量，现在指一个值、将来能指向另一个值"。区别在于——它被读的时候会记下"谁在读"，被写的时候会通知那些读者。这就是**细粒度**的最小单元。

```js
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(1);
console.log(count());   // 1  —— 读：调用 getter
setCount(0);            // 写：调用 setter
console.log(count());   // 0
```

`createSignal(初值)` 返回一个**两元素数组（元组）**：`[getter, setter]`。`count` 是 getter、`setCount` 是 setter。这一对就是 Solid 所有响应式的原子。

## 二、为什么读值要写 `count()`

因为"读"这个动作**必须可被拦截**，响应式系统才能在你读的瞬间把你登记成订阅者。如果 signal 是个普通变量 `count`，读它就只是取个值、系统无从知晓；把它做成**函数**，每次 `count()` 调用都是一次"被观测到的读"，系统得以建立依赖边。

推论（贯穿全包）：**在追踪作用域里"调用 getter"才建立订阅**。哪些是追踪作用域？JSX 里被编译成绑定的表达式、`createMemo`、`createEffect` 的回调内部。普通函数体外随手 `const c = count()` 拿到的只是个**当下快照值**，之后不会再变。

对比记忆：
- React `useState`：`const [count, setCount] = useState(1)`，读 `count` 是**直接值**（因为 React 靠重渲重取）；
- Solid `createSignal`：读要 `count()`（因为 Solid 不重渲，靠 getter 拦截订阅）；
- Svelte 5 `$state`：写 `let count = $state(1)`，读 `count` 是**直接值**，但编译器在背后把它变成 getter——**Svelte 用编译器替你写了 `()`，Solid 把这层显式暴露给你**（呼应 svelte-reactive-runes）。

## 三、setter 的"值相等短路"

`setCount` 写值时会把新值和旧值比一下，**只有真的不同才通知订阅者**。官方手搓响应系统那段就是这句：`if (value === newValue) return;`。

```js
const [n, setN] = createSignal(5);
setN(5);   // 值没变（===）→ 不通知、下游 effect 不跑
setN(6);   // 变了 → 通知
```

**坑点**：比较用的是引用相等（`===`）。若你 signal 存的是对象/数组，每次 `setObj({...})` 造了新引用就算"变了"；反之你**原地改了对象内部**再 set 同一个引用，会被短路当成"没变"、不更新。所以：**标量/整体替换用 signal；深层对象要按路径精确更新，用 `createStore`（L2）**。

## 四、以函数形式更新

setter 也能收一个"由旧值算新值"的函数，避免读到过期闭包值：

```js
setCount(c => c + 1);        // 基于当前值递增
setCount(n => n * 2);        // 派生式更新
```

需要**多个 signal 一起更新且只通知一次**时，用 `batch`（见下一关）；Solid 在事件/effect 里通常已自动批量，但异步回调里手动 `batch` 能合并多次写、削减中间通知。

## 五、哪些写法会悄悄丢失响应（本课最值钱的一节）

signal 的一切坑都源于一件事：**你拿走了值，而不是保留了对 getter 的调用**。

```js
const [count, setCount] = createSignal(1);

// ❌ 丢失响应：存了快照
const snapshot = count();          // 只是个数字 1，永远不变
// ✅ 保留响应：包进函数/getter
const current = () => count();     // 每次调用都读当下值
```

- **解构**：`const { x } = state` 或把 signal 解构成普通变量，得到的是定格值；要响应就别解构，或 `createMemo` 暴露。
- **提前求值传参**：把 `count()` 当普通实参传给一个只在挂载跑一次的表达式，等于传了个快照；要让它跟着变，传**函数**（getter 本身）或用 `<Show>`/`createEffect` 里读。
- **脱离追踪作用域异步读**：`setTimeout(() => console.log(count()), 1000)` 里读，**不会**被外层 effect 追踪（同步收集依赖、跑完即注销订阅者，下一关详解）。
- **在 `.map`/普通循环里读 signal 生成 JSX**：那是"执行一次"的命令式求值，不建响应式绑定；列表要用 `<For>`（L3）。

## 六、signal 里能放什么

什么都能放——原始值、对象、数组、函数、甚至另一个 signal。但"放了不等于按内部路径细粒度追踪"：`createSignal(obj)` 只在**整体引用变化**时通知，不会追踪 `obj.a.b` 的改动。想要深层按路径订阅，交给 `createStore`（L2）。这也是"什么时候该用 store 而不是 signal"的分水岭。

## 七、自检清单

1. `createSignal` 返回什么？为什么"读"要写成 `count()` 而不是直接取变量？用"拦截读以登记订阅者"解释。
2. 三家对照：同是"一个会变的值"，React `useState`、Svelte 5 `$state`、Solid `createSignal` 各自怎么读、为何 Solid 要显式 `()`？
3. setter 的"值相等短路"依据什么比较？存对象时它会怎么坑你？由此推出 signal 适合存什么、不适合存什么。
4. 列出四种"丢失响应"的写法并各给修法（提示：快照赋值 / 解构 / 提前求值传参 / 异步里读）。为什么 `const c = count()` 和 `() => count()` 命运不同？
5. `setCount(c => c + 1)` 相比 `setCount(count() + 1)` 稳在哪？需要多 signal 一次更新时用什么（→ 下一关 `batch`）？

🚀 下一关：solid-effect-tracking——signal 的"写即通知"具体通知了谁、`createEffect` 的同步依赖收集为何让 `setTimeout` 里的读追不上，以及 `batch`/`untrack`/`on` 三个追踪开关。
