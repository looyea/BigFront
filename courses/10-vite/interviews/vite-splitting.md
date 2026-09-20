# vite-splitting 面试题精选

> 共 12 题，覆盖 **分割原理 / manualChunks / 预加载 / tree-shaking / 体积优化 / 缓存** 六类。

---

## 一、分割原理

### 1. Vite 构建时代码是如何被自动分割成多个 chunk 的？

Rollup 从入口构建模块图：① 静态 import 的模块默认合入同一 chunk；② 遇到动态 `import()` → 以该模块为根切出异步 chunk（含仅它依赖的模块）；③ 被多个入口/chunk 共享的模块提取为公共 chunk。Vite 在此之上加了 HTML 入口解析、CSS 分割、依赖预构。

**来源**：Rollup — "Code Splitting / dynamic imports"; Vite — "Build Optimization / dependency pre-bundling"

### 2. 多入口（MPA）共享的模块 Vite 怎么处理？

自动提取到 shared chunk，避免重复。若用 `manualChunks` 可强制归到 vendor。注意 Rollup 的 `preserveEntrySignatures` 与共享 chunk 初始化顺序。

**来源**：Rollup — "Creating chunks / manualChunks"; Vite — "Multiple Pages"

---

## 二、manualChunks

### 3. 为什么"把所有 node_modules 塞进一个 vendor"不是最优？

① 首次仍下载全部第三方（哪怕只用其中一小部分页面）→ 违背按需；② 任一小依赖更新 → 整个巨大 vendor hash 变化 → 用户重下；③ 超大单文件解析慢。应按"变更频率 + 使用范围"分组（framework / ui / utils）。

**来源**：Webpack — "Separate chunks / Cache invalidation"; Vite — "manualChunks"; SpeedSuite — "vendor chunk pitfalls"

### 4. manualChunks 拆太细引发 `Cannot access 'x' before initialization` 的原因？

chunk 之间存在循环依赖或跨 chunk 的 TDZ（暂时性死区）访问：A chunk 的模块初始化时访问了尚未执行的 B chunk 绑定。Rollup 拆 chunk 后各 chunk 是独立 `<script type=module>`，执行顺序 + 循环引用 → 初始化次序错乱。解决：把有循环的模块合并回同一 chunk，或升级到 Vite 6 `advancedChunks`。

**来源**：Rollup GitHub — "manualChunks initialization error"; Vite — "Chunk size / circular dependency" issues; MDN — "TDZ"

### 5. Vite 6 的 advancedChunks 想解决 manualChunks 的什么问题？

`manualChunks` 是字符串/函数返回 chunk 名，语义粗、易踩循环/初始化坑、无体积感知。`output.advancedChunks`（Rollup 4.x 引入）用声明式的 `groups`（`name` + `test` 正则 + `minSize/maxSize/maxModuleSize/priority`）让 Rollup 更智能地按体积阈值合并/拆分 → 减少手工踩坑。

**来源**：Rollup — "output.experimentalChunks / advancedChunks"; Vite — "advanced chunks API" discussions

---

## 三、预加载

### 6. modulepreload、preload、prefetch 三者区别？

- `modulepreload`：预取+编译当前会用到的 ES 模块（高优先级）；
- `preload`：预取当前导航的关键资源（字体/图片/worker 等），`as` 必填；
- `prefetch`：预取"下一步可能"的资源，空闲时低优先级下载。
Vite 对入口依赖自动注入 modulepreload，对动态 import 用 `__vitePreload` 运行时预取。

**来源**：MDN — "<link rel=preload/prefetch/modulepreload>"; web.dev — "Preload, prefetch and your options"; Vite — "modulePreload"

### 7. 路由懒加载首屏切换有白屏/loading，如何优化体验？

① hover/viewport 进入时提前 `import()`（预取）；② 加载骨架屏/loading；③ `modulepreload` 提前拉依赖；④ 关键首屏路由不打异步 chunk（直接进主包），次级页才懒加载；⑤ 网络层 Service Worker 缓存 chunk。

**来源**：Vue Router — "Lazy loading routes / prefetch"; web.dev — "Speed up SPA navigation"; Create React App — "code splitting loading"

---

## 四、tree-shaking

### 8. tree-shaking 生效需要哪些前提？Vite 里怎么验证有没有 shake 成功？

前提：ESM 语法 + 依赖标记无副作用（`sideEffects: false` 或 `*.css` 例外）+ 静态可分析的 import。验证：`vite build` 后用 rollup-plugin-visualizer 看未引用代码是否被剔除；或搜索产物里是否含有某库未用的函数名。

**来源**：Webpack — "Tree Shaking / sideEffects"; Vite — "Build Optimizations / tree-shaking"; Rollup — "Tree shaking"

### 9. `sideEffects: false` 写错会有什么后果？

它告诉打包器"这个包任何 import 都不产生副作用"→ 打包器会删除"未被使用其导出"的整条 import。若包其实有副作用（如 polyfill 注入、CSS import、自注册），被误删 → 运行时功能缺失。所以只有真正无副作用的包才这么标。CSS 常需 `sideEffects: ["*.css"]` 例外保留。

**来源**：Webpack — "Tree Shaking sideEffects"; package.json — "sideEffects field"; Adam Wathan — "sideEffects false 误用"

---

## 五、体积优化实战

### 10. 发现某个第三方库打包后过大，有几种处理手段？

① 换更轻的替代品（moment→dayjs，lodash→lodash-es/ramda）；② 按需引入而非全量；③ 动态 import 延迟加载；④ external 外链到 CDN（配合 importmap 或全局变量）；⑤ 用 `patch-package`/子路径导入只取需要的模块。

**来源**：bundlephobia — "why is my bundle big"; web.dev — "Reduce JavaScript payload"; Vite — "build.rollupOptions.external"

### 11. external + CDN 外链大库有什么代价？

① 依赖 CDN 可用性（挂了全站崩）→ 需多 CDN 兜底；② 失去打包优化（版本锁、tree-shaking、hash 缓存由 CDN 决定）；③ 版本冲突（页面多处 importmap 不一致）；④ 离线/内网环境不可用。适合 echarts/three 这种超大且稳定的库。

**来源**：Vite — "Externalizing dependencies"; MDN — "import maps"; CDNs — "reliability / fallback"

---

## 六、综合场景

### 12. 首页很重、内页很轻的电商 SPA，如何设计整体分割策略？

策略：① 首屏关键路由打进入口（不做异步，避免瀑布流），配合 SSR/预渲染保 LCP；② 详情/购物车/订单等二级页 route-level 懒加载 + hover 预取；③ manualChunks 提取 framework（react/vue 稳定、长期缓存）+ UI 库 + 图表独立；④ 超大库（如商品 360 查看）动态加载；⑤ vendor 用 contenthash 长缓存，业务 chunk 频繁更新但体积小；⑥ CDN + HTTP/2 + Brotli + SW 预缓存。

**来源**：web.dev — "Content-Health / JavaScript"; Vite — "Build Optimization"; 大厂实践 — "前端性能优化 / 分包策略"（掘金/知乎）
