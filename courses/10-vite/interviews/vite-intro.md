# vite-intro 面试题精选

> 共 12 题，覆盖 **架构原理 / 工具链对比 / esbuild 预打包 / 生态定位 / 性能** 五类。

---

## 一、架构原理

### 1. 一句话解释 Vite 和 Webpack 的本质区别。

Webpack 是 **bundle-first**：启动时构建完整依赖图并打包后才能 serve；Vite 是 **no-bundle**：直接起 server，浏览器请求哪个模块就即时编译哪个——把打包推迟到 build 阶段。

**来源**：Evan You — "Vite: The next generation front-end tooling" VueConf 2019; Vite Guide — "Why Vite?"

### 2. 为什么 Vite dev 不做 bundle？bundle 有什么问题？

bundle 是 O(n)——项目越大启动越慢（Webpack 解析/编译所有模块）。Vite 利用 **浏览器原生 ESM**：import 是 lazy 的 → 没访问的模块不编译 → 启动时间恒定。代价：开发时 HTTP 请求数多（几百个模块几百个请求），HTTP/2 多路复用下这不是问题。

**来源**：Vite — "How Vite works"; web.dev — "HTTP/2 head request caching"

### 3. 为什么 Vite 生产构建还要用 Rollup（不直接输出 ESM 多文件）？

原因：① 减少 HTTP 请求数（Rollup 合并/分割 → 最优 chunk 数）；② Tree Shaking 全量分析；③ 跨 chunk 公共依赖提取；④ 老浏览器兼容（target）；⑤ 资源 hash + preload 注入。裸 ESM 多文件在 HTTP/1.1 环境下性能极差，且不能做到最优分割。

**来源**：Evan You — "Why bundle for production?"; Vite Guide — "Production Build"

---

## 二、工具链对比

### 4. Vite / Turbopack / Rspack 三者的定位？

| | Vite | Turbopack | Rspack |
| --- | --- | --- | --- |
| 出品 | VoidZero | Vercel | ByteDance |
| dev | no-bundle ESM | lazy 模块图 | bundle（但 Rust 快） |
| build | Rollup | 自研 | Webpack 兼容 |
| 生态 | 独立（插件丰富） | Next.js 专属 | 可替代 Webpack |
| 适用 | 全场景 | Next.js 项目 | 存量 Webpack 项目迁移 |

**来源**：Turbopack docs; Rspack docs — "Why Rspack?"

### 5. Vite 6 引入的 Environment API 解决了什么问题？

之前 dev/build/ssr/moduleRunner 是**四套不同内部机制**——插件作者要写四遍适配。Environment API 统一为 **可插拔环境**（`new Environment({ name: 'ssr', ... })`），每个环境有自己的 module graph + transform 链 → 插件只需 hook 环境生命周期 → SSR/Edge/Wasm 都是一种 environment。

**来源**：Vite 6 Blog — "Environment API"; Vite RFC #16057

---

## 三、esbuild 预打包

### 6. 预打包和 build 打包有什么区别？

| | 预打包 (optimizeDeps) | Build |
| --- | --- | --- |
| 阶段 | dev 启动时 | `vite build` |
| 工具 | esbuild | Rollup |
| 范围 | 只处理 node_modules | 全部（源码+依赖） |
| 目的 | 把 CJS 转 ESM / 合并小文件 | Tree Shake / Code Split / Minify |
| 输出 | `node_modules/.vite/deps/` | `dist/` |
| 缓存 | 有（命中秒启动） | 无 |

**来源**：Vite Dep Optimization guide

### 7. 什么时候需要手动配 optimizeDeps.include / exclude？

- **include**：动态 import 的 CJS 依赖（esbuild 静态分析发现不了）；
- **exclude**：link 本地开发的包（自己已 build 好 ESM → 不需要打包 → exclude 后走源码直接加载 → 改本地包代码即时生效）；
- **exclude**：monorepo 里 workspace 包（pnpm link 后 Vite 默认不打包它）。

**来源**：Vite — "optimizeDeps.include/exclude" docs

---

## 四、生态定位

### 8. Vite 只是 bundler 吗？它还能做什么？

Vite 是 **前端工具链平台**：① dev server + HMR；② build 优化；③ **Plugin Container**（可编程转换任何模块）；④ **Module Runner**（Node.js 里 import TS/Vue/任意格式）；⑤ SSR 框架基础（Nuxt/Remix/SvelteKit 底层）；⑥ Library 构建；⑦ 未来：Rolldown（统一 dev/build 为同一引擎）。

**来源**：Vite Conf 2023 — "Vite as a platform"; VoidZero 愿景

### 9. Vite 支持非 Vue 项目吗？

完全支持框架无关：React（@vitejs/plugin-react）、Svelte（@sveltejs/vite-plugin-svelte）、Solid、Preact、Angular（experimental）、Lit、vanilla TS/JS。任何 HTML+JS 项目都能用 Vite。

**来源**：Vite GitHub — "Framework Templates"; awesome-vite

---

## 五、性能

### 10. Vite 冷启动 vs Webpack 冷启动为什么快？

Webpack 5 项目 3000 个模块 → 冷启动 30s（所有模块 transform + bundle）。Vite 冷启动 <1s（起 server）+ 预打包 node_modules（esbuild 100-300ms）+ 用户访问首页 → 只编译当前路由涉及的 50-100 个模块。

**来源**：Vite benchmark issues; Webpack Performance guide

### 11. HMR 更新时 Webpack 为什么慢？Vite 怎么做到恒定速度？

Webpack HMR：重新构建**包含变更模块的 chunk**（一个 chunk 可能含 100+ 模块）→ 500ms+。Vite HMR：只重新编译**变更的那一个模块** → 通过 WS 推给浏览器 → 动态 import 替换 → 与项目大小无关（10ms）。

**来源**：Evan You — HMR design; Webpack HMR docs

### 12. 大型项目（10000+ 模块）Vite 的优势还明显吗？有什么坑？

dev 仍然快（no-bundle）。坑：① **首屏请求瀑布**——HTTP/2 下 3000 个并发 import 仍可能导致浏览器排队；② **预打包发现动态 import** → 需手动 include；③ **build 时** Rollup 本身可能慢（10000 模块 build 2-5min）→ 关注 Rolldown 迁移进度。

**来源**：Vite GitHub Discussions — "Large project optimization"
