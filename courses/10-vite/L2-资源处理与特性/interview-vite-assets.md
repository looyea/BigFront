# vite-assets 面试题精选

> 共 15 题，覆盖 **资源引用方式 / 图片优化 / Worker / glob / 后缀查询 / 构建产物** 六类。

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

---

## 补充（新专题 13-15）

### 13.  图标体系（几十上百个 SVG）在 Vite 项目里怎么组织才兼顾体积、按需与可维护？

候选拓扑比较：① 逐文件 ?component 化（SVG→组件）——按需树摇最好、可 currentColor，代价是仓库脏（几十个 .svg 各自 import）；② 图标库+unplugin-icons（编译期把 iconify 集合按需实例化为组件）——体积与开发体验双优，锁定图标源依赖；③ 自制 sprite（<symbol>+<use href>）——一次请求全量、失去内联着色灵活性且 hash 失效粒度粗（改一个图标全量缓存作废）；④ icon font——过时方案（渲染模糊/无障碍差/全量加载），新项目排除。Vite 特性利用：import.meta.glob 把本地 svg 目录懒实例化为组件映射表（自研图标系统的基建）；?raw+DOMPurify 处理运营上传的 SVG（富文本图标要消毒）。治理面：命名与 viewBox 规范进 CI 校验（lint 脚本检 viewBox 缺失——尺寸错乱头号来源）、未引用图标周期扫描（glob 表与实际 import diff）、设计侧交付单一可信源（Figma 插件直出组件目录）。收口句：图标是"数量大、体积敏感、高频改"的特殊资产集——按资产管线思路（构建期批处理+独立缓存）而不是随手 import 处理。

**来源**：Vite 官方静态资产处理；unplugin-icons 文档；InfoQ《图标库从雪碧图到组件化的三次搬家》

### 14.  字体资产（woff2、可变字体）的加载策略在 Vite 里怎么设计？font-display、hash 与 FOIT/FOUT 的取舍。

Vite 管线内：CSS 里 url(./font.woff2) 的字体进资源图（hash+重写，小文件不受 inline 阈值影响字体通常远大于 4KB——别担心被内联进 CSS 反而坏缓存），font-face 的 unicode-range 分片（中文字体 subsets）配合构建期生成（cn-font-split 类工具）。加载策略：font-display: swap 默认候选（FOUT 快速可读，重排抖动靠 size-adjust/descent-override 的本地回退度量对齐压住）；品牌标题字体用 optional 或预加载+document.fonts.ready 门控显隐；关键请求预载：@font-face 声明在 CSS、CSS 在 HTML 之后发现，首屏字体请求晚两拍——把最关键的字体 link rel=preload 进 HTML（hash 名会破静态 preload：解法是固定文件名牺牲 hash（字体年改几次）或构建期 manifest 注入）。坑位：可变字体体积（全轴 vs 静态多文件按用量选）、子集化的字符覆盖回归（新增文案字符掉出子集=回退字体混排——CI 里用文案全集对子集做覆盖断言）、SSR 的 link 预载与流式 HTML 顺序。加分句：字体是"体验敏感型资产"——它优化的终点不是体积而是 CLS 与可读时刻，说得出 size-adjust 度量对齐的人极少，这题的加分区。

**来源**：MDN font-display；web.dev 字体优化指南；Vite 资源 URL 重写讨论

### 15.  大文件（视频、模型权重、地图数据）不该进构建管线的理由与正确的分发姿势？

不进管线的三重理由：① hash 化让"内容变→全量作废"与大文件天然低频变更矛盾（改一次几 MB 缓存清零重下）；② 构建期搬运（复制/内联判定/产物扫描）的时间与磁盘成本随体积线性涨；③ 缺失协议能力——管线产物是静态 GET，而大文件要 Range 断点、限速、预签名轮换。正确姿势：对象存储/CDN 直分发（版本目录或 manifest 寻址），前端拿 URL 的通道按"可配置程度"选：env 注入基地址（构建期常量）、配置接口下发（运行时可调）、import.meta.resolve 风格的服务层封装；管线内只留"引用登记"（一个小 JSON 清单进 hash，内容不进）。访问控制：签名 URL 短时有效（防转发）、Range+缓存层对 CDN 的透传配置（否则断点续传在边缘被拆）。特殊场景：WebGPU/onnx 模型配 Cache API 预取与配额管理（用户可感知的"下载中"进度）、视频用 <video src> 直链（别进 JS）。收口句：判断标准是"这文件是代码依赖的资源，还是运行时数据"——前者进管线要 hash 保正确，后者进管线只带来成本。

**来源**：Vite 官方 Assets；HTTP Range 与 CDN 大文件分发实践；知乎《我们把 3D 模型打进 bundle 之后》
