# Metadata API 与 SEO

> 目标：让站点"被正确收录、被漂亮地分享"。Next 把 `<head>` 的杂活收编成**声明式 Metadata API**：静态导出、动态 generateMetadata、文件约定（robots/sitemap/manifest/OG 图）。并讲清 SEO 在这套体系里的机理——爬虫眼中的你和用户眼中的你为何一致。呼应 **next-routing**（段文件全家桶）、**mp-openapi**（分享卡对照）、**next-render-modes**（爬虫不再拿空壳）。

---

## 一、声明式：文件里"导出配置"而不是"渲染 head"

```tsx
// app/layout.tsx —— 全站默认值
export const metadata: Metadata = {
  title: { default: '大前端学院', template: '%s · 大前端学院' },   // template 是站名统一后缀神器
  description: '系统化的前端学习平台',
  metadataBase: new URL('https://college.example.com'),           // 相对 URL 解析基准（OG 图必填项）
  openGraph: { siteName: '大前端学院', type: 'website', locale: 'zh_CN' },
  robots: { index: true, follow: true },
};

// app/blog/[slug]/page.tsx —— 页面级覆写 + 动态生成
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);                 // 与 generateStaticParams 同一时机执行
  if (!post) return { title: '未找到' };
  return {
    title: post.title,                              // 套上 template 渲染
    description: post.excerpt,
    alternates: { canonical: `https://college.example.com/blog/${slug}` },
    openGraph: { images: [{ url: post.cover, width: 1200, height: 630 }] },
  };
}
```

规则三条：**就近合并**（子段覆盖父段同名字段、其余继承）；**只有服务端组件能 export metadata**（客户端组件要改标签用 `use()`/渲染 `<title>` 等受限手段，老 JSX `<Head>` 时代结束）；generateMetadata 的**耗时计入渲染**——它内部 await 要节制（能复用 generateStaticParams 已取的数据最好，L4 的 memoization 在这续命）。

---

## 二、文件约定：行政文件组件化

```text
app/robots.ts        →  /robots.txt：返回 { rules, sitemap } 对象
app/sitemap.ts       →  /sitemap.xml：从 DB/列表函数 map 出全部 URL（动态站上它=收录油门）
app/manifest.ts      →  PWA 清单
app/[locale]/opengraph-image.tsx         → 该段分享图：一个 ImageResponse 组件！
app/api/og/route.tsx →  或传统动态图端点（?slug= 拼参数）
```

**OG 图即组件**：`opengraph-image.tsx` 默认导出返回 `ImageResponse`（Satori 把 JSX 编译成 PNG/OG，构建/请求时执行），意味着"每张商品卡片的分享图"是**一段 React 代码+数据**而非 Photoshop 模板——小程序分享卡在 Web 侧的同构物（呼应 mp-openapi 的 onShareAppMessage 逐页定制）。

---

## 三、SEO 的机理层：爬虫看到什么、你控制什么

- 内容：SSR/SSG/流式都让爬虫拿到真 HTML（L1 的立身之本，流式对主流爬虫等流完成即可见——next-context-streaming 面试 10 已展开）；
- 三件套：**canonical**（治重复内容）、**robots 分级**（全站允许+私有段 `noindex` 走 generateMetadata 返回 `robots:{index:false}`——cookie 页/搜索结果页都要）、**结构化数据**（JSON-LD `<script type="application/ld+json">` 服务端组件渲染，商品/文章富摘要）；
- 抓取预算与发现：sitemap 随数据自动更新 + 内链真实 `<a href>`（Link 的渐进增强红利，呼应 next-link-router）；
- 国际化站：`hreflang`（alternates.languages）+ 语言段路由（L2 面试 10 的 i18n 方案）。

一句话心法：**Metadata API 管"说什么"，渲染模式管"说不说得出"，两者都对了才算 SEO 做完**。

---

## 四、调试工具箱（背操作步骤）

```bash
curl -s https://site.com/blog/hello | grep -o '<title>[^<]*'     # 服务器口径的 title
```
- 分享实测：微信/飞书/推特各自的调试器（卡片缓存是"改了没生效"的元凶——平台侧缓存与 revalidate 无关，要改 URL 查询参强制刷新）；
- DevTools：Elements 看 head（水合后被改的注意与 curl 结果对照，差异=客户端又动了）；
- 收录诊断流水线：robots.txt → 索引覆盖率报表 → sitemap 提交 → 页面级 canonical/noindex 抽查（顺序即排障顺序，呼应 mp-publish 的审核自救思路）。

---

## 五、自检清单

- [ ] title.template 解决什么问题？metadataBase 不写会怎样？
- [ ] generateMetadata 与服务端渲染/预生成的时机关系？
- [ ] 客户端组件为什么不能 export metadata？
- [ ] 私有页防收录的正确写法？
- [ ] "分享卡片图改了没生效"排查的前两步？

---

## 🚀 部署预告

- L6 收官 **next-fonts-images**：性能三兄弟里的字体与图片——next/font 的零 CLS 策略与 next/image 的服务端优化管线，和本课的 OG 图一样都是"把基础设施写成组件"的哲学；
- 本课的 sitemap/robots 动态化在 L8 全栈实战中接到真数据源。
