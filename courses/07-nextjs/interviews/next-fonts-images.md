# next-fonts-images 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点图片/字体优化高频面经，中文重述。

---

## A. 原理机制

**1. next/image 的运行时优化端点 /_next/image 是干什么的？会带来什么新依赖？**
**来源**：CSDN《Next Image Loader 架构解析》；掘金（serverless 图片超时案例）
它是个受限的图片处理函数：校验签名 URL+白名单，实时缩放/转码（sharp 管线）。新依赖：冷启动与超时（大请求体）、serverless 内存限制、自托管要确保 Node 环境带原生依赖——图多建议云 loader（呼应 next-fonts-images 第三节、next-deploy）。

**2. next/font 的"零布局偏移"具体怎么做到的？size-adjust 从何而来？**
**来源**：知乎《字体度量与 FOUT/FOFT》
Next 读字体文件的度量表（ascender/descender/x-height 等），为 fallback 字体生成调整后的 @font-face（size-adjust/stretch），使两种字体的行框/字宽对齐——swap 期内即回退字也不跳；CJK 无自动度量需手工补（呼应 next-fonts-images 第一节）。

**3. 为什么 sizes 属性常常比 srcset 手写更能决定真实流量？**
**来源**：SegmentFault《响应式图片的断点谎言》
srcset 给候选、**sizes 告诉浏览器布局占宽**，浏览器据此选档——sizes 写错（如全屏 hero 标了 50vw）会选小糊图或选大费流量。这是"声明布局意图"而非"贴属性"的思维（呼应 react-performance、mp-performance）。

---

## B. 工程决策

**4. CMS 存量的老图（绝对 URL、尺寸未知）迁到 Next，工程策略？**
**来源**：CSDN《老站迁移的图片层方案》
① remotePatterns 收域名白名单；② 尺寸：DB 补 width/height 字段（上传时抽取）或统一占位比例+fill；③ 批量优化走 CDN 处理参数（q/resize 参数直出），必要时 loader 指 CDN 而非自建端点（呼应 next-fonts-images 第三节）。

**5. 背景图（CSS background-image）吃不到 next/image 红利，怎么办？权衡？**
**来源**：掘金《背景图的三条出路》
① 改绝对定位 `<Image>` 铺底（全吃到，语义略歪，pointer-events 注意）；② 保持 CSS 但手工预加载+尺寸容器；③ 首屏背景转小尺寸内联/云参数裁切。推荐 ① 用于 hero、②③ 用于装饰层（呼应 next-fonts-images 第四节药3）。

**6. 图片懒加载和 LCP 是矛盾的吗？给出边界规则。**
**来源**：知乎《loading=lazy 与 LCP 互斥的实测》
视口内首屏大图懒加载=主动恶化 LCP；规则：LCP 候选（hero/首屏主图）priority/显式 eager+fetchpriority=high，其余 lazy；折叠线附近用 sizes+预取平衡。加分：用 RUM 的 LCP 元素分布定"谁是候选"（呼应 next-context-streaming 面试 10 的度量法）。

---

## C. 陷阱与安全

**7. dangerouslyAllowSVG 打开了什么风险？配套防御？**
**来源**：CSDN《SVG 的脚本与外部引用攻击面》
SVG 可内嵌脚本/外链——同源伺服即 XSS 面。配套：contentDispositionType=attachment（强制下载）、 CSP、上传侧净化（strip script/foreignObject）或转位图（呼应 next-fonts-images 第三节、exp-security 的上传课）。

**8. 图片端点被刷（恶意传大 URL）会造成什么？限流位置？**
**来源**：InfoQ《优化端点的成本攻击案例》
每张恶意 URL 触发一次下载+转码=计算账单攻击+对上游图床的 DDoS 代理。防线：白名单（已内置）、响应/超时、平台 WAF/edge 限流、监控 4xx/5xx 与该端点 QPS（呼应 next-route-handlers 面试 9）。

---

## D. 综合设计

**9. 给内容 App 设计"图片链路"全案：上传到展示。**
**来源**：掘金《从 presigned 直传到 CDN 出图》
上传：presigned 直传对象存储（原始文件不落应用服务器）→ 异步任务出多规格/缩略/模糊底元数据入库；存储：原图私有桶+处理桶；分发：CDN+长缓存（hash 名）；展示：loader 指 CDN 参数式处理、next/image 只管尺寸/sizes/priority/占位。这题在考"优化职责在应用/云/CDN 的切分"（呼应 next-fonts-images 第三节、mp-network 上传约束对照）。

**10. 字体子集化在中文站的完整做法与验证？**
**来源**：知乎《中文字体子集工程》
方案：unicode-range 分片（按频率）、按页动态子集（服务生成 woff2 切片）、极端时品牌字用图片/SVG 化；验证：Network 字体瀑布（分片命中）、CLS 位移、缺字兜底（豆腐块）自动化测试（抽查生僻字段落）（呼应 next-fonts-images 第一节 CJK）。

**11. 没有 next/image 的历史页面，LCP 很差。给一个'不动架构只动图片'的改造清单与预期收益评估法。**
**来源**：SegmentFault《图片快赢清单》
清单：补 width/height、原生 loading=lazy、首屏 hero 预加载+fetchpriority、图片格式批转 WebP（Content-Negotiation 或源站参数）、尺寸档位与 srcset 重写、CDN 开启压缩缓存。收益：改造前后用 RUM LCP p75 对比+分位差，逐页面归因（呼应 react-performance、node-deploy-perf 的 CDN 参数）。

**12. 图片与字体的优化项要不要进 CI 防回归？设计三个可机检的断言。**
**来源**：CSDN（性能预算实践合集）
例：① 首屏页 HTML 里无未声明尺寸的 `<img>`（AST/规则扫描）；② LCP 候选图必须带 priority/预加载标注（路由配置表比对）；③ 字体请求全部同源（产物 grep 外链域名）；可选：图片字节预算（构建产物报告阈值）。哲学同 L3 边界审计：**把性能从"人记得"变成"机器守着"**（呼应 next-perf、exp-testing）。
