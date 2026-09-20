# SSR 与 Vite 6 Environment API

> 目标：**理解并会用 Vite 做服务端渲染**——SSR 的价值与原理（渲染 HTML + hydration）；Vite SSR 开发模式（`createServer` + `ssrLoadModule` + `transformIndexHtml`）；构建双产物（client + server）；Vite 6 **Environment API** 统一 client/server 环境；streaming SSR 与常见坑。

---

## 一、为什么要 SSR

纯客户端渲染（CSR/SPA）：服务器只给一个空 `<div id="app">` + JS，浏览器下载并执行 JS 后才渲染。问题：① **首屏白屏**（要等 JS 下载执行）；② **SEO 弱**（爬虫拿到空 HTML）；③ 低端设备/慢网体验差。

**SSR（服务端渲染）**：在服务器上把应用渲染成**真实 HTML 字符串**返回，浏览器先展示 HTML（首屏快、可被爬），再加载 JS 让框架"接管"已存在的 DOM——这一步叫 **hydration（水合）**：绑定事件、恢复状态、后续转客户端交互。

> 折中方案：**SSG**（构建期预渲染成静态 HTML，见 vite-deploy）与 **ISR**（增量重生）。Vite 提供的是"构建 SSR 产物 + 开发时 SSR 服务"的底层能力，Nuxt/Next/Analog 等在其上封装。

---

## 二、SSR 的三段式

```
请求 →  [服务器] 把 App 渲染成 HTML 字符串（含 SSR 注入的数据）
      →  返回完整 HTML（首屏可见、可被爬虫读取）
      →  [浏览器] 加载 client JS → hydration → 变为可交互 SPA
```

关键约束（SSR 与 CSR 的最大不同）：

- **服务器上没有 `window`/`document`/`localStorage`**——只在浏览器用的代码要放 `onMounted`/客户端守卫里，或 `if (typeof window !== 'undefined')` 判断；
- **每请求要有独立的应用实例**（不能共享单例，否则用户 A 的状态漏到用户 B——呼应 Express L5 隔离）；
- **数据要能序列化注入再 hydration 时复用**（避免服务器取了、浏览器又取一遍）。

---

## 三、Vite SSR：开发模式手写一遍

Vite 提供一个"能编译模块、也能在服务端把模块加载执行"的 dev server。核心三件套：

```js
// server.js（Node，开发用）
import express from 'express';                 // 呼应 09-express！
import { createServer } from 'vite';

const app = express();
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

app.use(vite.middlewares);                     // 让 Vite 处理模块转换/HMR

app.use('*', async (req, res) => {
  const url = req.originalUrl;
  try {
    // ① 读 index.html
    let html = await import('node:fs').then(fs => fs.promises.readFile(resolve('index.html'), 'utf-8'));
    // ② 交给 Vite 插件链转换（注入 module script 等）
    html = await vite.transformIndexHtml(url, html);
    // ③ 在服务端加载入口模块（SSR entry），拿到 render 函数
    const { render } = await vite.ssrLoadModule('/src/entry-server.js');
    // ④ 用框架把 App 渲染成 HTML 字符串
    const { html: appHtml, state } = await render(url);
    // ⑤ 把 SSR HTML + 序列化的状态注入模板后返回
    const finalHtml = html.replace('<!--app-html-->', appHtml).replace('<!--app-state-->', serialize(state));
    res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
  } catch (e) {
    vite.ssrFixStacktrace(e);                  // 让报错映射回源码
    res.status(500).end(e.message);
  }
});
app.listen(3000);
```

- `middlewareMode`：Vite 不自己起端口，作为 Express 中间件跑；
- `transformIndexHtml`：套用框架插件对 HTML 的处理（呼应 L4 插件钩子）；
- `ssrLoadModule`：**在 Node 里加载并执行前端模块**（SSR 入口），开发时即时编译、带 HMR；
- `ssrFixStacktrace`：把 SSR 报错栈映射回源文件。

入口 `entry-server.js`（服务端）导出 `render()`，`entry-client.js`（浏览器）做 `hydrate()`。

---

## 四、生产：构建双产物

开发时 `ssrLoadModule` 即时编译；生产要预先构建**两份**：

- **client 产物**：浏览器 hydration 用的 JS/CSS（`dist/client`）；
- **server 产物**：Node 里执行 `render()` 用的 JS（`dist/server`，`ssr` 构建），框架运行时不打包进（`ssr.noExternal`/external）。

