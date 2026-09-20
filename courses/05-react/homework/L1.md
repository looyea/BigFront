# L1 课后作业 —— JSX、组件与渲染模型

> 覆盖本阶段三关：react-jsx、react-component、react-render-model。先找 bug 练眼，再手写练手，最后场景与简答练表达。

---

## 一、读代码找 Bug（10 小题）

1. ```jsx
   function Greet() { return <div>Hello</div><div>World</div>; }
   ```
   编译报错，两种修法？
2. ```jsx
   <div class="box" onclick={handleClick}>x</div>
   ```
   两个属性名哪里错了？
3. ```jsx
   <ul>{items.map((it, i) => <li key={i}>{it.name}</li>)}</ul>
   ```
   列表支持"在最前面插入一条"，用 index 当 key 会有什么问题？
4. ```jsx
   function Btn() { return <button onClick={doThing()}>go</button>; }
   ```
   这个 onClick 有什么问题？
5. `{count && <Badge/>}` 当 `count = 0` 时页面出现了一个多余的 "0"，为什么、怎么改？
6. ```jsx
   <div style="color:red; font-size:14px">A</div>
   ```
   改成合法的 JSX 写法。
7. ```jsx
   function List({ items }) { items.sort(); return <ul>{items.map(...)}</ul>; }
   ```
   在渲染里 `sort()` 改了什么、为什么危险？
8. 组件里写了 `const x = props.a; props.a = x + 1;` —— 违反了什么原则？
9. ```jsx
   function C(){ const [n,setN]=useState(0); setN(n+1); setN(n+1); return <b>{n}</b>; }
   ```
   点击后 n 变 2 还是 1？为什么？怎么改对？
10. 把一个 `<Comp>` 移到另一个父节点的子树里，发现它的内部 state 被清空了——用渲染模型解释为什么。

---

## 二、手写编程（5 题）

1. 用 Fragment 让一个组件返回两个平级 `<li>`，并解释什么时候必须用 `<React.Fragment key=..>`。
2. 写一个 `Card` 组件：接收 `title`、默认 children（对应"默认插槽"）、以及可选 `footer`（对应"具名插槽"）。
3. 把一个 `.map()` 列表渲染改成正确带稳定 `key`，并说明 key 与 diff 复用的关系（引 L1 渲染模型）。
4. 用三元和 `&&` 分别实现"未登录显示按钮、已登录显示用户名"，并说明二者在返回 `0`/`false` 时的渲染差异。
5. 写一个 `<RichHTML html={dirty}/>` 组件安全渲染富文本，指出 `dangerouslySetInnerHTML` 的风险与必要的前置处理。

---

## 三、场景题（1 题）

你 review 同事的 React PR，看到组件：① 直接在函数体里 `fetch` 并 `setList` ；② 列表用 index 当 key；③ 给子组件传内联对象 `style={{...}}`、`onSelect={() => ...}` 且子组件用了 `React.memo`。请逐条指出问题、结合"函数每次渲染重新执行 + render/commit 两阶段 + memo 浅比较"解释后果，并给修法。

---

## 四、简答题（3 题）

1. React Element、Component、真实 DOM 三者关系？渲染流程是怎样的？
2. React diff 的三大假设是什么？它和 Vue 的 patchFlag/依赖收集相比，把"优化责任"更多放在了谁身上？
3. 为什么说"重渲染 ≠ 重新操作 DOM"？`React.memo` 何时会失效？

---

## 五、挑战题 🏆

用一段 ≤200 字的"渲染模型速查卡"讲清：`setState` 之后到 DOM 变化之间发生了什么（触发→render→diff→commit→effect），并各写一句"对应的性能/正确性注意事项"。要求能解释：为什么函数式 `setState` 能拿到最新值、为什么 key 变化会重置 state、为什么 index 当 key 会串状态。
