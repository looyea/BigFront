# vite-assets 面试题精选

> 共 12 题，覆盖 **资源引用方式 / 图片优化 / Worker / glob / 后缀查询 / 构建产物** 六类。

---

## 一、资源引用方式

### 1. import 资源和 public 目录分别在什么时候用？

**import**：参与依赖图的资源（组件里的图片、CSS 里的 font-url）→ 享受 hash + Tree Shake + code-split。**public**：不参与构建的第三方资源（favicon.ico、robots.txt、SDK 脚本）→ 原样复制到 dist 根。public 里的文件**不能**通过 import 使用——路径永远写绝对 `/filename`。

**来源**：Vite Guide — "Static Assets Handling" / "The public Directory"

### 2. new URL('./img.png', import.meta.url) 和 import img 的区别？

两者最终都走 Vite 资源管线（返回 hash URL）。区别：`new URL` 是**标准 Web API**——在无 Vite 的纯 ESM 环境也能跑（但需要运行时支持）；`import` 只能被打包器处理。动态路径时 import 无法做（路径必须是字面量）→ `new URL(变量, import.meta.url)` 是逃生舱。

**来源**：Vite — "Importing Asset as URL"; MDN — "import.meta.url"

---

## 二、图片优化

### 3. Vite 能自动把 PNG 转 WebP/AVIF 吗？

不能——Vite 只做路径解析 + hash + inline。格式转换需：① `vite-plugin-imagemin`（构建时压缩）；② `<picture>` 手动写多格式；③ CDN 实时转码（imgix / Cloudflare Images）。Vite 6 不内置图片优化。

**来源**：Vite assets FAQ; vite-plugin-imagemin GitHub

### 4. assetsInlineLimit 设太小（如 100）有什么副作用？

大量小图片都变成独立文件 → HTTP 请求数暴涨 → dev 时瀑布变慢。build 后 chunk 数量也增加 → preload 列表膨胀。建议保持默认 4096（4KB）或适当调大（8KB）。

**来源**：Vite build.assetsInlineLimit docs

---

## 三、Worker

### 5. Vite 里 new Worker('./x.js', {type:'module'}) 和 ?worker import 的区别？

`new Worker` 原生语法：Vite dev 能处理但 build 时**不能** code-split worker（它只是 URL 字符串）。`?worker` import：Vite 把 worker 当**独立 entry** 用 Rollup 打包 → 有 hash + Tree Shake → build 后正常工作。生产必须用 `?worker` 或配 `build.rollupOptions` 手动包含。

**来源**：Vite — "Web Workers"; worker plugin docs

### 6. ?worker&inline 做了什么？

Worker 代码被 **base64 内联**到主 bundle → 运行时创建 Blob URL → `new Worker(blobUrl)`。优点：无额外文件/无 CORS 问题/部署简单。缺点：主 bundle 体积增加（Worker 代码大小）；不支持 source map 精准定位。

**来源**：Vite — "Importing Worker Inline"

---

## 四、glob

### 7. import.meta.glob 的构建时行为是什么？

Rollup 阶段**静态分析** glob pattern → 匹配所有文件 → 展开成显式 import 语句。`eager:true` → 生成 `import * as m0 from './a.js'` + 合并对象；`false` → 生成 `{ './a.js': () => import('./a.js') }` 映射 → 动态 import 各自独立 chunk。

**来源**：Vite — "Advanced Glob Importing"; Rollup dynamic import docs

### 8. glob 能用在非 ESM 资源上吗（如 .md）？

可以！`import.meta.glob('./docs/*.md', { query: '?raw', import: 'default', eager: true })` → 返回所有 Markdown 文件的原始文本。Vite 5+ 新增 `query`/`import` 选项控制导入方式。

**来源**：Vite — "glob import options"

---

## 五、后缀查询

### 9. ?raw / ?url / ?component / ?worker 这些叫什么？

统称 **Explicit Postfix Queries**（显式后缀查询）——在 import specifier 后加 `?xxx` 覆盖 Vite 对该扩展名的默认处理方式。如 .svg 默认是 URL → `?raw` 强制返回文本内容；`?component` 强制返回组件对象。

**来源**：Vite — "Explicit Postfix Queries"

### 10. 自定义后缀查询（如 ?inline）怎么做？

通过 **Vite 插件**的 `resolveId` + `load` 钩子：检测 `id` 结尾 `?myquery` → 自定义处理逻辑 → 返回虚拟模块。Vite 内置的 `?worker` 本质上也是这个机制（worker 插件）。

**来源**：Vite Plugin API — "resolveId" / "load"

---

## 六、构建产物

### 11. 为什么 Vite build 后 CSS 里 url('./font.woff2') 的路径能正确解析？

Vite 的 CSS 插件用 `postcss-import` + 自定义 `url()` 解析中间件 → 遇到 `url()` 转成 JS import → 走 asset pipeline → 最终 Rollup emit 资源文件 → CSS 里路径替换为 hash 后的相对/绝对路径。

**来源**：Vite — "CSS url() rewriting"; PostCSS — "postcss-url"

### 12. 如何让特定图片不参与 hash（固定文件名）？

方案：① 放 `public/` 目录（完全不走 pipeline）；② `build.rollupOptions.output.assetFileNames` 里做条件判断——指定文件名 pattern。推荐方案 ① 最简单。

**来源**：Vite — "assetFileNames"; public dir docs
