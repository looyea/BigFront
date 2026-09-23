# solid-signals 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) createSignal 返回什么？为什么 Solid 选择"getter 函数"而不是像 React 那样直接给值？
**来源**：signal 原语基础题的转述。

返回 `[getter, setter]` 元组。React `useState` 给的是**当下值**（因为 React 靠重渲重新取值），Solid 不重渲，必须靠**调用 getter 这个动作**被拦截、从而把当前订阅者登记进依赖边。读写成 `count()` 正是"我在这一刻观测你"的信号。

### 2. (A) 解释 setter 的"值相等短路"，以及它对存对象的影响。
**来源**：signal 更新语义题的转述。

setter 内 `if (value === newValue) return;`——新值与旧值引用相等就不通知。存对象时两个后果：① 原地 `obj.x=1` 再 `setObj(obj)`（同一引用）被当成没变、UI 不更新；② 想更新必须换引用 `setObj({...obj})`，但那就退化成"整体替换、粗粒度"。所以**深层对象按路径细粒度更新交给 createStore**，signal 适合标量或整体替换（呼应 solid-stores）。

### 3. (B) 面试官写下这行，问 count 会不会跟着变，为什么？`const c = count();`
**来源**：快照 vs getter 题的转述。

不会。`const c = count()` 只在执行那一瞬取了个值存进普通变量，之后 `setCount` 通知的是**订阅了 count 的 getter 的那些 effect/memo/DOM 绑定**，而这个普通变量根本不是订阅者、也不会在被读时重新求值。要"会变的 c"得写 `const c = () => count()` 或放进 memo/effect。

### 4. (C) 同一个"会变的数字"，React useState / Svelte 5 $state / Solid createSignal 三种读法有何异同？
**来源**：跨框架状态读法对比题的转述。

Solid：`count()`（显式 getter 调用建立订阅）。React：`count`（直接值，重渲时重取）。Svelte 5：`count`（直接值），但**编译器**在背后把对 `count` 的读变成对 signal 的 `$get()`。异：Solid 把"调用"这层摊给你，Svelte 用编译器替你藏起来；同：三家底层都是"读时订阅、写时通知"的信号系统，React 则另辟蹊径靠重渲（呼应 svelte-reactive-runes）。

### 5. (B) 这段 JSX 里哪种写法让标题不更新，为什么？`<h1>{title()}</h1>` vs 提前 `const t = title(); return <h1>{t}</h1>`
**来源**：JSX 内联读题的转述。

`{title()}` 会被编译成一个绑定 effect、在 `title` 变化时更新那个文本节点，正常；`const t = title()` 把值定格成快照再插进 JSX，之后 `t` 永不重取、标题冻结。教训：**把响应留到渲染表达式里读，别提前求值**（呼应 solid-effect-tracking 追踪窗口）。

### 6. (A) signal 能存函数/对象/另一个 signal 吗？"存了"和"按内部路径追踪"是一回事吗？
**来源**：signal 值类型辨析题的转述。

什么都能存（对象、数组、函数、甚至 signal）。但 `createSignal(obj)` 只在**整体引用变化**时通知，不会追 `obj.a.b` 的改动——"存了"≠"深层按路径订阅"。要深层细粒度用 `createStore`（代理在读写时按路径建 signal）。选型的分水岭就在这。

### 7. (D) 给你一个 `state = { user: { name }, list: [] }` 的复杂表单，你会用 signal 还是 store？怎么落地？
**来源**：状态建模选型题的转述。

深层嵌套、要按字段局部更新 → 用 `createStore`：路径级订阅，`setState('user','name',v)` 或 `produce(draft=>...)` 局部改，数组用索引/`reconcile` 吸收服务端返回。仅零散标量（开关、计数）→ 各自 `createSignal` 更轻。实践常混合：store 装结构化领域数据、signal 装 UI 局部值（呼应 solid-stores、solid-signals）。

### 8. (B) `setCount(count() + 1)` 连续调两次可能被合并成 +1 而非 +2，为什么？怎么避免？
**来源**：批量/闭包更新题的转述。

