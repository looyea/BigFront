# vue-router-basics 面试题精选

> 共 15 题，覆盖 前端路由原理 / history 模式 / RouterLink-View / useRoute-useRouter / 导航 五类。

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

---

## 补充（新专题 13-15）

### 13. history.pushState 之外，SPA 路由还有 hashchange 与「无 URL 的应用状态」三种形态——各自适用与失效边界？

pushState：干净 URL+SEO 可 达，代价 是 服务 端 兜 底（本关 刷 新 404 题）与 **同 步 约 束**（pushState 不 等 待 任 何 东西，渲染 是 异步 的，URL 与 UI 存 在 短 暂 分 叉 窗 口）。hashchange：免 服 务 端 配 置、file:// 也 能 跑（Electron 静 态 包/离线 包 场 景），代价：锚 点 语义 被 占（页 内 锚 链接 不 能 再 用 #）、hash 段 不 进 大 多 数 服务 端 日 志。无 URL 形态（组 件 内部 状态 机/弹窗 队 列/stepper）：不 需 要 收藏 与 前 进 后 退 就 不 该 进 URL——**滥用 反 例**：给 每 个 筛选 条 件 都 上 query 导 致 history 爆 炸（用户 后 退 10 次 才 出 得 去 页 面，正 解 `replace: true` 或 收敛 到 少数 状 态）；**该 上 而 没 上 的 正 例**：列 表 的 页 码/筛 选/排 序（可 分享 可 恢 复，本 关 型 题 的 产品 判 据）。终极 形 态：URL 是 **可 分享 的 应用 状态 序 列 化**，什 么 进 什 么 不 进 是 产品 决 策 不 是 技 术 惯 性。

**来源**：MDN History API 与 URL 状态管理；Vue Router history 模式实现差异说明。

### 14. router.push 的 Promise 返回值在 v4 里的完整故事：重复导航、守卫取消、渲染失败的 resolve/reject 各是什么？错误该谁吃？

v4 push 返回 `Promise<NavigationFailure | void | Error>`：成功 开 始 → resolve(undefined)；**导 航 失 败**（包 括 NavigationDuplicated 重 复 导航、守卫 abort/cancel、chunk 加载 失败 后 的 部分 场景）→ **resolve 一 个 failure 对 象**（不 reject！这 与 3.x 的 「reject NavigationDuplicated」与 早期 控制台 噪音 之争 是 一 段 历 史：v4 把 「取 消」归 为 正常 结 果）。真 reject 只 剩 极少 数（异 常 冒 泡），所 以 业务 不 要 `.catch` 当 控 流（会 吞 掉 导 航 失 败 的 区 分 度）；要 拿 结 果 用 `isNavigationFailure(failure, ErrorTypes...)` 判 定 类 型。渲染 失败（组 件 mounted 抛 错）不 在 push 语义 内——那 是 onErrorCaptured/全局 errorHandler 的 事（本包 生命 周期 错 误 题 的 分 界）。设计 落 论：「按 钮 连 点 去 抖」不 靠 catch，靠 `replace`+按 钮 disabled（导 航 in-flight 期 间 锁 操 作，配 afterEach 解 锁）。

**来源**：Vue Router 4 NavigationFailure 与 programmatical navigation 文档；v3 重复导航 reject 历史与 issue 定案。

### 15. 用 RouterLink 还是自绘按钮跳路由？可访问性、新标签页、prefetch 三个维度给决策。

真 `<a>`（RouterLink 渲 染 出 来 就 是）的 不 可 替 代 项：中 键/ Cmd+点 新 标 签（自 绘 div 绑 click 直接 残 疾）、浏览 器 状 态 栏 URL 预览、屏 幕 读 器 的 link 角 色、SEO 爬 虫 可 达（内 容 型 站点 的 路 由 必须 是 a）。自 绘 按钮 只 在 **行 为 不是 导 航** 时 合 法（打 开 抽屉/弹 窗，那 就 不 该 push 路 由 而 是 状态，本关 无 URL 形态 题）。prefetch：VitePress/Nuxt Link 那 样 「hover/可 见 时 预 请 求 组 件 chunk」在 纯 Vue Router 要 自 实 现（route 记 名 + import 映 射 表，鼠标 enter 触 发）——收益 是 「点 击 即 开」，代价 移 动 端 误 触 发 流 量（用 IntersectionObserver 视 口 内 预 取 更 节 制，本包 异步 关 chunk 题 的 前 置 手 段）。可访 问 细 节：当前 页 链接 要 带 `aria-current="page"`（RouterLink activeClass 只 给 class，读 屏 无 感），外链 统 一 加 标 识——「路 由 决 策 表 里 的 a11y 列」多 数 团队 空 白，主 动 讲 出 来 是 加分 项。

**来源**：Vue Router RouterLink 可访问性（aria-current）文档；WebAIM 导航链接规范；VitePress 预取策略说明。
