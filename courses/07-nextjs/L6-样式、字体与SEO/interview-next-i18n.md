# next-i18n 面试题精选

> 共 15 题，覆盖 路线与选型 / 路由与协商 / RSC 翻译分层 / SEO 与工程 四类 + 跨框架对照。

---

## 一、路线与选型

### 1. Next.js 的 i18n 怎么做？先讲讲内置方案为什么不算答案了。

Pages Router 的 `next.config i18n`（domains/locales/defaultLocale）在 App Router 下不受支持，官方立场是"middleware 自建"。实践路线：**next-intl**（社区标准，RSC/Server Actions 全适配）或自制 `[locale]` 段 + React context。答"i18n 配置对象"属于过期知识，面试官会追一句"App Router 呢？"（呼应 next-i18n 第一节）。

**来源**：Next.js 官方 docs — "i18n warning in App Router"；next-intl 文档

### 2. 自建 i18n 和 next-intl 的取舍？

自建 = locale 段路由 + headers 读 locale + 自己写 t() 与复数：能懂全部原理，但复数/插值/日期格式化/类型推导/工具链全要重造。next-intl 提供 getRequestConfig 按需装载字典、CLDR 复数、严格类型检查（缺键编译期报）、getTranslations/useTranslations/getFormatter 全家桶。生产项目直接 next-intl，面试手写题则走自制路线（呼应 next-i18n 第一、三节）。

**来源**：next-intl — "Features / Typed messages"

---

## 二、路由与协商

### 3. locale 放 URL 前缀、query 还是 cookie？SEO 角度为什么前缀胜出？

cookie：URL 不变但爬虫只看到一种语言、分享链接语言不确定、CDN 缓存键含 Cookie 复杂度上升；query（`?lang=en`）：可缓存但信号弱、页面重复内容风险；**路径前缀 `/en/…`**：每种语言独立 URL，可分别预渲染、hreflang 可指、CDN 天然按 URL 分——Google 官方推荐姿势（呼应 next-i18n 第二、四节）。

**来源**：Google Search Central — "Managing multi-region/multi-language sites"

### 4. 用户第一次访问 /pricing，怎么决定给他 /zh/pricing 还是 /en/pricing？完整讲协商链。

优先级链：**显式前缀 > 用户手动选择记忆（cookie）> Accept-Language 协商 > defaultLocale**。执行点在 middleware：无 `[locale]` 段时用 negotiator 解析 `accept-language` 头匹配支持列表，302/307 重定向并写偏好 cookie；带前缀的直接放行。加分点：协商结果别缓存进 CDN 全局（Accept-Language 因人而异），重定向响应要 `Vary: Accept-Language`（呼应 next-i18n 第二节、next-middleware-auth）。

**来源**：next-intl — "Language negotiation in middleware"；HTTP Accept-Language 规范

### 5. [locale] 段会不会污染所有路由文件？有没有办法收敛？

会——app/ 下整棵树要搬进 `app/[locale]/`。收敛手段：①`pathnames` 把本地化 slug 映射（`/en/about` ↔ `/zh/guan-yu`，可选）；②默认 locale 前缀隐藏（`/about` = `/en/about`，next-intl 的 localePrefix: 'as-needed'）——但要权衡：URL 形态不统一会让 hreflang 与 canonical 复杂化，SEO 激进派保持全前缀。route handler（/api）放段外不受影响（呼应 next-i18n 第二节、next-route-handlers）。

**来源**：next-intl — "Routing / localePrefix 配置"

---

## 三、RSC 翻译分层

### 6. Server Component 和 Client Component 里翻译 API 有什么不同？字典怎么到客户端？

RSC：`await getTranslations('ns')`——服务端翻完输出 HTML，**字典根本不进浏览器**。Client：`useTranslations('ns')` 吃 `NextIntlClientProvider` 下发的 messages——在 root layout 一次性 `getMessages()` 传 Provider（也可按命名空间裁剪只下发用到的）。纪律：**能留在服务端翻的绝不下沉**，Provider 里塞全量字典是初级性能事故（呼应 next-i18n 第三节、next-server-client 的边界课）。

