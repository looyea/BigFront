# L6 课后作业 · 样式、字体与 SEO

> 覆盖：样式与 Tailwind、Metadata/SEO、字体与 next/image。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 服务端组件里这一行会怎样？给两条修法：
```tsx
import styles from './card.module.css';   // card.tsx 无 'use client'，用到 styles.title
```

**2.** 运营在 CMS 改了描述，分享卡片仍是旧的。两个互相独立的缓存环节？各自怎么破？

**3.** 这页 LCP 是首屏大图，代码见下——指出三处问题：
```tsx
<Image src={hero} alt="h" width={1920} height={1080} loading="lazy" className="hero" />
// 且 sizes 未写；hero 在 CSS 里 max-width:50vw 但视觉上占满宽
```

**4.** Tailwind 类 `md:text-lg` 正常，同事重构成 `` cls={`md:text-${size}`} `` 后失效。原理与规范写法？

**5.** 暗色模式用 next-themes 默认配置（localStorage+水合后切换），SSR 站线上每次刷新白闪一下主题。解释时序，给出 cookie 方案的关键三步（L6 第四节）。

**6.** 这个 metadata 写法对 /blog/[slug] 全站生效了，但 sitemap.ts 里没有新文章。两问题一并答：
```ts
export const metadata = { title: '博客' };   // 写在 app/blog/layout.tsx
```

**7.** `<a href="https://cdn.x.com/i.png">` 换成了 `<Image src="https://cdn.x.com/i.png" .../>` 后构建通过但运行时报错。缺什么配置？为什么这个报错是"好事"？

**8.** 首页 HTML 里 curl 看 `<title>` 是对的，但搜索结果标题总带旧后缀；再查发现某客户端组件 useEffect 里 `document.title = ...`。解释两种"真相"与处置原则。

**9.** 中文字体接 next/font 后首屏瀑布里仍有一个 2.7MB 的 woff2。三个可选治理方向（含一个"不用这个字体"的诚实答案）。

**10.** robots.txt 把 /api 全Disallow，同事说"接口页反正没内容无所谓"。两个角度各批一句（收录语义、误伤面）。

---

## 第二段 · 手写编程（5 小题）

**11.** 给 `<Btn variant size className>` 写 `cn` 版本：基础类+variant 映射表+size 映射表+外部 className 合并；配 4 个调用断言（覆盖冲突、透传、默认值）。说明为什么映射表不是模板字符串。

**12.** 实现 cookie 暗色全链路：`toggleTheme` Action（写 cookie+revalidate 或 redirect 回来源）+ 根 layout 读 cookie 挂 class + Tailwind `dark:` 变量主题一处定义。贴三段关键码。

**13.** 写 app/sitemap.ts：从 getPublishedSlugs() 生成全量文章 URL（lastModified 用更新时间）+ 静态页清单；app/robots.ts 引用它。再回答：这两个端点的缓存姿态默认是什么、要不要动？

**14.** 用 ImageResponse 做一个"文章分享图"组件（标题+标签+站名，中文标题），字体从本地文件加载；给出尺寸与失败回退（静态兜底图）方案。

**15.** 给一张 4000×3000 的图库图设计完整链路：import vs 远程？sizes 怎么写（栅格 1/3、单图 90vw）？哪张该 priority？blurDataURL 哪来？逐条写理由。

---

## 第三段 · 场景题（1 小题）

**16.** 电商站改版（URL 大改+接入新设计系统+海外英文站启动）：给出含 SEO 的完整方案：① 旧新 URL 映射与重定向层选型（config vs middleware，量大）；② 三语 hreflang/canonical 结构；③ 设计系统 token → Tailwind 主题 → 小程序 WXSS 的一源多端映射；④ 商品图与 UGC 图两套图片策略；⑤ 上线后 4 周内你盯哪些指标判断"没搞砸收录"。

---

## 第四段 · 简答题（3 小题）

**17.** next/font 防 CLS 的两步机制各自防什么？CJK 为什么要手工介入？

**18.** metadata 就近合并规则一句话；generateMetadata 里取数的两条性能守则？

**19.** next/image 编译后的四件事，每件各治哪种病（一张对照小表）。

---

## 第五段 · 挑战题 🏆

**20.** 实现"性能预算机器人"：构建后对每路由产物做静态分析——① HTML 内未定尺寸的 img（width/height/fill 均无）；② 外链字体/脚本域名清单（对照白名单）；③ 首屏路由 JS 体积阈值；④ LCP 候选标记缺失检测（页面无 priority/fill+首图的启发式）。要求：① 给出解析输入（build manifest、HTML 产物、RUM 可选）与每项检查的算法骨架；② CI 中阻断 vs 评论两种模式的选择策略；③ 阈值如何随"基线快照"滚动更新防止债务固化（对照 L3 挑战题审计器与 09 包 exp-testing 的守卫哲学）。写关键代码思路与原理说明。
