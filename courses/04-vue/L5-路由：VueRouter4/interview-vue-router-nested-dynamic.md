# vue-router-nested-dynamic 面试题精选

> 共 12 题，覆盖 嵌套路由 / 动态参数 / props 解耦 / query-params / 视图与匹配 五类。

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
