# next-fonts-images 面试题（15 题）

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

---

## 补充（新专题 13-15）

**13.  用 next/font 治理 Webfont 性能：你会打出哪些组合拳？各治什么？**
**来源**：web.dev 字体优化清单；Next.js font 指南（调整与 fallback）
组合拳按瓶颈分层：① 传输——子集化（拉丁按 unicode-range 拆、中文手动裁剪/分片），字体从 MB 到几十 KB；格式 woff2 起步、可变字体一文件多字重（权衡：单文件大但请求少）；② 关键路径——self-host 同域 + next/font 自动 preload 字重字面（先拿正文要用的那个）；第三方 GTM 类字体一律本地化；③ 渲染策略——display 默认 swap（快显），对 CLS 敏感时配 adjustFontFallback 度量对齐的 fallback（size-adjust/ascent-override），浏览器模拟字体与真字体占位几乎同宽；④ 覆盖范围——font-display: optional 给非关键装饰字体（本次访问不闪、下次缓存生效）；⑤ 验证——Lighthouse 字体审计 + RUM 上 FOUT/CLS 事件采样。收口：字体优化=传输、关键路径、渲染三段各自的账，只说 swap 或只说子集都不算修完。

**14.  远程图（CMS/用户头像）在 next/image 下的优化链路怎么搭？白名单外来一手怎么办？**
**来源**：Next.js Images 远程域名配置；SegmentFault《图片优化代理被当 DDOS 工具的事故复盘》
标准链路：images.remotePatterns 按域名+协议声明白名单（新版本替代 domains），优化器拉取→变换（格式协商 AVIF/WebP）→ 浏览器缓存，可再配 loader 指向上游图片 CDN（自己不做二次优化只签名）。白名单外=请求 400——防"优化端点被滥用为任意 URL 代理/SSRF/DDOS 跳板"，这是必须讲的安全面。用户头像素解法：① 上传即转存自家对象存储 + loader 指向它（白名单稳定）；② 动态第三方域用自定义 loader 生成带签名参数的代理 URL（签名验域名+尺寸，防开放代理）；③ 实在不可控的第三方小图退化为原生 <img>（丢优化不丢正确）。加分点：优化器缓存目录在 serverless 下不持久（重复回源），量大走 CDN 层缓存或外部图片服务；AVIF 协商看 UA、别在 edge 层误剥 Accept 头。

**15.  LCP 元素是张 Hero 大图——围绕它把图片相关优化全做一遍，你的清单是？**
**来源**：web.dev LCP 图片优化；掘金《一张 Hero 图把 LCP 从 3.2s 做到 1.1s 的全过程》
清单：① 发现——priority（等价手动 preload）：LCP 图禁止 loading=lazy（懒加载让发现推迟到布局后，是最常见自伤）；② 尺寸——srcset/sizes 与设备像素匹配，移动端别下发桌面大尺寸；响应式断点配合布局稳定（width/height 或 aspectRatio 防 CLS）；③ 编码——格式（AVIF/WebP 协商）、质量-体积曲线（hero 可容忍 q 稍低）、动图改视频/静态首帧；④ 网络——CDN 边缘出图、HTTP/2 复用、优化后文件参与内容哈希长期缓存；⑤ 渲染——placeholder=blur 给即时视觉反馈（感知）、字体/主色不抢该图线程（LCP 计时到真正绘制）；⑥ 度量——RUM 上报 LCP 元素（onCLS 同类技巧）按模板/断点分布看，Lab 里 devtools 看"发现时间/请求时间/渲染时间"三段哪段长。能把 LCP 拆解成"发现→传输→渲染"三段并各给手段，这题就是满分结构。