在同一批次（事件默认批处理、或显式 batch）里，`count()` 两次读到的都是批开始时的旧值，于是各算 `旧+1`、最终 +1。改**函数式更新** `setCount(c => c + 1)`——每次拿到的是 setter 收到的当下值，两次就是 +2（呼应 solid-signals 函数式更新、solid-effect-tracking batch）。

### 9. (A) 为什么说"解构 signal 或 store 顶层"会丢响应？Solid 官方对解构的立场是什么？
**来源**：解构陷阱深化题的转述。

解构 = 一次性取值存进普通变量，脱离了"被读时订阅"的 getter。对 store，Solid 提供拆分写法（如 `const [store, setStore] = createStore(...)` 里 setStore 保留、或 `createMemo` 派生子集）来在需要解构时仍保持响应。立场：**能不解构就不解构；要解构就走框架给的响应式拆分 API**，别裸 `const {a}=store`。

### 10. (D) 设计一个"计数器 + 双击 +1、每秒自增"的组件，写出关键代码并说明为何读要 `()`。
**来源**：signal 编码实操题的转述。

```jsx
const [count, setCount] = createSignal(0);
const inc = () => setCount(c => c + 1);
setInterval(() => setCount(c => c + 1), 1000);   // 注意：这里用函数式更新，不依赖 count()
return <button onClick={inc}>当前 {count()}</button>;
```
`{count()}` 在 JSX 里被编译成绑定 effect，点击/定时器 `setCount` 后文本自动更新；定时器回调用 `c => c+1` 而非 `count()+1` 避免闭包旧值。

### 11. (C) Solid 没有 useState 的"异步批处理 + 渲染节流"，那 signal 写入后 UI 什么时候更新？会不会写一次刷一次很贵？
**来源**：更新时机/批量题的转述。

signal 写是**同步更新依赖图**，但 DOM 的写被 Solid 在微任务/批次里合并（事件与 effect 中默认批处理），不会每个赋值立刻同步重排 DOM。加上细粒度"只通知真正读了它的订阅者 + 相等短路"，通常比 React 的"整组件重渲"更省。真要跨异步合并多写，用 `batch`（呼应 solid-effect-tracking）。

### 12. (B) code review 里你看到 `const [s, setS] = createSignal(largeObj)` 且频繁 `setS({...s(), k: v})`，你会提什么？
**来源**：反模式识别题的转述。

提两点：① 大对象每次整体浅拷贝 + 换引用，会让所有读了该 signal 的订阅者**全量失效**，丧失细粒度优势；改 `createStore` 做路径级更新，或把大对象拆成多个小 signal。② 若确实只关心"整体替换"，signal 也行，但要评估订阅面是否过宽、必要时用 `createMemo` 收窄被追踪的值（呼应 solid-fine-grained-internals 过度订阅）。

---

## 补充（新专题 13-15）

### 13.  signal 订阅者的内存归属：为什么不需要手动 unsubscribe 也不泄漏？ 

 订阅登记在创建它的 observer（memo/effect/组件 owner）上，owner 销毁时统一摘钩并释放对 signal 的引用链；泄漏常见于把 signal 存进模块级数组等体系外结构。 

**来源**： https://www.solidjs.com/docs/latest/api 

### 14.  为什么设计成 getter 调用（count()）而不是 Proxy 属性直读？ 

 显式调用让依赖收集发生在读取瞬间、可静态识别响应式来源，也保留原始类型语义（===、算术直接可用）；代价是每次多一层括号，Svelte 选了编译器推断的另一端。 

**来源**： https://www.solidjs.com/docs/latest/api#createsignal 

### 15.  同步多次 setter 会不会产生中间态闪烁？batch 改变了什么？ 

 更新按队列提交，同一批微任务内 memo/effect 以最终值收敛；batch 把多 signal 写入打包成一次通知，用于事务性改写（如导入整表）避免下游多次重算。 

**来源**： https://www.solidjs.com/docs/latest/api#batch 
