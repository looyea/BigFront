# React Router 基础

> 目标：SPA 需要"前端路由"在不刷新的情况下切换页面。本课讲 React Router v6/v7 的核心：`BrowserRouter`、`Routes/Route`（声明式、元素即组件）、`Link`/`NavLink`（不整页刷新、激活态）、`useParams`/`useSearchParams`/`useNavigate`、嵌套路由与 `Outlet`、`index` 路由与 404。全程与 **vue-router-basics**（`createRouter`/`router-view`/`<router-link>`/`useRoute`）对照——理念一致，React 版更"组件化/声明式"。

---

## 一、搭起来：BrowserRouter + Routes + Route

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/user/:id" element={<User />} />
        <Route path="*" element={<NotFound />} />   {/* 404 兜底 */}
      </Routes>
    </BrowserRouter>
  );
}
```
- `BrowserRouter`：用 HTML5 History API（pushState）同步 URL 与 UI，需服务端配 history 回退（呼应 vue-router-basics 的 history 模式 + 10-vite history fallback）；
- `element={<Home/>}`：路由的"组件"是**一个 React 元素**，不是像 Vue 那样传组件选项对象/config 数组——更贴近 JSX；
- `*` 通配作 404；`path="/user/:id"` 定义动态段。

对照 Vue：Vue 是 `createRouter({ routes: [{ path, component }] })` 的**配置数组**集中声明；React Router 是**在 JSX 里写 `<Route>`**，路由树即组件树。

---

## 二、Link / NavLink：切换不刷新

```jsx
import { Link, NavLink } from 'react-router-dom';

<Link to="/about">关于</Link>

<NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>
  关于
</NavLink>
```
- 一定用 `<Link to>` 而非 `<a href>`：`<a>` 会整页刷新、丢失 SPA state（呼应 vue 的 `<router-link>` vs `<a>`）；
- `NavLink` 自带**激活态**：`className`/`style` 接收 `({ isActive, isPending })`，做导航高亮；
- 编程式跳转用 `useNavigate()`：`const nav = useNavigate(); nav('/user/1')`（对照 vue-router `router.push`）。

---

## 三、读取路由信息：hooks

```jsx
import { useParams, useSearchParams, useLocation } from 'react-router-dom';

function User() {
  const { id } = useParams();            // /user/:id → id
  const [sp] = useSearchParams();        // ?tab=posts&page=2
  const tab = sp.get('tab');
  const loc = useLocation();             // { pathname, search, state }
  return <div>{id} · {tab}</div>;
}
```
- `useParams`：动态段（对照 vue `useRoute().params`）；
- `useSearchParams`：读写 query（比 Vue 手动 `route.query` 更"受控"，可直接 setter 改 URL）；
- `useLocation`：当前路径/查询/state；`history.state` 可通过 `navigate('/x', { state: {...} })` 传"非 URL 携带"的数据。

---

## 四、嵌套路由与 Outlet

```jsx
<Route path="/dashboard" element={<Layout />}>
  <Route index element={<Overview />} />        {/* /dashboard 默认子路由 */}
  <Route path="settings" element={<Settings />} /> {/* /dashboard/settings */}
</Route>

function Layout() {
  return (
    <div>
      <Sidebar />
      <Outlet />        {/* ← 子路由渲染在这，等于 Vue 的 <router-view> */}
    </div>
  );
}
```
- 父 `element` 渲染公共外壳，`<Outlet/>` 是子路由的**插槽**（对照 vue `<router-view>`）；
- `index` 路由匹配父路径本身（避免空子路由，对照 Vue 的 `children` + 空 path 默认）；
- 深层嵌套继续用 `<Outlet/>`；`useOutlet()` 可编程拿到（呼应 vue-router-nested-dynamic）。

---

## 五、自检清单

- [ ] BrowserRouter 靠什么同步 URL？对服务端部署有何要求？
- [ ] `<Route element>` 与 Vue `routes` 配置数组的思维方式差异？
- [ ] 为什么不能用 `<a href>` 跳转？NavLink 的激活态怎么写？
- [ ] useParams / useSearchParams / useLocation 分别拿什么？
- [ ] Outlet 对应 Vue 的什么？index 路由解决什么？

---

## 🚀 部署预告

- 本课把"URL ↔ 组件"的映射用声明式 `<Routes>` 表达，`Outlet` 承担嵌套插槽，hooks 读取路由信息；
- 下一关进入 **react-router-data**：v6.4+ 的 Data Router（`createBrowserRouter` + `loader`/`action`）——把"进路由前先取好数据/提交后重取"从组件里的 useEffect 搬到路由层，呼应 vue-router-guard-lazy 与 09-express REST。
