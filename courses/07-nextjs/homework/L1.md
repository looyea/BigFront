# L1 课后作业 · 心智与入门

> 覆盖：Next 定位与目录、文件路由与布局、四种渲染模式与水合。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 访问 `/about` 一直 404，目录里有 `app/about/layout.tsx` 和 `app/about/index.tsx`，问题出在哪？

**2.** 这个根布局为什么让所有子页面白屏？
```tsx
// app/layout.tsx
export default function RootLayout({ header }: { header: React.ReactNode }) {
  return <html><body><div>{header}</div></body></html>;   // ← ?
}
```

**3.** 想让侧栏组件在子路由切换时**每次重置滚动位置**，却写成了 `layout.tsx`——该换成什么文件？为什么 layout 不行？

**4.** 页面在控制台报 `Text content does not match server-rendered HTML`，定位到：
```tsx
<p>访问于 {new Date().toISOString()}</p>   // ← 为什么？两种修法和取舍
```

**5.** 这段 app/blog 目录组织有个约定问题，指出来：
```text
app/Blog/page.tsx        # 期望访问 /blog
app/blog/Post/page.tsx   # 期望访问 /blog/post
```

**6.** 给同事演示时说"我们首页是 SSG"，但 `npm run build` 日志里 `/` 标着 `ƒ`。首页代码里有这一行，它为什么"叛变"了？
```tsx
const cookie = cookies().get('theme');   // ← ?
```

**7.** 从 SPA 迁来的人写了 `public/index.html` 想当入口，为什么完全没生效？正确心智是什么？

**8.** 这个页面用了 `React.lazy` 手动分包，你会建议改成什么 Next 原生手段？（指向两个机制）
```tsx
const Chart = React.lazy(() => import('./chart'));
```

**9.** `app/shop/route.ts` 里写了 `export default function Page() {...}`，浏览器访问 `/shop` 显示什么？为什么？

**10.** 新建 `app/dashboard/page.tsx` 后 dev 一切正常，生产构建后旧 HTML 里的内容纹丝不动、新页面 404。多半忘做了什么？（口述部署链路，呼应 react-deploy）

---

## 第二段 · 手写编程（5 小题）

**11.** 用 `create-next-app` 建 TS + App Router 项目，搭出：首页 `/`、`/docs/intro`、`/docs/advanced` 三页，且 `/docs/*` 共享一个含"文档子导航"的布局。写出目录树与 docs 布局代码。

**12.** 给 L11 的首页分别制造一次 SSG 与强制 SSR：先原样构建记录日志符号，再在页面里加 `export const dynamic = 'force-dynamic'` 重建，对比 build 日志与 view-source 结果并写结论。

**13.** 复现并修复水合不一致：先写一个顶层直接用 `window.innerWidth` 渲染宽度的组件观察报错；再改成 useEffect + state 版本，说明为什么第二版安全。

**14.** 写一个"模式探测"小工具页：同一页面里放三个子组件——静态 JSX、`await fetch(..., {cache:'no-store'})`、读 `headers()`——预测页面整体模式，用 build 日志验证，写出你的解释。

**15.** 把 `app/blog/layout.tsx` 依次改名为 `template.tsx` 再改回，在布局里加 `const [n,setN]=useState(0)` 与一个按钮，子页间切换观察 n 是否保留，记录两者差异结论（对应第四节课表）。

---

## 第三段 · 场景题（1 小题）

**16.** 接手一个用 Vite SPA 的新闻站：首屏白屏 2.8s、搜索收录不到正文、运营改标题必须重新发版。请给出迁移 Next 的渲染策略设计：① 首页/列表/详情/专题页各选什么模式与 revalidate 值，说明理由；② 哪些保留客户端渲染；③ 迁移顺序与回滚方案。至少引用本课三个原理作为依据。

---

## 第四段 · 简答题（3 小题）

**17.** 按"HTML 在哪一刻、由谁拼出"复述 SSG/ISR/SSR/CSR，并各配一个典型页面类型。

**18.** 根 layout 有三条铁律（不可删 / 渲染 html+body / 不能 'use client'），分别说明背后的原因。

**19.** App Router 里哪些代码行为会把页面从静态推向动态渲染？列至少 4 条。

---

## 第五段 · 挑战题 🏆

**20.** 设计一个"渲染模式可视化调试器"：一个开发期专用组件/方案，能在**每个页面右下角**浮层显示该页当前的实际渲染模式（SSG/ISR/SSR/CSR 线索）、构建时间戳、以及最近一次 revalidate 信息。要求：① 服务端与客户端各自能拿到什么信号（提示：build时间可注入 process.env、headers 里的 x-nextjs-cache 之类）；② 不侵入业务代码（用根 layout 挂载）；③ 讨论这种"环境隔离"的调试工具如何确保不会漏到生产（呼应 node-config 的环境守卫、vite-plugin-api 的开发期中间件思路）。写出关键代码与一段原理说明。
