# 动态路由与并行/拦截路由

> 目标：三类"高级路由"一次讲透——① **动态段** `[slug]` / `[...catchAll]` 与它的两个生成函数；② **并行路由** `@slot`（一个布局多坑位）；③ **拦截路由** `(.)segment`（点哪开哪的 modal 神技）。并行+拦截是 Next 相对所有前端路由的独创，面试区分度极高。呼应 **vue-router-nested-dynamic**（命名视图）、**react-router-basics**（`:id` 参数）、**mp-communication**（页面间传参对照）。

---

## 一、动态段：方括号即参数

```text
app/blog/[slug]/page.tsx        →  /blog/hello        params: { slug: 'hello' }
app/shop/[category]/[id]/page   →  /shop/book/42      params: { category, id }
app/docs/[...path]/page.tsx     →  /docs/a/b/c        params: { path: ['a','b','c'] }
app/[[...opt]]/page.tsx         →  / 和 /x/y 都命中   可选 catch-all
```

服务端组件直接接 props，**params 是 Promise**（Next 15 起统一异步）：

```tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;            // ← await 一下，别当普通对象用
  return <Article slug={slug} />;
}
```

客户端组件用 `useParams()` 钩子。对照记忆：Vue Router 的 `route.params.slug`、React Router 的 `useParams()`——Next 的特色是**参数即 props，服务端组件不用任何钩子**（呼应 vue-router-nested-dynamic 第 3 节）。

---

## 二、generateStaticParams：动态段的 SSG 白名单

动态页要走 SSG/ISR，得先知道"有哪些页"：

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPostSlugs();       // 构建时执行：生成这 500 个详情页
  return posts.map(slug => ({ slug }));
}
export const dynamicParams = false;         // 白名单外直接 404（默认 true：现渲）
```

- 不写此函数 → 该页默认动态渲染（访问时才定 slug 值）；写了 → 列出的预生成、其余按需（`dynamicParams:false` 则拒绝）；
- 配套 `generateMetadata({ params })`：给每个详情页出**独立的 title/description**——SEO 站点的命门（L6 next-metadata 主讲）；
- 心智对照：sitemap 之于爬虫 ≈ generateStaticParams 之于构建器（呼应 next-render-modes 第三节）。

---

## 三、并行路由 @：一个布局多个坑位

```text
app/dashboard/
├── layout.tsx          # 收两个 children props：analytics 和 team
├── @analytics/
│   └── default.tsx     # 未匹配 /dashboard/analytics 时的兜底
├── @team/
│   └── page.tsx
├── analytics/page.tsx  # 左坑位真正的内容路由
└── page.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function Layout({ children, analytics, team }: {
  children: React.ReactNode; analytics: React.ReactNode; team: React.ReactNode;
}) {
  return <div>{children}{analytics}{team}</div>;
}
```

`@slot` 目录**不影响 URL**，只是把渲染树"开洞"多传一个插槽 prop——等价于 Vue 命名视图 `<RouterView name="analytics">` 但无需 URL 里体现（呼应 vue-router-nested-dynamic 命名视图一节）。典型用途：仪表盘多源数据独立加载（每个槽自带 loading/error 边界）。

---

## 四、拦截路由 (.)：点哪开哪的 modal

需求经典三难：图片详情既要是**可路由页面** `/posts/[id]`（可分享/可回退），又要在列表内点击时以**弹层**打开且 URL 变化。

```text
app/
├── posts/[id]/page.tsx          # 独立页面
└── feed/
    ├── page.tsx                 # 列表
    └── (.)posts/[id]/page.tsx   # ← 拦截路由：在 /feed 内点 /posts/1 时渲染这个
```

括号点号是"拦截标记"：`(.)` 同级、`(..)` 上级、`(...)` 根级、`(.@slot)` 拦并行槽。从 `/feed` 点进 `/posts/1` → 命中 `(.)posts/[id]` 渲染成 modal；直接输 URL/刷新 → 正常整页。**同一内容两种打开方式，URL 与历史栈全程正确**——关闭时 `router.back()`，后退键天然关 modal。

---

## 五、matchers 与生成函数的关系图

| 声明 | 位置 | 决定什么 |
|---|---|---|
| `generateStaticParams` | page/layout | 动态段预生成哪些值 |
| `dynamicParams` | page | 白名单外的值 404 还是现渲 |
| `middleware matcher` | middleware.ts | 中间件只对哪些路径生效（L5） |
| `route segment config` | page/route | `dynamic/revalidate` 等渲染策略（L4） |

它们共享一个思想：**声明式枚举 + 兜底策略**，和 CSS 选择器/路由表匹配同一套哲学（呼应 vite-splitting 的声明式分包）。

---

## 六、自检清单

- [ ] Next 15 里 params 的类型为什么要写成 Promise？
- [ ] catch-all 与可选 catch-all 的目录写法差别？
- [ ] 不写 generateStaticParams 的动态页是什么渲染模式？
- [ ] 并行路由的 @slot 会出现在 URL 里吗？default.tsx 何时渲染？
- [ ] 拦截路由解决的经典三难是哪三难？关闭 modal 应该用什么 API？

---

## 🚀 部署预告

- 目录的"魔法前缀"还剩两类没讲——下一关 **next-groups-matchers**：路由组 `(marketing)`、私有目录 `_`、以及 public 静态目录的边界；
- 并行/拦截的槽位与 modal 都天然要"各自加载各自错"，L3 的 Suspense 边界课正好接住这个话题。
