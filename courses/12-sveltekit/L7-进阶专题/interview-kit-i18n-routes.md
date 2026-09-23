# kit-i18n-routes 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) [lang] 与 [[lang]] 在路由匹配上的本质区别？
**来源**：i18n 路由基础题的转述。

[lang] 是必填动态段，`/en/about` 匹配、`/about` 匹配不到；[[lang]] 是可选段，lang 可有可无，`/about`（lang=undefined）与 `/en/about` 命中同一页面组件。要做"默认语言不带前缀"就得用可选段。

### 2. (A) 可选参数为什么不能跟在 rest 参数后面？
**来源**：advanced-routing 细节题的转述。

参数按"贪婪"匹配，`[...rest]/[[optional]]` 里 rest 会把能吃的全吃掉，尾部可选段永远取不到值，因此官方规定非法。同理排序时 [[optional]] 与 [...rest] 除非位于最后一段，否则被忽略。

### 3. (A) 写出一个把语言码限制成 en/zh/fr 的 param matcher，并说明引用方式。
**来源**：matcher 手写题的转述。

```js
// src/params/lang.js
const valid = new Set(['en','zh','fr']);
/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param){ return valid.has(param); }
```
路由里写 `[[lang=lang]]`（[名=matcher名]）。src/params 下每个模块即一个 matcher，*.test.js/*.spec.js 除外用于单测。

### 4. (A) matcher 只在服务端跑吗？带 matcher 的段优先级如何？
**来源**：matcher 运行时机题的转述。

matcher 在服务端和浏览器都会跑，客户端导航的非法前缀同样被拒。带 matcher 的段（[name=type]）优先级高于不带 matcher 的 [name]；不匹配时 Kit 会按排序去试其它路由，最终都不中才 404。

### 5. (C) reroute 静默重写和 handle+redirect 规范化，各自优缺点？
**来源**：两条协商路线对比题的转述。

reroute 在 URL 与路由匹配前运行、返回新路径即可换语言而地址栏不变，省跳转但同内容多 URL、需靠 canonical 收敛重复。handle+redirect 显式 307 跳到带前缀 URL，地址栏唯一利于 SEO，代价是一次重定向往返。实务常混用，且要小心别和 trailingSlash/前缀规则打架造成重定向环。

### 6. (B) 用 reroute 把无前缀路径补成 /zh/... 后，页面里生成的链接却仍无前缀，为什么？
**来源**：reroute 与 URL 生成不一致排坑题的转述。

reroute 只改"匹配用"的路径、不改地址栏，page.url 仍是原始无前缀 URL，据此生成的链接自然不带前缀。要链接规范化得用 routeId/params 自己拼，或改用 handle+redirect 让 URL 真的带上前缀。这也是"静默重写有 SEO 重复内容风险"的根源。

### 7. (D) 画出 params.lang → 组件里 $t('nav.home') 的完整注入链。
**来源**：i18n 数据流全链题的转述。

[[lang=lang]]/+layout.server.js 的 load 从 params 判定语言并 return { lang }；/+layout.svelte 读 data.lang、取对应 messages、用 setContext('i18n', { lang, t }) 把翻译函数往下发；子组件 getContext('i18n') 拿 t 使用。切换语言即导航到新前缀 URL 让 load 重跑换 lang。setContext 传函数/对象以保持跨边界响应式。

### 8. (B) 为什么不能在 $lib/i18n.js 顶层写 let currentLang 供各页共享？
**来源**：状态纪律结合考法的转述。

服务端模块是跨请求共享的单实例，顶层可变状态会把 A 用户的语言带到 B 用户、且服务器重启即丢——违反"服务端无共享状态"纪律。语言应随请求走 load→context（context 每请求/每组件树独立），或纯客户端场景才谈得上共享模块。

### 9. (A) hreflang / canonical / x-default 分别解决什么问题？
**来源**：多语言 SEO 题的转述。

hreflang：告诉搜索引擎同一内容有哪些语言版本、该把哪个展示给哪个语言用户，值须与实际可达 URL 一一对应。canonical：把"带不带前缀都能开"的潜在重复内容收敛到唯一规范 URL。x-default：约定指向语言选择页或默认语言，覆盖未匹配任何 hreflang 的情况。三者写在 <svelte:head>，sitemap 每个语言各列一条。

### 10. (C) 语言协商的优先级一般怎么排（cookie / URL 前缀 / Accept-Language / 默认）？
**来源**：协商策略题的转述。

常见优先级：URL 前缀（显式、可分享、SEO 友好）> 用户显式选择的 cookie > Accept-Language 头（浏览器偏好）> 站点 defaultLocale 兜底。URL 一旦带合法前缀就以其为准，协商只用于"无前缀进来"时决定重定向/重写到哪。

### 11. (D) 设计一个 en/zh 双语、默认英文不带前缀、可切语言并利于 SEO 的路由方案。
**来源**：i18n 架构设计题的转述。

routes/[[lang=lang]]/...，src/params/lang.js 限定 en/zh。默认英文无前缀：reroute 对无/非法前缀按 cookie 协商、英文时保持原样、中文时重写或 redirect 到 /zh/...。语言切换器 goto 到目标前缀 URL 并写 cookie 记住选择。根 layout setContext 分发 messages。SEO：每页 <svelte:head> 出 hreflang(en/zh)+x-default(英文)+canonical，sitemap 端点列全两种语言 URL。

### 12. (B) 加了 (marketing) 布局组后，语言前缀路由突然错乱，可能哪里出问题？
**来源**：布局组与动态段交互排坑题的转述。

(group) 不影响 URL，但把 [[lang=lang]] 放错层级会改变匹配：如 [[lang]] 只包了 (site) 而 (marketing) 在其外，营销页就没语言段、语言切换/链接生成对不齐。或可选段没放最前、与别的动态段抢匹配。排查看最终路由树里 [[lang=lang]] 是否是目标页的真实祖先段、matcher 是否命中。

🚀 **下一组**：kit-navigation-state 面试题——两代状态 API 迁移、订阅纪律、导航竞态与滚动恢复的高频考法。

---

## 补充（新专题 13-15）

### 13.  hreflang/canonical/x-default 在 Kit 里怎么自动生成才不漏页？ 

 在根 layout 由 params.lang + 路由 path 反推全语言对等 URL 集，输出 link 标签且双向自指（含本页 canonical）；预渲染期一次性生成，动态页在 server load 拼，配 e2e 抽查互指闭环。 

**来源**： https://developers.google.com/search/docs/specialty/international/localized-versions ； https://svelte.dev/docs/kit/seo 

### 14.  reroute 补语言前缀与 handle+redirect 显式跳转，两种实现各自的长期代价？ 

 reroute 静默改写 URL 不变：同一内容双 URL 造成重复内容与 hreflang 混乱；redirect 产生 3xx 开销但 URL 唯一、可缓存、语义干净。国际站主流选 redirect+规范前缀，reroute 仅用于历史别名。 

**来源**： https://svelte.dev/docs/kit/hooks#Server-hooks-handle 

### 15.  多语言站的 RTL（如阿拉伯语）支持在 Kit 里怎么系统性落地？ 

 根 layout 按 lang 设 <html dir/lang>，CSS 用逻辑属性（margin-inline 等）替代物理方向，图片/图标按需镜像；预渲染期把 dir 写进 HTML 防首屏闪烁，设计系统组件要过 RTL 用例。 

**来源**： https://developer.mozilla.org/docs/Learn/Applying_bidi ； https://svelte.dev/docs/kit 
