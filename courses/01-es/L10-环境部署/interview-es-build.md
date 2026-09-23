# es-build 面试题精选

> 共 15 题，覆盖 **构建流程 / Tree Shaking / 代码分割 / 缓存策略 / CSS 处理 / Source Map / CI/CD** 七类。

---

## 一、构建流程

### 1. 描述一下现代前端构建的完整管线。

六阶段：**Resolve**（路径解析 + exports 条件选择）→ **Transform**（Babel/SWC/esbuild 降级语法、编译 TS/JSX）→ **Bundle**（依赖图合并 + Tree Shaking 删死代码）→ **Code Split**（dynamic import 拆 chunk）→ **Optimize**（Terser minify、Scope Hoisting、CSS 压缩）→ **Emit**（contenthash 命名 + Source Map + preload/prefetch 标签注入）。

**来源**：Vite Guide — "Production Deployment"；Webpack Concepts — "Build Pipeline"

### 2. Vite dev 为什么启动那么快？它和 Webpack 的本质区别是什么？

Webpack 是 **bundle-first**：启动时从 entry 递归构建整个依赖图 → 打包完才能 serve。Vite 是 **no-bundle**：dev 时利用浏览器原生 ESM → HTML 里 `<script type="module">` → 浏览器 import 什么 Vite 就**即时编译什么**（on-demand）。只有 node_modules 的 CJS/ESM 依赖用 esbuild 预打包（一次、缓存）。

**来源**：Evan You, "Vite — Why bundle for production?" VueConf 2019

---

## 二、Tree Shaking

### 3. 为什么 `import _ from 'lodash'` 不能 Tree Shake？怎么解决？

lodash 是 CJS 包（无 ESM 入口）→ 打包器对 CJS 无法做静态分析（module.exports 是动态赋值）→ 整个 500KB 全进 bundle。解决：① 用 `lodash-es`（ESM 重写版，支持 tree shake）；② 按路径导入 `import debounce from 'lodash/debounce'`；③ 或用 `unplugin-lodash` / babel-plugin-lodash 自动转换。

**来源**：Webpack Guide — "Tree Shaking"; lodash GitHub — "Modularize imports"

### 4. sideEffects: false 的副作用到底是什么？误标会怎样？

"副作用" = import 时除了定义导出还**修改全局状态/执行 IIFE/注册 polyfill**的代码。`sideEffects: false` 告诉打包器"这个包所有模块只要导出没人用就可以安全删除"。**误标后果**：包有真正的顶层副作用（如 `import 'core-js/stage/4'` 注入 polyfill），但标了 false → 被摇掉 → 运行时功能缺失。正确做法：把真正有副作用的文件列进数组 `"sideEffects": ["*.css", "./polyfill.js"]`。

**来源**：Webpack Docs — "The sideEffects flag"

---

## 三、代码分割

### 5. Route-based 和 Component-based 分割的区别？各自适用什么场景？

- **Route-based**：`component: () => import('./views/Dashboard.vue')` → 切路由时加载 → **首屏只拿首页代码**；适合页面级分割。
- **Component-based**：`const Modal = defineAsyncComponent(() => import('./HeavyModal.vue'))` → 用户点击触发时才加载 → 适合弹窗/富文本编辑器/图表等**低频重型组件**。

**来源**：Vue Router Guide — "Lazy Loading Routes"；Vite Guide — "Dependency Pre-Bundling"

### 6. manualChunks 配置不当会导致什么问题？

1. **循环依赖**：chunkA import chunkB, chunkB import chunkA → 浏览器加载顺序出错；
2. **vendor 过大**：把 vue+echarts+antd 合一个 chunk → 只要改 echarts 版本 → 整个 vendor hash 变 → 全量重下载；
3. **空 chunk**：分包粒度过细 → HTTP 请求数暴涨（HTTP/1.1 受限）。最佳实践：只分稳定的第三方（vue/react）+ 重型库（echarts）。

**来源**：Rollup Docs — "output.manualChunks"; Vite issue #4866

---

## 四、缓存策略

### 7. 为什么 index.html 不能强缓存？应该设什么 Cache-Control？

JS/CSS 文件名带 contenthash → 内容变时文件名变 → 可以 `max-age=31536000, immutable`。但 index.html 是**入口**——如果强缓存，新版本发布了用户拿到的还是旧 HTML → 旧文件名 → 404。正确：`Cache-Control: no-cache`（每次协商确认没变 → 304）或 `max-age=0, must-revalidate`。

**来源**：web.dev — "Fast load times with caching"; Create React App — "Deployment: Caching"

### 8. 如何处理图片的缓存？图片能用 contenthash 吗？

可以。Vite/Webpack 对 `import img from './logo.png'` 都会输出 `logo.[hash].png` → 永久缓存 + hash 变即更新。注意：① CSS 里的 `url()` 同样会被 hash 化；② HTML 里直接写 `<img src="/images/xx.png">`（public 目录）→ 不会被 hash → 要手动 cache-bust query 或 `?v=hash`。

