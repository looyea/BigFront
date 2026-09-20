# 文件路由基础与 Page/Layout

> 目标：把 App Router 的"文件约定"一次背全——`page / layout / template / loading / error / not-found / default / route` 各是什么、嵌套布局如何靠 `children` 拼装、根布局为什么不可删除。这是后面 RSC、缓存、并行路由所有玩法的地基。呼应 **vue-router-nested-dynamic**（嵌套 `<RouterView>`）、**react-router-basics**（路由表时代）、**mp-directory**（小程序也要手工注册页面的对照）。

---

## 一、一个路由段（Segment）的全部文件

`app/blog/` 这个目录就是 URL 里的 `/blog` 这一段，段内可放的文件各司其职：

| 文件 | 作用 | 记住一句话 |
|---|---|---|
| `page.tsx` | 段的界面 | 有 page 才是可访问路由 |
| `layout.tsx` | 段及子段的共用外壳 | 包裹 children，跨导航**不重挂载** |
| `template.tsx` | 会重置的壳 | 每次导航重新挂载（状态清零） |
| `loading.tsx` | 该段的 loading UI | 配 Suspense，流式渲染用（L3） |
| `error.tsx` | 该段错误边界 | 必须是客户端组件（L7） |
| `not-found.tsx` | 404 界面 | `notFound()` 触发（L7） |
| `default.tsx` | 并行路由兜底 | 未匹配时渲染（L2 并行路由） |
| `route.ts` | Route Handler（API） | 段的"接口版 page"（L4） |

对照小程序：新增页面要改 `app.json` 注册（mp-directory）；Next **零注册**，文件放进去路由就生效——"约定优于配置"的极致。

---

## 二、嵌套布局：children 就是插槽

```tsx
// app/blog/layout.tsx
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <nav>博客子导航</nav>
      {children}   {/* ← 子段（page 或下层 layout）渲染在这 */}
    </section>
  );
}
```

访问 `/blog/hello` 时渲染树是：

```text
<RootLayout>        app/layout.tsx
  <BlogLayout>      app/blog/layout.tsx
    <Page>          app/blog/hello/page.tsx
```

与 vue-router 嵌套 `<RouterView>` 同一棵树，但 Next 用**目录层级**替你把 `children` 配置写完了（呼应 vue-router-nested-dynamic 第 2 节）。

---

## 三、根布局与 html/body 的铁律

```tsx
// app/layout.tsx —— 根布局：整个应用唯一
export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
```

- **根 layout 必须渲染 `<html>` 和 `<body>`**，且**不可删除**——因为 Next 不再提供 index.html（next-overview 第三节埋的伏笔在这回收）；
- 布局是**持久化**的：从 `/blog` 跳到 `/blog/hello`，BlogLayout 的组件状态（比如折叠面板开合）**不丢**——它没有重新挂载。这正是 layout 与 template 的分水岭。

---

## 四、layout vs template（面试高频）

| | layout | template |
|---|---|---|
| 跨子路由导航 | 复用，不重挂载 | **重新挂载**，状态重置 |
| 状态保持 | ✅ 保持 | ❌ 清零 |
| 收到 children | ✅ | ✅（还额外收 key） |
| 适用场景 | 导航栏、页脚 | 需要"进新页就重置"的动画/表单壳 |

同类心智：Vue 里给 `<RouterView>` 加 `:key="route.fullPath"` 强制重建（呼应 vue-router-nested-dynamic 的 key 技巧）、React 列表 key 变化导致重挂载（呼应 react-lists-keys）——三种框架殊途同归：**换 key = 换人生**。

---

## 五、多页嵌套完整示例

需求：站点有前台 `/`、会员中心 `/member`（带侧栏）、成员页 `/member/orders`、`/member/profile`。

```text
app/
├── layout.tsx            # 根：<html><body>
├── page.tsx              # /
└── member/
    ├── layout.tsx        # 侧栏 + {children}
    ├── orders/page.tsx   # /member/orders
    └── profile/page.tsx  # /member/profile
```

侧栏只在 member 系出现——不需要像 vue-router 那样写 `components: { sidebar, main }` 命名视图，目录即作用域（呼应 vue-router-nested-dynamic 命名视图一节）。

---

## 六、命名与格式细则

- 扩展名全家桶：`page.js / page.jsx / page.ts / page.tsx` 均可，TS 项目统一 `.tsx`（呼应 ts-project）；
- 目录名小写短横线：`user-profile/` → `/user-profile`（大小写会进 URL，别用驼峰）；
- 段名以 `.` 开头（如 `app/blog/.draft/`）不参与路由——私有目录（L2 groups 细讲）；
- `page.tsx` 必须是默认导出的组件；layout 必须接收并渲染 `children`，否则子路由全部"隐身"——**最常见的白屏 bug**。

---

## 七、自检清单

- [ ] 一个路由段最多能有哪 8 种特殊文件？各自一句话职责？
- [ ] 为什么根 layout 不可删除？html/body 该谁渲染？
- [ ] 从 /a 导航到 /a/b，A 的 layout 状态会丢吗？template 呢？
- [ ] 新增一个页面需要改任何"注册文件"吗？和小程序对比一下。
- [ ] layout 忘渲染 children 会发生什么现象？

---

## 🚀 部署预告

- 路由的"静态骨架"已立，但真实站点还要回答"跳转怎么写、动态段怎么配"——下一关 **next-link-router** 讲 `<Link>` 预取与 `useRouter` 家族；
- L1 最后一关 **next-render-modes** 把 SSR/SSG/ISR/CSR 一次性讲透，那是理解 Next 缓存体系（L4）的前提。
