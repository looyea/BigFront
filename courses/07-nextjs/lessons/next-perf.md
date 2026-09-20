# Next.js 性能优化：Core Web Vitals、包体与数据通路

前一关我们把 next/image 和 next/font 这两台"性能外挂"装好了（呼应 next-fonts-images 第 3、4 节），这一关站到更高的视角：Next.js 应用的性能到底怎么量、优化三板斧（包体、渲染、数据）分别砍在哪里。这也是 React 性能课（呼应 react-performance）在框架层的完整闭环。

## 1. 先会量：Core Web Vitals 三指标

浏览器实验室（Lighthouse）与真实用户监控（CrUX）都围绕三个指标：

| 指标 | 全称 | 及格线 | 通俗含义 |
|------|------|--------|----------|
| LCP | Largest Contentful Paint | ≤ 2.5s | 最大内容元素多久画出来 |
| INP | Interaction to Next Paint | ≤ 200ms | 点一下多久给出反馈（2024 年取代 FID） |
| CLS | Cumulative Layout Shift | ≤ 0.1 | 页面布局抖不抖 |

- **LCP 的常见元凶**：HTML 慢（服务端取数阻塞）、首屏大图、字体闪烁——分别对应本包的 revalidate 策略（呼应 next-revalidate）、next/image（呼应 next-fonts-images 第 4 节"优化 LCP 三宗罪"）、next/font 的 size-adjust 度量补偿（第 3 节）。
- **INP 是 Next 特有的痛点**：'use client' 边界画得太粗，一个小组件交互拖进整个客户端 bundle，主线程一卡 INP 就爆。优化方向是**缩小客户端边界 + 用 next/dynamic 延迟非首屏 JS**。
- **CLS 在 Next 里的头号来源**：SSR 输出与 CSR 渲染结果不一致导致内容"跳变"，以及图片没占位（next/image 自动生成 width/height 占位就是在治这个）。

Next 内置上报通道：

```tsx
// app/layout.tsx 中挂客户端上报组件
import Script from 'next/script';
<Script
  src="https://unpkg.com/web-vitals@4/dist/web-vitals.js"
  strategy="afterInteractive"
  onLoad={(e) => {
    const { onLCP, onINP, onCLS } = (e.target as any).contentWindow;
    onLCP((m) => sendToAnalytics('LCP', m.value));
  }}
/>
```

生产上更常用 `@next/bundle-analyzer` + 平台自带的 Analytics，或自建 /api/metrics Route Handler 收点（呼应 next-route-handlers 第 3 节"三正当用途"）。

## 2. 砍包体：next/dynamic 与 Bundle 分析

**next/dynamic 是 React.lazy + Suspense 的框架封装**，专治"首屏加载了永远用不到的 JS"：

```tsx
// 1) 普通懒加载：组件进视口/被触发才拉 chunk
import dynamic from 'next/dynamic';
const Charts = dynamic(() => import('./charts'), { ssr: false, loading: () => <Skeleton /> });
```

三个关键参数：

| 参数 | 作用 | 什么时候用 |
|------|------|-----------|
| `ssr: false` | 完全跳过服务端渲染 | 纯客户端组件（地图、富文本编辑器、只依赖 window 的库） |
| `loading` | chunk 到达前的占位 | 永远要给，否则白屏伤 CLS |
| 配合 `Suspense` | RSC 层懒加载 | 服务端组件也可包 Suspense 做流式（呼应 next-context-streaming 第 3 节） |

**注意一个常见误用**：`ssr: false` 加多了，LCP 反而变差——首屏最大内容变成了纯 CSR，白屏等 JS。只对"首屏不可见"的模块用。

看包体拆分的三件工具：