**来源**：next-intl — "Usage in Server & Client Components"

### 7. Server Action 里发校验错误信息，怎么保证是用户语言的文案？

Action 运行在服务端，拿不到组件的 hook 上下文——从输入里取 locale（action 参数/隐藏字段）或 `await getLocale()`（next-intl/server 基于 headers），再 `getTranslations` 翻译错误键。呼应两条老纪律：**错键不错文**（vue-use-i18n iv12 同题）与 RSC 分层——错误的"键"随 action state 回到客户端渲染层再 `t()` 最稳（呼应 next-i18n 第三节、next-server-actions、next-forms-mutations 的 zod）。

**来源**：next-intl — "Server Actions 错误翻译"；vue-use-i18n 同题跨框架

---

## 四、SEO 与工程

### 8. hreflang 没生效，常见原因列三个。

①**缺自引用**（页面 A 列了 B/C 却没列自己，Google 判定无效组）；②单向引用（en 页指 zh 页，zh 页没指回——必须互引闭环）；③与 canonical 冲突（hreflang 指向的 URL 自己的 canonical 又指到别处）。Next 里对应检查：每页 `alternates.languages` 是否全语言枚举、`canonical` 是否指向本页语言版（呼应 next-i18n 第四节、next-metadata）。

**来源**：Google Search Central — "hreflang 常见错误"

### 9. 新增一种语言，工程上要做完哪几件事？

清单制回答：字典文件 + `i18n/request.ts` 装载映射 + locales 常量 + generateStaticParams 自动覆盖 + middleware 协商表 + hreflang/sitemap 增列 + 字体子集（中文/阿语字重差异，next-fonts-images）+ **翻译完成度检查**（CI 对比键集合，缺键 fallback 或 fail，vue-use-i18n iv10 同题）。说出后三条（字体、RTL、CI 键对齐）是加分分水岭（呼应 next-i18n 全课）。

**来源**：i18n 工程通识；next-i18n docs

---

## 五、跨框架对照

### 10. Vue 和 Nuxt 的 i18n 你了解吗？和 Next 路线差在哪？

Vue SPA：vue-i18n 的 `useI18n` + locale messages，路由前缀自己接线（vue-use-i18n 讲过）。Nuxt：**@nuxtjs/i18n 是框架级模块**——strategy（prefix/prefix_except/no_prefix）、hreflang、路由本地化、SEO 全部内置，等于 Next 的 middleware+next-intl 手工组合被官方收编。一句话总结：**Next 把选择权留给生态，Nuxt 把默认答案写进框架**（呼应 08-nuxt 预告、vue-use-i18n）。

**来源**：@nuxtjs/i18n 文档；vue-i18n 文档

### 11. 日期、货币、复数这些"翻译之外"的本地化，Next 项目里用什么？

`Intl.DateTimeFormat/NumberFormat/PluralRules/Collator`（01-es 学过原语）——next-intl 的 `getFormatter` 就是对它们的服务端可等待封装（RSC 里首次用 Intl 需 await 装 ICU，`await getFormatter()` 帮你做了）。禁忌：自己 `toFixed(2)` 拼金额、`split('-')` 拆日期（呼应 next-i18n 第三节、01-es Intl）。

**来源**：next-intl — "Formatters & polyfill 说明"；MDN Intl

### 12. 让 URL 里的 slug 也本地化（/en/about vs /zh/guan-yu），值吗？

收益：目标语言的可读 URL 对 SEO 与分享确实更好；成本：路由映射表成为第三份要维护的"翻译"（页面、字典之外），新增语言/改页面名都动它，重定向图谱翻倍。判断：内容营销站可做且用 next-intl `pathnames` 统一管理；工具/后台类产品保持英文 slug，把复杂度花在刀刃上。**能把成本和收益一起摆出来，比答"能做"值钱**（呼应 next-i18n 第二节）。

