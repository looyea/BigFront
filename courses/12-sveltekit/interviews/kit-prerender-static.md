# kit-prerender-static 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 给出"一个页面能否被预渲染"的官方判据，并解释其底层原因。
**来源**：预渲染基本规则必考题的转述。

判据：**任意两个用户直接访问它，从服务器拿到的内容必须相同**。因为预渲染产物是构建期定死、**全体用户共享一份**的文件——因人而异（登录态、实时数据）的内容一旦烧进去就对所有人生效，要么泄漏要么过期。

### 2. (A) prerender 页面选项如何继承与覆写？举"全站默认开、个别关"的写法。
**来源**：选项继承模型题的转述。

子 layout/page 覆盖父层同名值。根 `+layout.js` 设 `export const prerender = true` 全站默认预渲染，需要动态的页在其 `+page.js`/`+page.server.js` 设 `prerender = false` 关掉。三态 `true / false / 'auto'` 可按路由自由混合。

### 3. (A) 预渲染器怎么"找到"要渲染的页？entries 与 crawl 各管什么？
**来源**：爬虫发现机制题的转述。

默认 `crawl=true`：从 `entries`（默认 `['*']`，即所有不含必填 `[param]` 的路由）出发，扫页面里的 `<a>` 链接逐层发现新页并渲染。`crawl=false` 时只处理 entries 显式列出的。指向站外/跨 origin 的链接不作为待渲染目标。

### 4. (B) 构建报"marked as prerenderable, but were not prerendered"，逐条给修法与原理。
**来源**：预渲染漏烧高频报错排坑题的转述。

页标了 true 却没被爬到，且 true 已把它移出动态 manifest 故无法 SSR 兜底。修法：①把路由补进 `kit.prerender.entries` 或确保有"已预渲染且开 SSR"的页 `<a>` 链到它；②对带必填参数的动态页用 entry generator 产出清单；③把 `true` 改 `'auto'` 让它可动态回退。

### 5. (B) 为什么"标 prerender=false 的页，它链接到的可预渲染子页会漏烧"？
**来源**：爬虫跟链条件排坑题的转述。

预渲染器**只从"会被渲染"的页爬链接**——非预渲染（prerender=false）的页不产出文件、其出链不被跟进。于是若唯一链向 `/pricing` 的是某个动态页，`/pricing` 就发现不了。解法：从不关掉预渲染的页（如首页/导航 layout）也放一条到 `/pricing` 的链接，或显式列入 entries。

### 6. (A) entry generator 解决什么？给出动态博客全静态化的形状。
**来源**：动态段参数枚举题的转述。

爬虫不知 `[slug]` 该取哪些值。`+page.server.js` 导出 `entries`（`EntryGenerator`）返回 params 对象数组（可 async 从 CMS/DB 拉），预渲染器据此把每个实例烧成文件：`export const entries = async () => posts.map(p => ({ slug: p })); export const prerender = true;`。对应 Next 的 `generateStaticParams`。

### 7. (B) 预渲染页里读 url.searchParams 会怎样？为什么？正确姿势？
**来源**：静态页禁 API 排坑题的转述。

预渲染期访问 `url.searchParams` **被禁止**——静态文件没有"当前查询串"概念，构建期也无从确定。正确姿势：把读查询串的逻辑放浏览器端（如 `onMount` 里读 `$page.url.searchParams`），或让依赖查询串的页不预渲染（prerender=false）。

### 8. (C) prerender 与 SSR、与 CSR 三者能任意混搭吗？给出各自典型组合。
**来源**：三开关组合矩阵题的转述。

可混但有约束。SSG：`prerender=true` + ssr 默认 true。纯 SPA：`prerender=false`（或 fallback）+ `ssr=false`（只出空壳由 JS 接管）。SSR：`prerender=false` + ssr true。`csr=false`：只给无需交互的页（文章/about），不发 JS，但 `<form>` 不能渐进增强、HMR 失效。注意 `ssr=false` 与 `prerender=true` 冲突（会存空壳），`csr=false`+`ssr=false` 同时则啥都不渲染。

### 9. (C) Kit 的预渲染与 Next 的 SSG/ISR、Nuxt 的 nitro prerender 心智差异？
**来源**：跨框架静态化横向题的转述。

Next：`generateStaticParams`+`export`/`revalidate`（ISR 有后台再验证的半动态）。Nuxt：nitro `prerender` 配置 + route rules。Kit：以**页面选项 prerender 三态**声明式控制、靠 **link 爬虫 + entry generator**发现路由，没有内置 ISR 式"到期后台重生成"——要类似能力得靠 `prerender='auto'` 的长尾 SSR 或托管层缓存凑。Kit 独特在"爬虫为主、显式 entries 为辅"。

### 10. (C) 预渲染页的资源与非预渲染页的 manifest 关系？为什么说 prerender 能"缩小 server"？
**来源**：产物构成题的转述。

`prerender=true` 的路由被**从动态 SSR manifest 排除**——不进 server/serverless/edge 函数的路由表，产物里 server 部分更小、冷启动与内存更省。真正需要运行时的页才留 manifest。这也是为什么误标 true 又漏烧会 404：它已从"能动态渲染的清单"里被拿掉了。

### 11. (D) 大站预渲染慢（拉远程 CMS），给三条提速手段并说明原理。
**来源**：构建性能优化情景题的转述。

①`kit.prerender.concurrency` 调高——网络瓶颈型渲染下并行处理多页、边等 CMS 边渲别的；②能静态确定的内容全 prerender=true，避免 fallback SPA 与重复 SSR；③用 entry generator 精确产出要烧的 slug 清单 + 必要时 `crawl` 范围收紧，别爬全站。JS 单线程，纯 CPU 计算调 concurrency 无益，网络等待才有效。

### 12. (D) 一个"营销页要秒开+SEO、仪表盘要实时+登录"的产品，如何切 prerender 边界？
**来源**：混合渲染边界设计题的转述。

用 adapter-node 或平台适配器（因为有动态仪表盘）。`(marketing)` 组 layout `prerender=true` 全静态化吃 CDN 长缓存；`(app)/dashboard` 组 `prerender=false` 走 SSR + 鉴权（L5），实时数据放 server load 或客户端。个性化块即使在被预渲染的营销页里，也用 `onMount` 客户端 fetch 兜（接受轻微空窗）。换 adapter 不动业务码，是 Kit 混合渲染的核心红利。

🚀 **下一组**：L6 课后作业——预渲染粒度与爬虫机制的综合复盘。