1. 打包可视化：`@next/bundle-analyzer`，`ANALYZE=true next build` 后弹 Treemap——查"到底哪个库吃掉了 300KB"；
2. 构建日志：`next build` 输出的路由级 Size 列（First Load JS 一列），这是最粗但最有用的健康线（呼应 next-render-modes 第 5 节 ○/●/ƒ 日志解读）；
3. 依赖瘦身：moment→dayjs、lodash→lodash-es 按需、图标集用 `next/image` 思路换成 SVG 组件。Vite 打包课里的 chunk 拆分策略在 Next 里对应 `experimental.optimizePackageImports` 与自动 tree-shaking（呼应 vite-splitting）。

## 3. 砍渲染：路由预取与缓存层复用

Next 的性能优势一半来自"提前准备"：

- **Link 视口预取**：链接滚进视口就预取目标路由的 RSC Payload（呼应 next-link-router 第 1 节）。页面很多时用 `prefetch={false}` 关掉非首屏链接的预取，或改用 `<Link prefetch={null}>`（悬停才预取，v15.1+）。
- **Router Cache**：客户端保留最近访问的 50 个路由段（LRU），回退导航零网络（呼应 next-fetch-cache 第 6 节调优）。
- **数据层三件套复用**：请求记忆化（一次渲染同 URL 只 fetch 一次）、Full Route Cache（SSG/ISR 直接 CDN 命中）、`unstable_cache`（跨请求的函数级缓存）——命中越早的层，TTFB 越低（呼应 next-fetch-cache 第 3 节"三层缓存金字塔"）。

服务端侧还有一个隐蔽杀手：**取数瀑布**。页面组件里 await A 完再 await B，TTFB 直接相加。解法是把串行改并行：

```tsx
// 反例：瀑布
const user = await fetchUser(id);      // 300ms
const posts = await fetchPosts(id);    // 400ms → 总共 700ms

// 正例：并行
const [user, posts] = await Promise.all([fetchUser(id), fetchPosts(id)]); // 400ms
```

更彻底的做法是把非关键数据推给 Suspense 边界流式输出，首屏只等 LCP 需要的最小集（第 1 节 + next-context-streaming 第 4 节"骨架屏三标准"）。

## 4. 砍网络与图片之外：Headers 与压缩

- **静态资源 immutable**：`/_next/static/*` 默认带内容哈希，Next 自动发 `Cache-Control: immutable`，别自作聪明改掉；
- **ISR 页面的 stale-while-revalidate**：CDN 层命中过期缓存先给旧的、后台再生成新的，用户永远不等再生成（呼应 next-revalidate 第 4 节 SWR 生命周期）；
- **gzip/brotli**：Vercel/CDN 默认开，自建 Nginx 记得 `brotli on`（预习 next-deploy）；
- **压缩别压已压缩资源**：图片、webp 再 gzip 纯属浪费 CPU。

## 5. 自检清单

发布前过一遍：

- [ ] LCP 元素是什么？它在最慢的那一层（HTML/图片/字体）上有没有对应优化？
- [ ] 每个 'use client' 边界是否只圈了真正交互的部分？（呼应 next-boundaries 第 2 节）
- [ ] 非首屏重组件是否 next/dynamic + loading 占位？
- [ ] `next build` 日志里 First Load JS 最大的路由是多少？能否降到 200KB 以内？
- [ ] 取数是否并行化？非关键数据是否进了 Suspense 流？
- [ ] 是否接了 web-vitals 真实用户上报，而不只靠本地 Lighthouse？

## 6. 小结

性能优化在 Next 里是一套"指标 → 归因 → 分层砍"的固定动作：用 CWV 定位病灶，包体上砍客户端边界与无用依赖，渲染上用好预取与三层缓存，网络上让静态走 CDN、动态走并行与流式。三板斧全部来自前面关卡的知识拼图——性能不是新功能，是把已有旋钮拧到对的位置。

🚀 部署预告：性能做完还只是"快"，出了错怎么办？下一关 next-error-loading 讲错误边界、全局兜底与日志监控，让你的应用坏得体面。
