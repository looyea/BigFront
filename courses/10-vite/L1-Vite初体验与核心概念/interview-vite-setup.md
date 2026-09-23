# vite-setup 面试题精选

> 共 15 题，覆盖 **配置项 / 环境变量 / proxy / base / build 选项 / define / 多页/库模式** 六类。

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

---

## 补充（新专题 13-15）

### 13.  一个 monorepo 里多个 Vite 应用共享配置与依赖版本，你的工程组织方案？

配置共享：基础 config 抽成内部包（defineConfig 的工厂函数导出公共片段，应用侧展开合并——注意插件数组不去重会双实例）；TS 编译期共享用 tsconfig extends 链（根 tsconfig.base 管 compilerOptions，各包只加差异）。依赖治理：pnpm catalog 统一版本声明（workspace 级依赖漂移是"我机器上好的"主因）；dev 联动的核心坑——本地包若 main 指向 dist，改源码要 watch 构建才生效，推荐"源码直出"（exports 指向 src + 应用侧 optimizeDeps.exclude 该包 + 其依赖的预构建连锁处理，呼应 deps-perf 关）；linked 依赖的路径解析（preserveSymlinks 的取舍与 @fs allow 范围）要一起验证。CI 视角：缓存 key 必须含所有 workspace lockfile；构建顺序依赖交给任务编排（turbo 的 dependsOn: ^build）。组织反模式：把 vite.config 复制成 N 份后"改一处漏三处"、公共配置包里塞某应用的特例（参数化或分两档导出）。收口句：monorepo 配置共享的分寸在"80% 相同的部分进基座、差异显式声明在应用 config"——追求 100% 统一的基座最后都变成了 if 山。

**来源**：Vite 官方 Deps in Monorepos；pnpm workspace 文档；InfoQ《前端单仓多包的三种配置拓扑》

### 14.  Vite 的 debug 配置组合拳：从断点打不中到来源错乱，sourcemap 与 dev 转换链路怎么配合排障？

链路基理：dev 期每个模块的转换链（框架插件 transform → esbuild TS/JSX → 注入 HMR 尾巴）逐级带 map 拼接，断点"打不中/行号漂移"多半是链条某环丢了 map（第三方库没 map、自写插件 transform 返回没带 map——呼应 plugin 关）。配置矩阵：dev 期 sourcemap 基本免配置（浏览器吃内联 map）；build 期 sourcemap true 出 .map 供 DevTools 动态拉取但随包暴露、hidden 出 map 不引用（配错误平台上传后删本地）是生产标准答案；『inline』内联进产物调试特殊环境用。排障动作库：DevTools 里 Sources→按 URL 找原始文件确认 map 生效、Ctrl+P 搜不到原文件即 map 断链；生产栈还原用平台符号化（Sentry upload-sourcemap 带发布版本号对齐）而不是给线上挂 map 文件；"断点命中但变量全是 <optimised out>"是压缩标识符折叠，production 下正常，要精确复现就临时 build target 提高并关 minify。加分句：sourcemap 是"构建产物的一部分"而不是调试选项——把它写进发布检查清单（map 与产物一一对应、版本号绑定、访问边界）才是成熟做法。

**来源**：Vite 官方 Debugging 指南；Rollup sourcemap 文档；Chrome DevTools sourcemap 面板

### 15.  vite.config.ts 的加载与热更新机制：它自己是怎么被编译的？改配置为什么会重启？哪些改动其实可以不重启？

加载链路：Vite 启动时把自己的 config 当一个"Node ESM 入口"用 esbuild 现场编译（TS/JSX 语法剥离）再 import——所以 vite.config.ts 不需要预编译、但要遵守 ESM 规则（不能用 __dirname、顶层 await 可用）；config 里 import 的本地文件会被登记为依赖，任何一个变化都会触发热重载（restartInPlace：重读 config → 失效相关缓存 → 重启 server 语义）。为什么重启：config 参与决定解析/转换/serve 全链行为（alias、插件、target 都是启动期快照），无法安全局部生效。可豁免的：transform 级配置里真正只影响单请求的（少数插件支持），以及新版对 server.* 部分字段的支持热改（watch 配置等渐进放宽）——判断标准是"该配置是否被编译期快照"，不是猜测。工程注意：config 里做异步初始化（读文件、算目录）要快且可重入（每次热重载都会再执行一遍——副作用/定时器泄漏的隐藏点）；环境变量影响 config 分支时用 loadEnv 显式读（config 求值期 import.meta.env 不可用——它指 Vite 自己的构建环境不是你的）。收口：这题考"你是否理解 config 是元程序而不是普通模块"——把它的生命周期讲清，插件课的顺序问题大半自动消解。

**来源**：Vite 官方 config 文档（config 依赖预打包与重启）；bundle-require/esbuild-register 机制讨论
