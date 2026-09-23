# vue-router-nested-dynamic 面试题精选

> 共 15 题，覆盖 嵌套路由 / 动态参数 / props 解耦 / query-params / 视图与匹配 五类。

---

## 一、嵌套路由

### 1. Vue Router 的嵌套路由怎么实现？子路由 path 为什么不带 /？

父路由记录写 `children: [...]`，父组件里放一个 `<RouterView>` 作为子出口。子 `path` 是**相对父级**的，运行时拼接成完整路径；带前导 `/` 会被当作绝对路径、脱离父层级。`path:''` 表示命中父路径时渲染的**默认子路由**（呼应 vue-router-nested-dynamic 第一节）。

**来源**：Vue Router — "Nested Routes"

### 2. 一个页面里要并排渲染主体和侧栏两个路由组件，怎么做？

用**命名视图**：路由记录 `components: { default: Main, sidebar: Side }`，模板里两个出口 `<RouterView />` 和 `<RouterView name="sidebar" />`。可与 `children` 组合成多层命名出口（呼应 vue-router-nested-dynamic 第四节）。

**来源**：Vue Router — "Named Views / Multiple Components"

---

## 二、动态参数

### 3. `/user/:id` 里 params 从哪来、怎么读？和 query 有何不同？

`:id` 是动态段，命中的值进 `route.params.id`。params 参与**路径结构、需路由声明**；query（`?k=v`）承载**附加筛选态、无需声明**。URL `/u/42?tab=x` → `params.id='42'`、`query.tab='x'`（呼应 vue-router-nested-dynamic 第五节、router-basics interview 第 8 题）。

**来源**：Vue Router — "Dynamic Route Matching / params vs query"

### 4. 解释可选参数、可重复参数、catch-all 的写法与用途。

`:id?` 可选（`/users` 与 `/users/5` 都匹配）；`:name+` 至少一段、`:name*` 零或多段，值为数组；`/:pathMatch(.*)*` 匹配任意未命中路径，专用于 **404**。catch-all **必须放路由表最后**，否则吞掉其它路由（呼应 vue-router-nested-dynamic 第三节）。

**来源**：Vue Router — "Optional/Repetitable/Wildcard Params"

### 5. 路由匹配的优先级是怎样的？

大致：静态路径 > 带自定义正则的动态段 > 普通动态段 > 通配。所以 `/user/new` 会优先匹配静态 `/user/new` 而非 `/user/:id`。理解这点才能避免"静态被动态段抢先"（呼应 vue-router-nested-dynamic 第三节）。

**来源**：Vue Router — "Route Ranking / Matching"

---

## 三、props 解耦

### 6. 组件里直接读 `this.$route` 有什么不好？`props:true` 怎么改善？

直接依赖 `$route` 让组件**和路由强耦合**——离开路由上下文就无法复用/测试，且模板里散落 `$route.params`。`props:true`（或函数映射）把 params/query 变成**普通 props**，组件只认 props，符合单向数据流、便于单测（呼应 vue-router-nested-dynamic 第二节、vue-component-basics、vue-testing）。

**来源**：Vue Router — "Route Props / 解耦"

### 7. 想把 query 也传成 prop，并做类型转换，怎么写？

用函数形式：`props: (route) => ({ page: Number(route.query.page) || 1, id: route.params.id })`。这样组件收到已转换好默认值的 number（呼应 vue-router-nested-dynamic 第二、五节）。

**来源**：Vue Router — "props function"

---

## 四、复用与刷新

### 8. 同一路由组件在不同 params 间切换不重新挂载，会造成什么问题？怎么解？

`onMounted` 不再执行 → **数据停留在上一条**（经典"user/1→user/2 内容不变"bug）。解法：① `watch(() => route.params.id, ...)`；② 给 `<RouterView :key="$route.fullPath">` 强制重建；③ `beforeRouteUpdate` 守卫里重取（呼应 vue-router-nested-dynamic 第六节、vue-lifecycle）。

**来源**：Vue Router — "Route Component Reuse / params change"

### 9. query 值是字符串，分页 `?page=2` 直接 `page + 1` 会怎样？怎么防？

`'2' + 1 = '21'`（字符串拼接）而非 3。要在 props 映射或读取处 `Number(route.query.page)` 转换并校验，URL 一律字符串（呼应 vue-router-nested-dynamic 第五、七题、node-config env 全字符串）。

**来源**：Vue Router — "Query values are strings"、社区 — "?page 变字符串"

---

## 五、深链、刷新与部署

### 10. 嵌套动态路由 `/user/42/posts/7` 能被用户收藏/刷新直达吗？需要什么前提？

能，但前提是**服务器对任意路径都回退返回 index.html**，让前端路由接管解析（webHistory）。否则刷新直链 404。hash 模式则天然可直达（`#` 后不发请求）（呼应 vue-router-nested-dynamic 第一节、router-basics 第二节、vue-deploy）。

**来源**：Vue Router — "History Mode / server fallback"

### 11. `route.matched` 是什么？有什么用途？

它是当前 URL **命中的路由记录数组**（从父到子），可用于：读整条链上合并的 `meta`、判断层级、`matched.at(-1)` 拿最深记录做埋点/权限（呼应 vue-router-nested-dynamic 第一节、vue-router-guard-lazy 的 meta）。

**来源**：Vue Router — "RouteLocationMatched / route.matched"

