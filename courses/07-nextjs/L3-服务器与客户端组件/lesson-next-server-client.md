# Server Components 与 'use client'

> 目标：打开 Next 13+ 的黑盒——**React Server Components（RSC）**。核心三问：组件默认在哪跑？`'use client'` 到底声明了什么？RSC 和 SSR 是一回事吗？答对这三门，L3 后续两关（边界模式、流式渲染）才能建立在对的地基上。这是全 07 包面试区分度最高的一关，没有之一。呼应 **react-render-model**（客户端那棵 reconciliation 树）、**react-component**（组件=函数的旧定义）、**vite-ssr**（服务端只是拼字符串的旧世界）。

---

## 一、默认事实：你的组件在服务端跑

```tsx
// app/page.tsx —— 没有 'use client'，它就是 Server Component
import { db } from '@/lib/db';                 // 直接 import 数据库客户端！

export default async function Home() {
  const posts = await db.query('select * from posts');   // 服务器直连，无 HTTP 无 API
  return <PostList posts={posts} />;           // 注意：<PostList> 也在服务端渲染
}
```

RSC 的运行契约：**组件在服务器上执行，产物不是 HTML 字符串，而是序列化的"组件树描述"（RSC Payload）**，浏览器按描述拼 DOM。于是：

- `db`、密钥、fs 读取**永远不会泄漏**——这些代码压根没进客户端 bundle；
- 组件的 if/else、map、await 全在服务端完成，**客户端 JS 体积只包含客户端组件**；
- 页面导航传输的就是 payload 而非 JSON+再渲染——"数据获取"与"渲染"合并成一步。

对照旧世界：SSR（vite-ssr 手搓的那套）只是"把组件渲染成 HTML 字符串一次"，客户端仍要下载**全部**组件代码重新渲染；RSC 让服务端组件的代码**物理上不出现在浏览器**——这是两个次元（面试高频辨析，见下）。

---

## 二、'use client'：边界声明，不是导入语句

```tsx
// components/Counter.tsx
'use client';                    // ← 文件第一行。声明：本文件及其 import 图 = 客户端岛屿
import { useState } from 'react';

export default function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
```

三个常见误读一次纠正：

1. ❌ "'use client 的组件是 CSR、会重新取数" → ✅ 它**仍然会被服务端渲染**（进 HTML，SEO/首屏不受影响），只是**额外**下载 JS 供水合与交互；
2. ❌ "在 import 语句上写 'use client'" → ✅ 它是**模块级指令**，标一个文件 = 标它整个依赖子图；
3. ❌ "服务端组件不能用 hooks 是因为 React 限制" → ✅ 因为服务端没有"实例"概念：无状态存储处、无事件循环里的用户、一次性渲染完即销毁——useState/onClick 无处安放（呼应 react-usestate 的"状态挂在 Fiber 实例上"）。

---

## 三、能力对照表（背下来）

| | Server Component | Client Component |
|---|---|---|
| async/await 直取数据 | ✅ 组件内 await | ❌（用 hook/SWR 类库） |
| useState/useEffect/refs | ❌ | ✅ |
| onClick 等事件 | ❌ | ✅ |
| 直连 DB/fs/密钥 | ✅ | ❌ 绝对不行 |
| Node 第三方包（pg/sharp） | ✅ | ❌（浏览器包反向 ✅） |
| 代码进客户端 bundle | ❌ 不进 | ✅ 进 |
| 渲染时机 | 服务器 | 服务器（首轮）+ 浏览器（水合后） |

记法：**"能 await 不能 state，能 state 不能密钥"**。两边能力互补而非对立——一个页面本就是一棵混合树（第四节）。

---

## 四、一棵真实的混合树

```tsx
// app/blog/page.tsx (Server)
import { getPosts } from '@/lib/db';
import PostList from './post-list';        // (Client) 带点赞交互
import AdBanner from './ad-banner';        // (Client) 用 window 尺寸

export default async function Blog() {
  const posts = await getPosts();
  return (
    <>
      <AdBanner />
      <PostList posts={posts} />           {/* 服务端取数 → props 喂给客户端岛 */}
    </>
  );
}
```

```text
Server Blog ──┬── Client AdBanner   (岛屿：JS 下发，水合后可交互)
              └── Client PostList   (岛屿：数据由父级服务端注入)
```

架构红利全在这张图里：**数据在服务端拿（快、安全、可缓存），交互在客户端做（轻、少、精准）**——"server-first, client-minimal" 是本包贯穿到 L8 的第一设计律（呼应 react-architecture 的状态归属决策树：这次直接上升到"计算归属"）。

---

## 五、SSR vs RSC：面试必考的一字之差

| | SSR（老式，如 vite-ssr/Nuxt2） | RSC（Next App Router） |
|---|---|---|
| 服务端产物 | HTML 字符串 | RSC Payload（组件树序列化） |
| 浏览器是否再跑一遍全组件 | ✅ 必须（水合） | ❌ 服务端部分直接拼树，无二次渲染 |
| 服务端组件的代码是否下发 | ✅ 全量 JS 仍在 bundle | ❌ 完全不下发 |
| 数据获取位置 | 页面级钩子→props | 任意组件内 await |
| 交互能力 | 有（全组件可交互） | 仅客户端岛 |

一句话：**SSR 优化的是"首屏可见"，RSC 优化的是"计算与代码的物理位置"**——两者正交、可叠加（客户端岛照样 SSR 出首屏）。说"RSC 就是 SSR 增强版"会被判概念不清，正确关系是"RSC 换掉了 SSR 的产物形态与代码分布"。

---

## 六、防御工事：server-only 包

手滑把含密钥的模块 import 进客户端组件怎么办？给服务端模块上锁：

```ts
// lib/db.ts 顶部安装依赖：npm i server-only
import 'server-only';     // ← 一旦被客户端图引用，构建直接失败
```

对称地还有 `client-only`。ESLint 规则 `react-server-components/*` 是第二道锁。工程直觉同 ts-strict：**能把错误推到构建期的，绝不留给运行时**（呼应 exp-security 的纵深防御）。

---

## 七、自检清单

- [ ] RSC 传给浏览器的是 HTML 还是什么？和 SSR 的产物差在哪？
- [ ] 'use client' 的组件，服务端渲不渲染？代码下不下发？
- [ ] 为什么服务端组件不能 useState？用"实例"概念解释。
- [ ] 一个只有展示+一个按钮的页面，谁该是服务端谁该是客户端？
- [ ] 如何防止服务端模块被误引入客户端？两个手段。

---

## 🚀 部署预告

- 概念立住了，下一关 **next-boundaries** 处理真刀真枪：跨边界传函数？Context 怎么穿透？第三方库（chakra/redux）不配合 RSC 怎么办——边界模式的兵家必争；
- RSC 的"代码不下发"直接改写包体账本，L7 next-perf 会用它重算你的 bundle 预算。
