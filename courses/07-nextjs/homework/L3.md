# L3 课后作业 · 服务器与客户端组件

> 覆盖：RSC 与 'use client'、边界与数据流、Suspense 流式渲染。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 这段服务端组件为什么构建失败/运行报错两处各错在哪？
```tsx
// app/me/page.tsx（无指令）
'use client';                        // ← 位置错了？
export default async function Me() { // ← 和谁冲突？
  const u = await getMe();
  return <div onClick={() => ping()}>{u.name}</div>;
}
```

**2.** 同事说"这个页面没写 'use client'，所以它的取数发生在浏览器"。用 RSC 产物知识纠正他（两句话）。

**3.** 客户端组件里出现这一行，报错信息会提到什么关键词？给两种修法：
```tsx
import { prisma } from '@/lib/db';   // lib/db.ts 顶部有 import 'server-only'
```

**4.** 为什么下面这行 props 传不过去？改成什么？
```tsx
<ClientSearch onHit={(q) => track(q)} initial={{ date: new Date() }} />
```

**5.** 这个页面 TTFB 恒定 2.1s，代码里明明有 Suspense，为什么没流式效果？
```tsx
export default async function P() {
  const [a, b] = await Promise.all([getFast(), getSlow2s()]);  // ← 病灶
  return <><A d={a} /><Suspense fallback={<Skel/>}><B d={b} /></Suspense></>;
}
```

**6.** 给整站根 layout 加了 `'use client'` 后 build 报 metadata 相关错误。解释因果并给正确做法（主题 Provider 怎么办）。

**7.** 某页无事件无 state，却出现在客户端 bundle 分析里体积巨大。最可能的两个原因？（一个和 import 方向有关，一个和指令位置有关）

**8.** 骨架屏上线后 CLS 反而变差，检查发现 fallback 是个 20px 高的 spinner，真实内容 420px。用第五节标准解释并给出修法。

**9.** 慢面板抛错后**整页**变成错误页，而预期只坏一个面板。目录/代码层面缺了什么结构？（提示：边界的层级）

**10.** 运营反馈"百度抓取到的详情页经常没有正文"，经查该页 shell 秒出、正文在 2s 后的流式块里，且部分爬虫未等流结束。这算流式渲染的 bug 吗？你怎么处置与回应？

---

## 第二段 · 手写编程（5 小题）

**11.** 写一对组合：服务端 `Ranking`（await 取数 + 直接渲染表格）内嵌客户端 `LikeButton`（useState+事件）。给出两个文件全文，并标注每个文件渲染发生地。

**12.** 用 children 穿透实现 `<ClientDrawer>`（'use client'，含开关动画与 esc 关闭），服务端页面把一个大表格作为 children 传给它。写目录结构与关键代码，说明表格为何仍是服务端渲染。

**13.** 复现并修复第五题：改造为"快数据进 shell、慢数据下沉到子组件内 await + Suspense"，用 curl -N 观察（或描述应有的）分块到达现象，写 3 行结论。

**14.** 一个页面含三个源：profile(50ms) / feed(300ms) / stats(2s)。用 loading.tsx + 两个页内 Suspense + 各自骨架编排出来，写出每个用户时刻（0s/0.3s/2s）分别看到什么。

**15.** 写 `providers/locale.tsx`（'use client' 的 Context Provider）+ 服务端页 `app/de/pricing/page.tsx`：服务端用 cookies()/参数取 locale 渲染文案，岛内组件用 useLocale()。说明数据两条路径如何不打架。

---

## 第三段 · 场景题（1 小题）

**16.** 帮助中心重构：文章正文（SEO 必须）、目录树（全站共享、低频变更）、AI 问答框（重交互、调三方 SDK、含密钥）、用户收藏态（按人）。请为四块分别裁定：Server/Client、Suspense 边界有无、密钥存放位置、数据初始来源，并画一棵渲染树。交付时如何验证"AI SDK 没漏进 bundle"？（说出你用的工具与看什么指标）

---

## 第四段 · 简答题（3 小题）

**17.** 'use client 的三件套语义：对渲染位置、对 bundle、对 hydration 各改变了什么？

**18.** Server→Client 传 props 的序列化契约：列出 4 类可传、3 类不可传（含例外）。

**19.** loading.tsx、Suspense fallback、Link 预取三者在"点击瞬间"的先后接力关系是怎样的？

---

## 第五段 · 挑战题 🏆

**20.** 设计"边界审计器"：一个开发期 CLI/脚本，扫描 src 输出 ① 所有含 'use client' 的文件及其 import 子图的客户端体积估算；② 被客户端图间接 import 的 server-only 违例（构建前静态预警）；③ "无事件无 state 却位于客户端岛内"的可下沉组件清单（AST 找 onClick/useState/Context 消费点做反向证明）。要求：① 每项给出算法骨架；② 如何与 next/diagnostics 或 bundle analyzer 的数据对接避免重复造轮子；③ 结果如何进 CI 做增量卡口（只拦新增违例）。写出关键代码思路与原理说明。
