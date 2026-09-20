# Data Router：loader / action

> 目标：React Router v6.4+ 引入 **Data Router**（`createBrowserRouter`），把"进路由前先取好数据""提交表单后重取数据""跳转/鉴权重定向"从散落在组件里的 `useEffect` 上移到**路由层**，配合 `<RouterProvider>`、`useLoaderData`、`useActionData`、`Form`、`redirect`。这一关呼应 **react-effect-patterns**（治竞态）、**vue-router-guard-lazy**（守卫/懒加载）、**09-express REST**。

---

## 一、为什么把数据搬到路由层

传统写法在组件里 `useEffect(fetch)`：进页面先渲染空壳、再异步填数据，容易竞态、加载态散落、无法"数据就绪再进入"。Data Router 的思路：**路由本身声明它依赖的数据**——
- `loader`：进入该路由（URL 匹配）**之前**在服务端/客户端取数，返回给组件；
- `action`：处理该路由上的**写操作**（POST/PUT，配 `<Form>`），成功后自动重跑相关 loader；
组件只管"用 `useLoaderData()` 拿到的数据渲染"，不再自己 fetch。这与 Remix / Next.js 的数据模型同源，也把"loading / error"标准化成路由级。

---

## 二、createBrowserRouter + RouterProvider

```jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  {
    path: '/user/:id',
    element: <User />,
    loader: ({ params }) => fetchUser(params.id),   // 取数
    errorElement: <ErrorBoundaryPage />,            // 该路由错误兜底
  },
]);

function App() { return <RouterProvider router={router} />; }
```
- 用**配置数组**建 router（此时又回到声明式的镜像：数据相关能力用配置表达），再用 `<RouterProvider>` 挂上；
- `loader` 收到 `{ params, request, context }`，返回值给组件；
- `errorElement`：路由级错误界面（替代手动 ErrorBoundary 处理 loader/action 抛错，呼应 react-render-control）。

---

## 三、useLoaderData / useFetcher：消费数据

```jsx
function User() {
  const user = useLoaderData();        // 直接拿到 loader 的返回，已就绪
  if (!user) return <Empty />;
  return <h1>{user.name}</h1>;         // 无需 useEffect、无 loading 空壳
}
```
- `useLoaderData()` 同步返回本路由（及父路由合并）loader 的结果；进入即数据就绪；
- 局部/后台刷新用 `useFetcher()`：不改变当前 URL 地取数或提交（对照 react-data-fetching 的客户端缓存）。

> 参数变化时 loader 会**自动重跑**（`/user/1`→`/user/2`），解决上一关"同路由换参数不重新取数"的心智坑（呼应 react-router-basics 第 8 题）。

---

## 四、action + Form + 重取

```jsx
{
  path: '/new',
  element: <NewPost />,
  action: async ({ request }) => {
    const form = await request.formData();      // 直接拿 FormData
    const id = await createPost(Object.fromEntries(form));
    return redirect(`/post/${id}`);             // 提交成功后跳转
  },
}

function NewPost() {
  const submitting = useNavigation().state === 'submitting';
  return (
    <Form method="post">                        {/* 走 action，不整页刷新 */}
      <input name="title" />
      <button disabled={submitting}>提交</button>
    </Form>
  );
}
```
- `<Form method="post">` 触发路由的 `action`，`request.formData()` 读表单（呼应 react-forms React 19 一节）；
- `action` 里 `redirect(...)` 实现"写成功后导航"；
- **写后自动重取**：action 完成后，Router 会重新运行受影响路由的 loader，列表自然更新——这就是"提交后刷新数据"的框架级答案（对照 vue-router-guard 手动处理）。

---

## 五、loader 里做鉴权/重定向

```jsx
loader: async ({ request, context }) => {
  const user = await getUserFromSession(request);
  if (!user) throw redirect('/login');        // throw 一个 Response 做重定向/抛错
  return data({ user });
}
```
- loader/action 里 `throw redirect(...)` / `throw new Response(..., {status:403})` 可提前中断并跳转/报错，等价路由级守卫；
- 比组件里判断再 `<Navigate>` 更早（数据都没取就挡下），呼应 react-router-basics 第 10 题、vue-router-guard-lazy。

---

## 六、自检清单

- [ ] Data Router 相比"组件里 useEffect fetch"解决了哪些问题？
- [ ] loader 与 action 各自何时触发、拿到什么参数？
- [ ] useLoaderData 和 useFetcher 用途区别？
- [ ] action 完成后数据为什么会"自动刷新"？redirect 用在哪？
- [ ] 在 loader 里如何做鉴权重定向？为什么比组件里判断更好？

---

## 🚀 部署预告

- 本课把"取数/写数/守卫"从组件上移到路由声明：`loader` 进路由前取数、`action` 写后重取、`throw redirect` 做守卫；
- 下一关进入 **react-data-fetching**：当数据要跨组件共享、去重、缓存、失效时，`useEffect` 和 loader 都不够——引出 TanStack Query（`useQuery`/缓存键/失效），把"服务端状态"从客户端状态里分离出来（呼应 react-state-mgmt、vue-state-patterns）。
