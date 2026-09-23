# Link 导航与 useRouter

> 目标：Next 的"跳转"不只是换地址——`<Link>` 自带**预取（prefetch）**与渐进增强，`useRouter` 家族负责命令式导航。本课讲清：Link 何时预取/预取什么、`next/navigation` 与旧 `next/router` 的区别、`usePathname/useSearchParams` 在服务端与客户端的不同形态、`redirect` 在服务端组件中的正确用法。呼应 **react-router-basics**（useNavigate/Link）、**vue-router-basics**（`<RouterLink>` 无预取）、**mp-route**（五种跳转 API 决策表的对照物）。

---

## 一、`<Link>`：会预测人心的 a 标签

```tsx
import Link from 'next/link';

<Link href="/blog/hello">看这篇文章</Link>
// 渲染结果就是 <a href="/blog/hello"> —— SEO 与右键新开全都天然正常
```

三个内置行为：

1. **渐进增强**：JS 没加载完也就是个普通链接，点击照样跳（对比 SPA 的 `<a>` 全裸时代，呼应 react-jsx 的 a 标签讨论）；
2. **视口预取**：链接进入视口（viewport）时，后台悄悄把 `/blog/hello` 的 **RSC Payload** 拉进浏览器缓存——用户真点时"秒开"；
3. **悬停/进视口双通道**：默认 `prefetch` 在"能静态预取"的页生效，动态页则靠 visible 时预取缓存片段。

```tsx
<Link href="/admin" prefetch={false}>后台</Link>   // 关掉预取：低频/昂贵页
<Link href="/blog/[id]" as={`/blog/${id}`}>…</Link> // 动态段拼接（或直接模板字符串）
```

代价意识：预取=多发请求。列表页 200 条链接全在视口边缘反复进出时，预取风暴会打爆接口——**能关则关、该限则限**（呼应 mp-setdata 的"广播有成本"、react-performance 的"优化是有账单的"）。

---

## 二、next/navigation：拆成四个小钩子

旧 `next/router`（Pages 时代）一个大对象包打天下；App Router 拆成按需引入：

```tsx
'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

function Toolbar() {
  const router = useRouter();        // push / replace / back / forward / refresh / prefetch
  const pathname = usePathname();    // '/shop/cart'（字符串，不是 route 对象）
  const searchParams = useSearchParams();  // URLSearchParams 实例
  ...
}
```

| 旧用法（Pages） | 新用法（App） | 备注 |
|---|---|---|
| `router.push('/x')` | 同名，但**不能 await** | 想中断渲染用服务端 `redirect` |
| `router.query.id` |  props `params` / `useSearchParams` | 对象式 query 没了 |
| `router.events` 全局监听 | 无对应（用 loading.tsx / Suspense） | 进度条库改挂 Suspense 信号 |
| `useRouter` 到处可用 | **客户端钩子**，服务端组件不可 | 'use client' 边界，L3 主讲 |

小程序对照秒懂：`useRouter().push` ≈ `wx.navigateTo`（入栈）、`router.replace` ≈ `wx.redirectTo`（换顶）、`redirect()` 服务端函数 ≈ `wx.reLaunch`（决策表神似，呼应 mp-route 第一节）。

---

## 三、命令式重定向：服务端用 redirect()

```tsx
// app/profile/page.tsx —— 服务端组件
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Profile() {
  const session = await getSession();
  if (!session) redirect('/login');      // ← 服务端直接发 307，页面根本不渲染
  return <UserInfo user={session.user} />;
}
```

- 服务端 `redirect()`：抛特殊错误中断渲染、返回 3xx——**比客户端 `router.push('/login') + return null` 少一次白屏闪烁**（先渲染登录页骨架再跳的历史 bug 在 Next 用这招根除，呼应 react-router-basics 的 Navigate 讨论）；
- `permanentRedirect()` → 308，用于 URL 永久搬家（SEO 权重迁移）；
- 客户端事件里跳转才用 `router.push`：`onClick={() => { save(); router.push('/list'); }}`。

---

## 四、useSearchParams 的水合暗坑

```tsx
// ❌ 首版就按 searchParams 渲染 → SSR 时它是空的，水合不一致
function List() {
  const sp = useSearchParams();
  return <div>{sp.get('q') ?? '默认'}</div>;
}
```

规则：`useSearchParams` 只在客户端有意义。页面若在构建/服务端被预渲染，此刻 query 是空的——**首轮服务端 HTML 与客户端首轮结果不同**。两种正解：
1. 用 `<Suspense>` 包住使用该钩子的组件，让这段延迟到客户端补齐（官方推荐，L3 的 loading 边界同款思想）；
2. 把 query 值当"路由状态"提升：服务端组件直接收 `searchParams` **prop**（async 形式），传下去渲染——顺带获得 SSR 内容（呼应 next-dynamic 的 params 服务端读取、react-router-data 的"URL 即状态"）。

---

## 五、router.refresh / prefetch 两个"知道但少用"的按钮

```tsx
button onClick={() => router.refresh()}   // 重新拉当前页 RSC Payload：Server Action 后同步 UI 的原始手段
await router.prefetch('/next-step')       // 手动预取：适合"下一步几乎必然发生"（表单最后一页预取成功页）
```

`refresh` 只刷新**服务端数据**，不重跑客户端 effect、不清状态——与 F5 是两回事（对比 mp-network 里"重新请求≠重新加载页面"的层次区分）。L5 学完 `revalidatePath` 后，refresh 的出场率会进一步下降。

---

## 六、自检清单

- [ ] Link 的 prefetch 何时触发、预取的是什么东西？何时该关掉？
- [ ] `useRouter/usePathname/useSearchParams` 分别替代旧 API 的哪块？
- [ ] 服务端组件里跳登录页，正确写法？为什么优于客户端 push？
- [ ] useSearchParams 为什么会造成水合不一致？两种修法？
- [ ] `router.refresh()` 和浏览器刷新区别？

---

## 🚀 部署预告

- 跳转的"手"有了，下一关 **next-dynamic** 处理路由的"腿"：`[slug]` 动态段、生成函数、以及 Next 特色玩法——并行路由 `@folder` 与拦截路由 `(.)`（modal 的标准姿势）；
- Link 预取的浏览器侧缓存（Router Cache）在 L4 缓存金字塔里自有一层，届时回收本课"秒开"的完整原理。
