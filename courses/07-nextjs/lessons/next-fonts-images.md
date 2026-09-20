# 字体与 next/image

> 目标：性能三兄弟里"字体+图片"占首屏字节的 80%——`next/font` 与 `next/image` 是 Next 把"性能最佳实践"做成**默认基建**的样板课：不优化很难、想错很常见。CLS（布局位移）与 LCP（最大内容绘制）在这里从概念变成可交付的工程件。呼应 **react-performance**（指标定义）、**mp-performance**（图片与 setData 的字节账）、**vite-hmr**（构建期优化的 Web 版）。

---

## 一、next/font：字体不再闪

```tsx
// 构建期自托管：零外部请求、零隐私外泄（Google 字体也不再经浏览器之手）
import { Inter } from 'next/font/google';
import { PingFangBase } from '@/fonts/brand';   // next/font/local 本地字体文件

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

// app/layout.tsx
<html className={inter.variable}>              // CSS 变量注入，子树 font-family: var(--font-inter)
```

机制两层（面试深度）：
1. **构建期下载并打包**字体文件，URL 同源带 hash——无运行时网络请求，GDPR 友好（Google Hosted 字体的合规老病）；
2. **度量表补偿**：Next 生成带 `size-adjust` 的回退字体（ASCII 度量自动提取，CJK 需手工度量），保证**真实字体加载前后行高字宽不变 → CLS≈0**——这是它对比"手写 link 标签"的决定性差异（对照 mp-performance 的"骨架尺寸一致"同一条律）。

CJK 警告：中文字体动辄数 MB，子集化/分片（unicode-range 切片）与系统字体栈兜底是策略题不是组件题；`display:'swap'`+度量补偿组合下首屏走系统字、真字后到不跳动。

---

## 二、next/image：一张图的完整生产线

```tsx
<Image
  src={post.cover} alt="封面"
  width={1200} height={630}        // 比例决定占位高度 → 防 CLS 的第一参数
  sizes="(max-width: 768px) 100vw, 50vw"   // 响应式选档的依据（srcset 大脑）
  priority={isHero}                // LCP 图：取消懒加载+预加载，抢首屏
/>
```

编译后它做四件事：
1. **按设备选尺寸**：srcset 自动档位，手机不再下桌面原图；
2. **格式协商**：AVIF/WebP 按 Accept 降级 JPEG；
3. **请求时优化**：内置 `/_next/image` 端点（或云 loader）做缩放转码——原图 3MB、出网 80KB 量级；
4. **懒加载默认开**：视口外不请求（priority 的例外正是给 LCP 图）。

对比手写 `<img loading="lazy" srcset=…>` 全家桶：不是不能用，是**每个字段都要人对齐**（width/height/sizes/格式/档位），Next 把这些变成框架契约——"默认正确"哲学与 10-vite 的资源处理一脉（呼应 vite-build 的 assets 内联阈值）。

---

## 三、远程图片与 loader 的权限模型

```ts
// next.config.ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com', pathname: '/cover/**' }],
  // 不声明 = 直接报错拒绝优化：这是安全设计（防开放代理被滥用打图）
  loader: 'custom', loaderFile: './image-loader.ts',   // 云厂商（COS/OSS imgix）直连优化
  dangerouslyAllowSVG: true, contentDispositionType: 'attachment',   // SVG 需显式放行（XSS 面）
}
```

三种图源策略：**站内 import**（最优：构建期已知尺寸与 hash）、**remotePatterns 白名单**（动态 URL）、**loader 指向云处理**（大图库/存量 CMS 常选）。`static/` 裸路径图用 next/image 不会获优化收益——这是新手最常见的"用了但白用"（呼应 next-groups-matchers 的 public 告诫）。

---

## 四、LCP 与图片的三宗罪三味药

| 罪 | 药 |
|---|---|
| 首屏大图懒加载（优先级搞反） | LCP 候选 `priority`，其余默认懒 |
| 尺寸未声明 → 到位即跳动 | width/height 或 `fill`+容器 aspect 锁定 |
| 大图原图直出 | 响应式 sizes+格式协商；背景图 CSS 无法用 next/image，改 `<img>` 绝对定位或 `preload` |

验证统一走 Lighthouse/RUM 的 LCP 元素标注——**指标上认出那张图，比读十篇优化文有用**（呼应 mp-performance 度量五步）。

---

## 五、blurDataURL 与占位体验

```tsx
<Image src={cover} width={800} height={500} blurDataURL={tinyBase64} placeholder="blur" />
// 或静态 import 自动得到内联 64 字节模糊底
```

图片到达前显示**内联极小模糊图**（data URI 进 HTML 不占请求）——"渐进显影"体验；与骨架屏（L3）/字体补偿（本课第一节）同属一个世界观：**空白不是中性感，占位才是**（mp 的 skeleton、OG 图缺省同理，呼应 next-context-streaming 第五节）。

---

## 六、自检清单

- [ ] next/font 消 CLS 的两步机制？CJK 为什么要手工度量？
- [ ] priority 该给哪张图？给错到全部图会怎样？
- [ ] remotePatterns 不配会发生什么？这防的是谁的什么事故？
- [ ] fill 和 width/height 各适合什么布局？
- [ ] SVG 放行的代价是什么、怎么缓解？

---

## 🚀 部署预告

- L6 收官，进入 **L7 性能与工程**——**next-perf** 把前三关的零散收益汇成一张 Core Web Vitals 作战图，外加 next/dynamic 与包体分析的主武器库；
- 图片端点 `/_next/image` 在 serverless 部署下的超时/冷启动问题，L8 next-deploy 的自托管清单里有它的名字。
