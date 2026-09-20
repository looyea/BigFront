# Next.js 定位与项目结构

> 目标：回答"学了 React 为什么还要学 Next.js"。SPA 骨架（Vite/CRA 产物）在生产环境有三座大山——首屏白屏、SEO 不友好、前后端两套部署。Next.js 是 React 官方生态给出的工业级答案：**渲染框架 + 路由约定 + 服务端能力 + 构建优化**四合一。本课同时立起整个 07 包的心智地图与项目目录规范。呼应 **react-nextjs**（预告篇）、**vite-intro**（构建工具视角）、**react-deploy**（SPA 部署的局限）。

---

## 一、SPA 骨架的三座大山

用 10-vite 打包出来的纯 SPA（`index.html` + 一堆 JS）：

```html
<!-- 服务器返回的其实只有这个壳 -->
<div id="root"></div>   <!-- 内容？等 JS 下载、执行、取数、渲染完才有 -->
<script src="/assets/index-3f8a.js"></script>
```

1. **白屏期**：JS 下载执行前用户看空白，弱网下 LCP 轻松飙到 3s+（呼应 react-performance 的 LCP 定义）；
2. **SEO 失效**：爬虫默认拿到的是空壳 `<div id="root">`，内容站/电商不可接受；
3. **前后端割裂**：页面在 Vercel/Nginx、接口在 Express（09 包），跨域、部署、类型共享全是成本（呼应 exp-server 的 CORS 一节）。

**Next.js 的解法**：让 React 组件先在**服务器**上跑一遍、输出完整 HTML，浏览器只是"接管"这棵已经看得见的树。

---

## 二、Next 到底是什么：四合一

| 层次 | 提供什么 | 对应你学过的 |
|---|---|---|
| 路由 | 文件系统即路由，零配置 | vue-router / react-router 手写配置 |
| 渲染 | SSR/SSG/ISR/RSC 全模式 | vite-ssr 手动搭建的那套 |
| 服务端 | API 路由、Middleware、Server Actions | 09-express 整包 |
| 构建 | 代码分割、预取、图片/字体优化 | 10-vite 里要手动调的事 |

一句话：**Vite 是"更快的打包器"，Next 是"React 应用的完整运行时方案"**——前者管构建（呼应 vite-intro 定位），后者管"应用怎么跑起来、怎么被看见"。

---

## 三、create-next-app 与目录结构

```bash
npx create-next-app@latest my-app --ts --app --tailwind
```

```text
my-app/
├── app/                  # ★ 路由目录（App Router，本课主线）
│   ├── layout.tsx        # 根布局：所有页面共用的壳
│   ├── page.tsx          # 首页 → /
│   ├── globals.css
│   └── favicon.ico
├── public/               # 静态资源原样伺服（同 vite 的 public，呼应 10-vite L1）
├── next.config.ts        # 框架级配置（对照 vite.config.ts）
├── tsconfig.json         # Next 自动注入 paths: {"@/*": ["./*"]}
└── package.json          # dev / build / start 三个脚本
```

- `npm run dev` → 开发服务器（HMR，热更新机制与 Vite 同源思路，见 vite-hmr）；
- `npm run build` → 生产构建（内部由 SWC/Turbopack 完成，见 next-architect）；
- `npm start` → 用构建产物起 Node 服务（本质还是一个 Node HTTP 服务器，node-http 老朋友）；
- **没有** `index.html`——HTML 由服务器每次（或构建时每份）生成，这是与 SPA 骨架的根本差别。

---

## 四、`app/` 目录的心智模型：文件夹即路由

| 文件 | 作用 | 类比 |
|---|---|---|
| `app/page.tsx` | 一个路由的界面 | Vue 的 `.vue` 页面组件 |
| `app/layout.tsx` | 该层的共用外壳（nav/footer） | vue-router 的 `<RouterView>` 嵌套 |
| `app/about/page.tsx` | `/about` | 手写 `path: '/about'` 的时代结束了 |
| `app/blog/[id]/page.tsx` | `/blog/:id` 动态段 | react-router 的 `path="/blog/:id"` |

规则只有一条：**URL 结构 = 目录结构**。`app/dashboard/settings/page.tsx` 就是 `/dashboard/settings`，不需要任何注册动作（L2 展开细节，呼应 next-routing）。

---

## 五、一个最小页面长什么样

```tsx
// app/page.tsx —— 注意：没有 createRoot、没有 index.html、没有路由表
export default function Home() {
  return (
    <main>
      <h1>大前端学院</h1>
      <p>这段 HTML 在服务器上就已渲染好</p>
    </main>
  );
}
```

浏览器"查看源代码"（不是 DevTools 的 Elements）能看到 `<h1>` 真实存在——这就是 SSR 的第一口甜头。右键查看源代码 vs Elements 的差异，正是 **服务端 HTML** 与 **水合后 DOM** 的分界（next-render-modes 细讲 Hydration）。

---

## 六、自检清单

- [ ] SPA 骨架的三座大山分别是什么？Next 各用什么解？
- [ ] `app/` 里 page 与 layout 的职责分工？
- [ ] Next 项目里为什么没有 `index.html`？
- [ ] dev/build/start 三个命令分别对应你学过的哪套 Vite 动作？
- [ ] "查看源代码"能看到内容，说明了什么？

---

## 🚀 部署预告

- 本课立起"为什么"和"目录在哪"；下一关 **next-routing** 把 `app/` 的文件路由细则钉死：page/layout/template 三种文件、嵌套布局怎么拼、以及 tsx/js/jsx 的取舍；
- 学到后面请随时回望：本包 L3（RSC）与 L4（缓存）才是 Next 与其他框架拉开差距的地方，也是面试重灾区（呼应 react-nextjs 面试题）。
