# L6 课后作业 · 路由与数据获取

> 覆盖：React Router 基础、Data Router（loader/action）、TanStack Query 数据获取。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug（10 小题）

**1.** 这个跳转为什么会整页刷新、丢失 state？
```jsx
<a href="/about">关于</a>            // ← ?
```

**2.** 子路由不显示，父组件漏了什么？
```jsx
<Route path="/dash" element={<Layout />}>
  <Route path="settings" element={<Settings />} />
</Route>
// Layout 里只写了 <Sidebar/>，没有 ??? 
```

**3.** 为什么 `/user/2` 显示的仍是上一个用户的数据？（组件式取数）
```jsx
function User() {
  const { id } = useParams();
  const [u, setU] = useState(null);
  useEffect(() => { fetch(`/api/user/1`).then(r=>r.json()).then(setU); }, []); // ← 两处错
  return <div>{u?.name}</div>;
}
```

**4.** BrowserRouter 部署后刷新 `/about` 出现 404，最可能的原因？

**5.** 这段 NavLink 高亮为什么没生效？
```jsx
<NavLink to="/a"><span>className</span></NavLink>   // 想高亮但没写激活态
```

**6.** Data Router 里 loader 返回了函数，客户端 `useLoaderData` 拿不到，为什么？
```jsx
loader: () => ({ fmt: (n) => n.toFixed(2) })        // ← ?
```

**7.** 这段 action 提交后列表没更新，缺了哪一步？
```jsx
action: async ({ request }) => {
  const f = await request.formData();
  await createTodo(f.get('text'));
  return null;                                       // ← 少了什么
}
```

**8.** 用 useQuery 时切换 id 却命中同一份缓存，问题在哪？
```jsx
useQuery({ queryKey: ['user'], queryFn: () => fetchUser(id) });   // ← ?
```

**9.** 这段把接口数据塞进 Zustand 手动 fetch，犯了什么分类错误？（口述）
```jsx
const useStore = create((set) => ({ todos: [], load: async () => set({ todos: await api() }) }));
```

**10.** mutation 点了两次发了两次请求，有人说"给 useMutation 加去重"，这说法对吗？为什么？

---

## 第二段 · 手写编程（5 小题）

**11.** 用 React Router 搭一个带嵌套布局的三页应用：`/`（Home）、`/blog`（列表）、`/blog/:slug`（详情），要求 `<Outlet>` 布局、404 兜底、NavLink 高亮、编程式"返回列表"。

**12.** 把第 11 题升级为 Data Router：给 `/blog/:slug` 加 `loader` 取文章、`errorElement` 兜底；`/blog/new` 加 `action` 用 `<Form method="post">` 创建后 `redirect` 到详情。

**13.** 用 TanStack Query 重写一个"用户详情"组件：`queryKey:['user',id]`、`staleTime:60s`，处理 loading/error/重试三态，不再用 useEffect。

**14.** 实现一个待办"添加"：`useMutation` POST 成功后 `invalidateQueries(['todos'])`；再改造成**乐观更新**（onMutate 先 setQueryData 追加、onError 回滚）。

**15.** 做一个"登录守卫"：写 `RequireAuth` 包裹组件（读 Context 登录态，未登录 `return <Navigate to="/login" replace state={{from:location}}/>`）；再给出 Data Router 里改用 loader `throw redirect('/login')` 的等价写法。

---

## 第三段 · 场景题（1 小题）

**16.** 电商商品详情页：URL `/product/:id`，需要商品数据 + 库存 + 评价三块，评价可分页无限滚动，用户能"加购物车"（写操作，头部购物车角标要即时更新）。请设计数据流：哪些用 loader、哪些用 useQuery、加购用 useMutation 如何做乐观更新并让"服务端状态 vs 客户端购物车态"各司其职、切换不同 id 时如何避免竞态与错缓存。给出关键 queryKey 设计与失效策略。

---

## 第四段 · 简答题（3 小题）

**17.** 路由参数变化时，"组件式 useEffect 取数"和"Data Router loader"分别发生什么？后者帮你省了哪些心？

**18.** queryKey、staleTime、invalidateQueries 三者在缓存生命周期里各扮演什么角色？

**19.** 服务端状态和客户端状态如何区分？为什么"别用 Redux 手动缓存接口数据"？

---

## 第五段 · 挑战题 🏆

**20.** 综合：用 Data Router + TanStack Query 搭一个"文章列表 ⇄ 详情"最小应用，要求——① 列表页 loader 用 `queryClient.ensureQueryData` 预取写进缓存，列表组件用 `useQuery` 消费（进页面即有数据、无闪 loading）；② 详情页对同 `queryKey` 命中列表缓存、秒开；③ 编辑文章用 `useMutation` + 乐观更新 + `onSettled` 失效 `['posts']`；④ 未登录访问 `/admin` 由 loader `throw redirect('/login')` 拦下；⑤ 写清"预取缓存"与"路由自动重取"是如何配合而不重复请求的。附一段说明：若把接口数据全放进 Context 会有哪些退化。
