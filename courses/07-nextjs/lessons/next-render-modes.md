# SSR/SSG/ISR/CSR 渲染模式总览

> 目标：一张地图讲清四种渲染模式——**谁在什么时候把 HTML 拼出来**。SSR 请求时现拼、SSG 构建时拼好、ISR 拼好后定时翻新、CSR 服务器只给壳、浏览器现拼。并搞懂贯穿前三种的关键词 **Hydration（水合）**。这是 Next 区别于 SPA 的立身之本，也是 L4 缓存体系的前置课。呼应 **vite-ssr**（手搓 SSR 的痛）、**vue-ssr-nuxt**（Vue 阵营同款）、**react-render-model**（客户端渲染那棵树怎么来的）。

---

## 一、时间轴视角：HTML 在哪一刻诞生

```text              构建时(build)        请求时(request)         JS加载后
SSG   服务器拼好HTML ──────────────────── 原样吐出 ──────────── 水合
ISR   服务器拼好HTML ─── 过期后后台重拼 ── 吐出(新/旧) ───────── 水合
SSR   ─────────────────  服务器现拼HTML ── 吐出 ─────────────── 水合
CSR   ─────────────────  只吐空壳 ───────────────────────────── 浏览器拼HTML
```

- **SSG**（Static Site Generation）：`next build` 时把每个路由渲染成 `.html` 存好，请求来了 CDN 直接给——最快，但内容"冻结"在构建那一刻；
- **ISR**（Incremental Static Regeneration）：SSG + 过期时间。到期后第一个请求仍拿旧页，**后台**重渲染换新——静态的速度、动态的新鲜（Next 招牌，Pages Router 时代就有，App Router 换了写法，L4 细讲）；
- **SSR**：每次请求都在服务器上跑一遍组件（`await` 数据 → 渲染 HTML）——内容永远新鲜，代价是每请求一份计算与 TTFB 变长；
- **CSR**：就是传统 SPA（10-vite 产物），服务器只给 `div#root`。

---

## 二、Hydration：水合是什么、为什么会闪

SSR/SSG 返回的 HTML 已可见，但此刻它只是"死"的 DOM——点击没反应。浏览器加载 JS 后，React 做三件事：

1. 在内存里**再跑一遍组件**，生成预期的 DOM 结构；
2. 与服务端来的真实 DOM **逐一对账**（diff 属性/结构）；
3. 对上了 → 把事件监听"接管"挂上，页面从"能看"变"能用"。

```tsx
// 典型水合崩溃：服务器和浏览器各算各的，结果对不上
export default function Bad() {
  return <p>现在是 {new Date().toLocaleTimeString()}</p>;  // ❌ Text content does not match
}
```

服务端渲染时 12:00:00、浏览器水合时 12:00:03——文本对账失败，React 报警并可能整树重建（性能更差）。**水合不一致 = 两端渲染结果不同**，修复思路：把"只有浏览器才知道的值"延迟到 `useEffect` 里再 setState（客户端专属数据不进首轮渲染，呼应 react-useeffect、vue-lifecycle 的 onMounted 类比）。

---

## 三、App Router 里模式是怎么"自动"选的

Next 13+ 不再让你显式喊"这页 SSR！"，而是**由代码行为推断**：

| 你在页面里做了什么 | 结果模式 |
|---|---|
| 什么都不做（纯静态 JSX） | SSG：构建时预渲染 |
| `await fetch(...)` 且缓存命中策略允许 | SSG/ISR（配 revalidate 时长即 ISR） |
| 用了 `cookies()`/`headers()`/`searchParams` | 自动转 SSR（响应式，不可缓存） |
| `force-dynamic` / `no-store` | 强制 SSR |
| 组件是 `'use client'` 且数据在浏览器拿 | 该部分实际 CSR |

```tsx
// app/pricing/page.tsx —— 天然 SSG
export const revalidate = 3600;   // 每小时后台翻新 → 这就是 ISR 的写法
export default async function Pricing() {
  const plans = await fetch('https://api.example.com/plans').then(r => r.json());
  return <PlanList plans={plans} />;
}
```

哲学转变：**从"选模式"到"描述数据的新鲜度要求"，模式是推导结果**（L4 next-revalidate 把这层讲透）。

---

## 四、四种模式的取舍表

| | SSG/ISR | SSR | CSR |
|---|---|---|---|
| 首屏速度 | ⭐⭐⭐（CDN 直出） | ⭐⭐（TTFB 慢一点） | ⭐（白屏等 JS） |
| 内容新鲜度 | 构建时/过期翻新 | 每请求实时 | 加载后实时 |
| SEO | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| 服务器成本 | ≈0（静态文件） | 每请求计算 | ≈0 |
| 适合 | 博客、文档、营销页 | 个性化页、实时数据页 | 登录后工作台 |

经验法则：**能静态就静态（ISR 兜新鲜），必须按人给数据才 SSR，纯工具型界面 CSR 也无妨**（呼应 node-deploy-perf 的 CDN 缓存层级、mp-performance 的"启动优化=少算多缓存"）。

---

## 五、怎么验证一个页面到底走了哪种

```bash
npm run build
```

构建日志每行路由带符号：`○` Static（SSG）、`●` Hybrid（带 ISR 参数）、`ƒ` Dynamic（SSR）。再加两招：
- **view-source**：SSG/SSR 都有内容，CSR 是空壳（next-overview 第五节的手法）；
- **改底层数据不重新 build**：页面变了→SSR/ISR 已过期；没变→纯 SSG——用数据反推模式，比背文档可靠。

---

## 六、自检清单

- [ ] 不看笔记，按"HTML 在哪一刻、由谁拼出"复述四种模式？
- [ ] 水合的三步对账是什么？为什么 `new Date()` 会崩？
- [ ] App Router 里用了 `cookies()` 会发生什么？为什么？
- [ ] ISR 与"轮询重新 build"的本质区别？（增量换整份）
- [ ] build 日志里 ○ / ● / ƒ 分别指什么？

---

## 🚀 部署预告

- 模式地图已立，但"跳转与预取"还没讲——进入 **L2** 第一关 **next-link-router**：`<Link>` 的智能预取策略与 `useRouter` 家族的正确打开方式；
- L4 会把本课的"推断规则"升级成完整的缓存金字塔（Data Cache / Full Route Cache / Router Cache 三层），届时常回本课第三节对照。
