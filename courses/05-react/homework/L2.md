# L2 课后作业 —— 核心 Hooks：状态与副作用

> 覆盖本阶段三关：react-usestate、react-useeffect、react-effect-patterns。

---

## 一、读代码找 Bug（10 小题）

1. ```jsx
   const [user, setUser] = useState({ name: 'A', addr: { city: 'X' } });
   const edit = () => { user.addr.city = 'Y'; setUser(user); };
   ```
   视图没变，为什么？给修法（含深层更新方案）。
2. ```jsx
   const [n, setN] = useState(0);
   const inc = () => { setN(n + 1); setN(n + 1); };
   ```
   点一次 n 变几？改对。
3. ```jsx
   useEffect(() => { const t = setInterval(() => setN(n + 1), 1000); }, []);
   ```
   这个定时器有三个问题，找出来。
4. ```jsx
   useEffect(async () => { const d = await load(); setData(d); }, [id]);
   ```
   React 会抱怨什么？改对。
5. ```jsx
   const [form, setForm] = useState({});
   const onChange = (k, v) => setForm({ ...form, [k]: v });   // 连续快速多次调用
   ```
   某些输入会被覆盖，为什么？怎么改？
6. 数据获取 effect 里只 `fetch().then(setData)`，切换 id 快时旧数据闪现——缺了什么？
7. ```jsx
   useEffect(() => { window.addEventListener('resize', onR); }, []);
   ```
   少了什么、后果？
8. ```jsx
   const [text, setText] = useState(localStorage.getItem('t') || '');
   useEffect(() => { localStorage.setItem('t', text); }, [text]);
   ```
   这段其实可用得更好：读取初值有什么隐患？（惰性初始化）
9. `useMemo` 里 `{...props}` 每次新对象、传给 `React.memo` 子组件——子组件为什么还在重渲染？（引到 L3）
10. 严格模式下"挂载即 +1"的 effect 让计数从 1 变 2，你该如何正确看待与修？

---

## 二、手写编程（5 题）

1. 写一个 `useCounter`：`count` 支持函数式 `inc/dec/step`，用惰性初始化从 `initial` 起算。
2. 用 `useEffect` 实现"点击复制文本 2 秒后按钮文案自动复原"，正确处理定时器清理，避免卸载后 setState。
3. 写一个数据获取 effect：依赖 `id`，用 `AbortController + ignore` 处理竞态与卸载，暴露 `loading/error/data`。
4. 把一个"用 effect 监听 props.userId 变化再 setForm"的坏写法，改成 `key` 重置或派生的好写法，并说明为什么更好。
5. 用不可变方式实现一个 TODO 的增 / 删 / 切换 done（`map`/`filter`/展开），不借助任何库。

---

## 三、场景题（1 题）

搜索框联想：用户输入 → 防抖 300ms → 请求 `/api/suggest?q=`。请结合本关设计：① 何时用 state、何时用派生；② effect 依赖怎么写、防抖放哪、如何取消上一次请求与竞态；③ 组件卸载如何不留残余；④ 为什么这个"数据获取"将来更适合交给 TanStack Query。给出关键代码骨架 + 说明。

---

## 四、简答题（3 题）

1. React "state 不可变 + set 新值" 与 Vue "Proxy 就地改" 的根本差异，各自带来什么好处/成本？
2. `useEffect(fn)`、`useEffect(fn,[])`、`useEffect(fn,[a,b])` 分别何时跑、cleanup 何时跑？
3. 列出至少 4 种"不该用 effect"的情形，并给出各自替代（render 计算 / useMemo / 事件处理器 / key 重置）。

---

## 五、挑战题 🏆

手写一个 `useFetch`（返回 `{ data, loading, error, refetch }`）：
- 用 `AbortController` + `ignore` 正确治竞态与卸载；
- `refetch` 能手动重发；
- 不滥用 state（loading/error 合理合并）；
- 附一段注释解释**为什么 effect 的 cleanup 恰好是解决竞态的关键**（把 react-render-model + react-useeffect + react-effect-patterns 三点串起来）。