### 12. 复杂后台（多层布局 + 每层再切 tab/详情）的路由结构你会怎么设计？

用 `children` 逐层嵌套、每层组件放自己的 `<RouterView>`；身份资源用 params、列表筛选/页码用 query；列表↔详情用嵌套子路由；配 `props:true` 解耦；catch-all 兜底 404。避免把整棵结构塞进单个巨型组件（呼应 vue-router-nested-dynamic 全课、vue-project-architecture）。

**来源**：Vue Router — "Nested Routes 实战"、社区 — "后台系统路由设计"

---

## 补充（新专题 13-15）

### 13. 后台系统「模块 → 列表 → 详情 → 内嵌 tab」四层嵌套的路由表怎么设计？每层 RouterView、菜单高亮、面包屑分别依赖什么数据结构？

路 由 表 = 树 的 投影：模 块 层 `path: "/orders"` 带 布 局 组 件 与 `meta: { title, icon, order }`，列 表/详 情 作 子 路 由（详情 `:id` 段，`meta.hideInMenu` 控 菜 单 渲 染 但 保 留 面包 屑）；tab 层 不 再 下 钻 URL（四 层 全 进 URL 会 让 收 藏 链 接 脆 弱，tab 状 态 进 query 的 `?tab=items` 可 选 项——保 留 分享 性）。菜 单 高 亮 只 依 赖 `route.matched` 的 顶 层 记 名（不 要 写 path 前 缀 匹 配，`/orders/1/edit` 前 缀 会 误 击 `/orders-history` 类 兄 弟）；面 包 屑 = `route.matched.filter(r => r.meta?.title)` 再 把 params 插 值 进 title（详 情 面 包 屑 显 「订 单 #42」而 非 「:id」，本关 收 藏 直达 题 的 体验 闭 环）。设 计 红线：meta 字 段 集中 定 义 类 型（declare module 增 强 RouteMeta，本包 TS 联动），散 装 的 自 由 元 数据 三 个 月 后 没 人 敢 改。

**来源**：Vue Router 嵌套路由与 RouteMeta 类型增强文档；后台系统菜单-面包屑按 matched 派生的通行实现。

### 14. 「同组件不同 params」导致的取数 bug 全集：缓存、竞态、滚动、KeepAlive 四案各怎么治？

案 一 取 数 不 重 跑：watch `() => route.params.id` + immediate（本关 watch/onMounted 题 的 标 准 形），或 props 化 后 watch props（组 件 与 路 由 解 耦，测 试 可 独 立 传 参，props:true 题 的 延 续 价 值）。案 二 竞 态：id 快 速 切 换 时 旧 请 求 后 回——onCleanup 里 abort（watch 的 第 二 参 数）或 响 应 回 来 时 校 验 `route.params.id` 仍 等 于 请 求 时 的 id（双 保险 选 一 写 进 团 队 模 板）。案 三 滚 动：同 组 件 视 为 同 页，滚 动 不 复 位 是 scrollBehavior 默 认 行 为——需 要 「换 id 就 回 顶」的 产 品 形 态（商 详 页）在 watch id 时 手 动 `window.scrollTo` 或 给 RouterView 加 `:key="route.fullPath"` 换 实 例（换 实 例=放 弃 复用 的 所 有 性 能 与 状态 前 提，要 慎）。案 四 KeepAlive：list↔detail 往 返 列 表 状 态 靠 缓 存（activated 刷 新 策 略 见 生命 周期 关），详 情 间 横 切（相关 推荐 点 击）不 进 缓 存（include 按 组 件 name，本包 KeepAlive 题 的 路由 落 地）。

**来源**：Vue Router 路由组件参数化复用文档（生命周期与 watch params 指引）；社区同组件复用取数竞态案例。

### 15. query 驱动的状态（分页/筛选/排序）同步 URL 的工程学：序列化规范、replace 防轰炸、双向同步的循环防护。

序 列 化 规范：类 型 全部 降 为 字 符 串 的 约 定 + 集 合 决 策（数组 用 重 复 键 `tag=a&tag=b` 而 非 逗 号 拼 接——值 含 逗 号 时 歧 义）；空 值 政 策（默 认 值 不 进 URL，`page=1` 省 略，否 则 分享 链 丑 且 diff 噪 音 大）；对 象 状态 绝 不 JSON.stringify 进 query（URL 爆 炸+可 读 性 死，那 是 状 态 不 是 导 航 参 数）。防 history 轰 炸：输 入 即 筛 的 字 段 用 `replace` 更 新（或 防 抖 后 push，首 次 交 互 push 后 续 replace 的 混 合 策 略，本包 watch 防 抖 题 的 路 由 版）。双 向 同 步 循环：组 件 改 状态 → watch 写 URL → route 变 → watch route 回 写 状态 → 再 写 URL…… 防 线：写 前 比较 序 列 化 结果（相 等 就 跳 过 push），或 单 向 化——**URL 是 状 态 的 唯一 源**（组 件 只 读 route 派 生，任 何 变 更 都 push 路 由，本 次 讨 论 的 「router as store」模 式 ；反 之 「store 主 导 + 监 听 回 写」要 处 处 防 回 环）。测 试：参 数 化 用 例 打 收 藏 URL 直 达（含 非 法 组 合，page=abc 这 类 要 有 归 一 化 兜 底 而 不 是 NaN 请 求）。

**来源**：URL 状态管理（user-facing state）通行规范；Vue Router query 类型与序列化行为文档。
