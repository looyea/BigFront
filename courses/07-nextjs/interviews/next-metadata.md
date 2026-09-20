# next-metadata 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 Next SEO 与 Metadata 高频面经，中文重述。

---

## A. API 机制

**1. metadata 导出、generateMetadata、客户端渲染 <title> 三种改 head 的方式，优先级与适用场景？**
**来源**：CSDN《Next head 管理三条路》；知乎（metadata 合并规则讨论）
前两者服务端产出（后者水合后修改），同字段就近合并、请求期以最终 DOM 为准——但爬虫只看服务端产物，所以**SEO 必需项一律走 metadata/generateMetadata**；客户端改标签仅限工具类页面（如动态文档标题）。多套并存时以"服务端定稿、客户端少动"为纪律（呼应 next-metadata 第一节）。

**2. generateMetadata 里怎么避免和页面重复取数？**
**来源**：掘金《一次渲染内的数据复用》
同请求内 fetch memoization（URL+选项相同只发一次，L4 老朋友）；更稳的是数据进 params 衍生 + 共享 lib 函数 + unstable_cache 包一层；SSG 页两者分属构建期两次执行，缓存命中同样成立。展示"L4 缓存思维用在元数据层"是这题的满分线（呼应 next-fetch-cache）。

**3. sitemap.ts/robots.ts 返回的'对象'最后被谁、在哪变成了 XML？**
**来源**：SegmentFault《元数据文件约定的实现原理》
Next 内置了这些特殊路由的生成器：它们本质是框架预置的 Route Handler（构建/请求时执行你的函数，序列化为对应 XML/文本格式）。理解这层，你就知道 ① 动态查询要控耗时（它也是端点）；② 自定义格式需求可以退回手写 route.ts（呼应 next-route-handlers、next-groups-matchers 第三节）。

---

## B. SEO 工程

**4. 你的 SSR 站点收录仍慢/不全，按什么顺序排查？**
**来源**：知乎《收录漏斗排障清单》；InfoQ《SPA 转 SSR 后的遗留问题》
① 服务器口径内容完整性（curl 关键模板页，警惕流式/动态 hole 里才是正文）；② robots/noindex 误伤（私有段标记外溢？测试环境忘了 noindex 整站）；③ sitemap 新鲜度与提交；④ canonical 自洽（www/裸域/尾斜杠归一，L2 第四节）；⑤ 内链可达性与渲染 JS 依赖。框架只保证"说得出"，这单子是"说得全说得对"（呼应 next-render-modes 面试 12）。

**5. 结构化数据（JSON-LD）放服务端组件还是客户端？Google 富摘要没生效先查什么？**
**来源**：CSDN《JSON-LD 与 Next 渲染管线》
服务端组件渲染（爬虫口径可见）；富摘要排查顺序：脚本是否在 HTML 内→字段必填项与类型（价格要带币种）→URL 级测试工具→内容质量门槛。加分点：结构化数据是"另一种 metadata"，与 canonical/robots 同属机器可读层（呼应 next-metadata 第三节）。

---

## C. 分享与生态

**6. ImageResponse 动态 OG 图的生产注意事项（至少三条）？**
**来源**：掘金（edge 图片生成实践案例）；SegmentFault（字体与性能讨论）
① 字体需 fetch 注入（默认环境无中文字体，乱码是高频事故）；② 计算/内存在边缘受限，大图降级策略；③ 加 CDN/数据缓存（每张图一次渲染）与失败回退静态图；④ 平台缓存差异的测试成本（各调试器）（呼应 next-metadata 第二、四节）。

**7. 微信生态的分享卡片和标准 OG 有什么本土差异？工程上怎么兼容？**
**来源**：知乎《国内 IM 的分享卡不读 OG 怎么办》；CSDN（JS-SDK 签名实践）
多数国内 App 不读 OG 标签：微信走 JS-SDK 签名+后端提供配置接口（域名备案/公众号设置前置），飞书/钉钉各有 SDK。兼容姿势：页面仍出标准 OG（海外与通用爬虫面），另挂 SDK 初始化（服务端把签名 config 注入）——双轨但数据同源（呼应 mp-openapi 分享一节、next-route-handlers BFF 用途）。

---

## D. 综合架构

**8. 多语言站（/zh /en）的 metadata 完整方案？**
**来源**：InfoQ《i18n SEO 全景》
[locale] 段 + generateMetadata 按语言查库出 title/description；alternates.languages 输出 hreflang 组；语言内 canonical 自指；hreflang 双向成对（漏一个 Google 丢整组）；OG 按语言版本；sitemap 分语言索引。middleware 协商与页面定稿两阶段分工（呼应 next-dynamic 面试 10、middleware-auth 面试 8）。

**9. 老站 URL 全变了，SEO 权重怎么救？**
**来源**：CSDN《改版迁移的权重保全》；知乎（重定向矩阵案例）
映射表驱动：301 逐条（next.config redirects 可静态表、量大走 middleware 查映射）、暂保留旧 URL 响应（410 慎用）、sitemap 新旧两版分阶段、Search Console 改址+抓取监控、canonical 链清晰。加分：灰度期双 sitemap 与回滚预案（呼应 node-deploy-perf 的回退观、mp-publish）。

**10. 平台要求'每页独立描述'但运营不填，工程怎么兜底？**
**来源**：掘金《自动摘要的取舍》
generateMetadata 里 fallback 链：运营字段 → 正文首段截断（去 markdown/HTML 后 80-120 字）→ 模板句（含分类词）；同时给 CMS 后台标"自动生成"提示运营覆写。这题本质是"数据缺口的工程韧性"，与骨架屏兜底同思想（呼应 mp-storage 的降级链）。

**11. 内部系统要不要 SEO 栈？noindex 之外的合规清单？**
**来源**：SegmentFault《内网应用的爬虫与扫描治理》
要反向清单：全站 robots meta noindex,nofollow + 网关 Basic/OIDC（middleware+Auth）+ sitemap 禁暴露 + 防扫描（公网误暴露的内网系统案例频发）+ 测试环境 HTTP-Basic 双保险——"不被搜到"本身就是 SEO 工程（呼应 next-middleware-auth 纵深、exp-security）。

**12. 你负责审计一个 Next 大站的 SEO 健康度，设计可自动化的检查项与阈值。**
**来源**：知乎《大站 SEO 巡检系统设计》
参考矩阵：title 重复率/缺失率（build 期抽 manifest 全量）、description 长度分布、canonical 自指率、hreflang 成对率、sitemap-索引差集、404 率曲线、OG 图可访问性与尺寸、渲染口径内容完整性（无 JS 抓取比对）。全部可脚本化挂 CI/定时——把"SEO 做没做好"变成指标而非玄学（呼应 next-perf 度量工作流、react-performance 的指标观）。
