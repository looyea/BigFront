# vue-router-basics 面试题精选

> 共 12 题，覆盖 前端路由原理 / history 模式 / RouterLink-View / useRoute-useRouter / 导航 五类。

---

## 一、前端路由原理

### 1. SPA 的前端路由是怎么工作的？和传统多页路由有何区别？

前端路由**不向服务器请求新 HTML**，而是监听 URL 变化（History API / hash），在客户端把匹配的组件渲染进 `<RouterView>`。传统 MPA 每个 URL 一次整页加载；SPA 只在首屏加载一次，之后 URL 与视图在内存中映射切换（呼应 vue-router-basics 第一、三节）。

**来源**：Vue Router — "Getting Started / 路由原理"、MDN — "History API"

### 2. `history.pushState` 和直接改 `location.href` 有何不同？

`pushState` **只改地址栏 URL、不触发页面加载/刷新**，可在不重新请求文档的前提下维护历史记录栈，SPA 靠它做无刷新导航；改 `location.href` 会让浏览器**发起整页导航**。`popstate` 事件则用于响应前进/后退（呼应 vue-router-basics 第二节）。

**来源**：MDN — "history.pushState() / popstate"

---

## 二、history 模式

### 3. createWebHistory 和 createWebHashHistory 的区别？各自代价？

webHistory 用 pushState，URL 干净（`/about`），但**刷新/直链需服务器回退到 index.html**，否则 404。hash 模式 URL 带 `#`（`/#/about`），`#` 后不发请求、**天然免回退**，但 URL 不美观、和页内锚点语义冲突。现代部署优先 webHistory+回退（呼应 vue-router-basics 第二节、vue-deploy）。

**来源**：Vue Router — "History Modes"

### 4. 为什么刷新一个深层路由 `/user/42` 会 404？怎么修？

`/user/42` 是前端路由，磁盘上没有这个文件；刷新时浏览器真的向服务器要 `/user/42` → 404。修：服务器把**所有非静态资源请求回退返回 index.html**。Nginx `try_files $uri $uri/ /index.html;`；Express `app.get('*', sendFile(index.html))`；Vite dev 默认已处理（呼应 vue-router-basics 第二节、09-express、node-http）。

**来源**：Vue Router — "HTML5 History Mode / Nginx, Apache config"

---

## 三、RouterLink / RouterView

### 5. `<RouterLink>` 相比 `<a>` 做了什么额外的事？

渲染为 `<a>` 但**拦截点击**、调用 `router.push` 做客户端导航（不整页刷新），并自动维护 `router-link-active`/`router-link-exact-active` 类用于高亮，还能 `custom` 自定义渲染（呼应 vue-router-basics 第三节、vue-class-style-transition）。

**来源**：Vue Router — "RouterLink / active class"

### 6. `<RouterView>` 的作用是什么？一个页面能有多个吗？

`<RouterView>` 是路由组件的**渲染出口**，渲染当前匹配到的（嵌套）组件。可以有**多个命名视图**（`<RouterView name="sidebar">` + 路由记录 `components: { default, sidebar }`），用于同一层级并排渲染多个组件（呼应 vue-router-basics 第三节、vue-router-nested-dynamic）。

**来源**：Vue Router — "RouterView / Named Views"

---

## 四、useRoute / useRouter

### 7. useRoute 和 useRouter 有什么区别？为什么别混用？

`useRoute()` 返回**当前激活路由的响应式只读快照**（path/params/query/meta/matched），用来"读"；`useRouter()` 返回**导航器实例**，用来 push/replace/订阅守卫"动作"。混用会读不到数据或误触发导航。二者都要在 setup 顶层调用（呼应 vue-router-basics 第四节、vue-composables 第一节）。

**来源**：Vue Router — "useRoute / useRouter"

### 8. route.params、route.query、route.hash 分别从 URL 的哪部分来？

`/user/42?tab=posts#a`：`params.id = '42'`（动态段，需在路由里声明 `:id`）、`query.tab = 'posts'`（`?` 后键值）、`hash = '#a'`。params 依赖路由定义、query 可任意附加（呼应 vue-router-basics 第四节、vue-router-nested-dynamic）。

**来源**：Vue Router — "URL Loader Data / params, query, hash"

---

## 五、导航

### 9. push 和 replace 有何区别？哪些场景该用 replace？

`push` 向历史栈**新增**一条（可后退）；`replace` **替换**当前条目（不留后退点）。该用 replace 的：登录成功跳首页（不该后退到登录页）、表单提交后跳详情、重定向纠正错误 URL（呼应 vue-router-basics 第五节、vue-router-guard-lazy 鉴权重定向）。

**来源**：Vue Router — "router.push / router.replace"

### 10. 命名路由相比路径字符串好在哪？

`{ name:'user', params }` 不硬编码 `/user/xxx` 结构，路由定义改了跳转点不用改，减少散落的路径拼接错误；也更易做类型化。代价是要保证每条路由都有唯一 name（呼应 vue-router-basics 第五节）。

**来源**：Vue Router — "Named Routes"

### 11. 编程式导航 `router.push` 返回什么？被守卫中断会怎样？

返回一个 Promise，导航成功 resolve、被导航守卫取消/重定向则 **rejected/中止**（可能抛 NavigationFailure）。要 `await`/`.catch` 处理，避免未捕获拒绝（呼应 vue-router-basics 第五节、vue-router-guard-lazy、node-async-errors）。

**来源**：Vue Router — "Navigation / router.push promise / NavigationFailure"

### 12. 想在"进入某路由时"根据 route.params 重新取数，用 watch 还是 onMounted？

`onMounted` 只在组件**首次挂载**跑；同一路由不同参数（如 `/user/1`→`/user/2`）默认**复用组件实例**、不重新挂载。要按参数变化重取数，用 `watch(() => route.params.id, fetch, { immediate:true })`（或路由 `beforeRouteUpdate`、给 RouterView 加 `:key="route.fullPath"` 强制重建）（呼应 vue-watch、vue-router-nested-dynamic、vue-lifecycle）。

**来源**：Vue Router — "Reuse of Route Components / route params watch"
