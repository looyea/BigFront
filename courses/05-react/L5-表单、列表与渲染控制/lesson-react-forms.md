# 受控与非受控表单

> 目标：表单是 React 状态管理最典型的落地场景。本课讲：什么是**受控组件**（value 来自 state、onChange 回写，React 是唯一数据源）、**非受控组件**（DOM 自己持有值，用 `ref` 读取）、两者取舍、`name`/多字段用一个对象 state 管理、校验与提交、以及 React 19 的 `action`/`FormData`/`useActionState` 新范式。这是把 **react-component**（单向数据流）、**react-usestate**（快照/函数式更新）落到输入场景，并全程与 Vue 的 `v-model` 双向绑定对照。

---

## 一、受控组件：React 是唯一数据源

```jsx
function Controlled() {
  const [text, setText] = useState('');
  return (
    <input
      value={text}                          // 值由 state 决定
      onChange={e => setText(e.target.value)}  // 每次输入回写 state
    />
  );
}
```
- input 的 `value` 始终等于 `text`，用户输入的每个字符都经 `onChange` 更新 state，再由 state 重新渲染出 value——**渲染即真相**；
- 与 Vue `v-model="text"` 效果相同（都是"值绑定 + 输入更新"），但 React 要**手写两半**：`value` + `onChange`，没有编译期语法糖替你双向；
- 好处：state 是单一数据源，随时可读、可校验、可联动、可受控清空（`setText('')`）。

呼应 **react-usestate**：`onChange` 里拿到的是**事件对象**，值在 `e.target.value`，不是直接 `setText(e)`。

---

## 二、非受控组件：DOM 自己持有值

```jsx
function Uncontrolled() {
  const ref = useRef(null);
  function submit(e) {
    e.preventDefault();
    console.log(ref.current.value);   // 提交时一次性读
  }
  return <form onSubmit={submit}><input ref={ref} defaultValue="" /></form>;
}
```
- 值存在 DOM 里，React 不拦截每次输入，只在需要时用 `ref` 读（呼应 **react-refs**）；
- `defaultValue`/`defaultChecked` 给初始值，之后不再受 React 控制；
- 适合：文件上传 `<input type="file">`、集成非 React DOM、纯"提交时读一次"的简单表单——少写很多重渲染。

| | 受控 | 非受控 |
|---|---|---|
| 数据源 | React state | 真实 DOM |
| 读取 | 随时 | 靠 ref |
| 实时校验/联动 | 天然支持 | 需额外监听 |
| 重渲染 | 每次输入 | 无 |

---

## 三、多字段：一个对象 state + name

```jsx
const [form, setForm] = useState({ user: '', email: '', agree: false });
const onChange = e => {
  const { name, type, value, checked } = e.target;
  setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value })); // 函数式更新
};
// <input name="user" value={form.user} onChange={onChange} />
```
- **必须用函数式 `setForm(f => ...)`**：否则会丢掉其它字段（呼应 react-usestate 的"state 是旧快照"陷阱）；
- `name` 属性作键，一个 handler 管所有字段；
- 受控 checkbox 用 `checked` 而非 `value`。

> 字段一多、校验复杂时，社区普遍交给 **React Hook Form**（非受控 + ref 订阅，性能优于逐字段受控），其思路在 L6 数据获取与作业里再展开。

---

## 四、校验与提交

```jsx
function onSubmit(e) {
  e.preventDefault();                 // 阻止浏览器默认提交/整页刷新
  if (!form.user.trim()) { setError('用户名必填'); return; }
  // 通过后再 fetch/POST
}
```
- 一定要 `e.preventDefault()`，否则原生 form 会刷新页面（React 的 on 事件是**真实 DOM 事件**，对象是原生 `event`，不是 Vue 的 `$event` 包装）；
- 校验时机：onChange（实时）、onBlur（失焦）、onSubmit（提交时）组合；
- 提交用 `async` 函数处理网络，记得处理 loading / 错误 / 竞态（呼应 react-effect-patterns）。

---

## 五、React 19：action + FormData + useActionState

```jsx
async function save(form) {
  const name = form.get('name');       // FormData 直接取，无需 value=state
  const data = await api(name);
  return data;
}
// <form action={save}> <input name="name" /> </form>
```
- 给 `<form>` 传 `action` 函数，提交时自动带上 `FormData`，**不用手动 controlled 每个字段**；
- `useActionState` 提供 `state / action / isPending`，把"提交中、错误、结果"标准化；
- 这是 React 向"渐进增强 / 无 JS 也能提交"靠拢，思想上接近把状态交还给表单本身（类似非受控，但由框架托管）。

---

## 六、自检清单

- [ ] 受控组件里 `value` 和 `onChange` 各自作用？漏掉 onChange 会怎样（输入框"打不进字"）？
- [ ] 受控 vs 非受控分别适合什么场景？非受控用什么读值？
- [ ] 多字段用一个对象 state 时，为什么必须函数式更新？
- [ ] 为什么提交要 `e.preventDefault()`？React 事件对象和 Vue `$event` 有何不同？
- [ ] React 19 的 `action`/`FormData` 省掉了什么样板？

---

## 🚀 部署预告

- 本课把"单向数据流 + 状态快照"落到输入框：**受控 = React 持有真相**，与 Vue `v-model` 殊途同归但更手动；
- 下一关进入 **react-lists-keys**：把 `map` 渲染列表与 diff 复用、`key` 的意义（尤其"别用 index"）讲透，呼应 vue-conditional-list 与 react-render-model 第三节。
