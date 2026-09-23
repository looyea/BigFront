# L2 课后作业 · 路由进阶

> 覆盖：Link 与 useRouter、动态/并行/拦截路由、路由组与目录约定。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 服务端组件里这段为什么会报错？改成什么？
```tsx
// app/cart/page.tsx（无 'use client'）
export default function Cart() {
  const router = useRouter();          // ← ?
  return <button onClick={() => router.push('/shop')}>去逛逛</button>;
}
```

**2.** 列表页 300 个商品 Link，Network 里发现进页面就爆了 300 个请求。指出元凶与两种修法（呼应 next-link-router 第一节）。

**3.** 这个动态页在 Next 15 下 params 取不到值，为什么？
```tsx
export default function Post({ params }: { params: { slug: string } }) {
  return <Article slug={params.slug} />;   // ← 显示 [object Object] / undefined
}
```

**4.** `/docs` 访问 404，但 `/docs/a` 正常。目录是 `app/docs/[...path]/page.tsx`，改哪里最省事？

**5.** 刷新后弹窗 modal 变成了整页，产品说是 bug。用拦截路由的知识判断：这是 bug 吗？该怎么向产品解释（一句原理+一句方案）？

**6.** 这段为什么水合报警？给两种修法：
```tsx
function TabBar() {
  const sp = useSearchParams();
  const tab = sp.get('tab') || 'basic';    // ← 预渲染页 SSR 时 sp 为空
  return <Tabs value={tab} />;
}
```

**7.** 报错 `You cannot have two parallel pages that resolve to the same path`：`(auth)/login/page.tsx` 与 `(portal)/login/page.tsx`。三种各自成立的解法？

**8.** 部署到网关子路径 `/crm` 后，public 里的 logo 全 404、Link 跳转丢前缀。分别是什么原因？（两个机制）

**9.** 改了 `public/hero.png` 文件名为 `hero-v2.png`，构建通过、线上图片裂开。为什么 import 的图片不会这样？这暴露 public 的什么特性？

**10.** `router.push('/list')` 后发现列表数据还是旧的，同事说"push 自带刷新"。他说得对吗？该用什么（至少两种，说明差别）？

---

## 第二段 · 手写编程（5 小题）

**11.** 建 `app/shop/[category]/[id]/page.tsx`：从 params 取两参数渲染；再写 `generateStaticParams` 枚举 2 分类 × 3 商品共 6 组合；设 `dynamicParams=false` 后访问 `/shop/book/999` 观察结果。

**12.** 用并行路由做 `/dashboard`：左槽 `@metrics`（含自己的 loading.tsx）、右槽 `@alerts`；URL 直达 `/dashboard/metrics` 时右槽显示 default.tsx 内容。贴出目录树与 layout 签名。

**13.** 实现拦截路由版图片查看器：`/gallery` 列表 + 点图弹 modal（`(.)gallery/[id]` 渲染 `<dialog>` 样式）+ 直达/刷新 `/gallery/3` 为整页 `<GalleryImage>`。写关闭按钮逻辑（要求：来源是拦截则 back，直达则 replace 到列表）。

**14.** 用路由组重组一个乱摊子：现有 marketing（3 页无壳）、admin（4 页带侧栏+守卫）、公开帮助页 2 个——给出 app/ 目录树（用 (group) 与私有目录），保证 URL 全部不变。

**15.** 写一个 `<SmartLink>` 封装：默认关预取、props 可开；外链自动加 `target="_blank" rel="noopener"`；basePath 环境安全。附一段注释说明每个默认值的理由。

---

## 第三段 · 场景题（1 小题）

**16.** 内容社区需求：帖子页 `/post/[id]` 要能 ① 从时间线点击时以半屏弹层打开且 URL 变化、可分享；② 直达/刷新是全屏页；③ 弹层内点"全部楼层"跳转到全屏页且浏览器后退能回到弹层再回到时间线。请给出路由结构设计（目录树+关键文件），并说明历史栈每一步发生了什么；如果产品再加"弹层数据要和列表预取共用"，你加什么机制？

---

## 第四段 · 简答题（3 小题）

**17.** 默写目录魔法字符表：`( )`、`_`、`[ ]`、`@`、`(.)` 各自对 URL 的影响与用途。

**18.** `usePathname` 和 `useSearchParams` 在 SSR 阶段分别能拿到什么？为什么 Link 预取动态页会降级？

**19.** app/robots.ts 和 public/robots.txt 同时存在，哪个生效？该用哪个？说明理由。

---

## 第五段 · 挑战题 🏆

**20.** 设计"路由约定守门员"：一个开发期检查方案（脚本或自定义 ESLint 规则/构建插件思路均可），能自动检出：① app/ 下大写或下划线开头的非法段名；② 同层解析到同 URL 的两个 page；③ public 里被代码引用但已不存在的文件；④ 未被引用的 public 死文件。要求：① 说明每项的检查算法（AST/正则/图遍历均可）；② 如何挂进 CI 且开发期秒级反馈（对照 vite-plugin-write 的插件钩子与 10-vite 的 closeBundle 时机）；③ 白名单逃生机制怎么设计才不会让军规形同虚设。写出关键代码骨架与原理说明。
