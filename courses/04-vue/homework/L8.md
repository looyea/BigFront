# L8 课后作业 —— 架构、SSR 与部署

> 覆盖本阶段三关：vue-project-architecture、vue-ssr-nuxt、vue-deploy。这是全课最后一份作业，也是把前 24 关串起来的"综合演练"。

---

## 一、读代码找 Bug（10 小题）

1. SSR 项目里 `export const store = defineStore('user', {...})()` 写在模块顶层并直接 `store()` 使用 —— 有什么问题？（呼应 vue-project-architecture、vue-pinia-advanced）
2. ```js
   // entry-server.js
   import { createSSRApp } from 'vue';
   const app = createSSRApp(App);          // 放在模块顶层而非工厂函数里
   app.use(createPinia());
   ```
   并发请求下会怎样？
3. 组件 `<script setup>` 顶层写 `const ua = navigator.userAgent;` —— SSR 下报什么错、为什么、怎么改？
4. ```nginx
   location / {
     root /var/www/dist;
     # 访问 /order/123 刷新返回 404
   }
   ```
   缺了哪行、加什么？
5. `.env.production` 里写 `VITE_DB_PASSWORD=xxx` 并在前端 fetch 用到 —— 安全隐患是什么？
6. 给 `assets/index-abc123.js` 和 `index.html` 都配了 `Cache-Control: max-age=31536000, immutable` —— 哪个配错、后果？
7. 部署到子路径 `/app/`，`vite.config` 忘了配 `base` —— 会出现什么现象？
8. 把某第三方"仅客户端"图表组件在 SSR 页面顶层 `import` 且 `onServerPrefetch` 外直接渲染 —— 报错原因与两种解法？
9. `app.config.errorHandler` 没设，某个子组件 render 抛错 —— 从架构角度缺了哪层兜底？`onErrorCaptured` 能做什么？
10. 团队把每个 `ref` 小状态（输入框草稿、弹窗开合）都建了全局 Pinia store —— 违背了哪条架构纪律？给出重构方向。

---

## 二、手写编程（5 题）

1. 为一个 `features/cart` 画出自包含目录结构（components/store/composables/api/routes/`index.ts`），并用文字说明 barrel 对外只暴露什么。
2. 写一个 SSR 安全的"每请求实例"工厂：`createApp()` 内 `createSSRApp` + `createPinia` + `createRouter(createMemoryHistory 或 webHistory)`，并注释为什么不能放模块顶层。
3. 用 `import.meta.client`（或 `typeof window` 守卫）改写一段"读 localStorage 初始化主题"的逻辑，使 SSR 不报错、客户端水合正常。
4. 写一段 Nginx 配置：静态托管 dist、history 回退、assets 一年 immutable、`index.html` no-cache、开 gzip。
5. 给 `useCounter` composable 写一个不依赖组件的 Vitest 用例（含 `effectScope` 停止后副作用清理的断言，或至少断言 count 递增），说明为何这么测（呼应 vue-testing、vue-composables）。

---

## 三、场景题（1 题）

一个内容资讯站要从纯 SPA 迁移到更好的首屏与 SEO，团队担心复杂度。请给出**渐进式方案**：
- 先判断哪些页面上 SSR/SSG（列表/详情 vs 后台管理）；为什么；
- 用裸 Vue SSR 还是 Nuxt？各自要额外搭什么；
- 迁移期 hydration mismatch、每请求实例、浏览器 API 三大坑如何防；
- 部署形态（静态 CDN / Node 运行时）分别怎么落；
- 如何用 Lighthouse/visualizer/错误监控验证收益且防回归。
（要求至少点出 5 个本关/跨关具体机制。）

---

## 四、简答题（3 题）

1. 为什么说"避免过度全局化"既是架构纪律又是 SSR 正确性前提？两个角度分别解释。
2. 内容 hash 文件名为什么能同时做到"永久缓存"和"发版即时生效"？这对 `index.html` 的缓存提出什么要求？
3. SSR、SSG、CSR 三者的"首屏内容来自哪里"分别是什么？据此说明各自 SEO 与运维差异。

---

## 五、挑战题 🏆 —— 全课毕业交付

为一个虚构的"电商后台 + 对客商城"设计**一套 Vue 3 技术方案一页纸**，串起全课 8 阶段：
- 响应式与状态：哪些用 ref/computed、哪些进 Pinia、哪些 provide/inject（引 L1/L4/L6）；
- 组件与逻辑：容器/展示分层、composables 库、编译器宏规范（引 L3/L4/L7）；
- 路由与性能：路由懒加载 + 预加载、大列表 shallowRef/虚拟滚动、patchFlag/v-memo（引 L5/L7）；
- 渲染选型：后台用 SPA、商城内容页用 SSG/SSR，说明理由（引 L8）；
- 测试与部署：Vitest + vue-tsc 进 CI、vite build + Nginx 回退 + hash 长缓存 + CDN（引 L7/L8）。
要求：每个技术选择都配一句"放弃了什么替代方案、为什么"。这份一页纸就是你学完 04-vue 的"架构师视角毕业答卷"。
