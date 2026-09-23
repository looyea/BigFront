# Next.js 与 React 的全栈形态

> 目标：纯 CSR 的 React SPA 有首屏白屏、SEO 弱、TTFB 慢的问题；**Next.js** 把 React 带上服务端渲染/静态生成/数据/路由一体化。本课讲：为什么需要 SSR、App Router（文件即路由）、三种渲染策略 **SSR / SSG / ISR**、**Server vs Client Components**、**水合(hydration)** 与常见错。呼应 **vue-ssr-nuxt**、本套 **07-nextjs**、以及 react-architecture 第四节的边界。

---

## 一、为什么需要 SSR / 静态生成

纯 CSR：浏览器先下 HTML 壳 + 大 JS，执行后才渲染内容 → **首屏白屏、爬虫看不到内容、慢网络体验差**。SSR 在服务端把首屏渲染成**真实 HTML** 返回：首屏即可见、利于 SEO、TTFB 更快。代价：服务器压力、需处理数据获取与水合。这与 Vue 引入 Nuxt 的动机完全一致（呼应 vue-ssr-nuxt）。

---

## 二、App Router：文件即路由

```
app/
  layout.tsx        // 根布局（含 <html><body>）
  page.tsx          // 首页
  blog/
    page.tsx        // /blog
    [slug]/page.tsx // /blog/:slug（动态段）
  loading.tsx       // 该级的 Suspense fallback
  error.tsx         // 该级 ErrorBoundary
```
- **文件夹=路由段、`page.tsx` 是页面、`layout.tsx` 提供嵌套外壳**（对应 react-router 的 `<Route>`/`<Outlet>` 但用文件系统表达，呼应 react-router-basics 第四节）；
- `loading.tsx`/`error.tsx`/`not-found.tsx` 是**约定式**的加载/错误/404 边界（呼应 react-render-control）；
- 与 `pages/` 老路由相比，App Router 原生支持布局嵌套 + Server Components。

---

## 三、SSR / SSG / ISR 三策略

| 策略 | 何时生成 HTML | 适用 |
|---|---|---|
| **SSG**（静态生成） | **构建时** | 内容不常变的营销页/文档，最快、可放 CDN |
| **SSR**（服务端渲染） | **每次请求时** | 个性化/实时数据（仪表盘、用户页） |
| **ISR**（增量静态再生） | 构建时生成 + **到期后台重生成** | 内容较多又偶尔更新（博客列表、电商页） |

- App Router 默认尝试静态渲染（≈SSG）；用到 `cookies()`/动态 `fetch`（`cache: 'no-store'`）等就转为动态（≈SSR）；
- `revalidate`（秒）设定 ISR 再生周期；`generateStaticParams` 决定预渲染哪些动态路径；
- 选择口诀：**越静态越好、越靠近 CDN 越好**，只有确需实时/个性化才上 SSR（对照 Nuxt 的 `ssr:false` / 预渲染 / SWR，呼应 vue-ssr-nuxt）。

---

## 四、Server vs Client Components

```tsx
// 默认是 Server Component：在服务器渲染，可 async 直接取数、代码不进客户端包
async function Page() {
  const posts = await db.query();          // 直接访问数据源
  return <List posts={posts} />;
}

'use client';                              // 需要交互/hooks/浏览器 API 才标
function LikeButton({ id }) {
  const [on, setOn] = useState(false);
  return <button onClick={() => setOn(x => !x)}>❤</button>;
}
```
- **Server Component**：默认，只在服务器跑——可 `async/await` 直连数据库/文件、密钥不外泄、产物不进浏览器 → 客户端 bundle 更小；
- **Client Component**（`'use client'`）：有 state/effects/事件/浏览器 API；其**子树也在客户端**；
- 边界原则（呼应 react-architecture 第四节）：**把 client 推到尽量深的叶子**；Server→Client 通过 props 传**可序列化**数据（函数/Date 不能直传）。
- 这改变了"数据获取"：Server Component 里 `await` 取数可替代很多客户端 useEffect/Query（二者可并存分工）。

---

## 五、水合（Hydration）

- 服务端返回 HTML + 一份"要渲染成什么"的序列化数据 → 客户端 React 启动，**接管**已有 DOM、绑定事件、恢复组件 state，使静态 HTML 变可交互——这就是水合；
- **hydration mismatch**：服务端 HTML 与客户端首次渲染不一致（如用了 `Math.random()`/`Date.now()`/读 `window`、时间/登录态两端不同），React 报警甚至重建整块（呼应 vue-ssr-nuxt 同类坑、react-advanced-hooks 的 useId/`useSyncExternalStore` SSR 守卫）；
- 规避：浏览器专属逻辑放 `useEffect`；用 `suppressHydrationWarning`（仅用于时间戳等无害差异）；两端数据一致。

---

## 六、自检清单

- [ ] 纯 CSR 有哪三大痛点？SSR 如何解决、带来什么代价？
- [ ] SSG / SSR / ISR 分别何时生成 HTML？如何选？
- [ ] Server Component 和 Client Component 的区别与划分原则？
- [ ] 什么是水合？常见 mismatch 成因与规避？
- [ ] `loading.tsx`/`error.tsx` 约定对应前面哪一关的能力？

---

## 🚀 部署预告

- 本课把 React 从 SPA 带到全栈：App Router 文件路由、SSR/SSG/ISR、Server/Client 边界、水合，与 Nuxt 高度同构；
- 最后一关进入 **react-deploy**：把 Next.js/Vite React 产物部署上线——静态导出、Node 服务端、`NEXT_PUBLIC_` 环境变量、CDN/缓存、SPA history 回退，呼应 vue-deploy 与 10-vite-deploy。