**来源**：Vite Guide — "Static Assets Handling"

---

## 五、CSS 处理

### 9. CSS 嵌套原生支持后 PostCSS 还需要吗？

看目标浏览器：Chrome 112+/Safari 16.5+/Firefox 117+ 原生支持 `&` 嵌套。如果需要兼容 **更老的浏览器**（企业内网/低端安卓），仍需要 PostCSS + `postcss-nesting` 降级。另外 PostCSS 生态远不只嵌套——autoprefixer / cssnano / postcss-preset-env / Tailwind 插件都依赖它。

**来源**：MDN — "CSS Nesting"; web.dev — "CSS Nesting"

### 10. Critical CSS 是什么？怎么提取？

首屏渲染所需的**最少 CSS**（通常 <14KB）内联到 HTML `<head>` → 避免阻塞渲染的外部 CSS 请求。工具：`critters`（Vite plugin）、`penthouse`、`@fullhuman/postcss-critical-css`。原理：用 Puppeteer 测页面可视区 → 提取命中的 CSS 规则 → 内联；其余 CSS 异步加载 `<link rel="preload" as="style" onload="this.rel='stylesheet'">`。

**来源**：web.dev — "Eliminate render-blocking resources"; Addy Osmani — "Critical CSS"

---

## 六、CI/CD

### 11. 如何在 CI 里做 bundle size 门禁？

两种主流：① **size-limit**：`npm i -D size-limit @size-limit/file`，package.json 配路径+limit → CI step 跑 `npx size-limit` → 超标 exit 1 → 红叉；② **bundlewatch**：对比 GitHub 上基准分支的产物体积 → PR 评论显示 delta（增/减多少 KB）。两者互补：size-limit 硬阈值、bundlewatch 看趋势。

**来源**：Andrey Sitnik, "Size Limit: automate bundle checks" GitHub Readme

### 12. monorepo 中如何增量构建？只打包改动的包。

- **Turborepo**：content-hash 每个包的输入 → 命中缓存就跳过；`turbo run build --filter=app...` 只构建受影响包；
- **Nx**：`nx affected --target=build` 基于依赖图推断改动影响范围；
- **pnpm workspace** + Turborepo = 2024-2025 最主流组合。

**来源**：Turborepo Docs — "Caching"; Nx Docs — "Affected"

---

## 补充（新专题 13-15）

### 13. Vite 生产为什么用 Rollup 而不是 esbuild？Rolldown 又是什么？

esbuild 快但当年 bundle 能力弱：代码分割粒度、split chunks 策略、成熟插件生态都不如 Rollup；且 Go 的 sourcemap 链路当时不达标。Vite 策略「dev 用 esbuild 做翻译，prod 用 Rollup 做打包」（Rollup 的 ESM 摇树/scope hoisting 产物质量最高）。痛点在大型项目 Rollup 变慢且要两份解析管线——**Rolldown**（Rust 重写、兼容 Rollup API）目标统一两条管线，Vite 7 起实验接入。加分点：能讲出 dev/prod 同引擎才能消除「开发正常构建炸」类差异。

**来源**：Vite 官方《Why Not Bundles / Rolldown 公告》；rolldown.rs 文档动机篇。

### 14. Tree Shaking 完整生效条件有哪些？列举摇不掉的场景。

条件链：ESM 静态结构（CJS 基本放弃）→ 副作用判定：bundler 默认**执行顶层语句视为有副作用**，`sideEffects:false` 或 glob 列表告诉打包器「纯重导出文件可整文件扔」→ 已知纯函数标注 `/*#__PURE__*/` 才敢删调用。摇不掉：属性访问动态化（`obj["f"+"oo"]`）、导出对象被整体消费、CommonJS 互操作包装、`import "polyfill"` 副作用导入被 sideEffects 白名单保护失败误删（antd 样式曾踩）。验证手段：产物里搜函数名 + rollup-plugin visualizer 对照。

**来源**：webpack 指南《Tree Shaking / sideEffects》；rollup docs《Tutorial: Tree-shaking》PURE 注释条款。

### 15. 前端缓存体系：contenthash、HTTP 头、chunk 更新之间的关系讲一下。

两层：协商缓存（ETag/Last-Modified）兜底，强缓存（`Cache-Control: max-age=31536000, immutable`）让 hash 文件名资源永不回源——contenthash 变了 URL 自然变，旧文件留版不冲突。**陷阱在入口**：index.html 必须 no-cache（否则新 chunk 名引不到）；动态 import 的 chunk 在页面存活期被替换 → 老页面拉不到旧文件名，需要 import 失败重试/版本协商策略（发布原子性：整站目录版本化）。module id 稳定性（deterministic/sized）决定改动会不会牵一发动全身地 bust 全部 hash。

**来源**：web.dev《Faster site loads with immutable caching》；webpack output.chunkLoadingFailure 与 deterministic module ids 文档。
