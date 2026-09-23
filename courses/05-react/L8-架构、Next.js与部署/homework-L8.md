# L8 课后作业 · 架构、Next.js 与部署

> 覆盖：项目架构（feature/分层/依赖方向/Server-Client 边界）、Next.js 渲染与水合、部署与缓存/环境变量。共 5 段 20 题。

---

## 第一段 · 读代码 / 找问题（10 小题）

**1.** 这个目录组织有什么坏处？
```
src/components/Header.jsx  src/components/Footer.jsx
src/api/user.js            src/store/userSlice.js   // 一个"用户"功能散在 4 处
```

**2.** 依赖方向违规：指出问题并改正。
```jsx
// services/http.js
import { useAuth } from '../features/auth/hooks';   // ← 下层引上层
```

**3.** 这段 Server Component 为什么报错？
```tsx
async function P() {
  const data = await fetch(url);
  return <Widget onHover={() => console.log(data)} initial={data} />;  // ← Widget 是 'use client'
}
```

**4.** 这段水合为什么会 mismatch？
```tsx
function Time() { return <span>{new Date().toLocaleTimeString()}</span>; } // 服务端/客户端首帧不同
```

**5.** `next/image` 相比 `<img>` 帮解决了哪些部署/性能问题？（口述两点）

**6.** 部署后刷新 `/dash/settings` 404，nginx 缺了什么配置？

**7.** 子路径 `/shop/` 部署，资源全 404，最可能漏设了什么（说两处）？

**8.** 这段安全上犯了什么错？
```bash
# .env.production
VITE_STRIPE_SECRET=sk_live_51H...    # ← 这是 secret key
```

**9.** 发版后用户仍看旧页面，服务器 `index.html` 的响应头可能是多少 `Cache-Control`？应改成什么？

**10.** 改了 `NEXT_PUBLIC_API` 后 `next start` 没生效（自托管），为什么？该怎么办？

---

## 第二段 · 手写编程（5 小题）

**11.** 为一个"电商前端"设计目录：`features/(auth,cart,products)`、`shared/(ui,lib,hooks)`、`app/`，为 `products` feature 写 `index.ts` 门面只导出 `ProductCard` 与 `useProducts`，说明外部为何不能直接 import 内部文件。

**12.** 把一个 500 行"商品详情"巨型组件按 页面/容器/展示/UI 四层 + 自定义 Hook + service 拆分，画出依赖方向（组件→hooks→services→lib）。

**13.** 用 App Router 写：`app/blog/page.tsx`（Server Component，`await` 直接查库）、`app/blog/[slug]/page.tsx`、`generateStaticParams` 预渲染前 20 篇、`revalidate=60` 开 ISR，`loading.tsx`/`error.tsx` 兜底。

**14.** 把纯 SPA 版改造成"Server/Client 边界尽量深"：给只有"加入购物车"按钮需要交互，标最小的 `'use client'` 叶子，其余保持 server，并说明客户端 bundle 因此省下什么。

**15.** 写一段 nginx（或 Netlify `_redirects`/Vercel rewrites）实现：静态资源 `assets/` 长缓存 immutable、`index.html` no-cache、未知路径回退 index.html。

---

## 第三段 · 场景题（1 小题）

**16.** 你要把一个"面向 SEO 的内容站 + 登录后台"部署上线，团队纠结 SSR 还是纯 CSR、放 Vercel 还是自建 Docker、密钥怎么管、发版后偶尔白屏。请给一份部署与架构方案：哪些页面用 SSG/ISR、哪些用 SSR 或纯 CSR（后台）、Server/Client 边界、`NEXT_PUBLIC_` 与机密如何分、缓存与 CDN 策略、history 回退或流式、以及"发版白屏"的定位与预防。给出取舍理由。

---

## 第四段 · 简答题（3 小题）

**17.** 为什么"按 feature 组织 + 门面收敛"能提升可维护性？和"按类型组织"对比。

**18.** 简述水合的完整过程，以及为什么"两端首次渲染一致"是硬要求。

**19.** `VITE_`/`NEXT_PUBLIC_` 前缀的三件含义（谁能读、何时固化、安全边界）各是什么？

---

## 第五段 · 挑战题 🏆

**20.** 端到端：把你这个 24 关 React 课程里最熟的一个小应用（如待办/看板）改造成一份**可部署的生产工程**——① feature 目录 + 单向依赖；② 状态按"局部/Context/Zustand/Query"正确归类，服务端数据一律 Query；③ 迁移到 Next App Router：列表页 ISR、详情页 Server Component 直取、交互叶子 `'use client'`；④ 配 `base`/回退/缓存头/环境变量分离；⑤ 写一个 CI 脚本 `build → 产物校验 → 部署`。最后用一段话复盘：**从"SPA 手搓 useEffect"到"全栈 + 缓存 + 边界"，你的心智模型发生了哪些变化？**（这道题没有唯一答案，考察你把全课串成工程直觉的能力。）
