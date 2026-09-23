# L5 课后作业 · 表单、列表与渲染控制

> 覆盖：受控/非受控表单、map + key、条件渲染/ErrorBoundary/Suspense。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug（10 小题）

**1.** 这段受控输入有什么问题？
```jsx
function A() {
  const [v, setV] = useState('');
  return <input value={v} />;          // ← ?
}
```

**2.** 为什么敲不进字？
```jsx
<input value={text} onChange={e => console.log(e.target.value)} />
```

**3.** 找错并说明为什么点提交会刷新整页：
```jsx
function F() {
  const [q, setQ] = useState('');
  return (
    <form onSubmit={() => search(q)}>
      <input value={q} onChange={e => setQ(e.target.value)} />
    </form>
  );
}
```

**4.** 这段多字段表单为什么会"丢字段"？
```jsx
const [form, setForm] = useState({ a: '', b: '' });
const onChange = e => setForm({ [e.target.name]: e.target.value }); // ← ?
```

**5.** 找出 `{count && <List/>}` 在 `count=0` 时的现象与原因。

**6.** 这个列表渲染的 key 有什么问题（数据会被删除/重排）？
```jsx
{list.map((x, i) => <Row key={i} data={x} />)}
```

**7.** 为什么这个组件每次渲染都重建、state 丢失？
```jsx
{items.map(it => <Row key={Math.random()} data={it} />)}   // ← ?
```

**8.** 这段对 state 数组排序有什么问题？
```jsx
const sorted = items.sort((a, b) => a.n - b.n);   // items 来自 useState
```

**9.** 这个 ErrorBoundary 为什么捕获不到按钮点击的报错？
```jsx
<ErrorBoundary><Btn onClick={() => { throw new Error('x'); }} /></ErrorBoundary>
```

**10.** Suspense 用法哪里不对？
```jsx
const Lazy = lazy(() => import('./Lazy'));
return <Lazy />;                        // ← 少了什么
```

---

## 第二段 · 手写编程（5 小题）

**11.** 写一个**受控**注册表单：字段 `user/email/agree`，用单个对象 state + 函数式更新 + `name` 通用 onChange，提交时 `preventDefault` 并做非空校验。

**12.** 把第 11 题改造成**非受控**（用 `useRef` 在提交时一次性读值），对比代码量与重渲染次数。

**13.** 实现一个可增删、可在顶部插入的待办列表，每项带输入框，用稳定 `id` 作 key；再故意把 key 改成 index，观察"输入跟着位置跑"的 bug 并写一句解释。

**14.** 写一个通用 `class ErrorBoundary`（`getDerivedStateFromError` + `componentDidCatch`），降级 UI 带"重试"按钮能重置错误态，包裹一个会随机的子组件。

**15.** 用 `React.lazy` + `Suspense` 懒加载一个"图表"组件，并再套一层 ErrorBoundary，使三种状态（加载/错误/成功）都有对应界面。

---

## 第三段 · 场景题（1 小题）

**16.** 你在做一个可搜索、可多选、能实时联动（选中项数量显示在按钮上）的商品列表（约 2000 条）。请回答：搜索框用受控还是非受控？列表 key 用什么？"选中数量"这种跨组件联动放哪？首屏卡顿怎么优化（虚拟化/memo/派生 useMemo）？出错和白屏怎么兜底？给出关键取舍与理由。

---

## 第四段 · 简答题（3 小题）

**17.** `value` 有但 `onChange` 没有，为什么输入框变只读？这体现了受控组件的什么原则？

**18.** React 里"卸载重建"和"CSS 隐藏"分别对应 Vue 的哪个指令？各自的 state/DOM 差异是什么？

**19.** ErrorBoundary 为什么是类组件？它捕获不到哪四类错误？

---

## 第五段 · 挑战题 🏆

**20.** 实现一个极简 `useField(name)` 自定义 Hook（受控思路）：返回 `{ value, onChange, error, onBlur }`，内部维护值与失焦校验，支持任意校验函数；再用它拼一个两字段表单，做到：① 失焦才报错、② 提交统一校验、③ 校验规则通过参数注入复用。写清它相比"每个字段手写 useState"复用了什么，并说明在超大表单里为何可能不如 React Hook Form（非受控）性能。
