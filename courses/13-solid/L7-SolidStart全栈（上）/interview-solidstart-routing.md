# SolidStart 路由 · 面试题

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 写出这几条文件对应的 URL：routes/index.tsx、routes/blog/index.tsx、routes/blog/post.tsx、routes/about.tsx。

分别是 `/`、`/blog`、`/blog/post`、`/about`。规则：目录=路径段、文件名=末段、`index` 代表目录本身；`.mdx` 文件也按页面路由处理。
**来源**：v2 routing「Basic filename mapping」直接转述。

### 2. (A) [id]、[[id]]、[...slug] 三种方括号各生成什么路由？参数怎么读？

`[id]` → `/users/:id` 动态段；`[[id]]` → `/users/:id?` 可选段（`/users` 与 `/users/abc` 都匹配）；`[...slug]` → catch-all，匹配任意多段，参数是**最后有效段之后拼成的斜杠字符串**。统一用 `useParams()` 读。
**来源**：v2 动态段/官方 v1 可选与 catch-all 约定转述。

### 3. (A) 嵌套布局怎么靠文件命名实现？它和 blog/index.tsx 的区别？

在 routes 下放一个**与子目录同名的文件**（blog.tsx 配 blog/ 目录），它就是该子树的布局，用 props.children 落子内容；而 `blog/index.tsx` **只服务 /blog 索引路由**、不是布局——官方专门提醒这两者别混。
**来源**：v1 routing「Nested layouts」及其 Note 转述。

### 4. (B) 全局搜 "index.tsx" 搜出十几个，怎么让入口文件可辨识？

用官方 Rename Index 约定：把目录的 index 文件改名为**所在目录名加圆括号**——`routes/socials/(socials).tsx`，路由行为等同 index，文件名却可全局检索定位。
**来源**：v1 routing「Renaming Index」一节转述。

### 5. (B) 想要 URL 是 /users/1、但页面不要被 users 段的布局套住，怎么办？

转义嵌套：把"多出来的命名"包进括号目录——`routes/users(details)/[id].tsx`，路径仍是 `/users/:id`，但它是独立路由、不嵌套在 users 布局下；需要时还能配 `users(details).tsx` 自带布局。
**来源**：v1 routing「Escaping nested routes」示例转述。

### 6. (B) 团队想按业务域分文件夹（(static)、(app)），但 URL 不想多出这一层？

用 route groups：括号包裹的目录名只服务文件系统组织、**不进 URL**——`(static)/about-us/index.tsx` 仍映射 `/about-us`。
**来源**：v1 routing「Route groups」一节转述。

### 7. (A) route 文件除了 default export 组件还能导出什么？给一个 preload 的例子说明用途。

可导出 `route` 对象（`satisfies RouteDefinition`）挂路由级行为，如 `preload()`——在页面渲染前预热该路由需要的数据/资源。这让"取数策略"和"UI"住在同一个文件里。
**来源**：v2 routing「Route config exports」与 data-fetching 例子转述。

### 8. (C) 整站根布局和 blog 子树布局在 Start 里分别挂在哪？

根布局在 `app.tsx` 的 `<Router root={...}>`（root 组件负责 Suspense 包裹与全站壳子）；子树布局走文件约定（blog.tsx + props.children）。一个显式声明、一个由文件系统推导。
**来源**：v1 routing root 与 nested layouts 的对比转述。

### 9. (C) UI 路由和 API 路由同用一个 routes 目录，框架按什么区分？

按导出形态：default export 组件的是 UI 路由（进 `<FileRoutes />`）；**导出 HTTP 方法名（GET/POST…）的是 API 路由**（如 `routes/api/ping.ts` → `/api/ping`），不会出现在页面路由表里。
**来源**：v2 routing 两类 route 的判定规则转述。

### 10. (D) 做一个多级帮助文档站 /help/**，任意深度都要同一套页壳，文件怎么放？

`routes/help/[...slug].tsx` 一个 catch-all 文件吃下任意后缀，params.slug 拿到斜杠串再解析文档路径；若要 /help 本身有落地页，再加 `help/index.tsx`。内容页可配 `.mdx` 直接当路由文件。
**来源**：catch-all + mdx 页面约定的组合应用类面试题转述。

### 11. (D) 产品要求 /dashboard 下二十个页面共享侧栏，但其中 /dashboard/report 要全屏，目录怎么设计？

`dashboard.tsx` 做子树布局（侧栏）+ `dashboard/` 放其余页面；report 用转义目录 `dashboard(report)/` 挂 `report.tsx`（不套 dashboard 布局），需要时给它独立布局 `dashboard(report).tsx`。
**来源**：nested layouts 与 escaping 组合的实战场景转述。

### 12. (B) 新建 routes/foo.tsx 后访问 404，排查顺序是什么？

先确认文件**default export 了组件**（没有它就不是页面）；再看是否把 API 风格导出（GET/POST）误当页面；核对大小写与路径映射（index 语义）；最后确认没被误放进括号分组造成理解偏差。路由表由文件扫描生成，"文件在但导出不合约定"是最常见断点。
**来源**：v2「must default export a component」约定反推的排坑题转述。

---

## 补充（新专题 13-15）

### 13.  代码声明式路由树对大团队协作的实际利弊？ 

 利：路由即类型、集中可审计、重命名安全、测试可 mock 局部树；弊：根文件成合并热点、路由数膨胀后需要分文件拼接；缓解是按业务域拆树片段再组合，配 lint 防绕过声明直拼路径。 

**来源**： https://github.com/solidjs/solid-start ； https://tanstack.com/router 

### 14.  路由 loader 里取数失败，用户看到什么由哪些层决定？ 

 loader 抛错被路由级 ErrorBoundary 接住，未配则冒到根/全局错误页；要区分 404（渲染 NotFound 或 redirect）与 5xx（边界+上报）；loader 返回错误标记 vs 抛异常的取舍：状态码语义与局部兜底能力。 

**来源**： https://docs.solidjs.com/ 

### 15.  设计带语言前缀（/zh/、/en/）与可选静态段的路由结构，你会怎么搭？ 

 语言作为布局段包一棵子树（共享 layout+params 校验），或 reroute 层重写去前缀命中同一树；可选段用通配+兜底重定向避免路由歧义；hreflang/canonical 与 301 规范化是 SEO 侧配套。 

**来源**： https://github.com/solidjs/solid-start 