**来源**：next-intl — "Localized pathnames"；SEO 实践通识

---

## 补充（新专题 13-15）

### 13.  Next 内置 i18n 路由（Pages 时代）与 App Router 自建 [locale] 段，能力上各丢了什么、多了什么？

内置方案给：框架级前缀路由与协商（Accept-Language/cookie 的 redirects 三模式）、next/link 自动带 locale、getStaticProps 下按 locale 预生成；丢：与 App Router 完全不兼容（官方明示 unsupported），且策略黑盒（跳转逻辑不可深改）。自建 [locale] 段给：一切都在作者手里——locale 解析进 layout、per-request NextIntlClientProvider、静态生成用 generateStaticParams 按 locale×slug 枚举、middleware 协商可定制（登录态/地区例外）、语言切换保留当前路径；代价要认清：hreflang 要自己声明（layout metadata 遍历全 locale）、无前缀路径的 308/rewrite 策略自管、默认 locale 是否折叠前缀要定规矩（canonical 跟着变）、每个动态路由都要记得 locale 维度枚举否则一半页丢预渲染。结论句：内置=省心的租约，自建=自己扛运营细节——从 Pages 迁 App 时 i18n 通常是重写量最大的一块，要有预期。

**来源**：Next.js 官方 i18n 限制说明；next-intl 文档《App Router 设计动机》

### 14.  翻译工作流（文案抽取、翻译记忆、回种）你会怎么搭？动态内容（CMS 文章）的翻译策略呢？

静态 UI 文案流水线：① 消息目录单一事实源（JSON/YAML 按命名空间分文件，key 语义化非文案哈希）；② 抽取与校验进 CI——扫描 t() 调用防漏翻、"key 存在但某 locale 缺失"直接 fail、插值参数一致性检查（{count} 写错就爆炸）；③ 翻译界面用带翻译记忆的 CAT 平台（Lokalise/Crowdin 类），Git 双向同步、审校后回种仓库；④ 上下文问题（一词多义）靠 key 命名带场景（nav.login vs form.login）而非注释。动态内容按量分级：编辑制 CMS 多语言字段（翻译状态机：草稿→待译→发布）适合核心页；机器翻译兜底长尾 + 人工修正队列回写；最忌"前端运行时调翻译 API"（延迟、费用、不可收录）。发布联动：新文章只发默认语言→后台翻译完→revalidateTag 目标语言列表，hreflang 按"已发布语言集合"动态出——未发布的别声明，等于给爬虫 404。

**来源**：InfoQ《前端 i18n 的工程流水线》；掘金《我们给 Next 站搭的翻译 CI》

### 15.  hreflang 集群、语言前缀、canonical 三者怎么互相咬合才不出"自我竞争/错误地区投喂"？常见破法列三个。

咬合规则：每个语言版页面都① 声明指向"本页各语言版（含自身）"的 hreflang 集群（x-default 给语言选择页/默认语言）；② canonical 指向自己所在语言版的规范 URL（含协议与尾斜杠统一）；③ sitemap 列全部语言 URL、且与集群集合一致——三者是同一份"语言版清单"的三种投影，必须同源生成。常见破法：① 集群互指缺角（A 指 B、B 不指 A）——Google 直接忽略，动态枚举漏了未发布语言就缺角；② canonical 与 hreflang 打架（canonical 都指默认语言）——非默认语言版全部失去收录资格；③ 自动跳转坑——按 IP/Accept-Language 302 到语言版，爬虫和分享链接被劫持进单一语言，正确是"URL 前缀为准 + 跳转只作建议（可关）"；④ 默认语言前缀折叠（/ 与 /en 同内容）双 URL 竞争——定死一种并全站统一。

**来源**：Google 官方 hreflang 指南；SegmentFault《多语言站收录异常排查记》
