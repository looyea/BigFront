# 构建与部署：把裸 Svelte 应用送上天

> 目标：不借任何应用框架，把一个纯 Svelte SPA 完整交付上线——vite build 产物解读、base 与子路径、history 路由回退、hash 缓存纪律、静态与 SSR 两种形态的账本，最后立一份"部署前检查清单"（呼应 10-vite-deploy 的总纲、vue-deploy、react-deploy 同款终关仪式；SSR 细节在 L10 svelte-ssr-hydration 展开）。

---

## 一、产物从哪来：纯 Svelte = Vite 项目

`sv create`（不选 Kit）生成的就是标准 Vite 工程（L7 接头理论的成果今天收获）：

```bash
npm run build     # vite build → dist/
npm run preview   # 本地起静态服务验产物（部署前冒烟，别直接甩生产）
```

`dist/` 里就三类东西：`index.html`（宿主）、`assets/*.js|css`（**文件名带内容 hash**）、静态资源。Svelte 编译发生在 vite-plugin-svelte 的 transform 里——**部署视角下没有一个"Svelte 专属环节"**，它就是普通 Vite 构建（呼应 10-vite-build）。这带来一个好消息：所有 Vite 部署知识（base/分包/缓存头/CDN）原样复用，本课只补 Svelte 特有的三小块。

## 二、Svelte 特有的三小块

### 1. 编译器警告在 CI 收口

`a11y_*` 与响应式反模式警告不影响 build 成功——**部署纪律是把 `sv check` 与 lint 挡在 build 之前**（L7 三件套顺序），而不是指望 vite build 替你把关可访问性。

### 2. 无框架运行时兜底 = 体积账更透明

bundle 分析（`rollup-plugin-visualizer`，10-vite 工具）里 Svelte 项目的构成：你的代码 + 每组件编译产物 + 一小撮 `svelte/internal`。没有"再瘦框架"的空间，优化动作全在**代码分割与依赖治理**（懒路由用 `import()`——纯 Svelte 手搓路由也能分包，呼应上一关"轮子清单"）。

### 3. 挂载点契约

`index.html` 里的 `<div id="app">` 与 `main.js` 的 `mount(App, { target: ... })` 是**你自己维护的契约**（Kit 没这操心）——嵌入到别的页面模板（如政企老系统Velocity/JSP 吐的壳）时，这两处+静态资源路径就是全部集成面，这也是 Svelte 常被选去"寄生"老页面的原因。

## 三、老三样：base、回退、缓存头

部署在子路径（如 `https://x/console/`）：

```js
// vite.config.js
export default { base: '/console/' };   // 产物里的资源引用全部带前缀
```

history 路由刷新 404 的修复与缓存头纪律，与 04/05/10 包逐字同款（跨包反复出现的"部署三件套"，此处仍是唯一正解）：

```nginx
location /console/assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";  # 带 hash 的产物
}
location /console/ {
  try_files $uri $uri/ /console/index.html;                        # SPA 回退
  add_header Cache-Control "no-cache";                             # index.html 必须再验证
}
```

**为什么**：hash 变=文件变，immutable 才安全；index.html 是"清单"，缓存它就是发布失败的经典事故源（发新不上线、用户一半新一半旧——跨 chunk 的 runtime 不匹配直接白屏）。

## 四、静态 vs SSR：两本账

| | 静态 SPA（本课主线） | SSR（L10 手搓 / Kit 内置） |
|---|---|---|
| 服务器要什么 | 一个文件桶/Nginx | 常驻 Node（或 serverless）+ 缓存策略 |
| 首屏 | 白屏→下 JS→渲染 | HTML 直达（SEO/弱设备友好） |
| 成本曲线 | 流量再大不加算力 | 每请求耗算力，要做限流/降级 |
| 典型场景 | 内网后台、登录后应用 | 营销页、详情分享卡、低 SEO 诉求则不必 |

纯 Svelte 走 SSR 意味着自己写 `render()` 服务端 + `hydrate` 客户端全套（L10 带你走一遍并给"该不该"的判据）；绝大多数 SPA 场景，**静态部署 + 好分包**就是正确答案——别为了简历给后台系统加 SSR（诚实的工程观）。

## 五、CI/CD 流水线（把前十包的知识串成一条线）

```yaml
# 概念版，GitHub Actions / 任意 CI 同构
- npm ci
- npx sv check && npm run lint          # 类型与规范闸门（L7）
- npm test -- --run                      # Vitest（组件测试在浏览器/Node 双环境）
- npm run build                          # vite build（产物含 hash）
- 产物扫描（密钥/ sourcemap 策略检查）    # 呼应 exp-security、vite-ci-perf
- 部署：rsync/S3 dist/ → CDN invalidate index.html
- 冒烟：preview/生产域 curl 首页 + 关键路由回退验证
```

发布纪律同款：**不可变版本目录 + 原子切换**（`releases/<git-sha>/` + 软链切 current），回滚=切回上一软链，十包部署课的公共收口。

## 六、自检清单

- [ ] 说得出纯 Svelte 项目在 Vite 工程里的"特殊性"只剩哪三小块。
- [ ] base 配子路径时资源 404 的排查路径（产物引用 vs 服务端回退）。
- [ ] 背下并能推导缓存头纪律：hash 产物 immutable、index.html no-cache。
- [ ] 能开一张静态 vs SSR 的账本并给出选型判据。
- [ ] 默写 CI 流水线的闸门顺序，指出每步挡的是什么事故。

---

🚀 **下一站（L9 开篇）**：`svelte-special-elements`——部署完结回到组件深水区：`<svelte:window>/<svelte:document>/<svelte:body>` 全局事件、`<svelte:element>` 动态元素，以及 Svelte 5 里"动态组件"终于不用特殊标签了。
