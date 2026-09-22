# prerender：静态化的粒度与爬虫

> 目标：把"哪些页被烧成文件、怎么被找到、动态内容怎么办"三件事讲透——prerender 开关的继承与逐路由覆写、链接爬虫的发现机制与 entries/origins/crawl 三个旋钮、entry generator 处理动态段、混合渲染（预渲染壳 + 客户端取数）与静态资源缓存头账本（呼应 nuxt-hybrid-rendering、next-deploy 的 ISR/SSG 分层）

## 一、开关的继承模型：根 layout 铺开、子路由收放

prerender 是**页面选项**，遵循 SvelteKit 页面选项的通用继承律：**子 layout/page 覆盖父层同名值**。所以标准打法是：
- 根 `+layout.js`/`+layout.server.js` 里 `export const prerender = true` → **全站默认预渲染**；
- 需要动态 SSR 的个别页 `export const prerender = false` 关掉；
- 想"预渲染热门 + 长尾仍动态"（如 `/blog/[slug]` 只烧最近的几篇）→ 第三态 `prerender = 'auto'`：**既产出静态文件，又保留在动态 SSR manifest 里**，文件命中就发文件、没预渲染到的 slug 落到服务器现渲。

⚠️ 一个反直觉点：`prerender=true` 的路由会被**从动态 SSR manifest 排除**——意味着它只能以文件形态存在，**不能被运行时按需动态渲染**。若它因故没被爬虫访问到（见下），就会 404/报错而非回退 SSR。这正是 `'auto'` 存在的理由。

## 二、爬虫怎么找到页：link crawling 与它的盲区

预渲染器**从入口出发、扫页面里的 `<a>` 元素**发现新页，逐个渲染成文件。多数时候你"不用告诉它有哪些页"，它顺链接爬。但有明确盲区：
- **只从 `prerender` 生效、且 SSR 开启的页爬链接**——被标 `prerender=false` 的页**其指向别处的链接不被跟进**（即使目标是可预渲染的）。
- **动态段 `[param]` 页面爬虫无从得知参数取值**——`/blog/[slug]` 不会因为某页有个 `<a href="/blog/hello">` 以外的方式被发现，若那个链接不存在于任何已渲染页，slug 页就漏烧。
- 于是经典报错：**"The following routes were marked as prerenderable, but were not prerendered"**——页标了 true 却没被爬到。三种官方修法：①补进 `prerender.entries`；②确保有已预渲染页链接到它；③把 `true` 改 `'auto'` 让它可动态兜底。

## 三、三个全局旋钮：entries / crawl / origins

在 `svelte.config.js` 的 `kit.prerender`：
- **`entries`**（默认 `['*']`）：预渲染的**起点**。`'*'` 代表"所有不含必填 `[param]` 的路由"（可选参数按空处理）。把爬虫爬不到的动态页显式列进来。
- **`crawl`**（默认 `true`）：是否顺 `<a>` 链接爬。关掉就**只处理 entries 里显式列的**，用于站很大、你精确知道要烧哪些的场合。
- **`concurrency`**（默认 `1`）：并行预渲染页数。JS 单线程，但**网络瓶颈型**（拉远程 CMS）时调高能显著提速（边等网络边渲别的）。
- 关于 **origins**：爬虫默认只跟"同 origin"的链接——指向站外或跨源的 `<a>` 不被当作待渲染目标；这保证不会爬出站去。

## 四、entry generator：给动态段喂参数清单

处理"参数取值靠数据决定"的动态路由的正解——在 `+page.js`/`+page.server.js`/`+server.js` 导出 `entries`：

```ts
// src/routes/blog/[slug]/+page.server.js
/** @type {import('./$types').EntryGenerator} */
export const entries = async () => {
  const posts = await db.listSlugs();          // 可 async：从 CMS/DB 拉清单
  return posts.map(p => ({ slug: p }));         // 每项是 params 对象
};
export const prerender = true;
```

`entries` 返回**每个实例的 params 形状数组**，预渲染器据此把 `/blog/hello-world` 等全部烧出来。`'*'` 兜不住必填参数路由，entry generator 才兜得住——这是"动态路由也能全静态化"的关键机制，对应 Next 的 `generateStaticParams`。

## 五、什么不能预渲染 & 混合渲染的折中

**硬禁区**：
- **带 action 的页**——服务器必须能处理 POST，绝不能是死文件；
- **预渲染期访问 `url.searchParams`**——被禁（静态文件没有"当前查询串"），要读查询串放浏览器（onMount）。
- **每个用户看到的内容不同**——预渲染产物**全体用户共享一份**，个性化内容不能进静态 HTML。

**判据一句话**（文档原文）：能预渲染 ⟺ "**任意两个用户直接访问它，从服务器拿到的内容必须相同**"。

**混合渲染**（prerender 壳 + 客户端取数）：页可预渲染成静态壳，但把**个性化/实时数据放 `onMount` 里客户端 fetch**。代价是首屏空白/加载指示器，体验打折——所以"能服务端确定的一律烧进去，只把真正 per-user 的留客户端"。这正是 adapter-static SPA（fallback）之外更优的"静态为主、动态点缀"路线。

## 六、缓存头账本：静态化 ≠ 自动配缓存

预渲染吐出 `foo.html`/`foo/index.html` 及带 hash 的资源，但**浏览器/CDN 缓存策略不是 Kit 给的**——是**托管层**（Nginx/CDN/Pages）配的响应头。记账规则：
- **内容哈希资源**（`_app/immutable/**` 里带 hash 的 JS/CSS）：可 `immutable, max-age=31536000`——文件名变了才失效，永不过期是正解；
- **HTML 入口页**：要 `no-cache`/短 max-age + 校验，否则改版后用户拿旧壳、去要已被清掉的 chunk 就 404；
- `trailingSlash` 决定产出 `about.html` 还是 `about/index.html`——**托管的重写规则要匹配**它，否则 `/about` 命中不到文件。
一句话：Kit 负责"生成文件"，"怎么被缓存"是你和宿主之间要显式谈拢的账。

## N、自检清单

1. prerender 的继承模型？`true` / `false` / `'auto'` 三态各自对 manifest 的影响，为什么说 `true` 反而可能 404？
2. 爬虫靠什么发现页面？为什么"标 prerender=false 的页其出链不被跟进"会导致目标页漏烧？
3. entries 默认值 `['*']` 覆盖什么、漏掉什么？entry generator 补的是哪一类路由？
4. 背出"能不能预渲染"的一句话判据，并列出三条硬禁区。
5. 预渲染产物的缓存头谁来配？哈希资源与 HTML 入口的策略分别是什么、为什么相反？

🚀 下一关：kit-deploy-node——生产拓扑：standalone Node 的启动与静态托管分工、ORIGIN/代理头环境变量纪律、Docker 要点、优雅停机与健康检查、Vercel/Netlify/自托管三条路对照。
