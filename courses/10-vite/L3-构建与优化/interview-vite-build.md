# vite-build 面试题精选

> 共 15 题，覆盖 **构建模型 / Source Map / 压缩 / 缓存 / CSS / Rollup 穿透 / 性能** 七类。

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

---

## 补充（新专题 13-15）

### 13.  Vite 7 把默认 build.target 换成 baseline-widely-available 意味着什么？升级时你会检查什么？

变更实质：从"具体版本表"（es2020 类）转向 Baseline 口径——被广泛支持（默认开启且覆盖主流现代浏览器约 2.5 年支持窗）的特性才不降级，官方维护映射表随版本滚动。影响面检查：① 产物下限收紧——目标环境里"边缘但仍有量"的旧浏览器（老安卓 WebView、企业锁定版 Chrome）可能加载到不降级的语法直接 SyntaxError：升级前拉真实用户浏览器分布（GA/上报数据）对照 Baseline 覆盖表，这是唯一硬判据；② 体积/性能红利用足（更少 polyfill 与降级包裹、async 原生），可量化预期收益；③ 与 browserslist 的关系澄清——Vite 的 target 不吃 browserslist 配置文件（与 webpack 生态的关键差异），两套真值体系并存时要以 build.target 为唯一声明源并删除/文档化 browserslist 避免假安全感；④ 需要覆盖时显式设 target 而不是改回旧默认（自定义数组形式支持按引擎粒度）。加分句：能讲出"我们的兼容基线是数据定的不是习惯定的，且全仓只有 build.target 一处声明"，这题的格局就对了。

**来源**：Vite 7 发布说明（基线目标变更）；web-platform-baseline 项目（Baseline 定义）；MDN 浏览器兼容性约定

### 14.  构建产物的完整性与来源治理：SRI、manifest、crossorigin 在你的发布管线里怎么用？

SRI（integrity 属性）：给 script/link 加内容哈希，篡改（CDN 被投毒/中间人）即拒载——Vite 产物的 hash 名 + sha384 值在构建期都可计算（manifest/插件生成），但注意三个现实约束：动态 import 的 chunk 无法逐个挂 SRI（不走 HTML 标签）、改一个文件要同步刷新引用它的 HTML 标签（发布系统复杂度）、同源脚本收益有限（主要防第三方 CDN 供应链）。manifest（build.manifest 的 .vite/manifest.json）：chunk 与资源的依赖/入口映射表——给服务端模板引擎消费（非 HTML 入口的项目用它拼正确的 preload/预载标签）、给发布系统做"本次变更影响面"计算、给监控做版本指纹。crossorigin：上 SRI 必须 anonymous 属性否则拿不到校验语义；错误监控"Script error 无堆栈"的经典解就是给所有 script 加 crossorigin + CDN 配 CORS 响应头（两件事同源）。组合建议：自家主域产物 crossorigin+错误监控必配；第三方依赖（CDN 的字体/SDK）SRI+版本锁定；全量 SRI 按"是否可被静默替换"评估。收口句：产物治理的主线是"可验证"——名字可验证（content hash）、来源可验证（SRI）、映射可验证（manifest），三者齐了发布事故的定位才会从考古变成查表。

**来源**：MDN Subresource Integrity；W3C SRI spec；Vite build.manifest 文档

### 15.  Rollup 4 升级给 Vite 构建侧带来了什么（hooks 语义、异步观察者、对插件生态的冲击）？

Rollup 4 三主线：① 钩子全异步化（观察者异步、移除同步钩子）——构建并行度提升、插件里 await 成为常态，遗留同步钩子插件直接报错（升级冲击的主要来源）；② 树摇与 AST 增强（更准的副作用推断、/*#__PURE__ 处理改进）——产物体积常有 2-5% 白捡收益，但"以前被错误保留的代码"消失可能暴露依赖该 bug 的业务（副作用注册类代码显形）；③ API 与类型现代化（programmatic 接口对齐 Vite 6 的 Environment 使用）。插件生态冲击的工程处理：升级前跑一次 build 的插件清单审计（维护活跃度、peer 声明）、把"构建行为 diff"当 breaking 看待（产物文件清单对比、体积基线、抽样运行时验证），社区插件跟进期用 overrides/patch 争取时间而不是冻结 Vite。加分维度：Vite 借此把自身对 Rollup 的依赖面收窄（Rolldown 兼容层以 Rollup 4 的 standard hook 形状为合同——升级 Rollup 4 实际是在为换引擎铺路，插件合规度=未来迁移成本），能说出这层"版本升级的路标意义"是架构视角。

**来源**：Rollup 4 发布说明（standard hooks、异步观察者）；Vite 与 Rollup 大版本跟进公告；知乎《我们升级 Vite 后第三方插件全红的那天》
