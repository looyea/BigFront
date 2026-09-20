# vite-build 面试题精选

> 共 12 题，覆盖 **构建模型 / Source Map / 压缩 / 缓存 / CSS / Rollup 穿透 / 性能** 七类。

---

## 一、构建模型

### 1. Vite 开发和构建为什么用两套不同的打包策略？

开发用 no-bundle（原生 ESM 按需编译），启动快、HMR 精准；构建用 Rollup 全量打包，产出优化的静态资源（tree-shaking、scope hoisting、代码分割、minify）。两者目标不同：开发重"启动速度 + 反馈速度"，生产重"运行时性能 + 体积"。esbuild 只做依赖预构建，不做最终 bundle（插件生态/输出优化不如 Rollup 成熟）。

**来源**：Vite 官方 — "Why Vite / Build Optimizations"; Vite 作者 Evan You — "Vite: the next generation front tooling" 演讲

### 2. 为什么 Vite 以 HTML 作为构建入口而不是 JS entry？

HTML 是浏览器真正加载的文档，`<script type="module" src>`、`<link rel=modulepreload>`、资源引用都在其中。以 HTML 为起点可：① 天然支持多页应用（MPA）；② 精确知道哪些 chunk 是入口；③ 自动注入带 hash 的资源路径。这与传统 Webpack 用 JS entry + HtmlWebpackPlugin 的思路相反。

**来源**：Vite guide — "Multiple Pages / Working with HTML"; Vite — "Excluding Updates / html as entry"

---

## 二、Source Map

### 3. 生产环境为什么不直接暴露 sourcemap 文件？

sourcemap 可还原出接近原始的源码（含变量名/注释/目录结构）→ 竞争对手可读、内部逻辑/密钥路径可能泄露。正确做法：`sourcemap: 'hidden'` 生成但不写引用注释 → CI 上传到错误监控（Sentry）→ 从公开产物删除 .map。

**来源**：Sentry docs — "Upload Source Maps"; MDN — "Source Map"; linkify — "Should you deploy sourcemaps"

### 4. `sourcemap` 的四种取值分别适用什么环境？

`false` 生产（不生成）；`true` 预发/dev（生成 + 引用注释）；`'inline'` 单文件调试（map 内联进 JS）；`'hidden'` 生产最佳（生成但不引用 → 传 Sentry）。

**来源**：Vite build options — "build.sourcemap"; Rollup output — "sourcemap"

---

## 三、压缩

### 5. esbuild 和 Terser 压缩的差异？何时必须用 Terser？

esbuild 快 20-40 倍（Go 原生），但压缩率略低于 Terser，且不支持某些精细控制：保留法律许可证注释（`comment_filter`）、属性名混淆白名单、`/*#__PURE__*/` 的边角处理。需要这些 → 切 `minify: 'terser'`。Vite 5+ esbuild 支持 `drop` 移除 console/debugger。

**来源**：Vite — "build.minify / terserOptions"; esbuild docs — "Minifying"; Terser — "compress options"

### 6. 移除 console 有哪几种方式？推荐哪种？

① `esbuild.drop: ['console']`；② `terserOptions.compress.drop_console: true`（需切 terser）；③ `pure_funcs: ['console.log']`（只删指定方法、保留 warn/error）；④ 构建期 DefinePlugin 式替换。推荐 ③（保留 error 便于线上排查）。全局 `define console.log=void 0` 脆弱不推荐。

**来源**：Vite — "build.terserOptions"; esbuild — "drop / pure"; esbuild issue — "remove console"

---

## 四、缓存与产物

### 7. 如何设计构建产物实现浏览器永久强缓存？

带 contenthash 的 JS/CSS → `Cache-Control: public, max-age=31536000, immutable`（内容变则文件名变，永不冲突）；index.html → `Cache-Control: no-cache`（每次验证，保证发版即生效）。关键：入口 HTML 绝不能强缓存，否则用户拿不到新的 hash 引用。

**来源**：web.dev — "Cache / HTTP caching"; MDN — "immutable / Cache-Control"; Create React App — "Deployment CDN cache"

### 8. `base` 配置解决什么问题？

部署到非根路径（如 `https://cdn.com/my-app/`）时，构建产物里的资源引用路径需要正确前缀。`base: '/my-app/'` 让所有 import/asset URL 带正确前缀。相对路径用 `base: './'`（配合 file:// 或不确定域名场景）。开发时 base 也影响 dev server 路径。

**来源**：Vite — "base / public base path"; Vite deploy — "Base Public Path"

---

## 五、CSS

### 9. cssCodeSplit 的默认行为以及它和懒加载的关系？

默认 true：Vite 为每个包含样式的异步 chunk 生成独立 CSS 文件，在懒加载 chunk 被 import 时自动注入 `<link>`。首屏只加载必需 CSS → LCP 更快。false：全部 CSS 合并成一个 `style.css` 在入口一次性加载。

**来源**：Vite — "build.cssCodeSplit"; web.dev — "Critical CSS / code splitting"

### 10. Lightning CSS 相比 PostCSS + esbuild 有什么优势？

Lightning CSS（Rust）一站式做转换 + 压缩 + 浏览器降级（target 转译），比 PostCSS（JS）+ esbuild 组合快很多，且能自动加前缀、按 `browserslist_to_lightningcss_targets` 降级现代语法（nesting、:is）。Vite 5.4 实验性支持，6 增强。

**来源**：Vite — "CSS / Lightning CSS"; Lightning CSS docs — "Features / transforms"; Parcel — "Lightning CSS" 博客

---

## 六、Rollup 穿透与库模式

### 11. Vite 库模式（library mode）和 app 模式的区别？

库模式 `build.lib`：输出 ES/CJS/UMD 格式供他人 import，不处理 HTML，需 `rollupOptions.external` 排除 peer deps（如 vue/react），通常保留导出、生成 .d.ts（需 vite-plugin-dts）。app 模式：输出可运行的 SPA/MPA，处理 HTML、内联小资源。库要 tree-shakable + 多格式，app 要体积最优 + 缓存。

**来源**：Vite — "Build Library Mode"; Rollup — "output.format"; TypeScript — "publishing types"

### 12. 构建很慢，如何定位和优化？

① `vite build --debug` 看各插件/阶段耗时；② `sourcemap: false` 或 `'hidden'` 减少 map 生成；③ minify 用 esbuild 不用 terser；④ `reportCompressedSize: false` 省 gzip 计算；⑤ 减少 manualChunks 过度拆分导致的额外遍历；⑥ 依赖太大考虑 external / CDN；⑦ 用 rollup-plugin-visualizer 找体积/耗时大头；⑧ CI 缓存 node_modules/.vite。

**来源**：Vite — "Build Optimization / performance"; rollup-plugin-visualizer; Vite — "Performance tuning" discussions
