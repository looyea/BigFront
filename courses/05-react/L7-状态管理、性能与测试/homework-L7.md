# L7 课后作业 · 状态管理、性能与测试

> 覆盖：状态选型（局部/Context/外部 store/Query）、性能优化、Testing Library。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 这个 Context 为什么导致所有消费者频繁重渲染？怎么改？
```jsx
function Provider({ children }) {
  const [n, setN] = useState(0);
  return <Ctx.Provider value={{ n, setN }}>{children}</Ctx.Provider>;  // ← ?
}
```

**2.** 为什么给 `Row` 套了 `React.memo` 还是每次都渲染？
```jsx
{list.map(item => <Row key={item.id} data={item} onEdit={() => edit(item)} />)}  // ← ?
```

**3.** 这段把接口数据塞进全局 store 手动 fetch，犯了什么分类错误？（口述并改写方向）

**4.** 派生值被复制进 state 又用 effect 同步，问题在哪？
```jsx
const [full, setFull] = useState('');
useEffect(() => { setFull(first + ' ' + last); }, [first, last]);   // ← 反模式
```

**5.** 千行列表直接 `items.map` 全量渲染，卡顿。第一招该上什么？

**6.** 这个测试为什么偶发失败（flaky）？
```jsx
fireEvent.click(btn);
expect(screen.getByText('加载完成')).toBeInTheDocument();   // 结果异步返回
```

**7.** 用 `getByTestId` 查一个本可 `getByRole('button',{name})` 的按钮，问题是什么？

**8.** 这段测试断言"元素不该存在"却抛错了，为什么？
```jsx
expect(screen.getByText('错误')).toBeNull();   // ← 用错查询
```

**9.** 把整页所有 state 都提到顶层组件管理，从性能角度有什么问题？

**10.** `useMemo(() => sortList(items), [items])` 写成 `useMemo(() => sortList(items), [])` 会怎样？

---

## 第二段 · 手写编程（5 小题）

**11.** 用一个 Zustand store 管理"计数器 + 主题"，写两个组件：A 只显示 count、B 只显示 theme。用选择器订阅证明"改 count 不会让 B 重渲染"（加一行 `console.count('B render')` 验证）。

**12.** 把第一段第 1 题的 Context 改造成 `StateCtx` + `DispatchCtx` 双 Context，并 `useMemo` 稳定 value，说明消费者重渲染的变化。

**13.** 给第 2 题写正确的 memo 版：稳定 `onEdit` 引用（`useCallback` 或在 Row 内自取），使 `React.memo` 真正生效。

**14.** 用 Vitest + Testing Library 测一个 `<Counter/>`：`getByRole('button')` 查询、`userEvent.click` 点击两次、`findByText` 等异步、断言 `toHaveTextContent('2')`。

**15.** 给一个依赖 `useParams` 和一个用 MSW mock 的 `/api/user` 的组件写测试：用自定义 `render`（套 `MemoryRouter`），测成功渲染用户名、失败渲染错误块两种分支。

---

## 第三段 · 场景题（1 小题）

**16.** 一个数据看板页：顶部全局"时间范围"选择器（几乎所有图表都要读），中间一个大表格（5000 行、可点行展开详情），表格数据来自接口、会被定时轮询刷新。请设计：① 时间范围放哪（Context/store/URL）？为什么？② 表格如何不卡（虚拟化/分页）？③ 轮询刷新怎样只让受影响组件重渲染？④ 你如何用 Profiler 验证优化有效？给出选型与理由。

---

## 第四段 · 简答题（3 小题）

**17.** 画出"局部 state → Context → 外部 store → Query"的选型决策，各自适用条件是什么？

**18.** React 里"重渲染 ≠ 改 DOM"，这句话如何影响你决定要不要 memo？

**19.** get/query/find 三种查询在"找不到"时行为有何不同？断言"不存在"该用哪个？

---

## 第五段 · 挑战题 🏆

**20.** 综合：实现一个"可搜索的巨型列表"组件并配套测试——① 搜索词用 `useDeferredValue`/`startTransition` 保持输入跟手；② 派生过滤结果用 `useMemo`（别复制进 state）；③ 列表虚拟化只渲染可见行；④ 行组件 `React.memo` + 稳定回调；⑤ 写 RTL 测试：`userEvent.type` 输入、`findByText` 断言过滤结果、`queryByText` 断言"无匹配"时占位存在、点击行触发选择。附一段说明：若不虚拟化/不 memo，Profiler 会看到什么、你如何逐项消除。
