# 构建与部署

> 目标：把 `vite build` 出来的静态产物，正确地交到用户手上。本课串起：构建产物结构、`base`/publicPath、**history 路由在 Nginx 的 `try_files` 回退**（SPA 刷新 404 的根因与解法）、`VITE_` 环境变量、**静态资源 hash 与缓存策略**（`index.html` 不缓存、带 hash 的 assets 长缓存）、CDN、gzip/brotli 预压缩、首屏优化与 **SPA vs SSG** 取舍（呼应 10-vite-deploy、node-deploy-perf、exp-static、vue-performance 分包、vue-ssr-nuxt）。

---

## 一、`vite build` 产物

```
dist/
  index.html            # 入口，引用带 hash 的资源
  assets/
    index-a1b2c3.js     # 内容 hash
    vendor-d4e5.js      # 分包（manualChunks）
    index-f6g7.css
  favicon.svg ...       # public/ 原样拷贝
```
- 生产构建做了压缩、tree-shaking、代码分割、静态资源 hash（呼应 vue-performance 第六节、10-vite build）；
- `dist/` 是**纯静态**，任意静态服务器/CDN/对象存储都能托管（SPA 场景无需 Node）。

---

## 二、base / publicPath

应用不在根路径（如部署到 `https://x.com/admin/`）时设 `base: '/admin/'`，否则 `index.html` 里引用的 `/assets/...` 会 404。Nginx 的 `root`/`alias`、CDN 前缀要和 `base` 对齐（呼应 10-vite）。

---

## 三、history 路由的刷新 404（必考）

`createWebHistory` 用 `pushState`，浏览器地址是真路径，但**刷新/直链时服务器上没有这个文件**：
```
GET /user/42  →  Nginx 找不到 /user/42 文件  →  404
```
解法——**回退到 index.html**，交给前端路由再解析：
```nginx
location / {
  root  /var/www/dist;
  try_files $uri $uri/ /index.html;   # 找不到文件就回退 SPA 入口
}
```
用 `createWebHashHistory`（`/#/user/42`）则天然免回退，但 URL 丑、SEO 差——又一个 SPA/SSR 选型权衡（呼应 vue-router-basics 第一节、vue-deploy 第七节）。

---

## 四、环境变量 `VITE_`

```js
const api = import.meta.env.VITE_API_BASE;   // 只有 VITE_ 前缀会注入客户端
```
- **只有 `VITE_` 开头的变量会被打进前端产物**、且**构建时内联**（非运行时读取）；
- ⚠️ 前端代码 = 公开：密钥、内部地址**绝不能**放 `VITE_`（会被反解）；秘密留在后端，前端只调接口（呼应 node-config 密钥不外泄、exp-auth/exp-security）。
- 多环境：`.env.production` / `.env.staging`，构建时 `--mode` 选择（呼应 node-config 环境分层）。

---

## 五、缓存策略：hash + Cache-Control

内容 hash 文件名让"变更即换名、不变即长缓存"：

| 资源 | 缓存 | 原因 |
|---|---|---|
| `index.html` | `no-cache` / 短 | 入口要能拿到最新资源清单 |
| `assets/*.[hash].js/css` | `max-age=31536000, immutable` | 内容变→hash 变→URL 变，可永久缓存 |
| `public/` 无 hash 文件 | 谨慎/短缓存 | 改名不自动失效，易留旧缓存 |

发版：新 `index.html` 指向新 hash assets，用户秒获新版且旧 hash 资源仍在 CDN 可用（平滑发布、避免 chunk 404，呼应 vue-project-architecture 的 chunk 加载失败）。

---

## 六、CDN、压缩与首屏

- **CDN**：静态产物上 CDN，就近分发；配合 hash 长缓存命中率高（呼应 10-vite-deploy）；
- **压缩**：Nginx `gzip` 或构建期 **brotli 预压缩**（`vite-plugin-compression`），传 `Content-Encoding`；
- **首屏**：路由/组件分包 + 预加载（呼应 vue-performance）、`<link rel=preload>` 关键资源、图片懒加载与现代格式、`modulepreload`；
- HTTPS/HSTS、安全响应头（CSP 防 XSS）见 **exp-security** 与 **node-https-tls**。

---

## 七、SPA vs SSG，以及部署目标

- **纯 SPA**：`vite build` → 静态托管 + `try_files` 回退，最简；
- **SSG**（构建时预渲染，如 `vite-ssg`/Nuxt prerender）：内容页直出 HTML，首屏与 SEO 更佳、可丢到 CDN 免服务器（呼应 vue-ssr-nuxt）；
- **SSR**：需 Node/edge 运行时跑 `server entry`，部署到 Node（呼应 node-deploy-perf pm2/cluster）或 Serverless/edge。
选型的三条轴：**SEO/首屏诉求 × 内容动态性 × 运维成本**。

---

## 八、自检清单

- [ ] 为什么 history 路由刷新会 404？Nginx 怎么修？
- [ ] 为什么带 hash 的 assets 能 `immutable` 长缓存，而 index.html 不能？
- [ ] 密钥为什么不能放 `VITE_` 变量？前端 env 是构建期还是运行时？
- [ ] gzip 和 brotli 预压缩差别？CDN 为何配合 hash 更有效？
- [ ] SPA / SSG / SSR 部署目标与取舍分别是什么？

---

## 🎓 全课收官：04-vue 你已贯通

到这里，Vue 3 全 8 阶段 24 关完成，形成闭环：
- **L1 响应式**（ref/reactive/computed → Proxy 懒代理/track-trigger/effect）是**引擎**；
- **L2 模板** 把声明式写法编译成 render + 依赖收集；**L3~L4 组件**（props/emits/slot/lifecycle/provide/composables/异步）是**结构**；
- **L5 路由 / L6 状态** 解决"多页面、多组件如何共享与流转数据"，统一到 **单向数据流 + single source of truth**；
- **L7 编译器宏/性能/测试** 让你写得干净、跑得飞快、测得住；
- **L8 架构/SSR/部署** 把散点组织成可维护工程并交付上线。
把每条"呼应"顺藤摸瓜复习一遍，就是从语法到工程的完整 Vue 能力图谱。后续 **05-react** 会拿这套心智对照 React（Hooks vs 组合式、Context vs provide、Redux/Zustand vs Pinia），迁移学习事半功倍。