```js
// vite.config.js
export default {
  plugins: [vue()],
  build: {
    // 通过两次构建或框架构建 API 产出 client + server
  },
};
```

用 `vite build --ssr src/entry-server.js --outDir dist/server` 构服务端入口，再普通 `vite build` 构客户端。运行时 Node 服务加载 server 产物 render、静态资源指向 client 产物。**别用 dev server 上生产**（`ssrLoadModule` 是为开发设计的，慢且不安全）。

---

## 五、Vite 6 Environment API（重点新特性）

Vite 6 之前，"客户端环境"与"SSR/Node 环境"是两套割裂的 API（`ssrLoadModule`、`ssrTransform`、`isSSR` 标志散落）。**Environment API** 把它们统一成"**环境（Environment）**"抽象：

- 每个环境有名字与配置：`client`（浏览器）、`ssr`（默认 Node 服务端）、可自定义更多（如 `edge`、`test`）；
- 插件不再写 `if (ssr)` 分支，而是**按环境**注册行为——同一插件可在不同环境有不同 transform；
- 统一 `vite.env` / `import.meta.env` 在环境下的取值；
- `createServerEnvironment` / 新的钩子签名让"任意 JS 运行时"都能被 Vite 编译（Node、边缘运行时、浏览器测试等）。

对插件作者：`applyToEnvironment(environment)` 决定插件在哪些环境生效；`environment.name`/`config.environment` 取代旧 `isSSR`。框架（Nuxt/Vitest/Analog）借此把"服务端环境"和"测试环境"用同一套机制表达。**Vitest 已用 Environment API 跑 SSR 环境的单测。**

> 心智：以前是 client vs "SSR 特例"；现在是"**多环境**"，SSR 只是其中一个 environment。这让 Vite 从"浏览器 bundler + SSR 补丁"升级为"**通用多环境编译平台**"。

---

## 六、hydration 与数据序列化

SSR 把 state 塞进 `<script>window.__INITIAL_STATE__ = ...</script>`，client hydration 时框架读取它复用，避免二次请求。安全点：

- state 必须是**可 JSON 序列化**的（Date/Map/函数要处理）；
- **XSS**：注入前对 `</script>` 等做转义（否则 `</script><script>alert(1)` 逃逸——呼应 Express L6）；
- **hydration mismatch**：服务端与客户端首次渲染结果不一致（如用了 `Date.now()`、`Math.random()`、读了 `window`、条件渲染依赖客户端数据）→ 框架报警告、DOM 闪烁。对策：把"仅客户端"的渲染放挂载后再更新，或用框架的 `<ClientOnly>`/`suppressHydrationWarning`。

---

## 七、Streaming SSR

字符串 SSR 要等**整个** App 渲染完才吐 HTML，首字节（TTFB）受最慢数据拖累。**流式渲染**（React `renderToPipeableStream` / Vue `renderToString` + 流 / Suspense）把 HTML 分块尽早 flush：静态骨架先出、慢组件用占位后补，显著改善感知性能与 TTFB。Vite 侧照常产出 client/server 双产物，流式由框架 render 与 Node 响应流配合实现。

---

## 八、自检清单

- [ ] SSR 解决 CSR 的哪些问题？hydration 是什么？
- [ ] Vite SSR 开发三件套是哪三个 API？各自作用？
- [ ] 为什么生产不能用 `ssrLoadModule`/dev server？
- [ ] 为什么每请求要新建应用实例？
- [ ] Environment API 相对旧 `isSSR` 的进步在哪？
- [ ] 注入初始 state 要注意哪两件事（序列化 + XSS 转义）？hydration mismatch 怎么产生、怎么避免？

---

## 🚀 部署预告

- **SSR 需要常驻 Node 服务**（区别于纯静态 SPA）：部署形态是"Node 进程 + client 静态资源"（呼应 Express L8 部署）；
- **预渲染（SSG）**：对不随请求变的页面，构建期直接产出静态 HTML，兼得 SEO 与静态托管便利（vite-deploy）；
- **边缘/多环境**：Environment API 让同一套 Vite 编译面向 Node / 边缘运行时（vite-deploy 会提）。

下一关 **vite-deploy**——静态部署 / CDN / Docker / Monorepo / library mode / 多页面，把构建产物送到线上。
