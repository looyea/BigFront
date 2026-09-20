# vite-setup 面试题精选

> 共 12 题，覆盖 **配置项 / 环境变量 / proxy / base / build 选项 / define / 多页/库模式** 六类。

---

## 一、配置项

### 1. vite.config.ts 为什么能用 TypeScript 写？Vite 怎么执行的？

Vite 启动时用 **esbuild 把 vite.config.ts 编译成临时 JS**（bundle 模式 + 外部化 node_modules）→ 动态 import 执行。支持顶层 await、ESM import 插件。编译缓存到 `node_modules/.vite/vite.config.ts.timestamp-xxx.mjs`。

**来源**：Vite Config file docs; Vite source — `loadConfigFromFile`

### 2. define 和 env 都能注入常量，什么时候用哪个？

- **env**（`.env` + `import.meta.env.VITE_*`）：适合**运行时可配**的（不同部署环境 URL 不同）——`.env.production` / `.env.staging`；
- **define**：适合**编译时常量**（版本号、feature flags、`__DEV__`）——文本替换后 Tree Shake 删除不可达代码。

define 支持任意标识符、env 只能 `VITE_` 前缀。

**来源**：Vite Env and Mode guide; Vite define docs

---

## 二、环境变量

### 3. .env 里的变量会进 git 吗？最佳实践？

- `.env` 可以进 git（只含默认值/占位符）；
- `.env.local` / `.env.*.local` **必须 gitignore**（含真实密钥）；
- 用 `.env.example` 列出需要的变量名+说明 → 新人 copy → 填值；
- CI/CD 里用 Secrets 注入环境变量（不写文件）。

**来源**：Vite .env files docs; 12-Factor App — "Config"

### 4. 为什么 Vite 不用 process.env 而是 import.meta.env？

① 浏览器没有 process；② Vite 做静态文本替换（编译时）——`import.meta.env.VITE_FOO` → `"https://api.example.com"` 写进产物；③ 比 `process.env` 更安全（明确前缀暴露 vs 全量泄漏）；④ ESM 规范里 `import.meta` 是模块元信息标准位置。

**来源**：Vite Env docs — "IntelliSense for ImportMetaEnv"; MDN — "import.meta"

---

## 三、Proxy

### 5. 开发时 Vite proxy 的原理是什么？生产环境怎么办？

Vite dev server（Connect 中间件）拦截匹配路径 → `http-proxy` 转发到 target → 响应回传浏览器。生产环境**没有 Vite server** → 需要：① Nginx `location /api { proxy_pass ... }`；② 或前后端同域部署；③ 或用 API Gateway。

**来源**：Vite server.proxy docs; http-proxy GitHub

### 6. proxy 配置里 changeOrigin: true 做什么？rewrite 呢？

- `changeOrigin: true`：转发时修改 Host 头为 target 的 host → 有些后端根据 Host 判断路由/ CORS → 不开就 404；
- `rewrite: path => path.replace(/^\/api/, '')`：前端请求 `/api/users` → 实际转发 `/users` 给后端。

**来源**：http-proxy-options docs — "changeOrigin" / "pathRewrite"

---

## 四、base 与 publicDir

### 7. base: './' 和 base: '/' 的区别？

`'/'` → 绝对路径 `/assets/xxx.js`（根域名部署）；`'./'` → 相对路径 `./assets/xxx.js`（任意子目录都能跑）。**注意**：SPA history fallback + 嵌套路由（`/users/123`）下相对路径会 404 → 子目录部署要写死完整前缀如 `/my-app/`。

**来源**：Vite public base path docs; GitHub Vite issues — "relative base + nested routes"

### 8. public 目录里的文件会被 hash 化吗？

不会。public 里的文件**原样复制**到 dist 根——不走 Rollup、不 hash、不 transform。适合 favicon / robots.txt / 第三方 SDK（不需要 hash 的文件）。引用时用绝对路径 `/logo.png`（会加 base 前缀）。

**来源**：Vite Static Assets — "The public Directory"

---

## 五、Build 选项

### 9. sourcemap: 'hidden' 模式的作用是什么？

生成 `.map` 文件但**不在 JS 末尾写 `//# sourceMappingURL=` 注释** → 浏览器 DevTools 不会自动下载 map（源码不暴露给用户）；但你可以把 .map 上传到 Sentry 用于错误反解。CI 流程：build → upload map to Sentry → delete map → deploy JS only。

**来源**：Vite build.sourcemap docs; Sentry — "Upload source maps"

### 10. cssCodeSplit: true 默认行为是什么？关掉有什么好处？

默认 true：每个异步 chunk 的 CSS 独立文件（按需加载）。false：全部 CSS 合并一个文件。false 的好处：① 避免首屏 FOUC（无闪烁）；② 减少 CSS 请求数。坏处：首屏下载了不需要路由的 CSS。通常保持 true。

**来源**：Vite build.cssCodeSplit docs

---

## 六、多页与库模式

### 11. MPA（多页面）如何配置？和 SPA 有什么区别？

`build.rollupOptions.input` 写多个 HTML → 每个是独立入口 → 共享 chunks 自动提取。MPA 每页独立加载（跳转时整页刷新）；SPA 单 HTML + 前端路由（不刷新）。Vite 天然支持两者。注意：dev 时每个 HTML 都能访问。

**来源**：Vite Multi-page Strategy docs

### 12. Library 模式下 CSS 怎么处理？

`build.lib` + CSS import → 默认**内联到 JS** 里（style inject）。如果希望输出独立 CSS 文件 → `cssCodeSplit: false` → 输出 `dist/my-lib.css`。用户引入 JS 后需手动 `import 'my-lib/dist/my-lib.css'`。或配插件 `vite-plugin-lib-inject-css` 让 JS 自动 import CSS。

**来源**：Vite Build Library Mode docs; vite-plugin-lib-inject-css GitHub
