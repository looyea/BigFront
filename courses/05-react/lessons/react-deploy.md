# React 应用部署

> 目标：把前 7 关写的 React 应用真正**上线**。本课讲：Vite 构建产物、`base` 路径、SPA 的 **history 回退**（nginx/静态托管重写）、Next.js 三种部署形态（SSG 静态导出 / Node 服务端 / Edge/serverless）、**环境变量**（`VITE_` / `NEXT_PUBLIC_` 只暴露客户端、密钥别外泄）、**带 hash 的资源缓存策略与 CDN**、常见坑（404、缓存旧版、路径、CORS）。呼应 **vue-deploy**、**10-vite-deploy**、**09-exp-deploy**、react-nextjs。

---

## 一、构建产物与 base

```bash
npm run build          # Vite：输出到 dist/（index.html + /assets/*.hash.js|css）
```
- 产物是静态文件：`index.html` + `assets/[name].[hash].js|css`；
- **`base`**：若站点不在域名根（如 `/myapp/`），`vite.config` 设 `base:'/myapp/'`，否则资源 404（对照 vue 的 `publicPath`，呼应 vue-deploy）；
- 部署 = 把 `dist/` 交给任意静态服务器/CDN/OSS/Vercel/Netlify/GitHub Pages。

---

## 二、SPA 的 history 回退（最常踩）

用 BrowserRouter（history 模式，呼应 react-router-basics 第一节）时，刷新 `/user/1` 这种**非根路径**，服务器上没有这个真实文件 → **404**。必须把未知路径**回退到 index.html**，交给前端路由：

```nginx
location / {
  try_files $uri $uri/ /index.html;   # nginx：找不到文件就返回 index.html
}
```
- 静态托管（Netlify `_redirects: /* /index.html 200`、Vercel rewrites、Vercel/Cloudflare Pages）都有对应 SPA 回退开关；
- 或改用 HashRouter 免回退（代价：URL 带 `#`，呼应 react-router-basics 第 2 题）；
- 与 Vue Router history 模式部署完全同构（呼应 vue-deploy）。

---

## 三、Next.js 的三种部署形态

| 形态 | 怎么产出 | 部署到哪 | 适用 |
|---|---|---|---|
| **静态导出** `output:'export'` | 纯静态 HTML/CSS/JS | 任意静态托管/CDN | SSG、无 SSR/API routes |
| **Node 服务端** | `next build && next start` | 有 Node 的服务器/Docker | 需 SSR/Server Actions |
| **Edge / Serverless** | Vercel/云平台自动 | 平台函数 | 全球低延迟、自动扩缩 |

- 静态导出用不了 SSR/动态 route handler/`headers()/cookies()` 服务端能力（呼应 react-nextjs 第三节）；
- SSR 需运行时：Docker 化 `next start`，或上 Vercel（`NEXT_PUBLIC_*` 见第四节）；
- `basePath`/`assetPrefix` 对应子路径部署与 CDN 域名。

---

## 四、环境变量：只暴露该暴露的

```bash
# Vite：只有 VITE_ 前缀会注入客户端
VITE_API_URL=https://api.x.com
# Next：只有 NEXT_PUBLIC_ 前缀进浏览器
NEXT_PUBLIC_API_URL=https://api.x.com
DATABASE_URL=...        # 无前缀 → 仅服务端可读，不会进包
```
- 构建时内联进 JS → **任何"前缀暴露"的变量都能被用户看到**，密钥/DB 连接串绝不能加前缀、绝不能进客户端；
- 变量在**构建期**固化（非运行时读），改值要重新构建（Next 自托管也支持运行时 env 用于 server 侧）；
- 与后端 `.env` 区分：前端"公开配置"和"服务端机密"是两拨（呼应 node-config、ts-project）。

---

## 五、缓存与 CDN

- 带 hash 的 `assets/*.abc123.js`：内容变→文件名变→**可设 `Cache-Control: immutable, max-age=31536000` 长缓存**；
- `index.html` **不能强缓存**（`no-cache`），否则发新版后用户仍拿旧 html 引用旧 hash JS，更新不下发；
- 部署后老资源仍在（利于仍在打开的页面），新 html 引新 hash → 平滑更新；
- 配 CDN 分发静态资源、`assetPrefix`/域名、gzip/brotli 压缩（呼应 10-vite-deploy、exp-deploy）。

---

## 六、常见坑清单

- 刷新子路由 404 → 没配 history 回退（第二节）；
- 资源 404 → `base`/`publicPath` 没设或子路径部署；
- 改了环境变量没生效 → 需**重新 build**；
- 白屏 → 生产 `base` 错 / CORS / 首屏 JS 报错（开 source map 定位）；
- 密钥泄漏 → 误把机密加 `VITE_`/`NEXT_PUBLIC_` 前缀；
- CORS → 前端直连后端跨域，靠后端 `Access-Control-Allow-Origin`（呼应 09-exp-security）或部署期同源反代。

---

## 七、自检清单

- [ ] 为什么 BrowserRouter 刷新会 404？如何回退？
- [ ] `base`/`publicPath` 设错会怎样？
- [ ] `VITE_`/`NEXT_PUBLIC_` 前缀意味着什么安全边界？
- [ ] 带 hash 的资源和 index.html 缓存策略分别怎么定？为何？
- [ ] Next 静态导出与 SSR 部署对运行时的要求差异？

---

## 🎓 全课收官

至此，**「大前端学院 · React 课程包」8 阶段 24 关全部完成**：

- **L1 JSX / 组件 / 渲染模型** → **L2 核心 Hooks（state / effect / 模式）** → **L3 refs / 记忆化 / 进阶 Hooks** → **L4 通信与复用（Context / 组合 / 自定义 Hook）** → **L5 表单 / 列表 key / 渲染控制** → **L6 路由与数据获取（Router / Data Router / Query）** → **L7 状态管理 / 性能 / 测试** → **L8 架构 / Next.js / 部署**。

React 的心智主线一以贯之：**UI = f(state)**、**渲染即重跑 + diff**、**state 快照不可变**、**Hooks 顺序即身份**、**key 稳定即复用**、**服务端状态与客户端状态分离**、**从 SPA 走向 Server/Client 全栈**。

它与 **04-vue** 互为镜像：响应式自动 vs 手动记忆化、SFC vs JSX、composable 共享单例 vs Hook 各自一份、Pinia vs Zustand/Query、Nuxt vs Next——学透两者，你就掌握了大前端框架的**通法**。下一步可进入 **06-小程序**、**07/08-Next/Nuxt 深化**，或在真实项目里把这 24 关串成自己的工程直觉。祝你好运，毕业快乐 🎓。
