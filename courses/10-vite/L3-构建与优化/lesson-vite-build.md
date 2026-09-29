# 生产构建配置

> 目标：**掌握 `vite build` 的完整配置项**——输出目录、资源内联阈值、Source Map、压缩器选型（esbuild vs Terser）、CSS 代码分割、Rollup 选项自定义。理解 Vite 生产构建与开发模式的差异。

---

## 一、从 dev 到 build：模型切换

回忆 L1 讲过的双模型：

- **开发**：no-bundle，浏览器原生 ESM 按需请求每个模块；
- **构建**：`vite build` 调用 **Rollup**，把所有模块打包成少量静态资源（bundle + tree-shaking + minify）。

```bash
# 目的：构建命令—默认读 .env.production，--mode 可切到自定义环境
vite build            # ✅ 读 .env.production，mode=production
vite build --mode staging   # ✅ 改读 .env.staging
# ❌ 误用 vite（不带 build）→ 起的是 dev server（no-bundle），不会产出 dist/
```

构建入口默认是项目根 `index.html`（不是 JS 文件！）——Vite 以 HTML 为起点解析 `<script type="module">`、`<link>` 依赖，递归构建模块图。这是 Vite 与 Webpack 的关键差异：**HTML 优先**。

---

## 二、build 核心配置项

```js
// vite.config.js
// 目的：build 核心配置项全景—产出目录/缓存/压缩/拆分一站式控制
export default defineConfig({
  build: {
    outDir: 'dist',              // ✅ 输出目录
    assetsDir: 'assets',         // ✅ 静态资源子目录
    emptyOutDir: true,           // ✅ 构建前清空 outDir（root 外需显式置 true 防误删）
    sourcemap: true,             // ✅ true | 'inline' | 'hidden'
    target: 'es2015',            // ✅ 语法降级目标（下一关详解）
    cssCodeSplit: true,          // ✅ CSS 按 chunk 拆分
    assetsInlineLimit: 4096,     // ✅ <4KB 资源内联为 base64
    minify: 'esbuild',           // ✅ 'esbuild' | 'terser' | false
    chunkSizeWarningLimit: 500,  // ✅ chunk 超 500KB 告警
    modulePreload: { polyfill: true },   // ✅ 为 <link rel=modulepreload> 注入 polyfill
    copyPublicDir: true,         // ✅ 是否拷贝 public/
    ssr: false,                  // ✅ 库/SSR 构建模式
    manifest: false,             // ✅ 生成 .vite/manifest.json（SSR/后端模板需要）
    reportCompressedSize: true,  // ✅ 构建日志显示 gzip 大小
  },
});
// ❌ outDir 指到项目 root 外（如 ../www）却不写 emptyOutDir:true → Vite 拒绝清空并告警，旧残留与新产物混在一起
```

### 2.1 outDir 与 emptyOutDir

`outDir` 若在项目 root 之外，Vite 会警告并要求 `emptyOutDir: true` 显式确认才清空——防止误删系统目录。多环境构建可 `outDir: 'dist/staging'`。

### 2.2 assetsInlineLimit

小于该阈值（字节）的图片/字体在构建时内联成 `data:` base64 URL，减少 HTTP 请求数。默认 4096（4KB）。经验：小图标内联、大图保持独立文件（利于缓存 + base64 体积膨胀 ~33%）。

---

## 三、Source Map 三态

| 值 | 产物 | 适用 |
| --- | --- | --- |
| `false` | 无 map | 生产（最安全，不暴露源码） |
| `'true'` | `app.js` + `app.js.map`，JS 末尾有 `//# sourceMappingURL` | 预发（DevTools 可下载 map） |
| `'inline'` | map 内联进 JS（单个大文件） | 调试特殊环境 |
| `'hidden'` | 生成 `.map` 但 JS 里**不写**引用注释 | **生产推荐**：用户上传 map 到 Sentry，但不随 JS 暴露给用户 |

```js
// 目的：按模式选 sourcemap—生产用 hidden 上传 Sentry 而不向用户暴露源码
build: { sourcemap: mode === 'production' ? 'hidden' : true }   // ✅ 生产出 .map 但 JS 不写引用注释
// ❌ 生产直接 sourcemap:true → map 随 JS 公开可下载，等于把源码曝给所有人
```

Sentry 上传：`sentry-cli upload-dif --bundle-sourcemap url ./dist/**/*.map`，然后从公开产物删除 map。

---

## 四、压缩：esbuild vs Terser

Vite 默认用 **esbuild**（Go 编写）做 minify，比 Terser（JS）快 20-40 倍。

```js
// 目的：切 Terser 做精细控制—需 drop_console/混淆属性时才换（代价是构建变慢）
build: {
  minify: 'terser',                // ✅ 默认 esbuild 不够用时才显式切 terser
  terserOptions: {
    compress: {
      drop_console: true,     // ✅ 移除所有 console.*
      drop_debugger: true,    // ✅ 移除 debugger
      pure_funcs: ['console.log'],  // ✅ 只移除 console.log
    },
    mangle: { properties: { regex: /^_internal/ } },  // ✅ 混淆 _internal 前缀属性
  },
}
// ❌ 只为删 console 就切 terser → 构建时间暴涨；esbuild 用 esbuild.drop:['console','debugger'] 就能快处理
```

- **esbuild**：默认、极快、支持 `drop`（`esbuild.drop = ['console','debugger']` Vite5+）。
- **terser**：更细粒度控制、支持注释保留/法律头 `comment_filter`、Legacy。切换后构建变慢。
- `minify: false`：仅分析/调试产物结构。

移除 console 的替代方案：`define: { 'console.log': 'void 0' }`（不推荐，脆弱）。

---

## 五、CSS 代码分割 cssCodeSplit

- `true`（默认）：每个异步 chunk 的 CSS 单独输出，配合懒加载按需注入 `<link>` → 首屏 CSS 更小。
- `false`：所有 CSS 合并到一个文件 → 适合首屏即需全部样式的场景，或某些后端模板集成。

```js
// 目的：css 配置—开发 sourcemap + 全局变量注入 + 指定 postcss + 选择转换器
css: {
  devSourcemap: true,        // ✅ 开发时 CSS 定位到源文件
  preprocessorOptions: { scss: { additionalData: `@use "@/styles/vars.scss" as *;` } },
  postcss: './postcss.config.cjs',   // ✅ 显式指定 postcss 配置路径
  transformer: 'postcss',    // ✅ 'postcss' | 'lightningcss'
}
```

Vite 5.4+ 支持用 **Lightning CSS**（Rust）替代 PostCSS + esbuild 做压缩，构建更快且能降级浏览器目标：

```js
// 目的：Lightning CSS—用 Rust 一次完成处理+压缩，比 PostCSS+esbuild 更快且能降级目标
css: { transformer: 'lightningcss', lightningcss: { errorRecovery: true } },   // ✅ errorRecovery 容错不中断
build: { cssMinify: 'lightningcss' },   // ✅ CSS 压缩也交给 lightningcss
```

---

## 六、自定义 Rollup 选项

Vite 构建底层是 Rollup，`build.rollupOptions` 可穿透配置：

```js
// 目的：自定义 Rollup 选项—穿透配多入口/产物命名/拆包/外部依赖/库模式
build: {
  rollupOptions: {
    input: { main: resolve(__dirname, 'index.html'), admin: resolve(__dirname, 'admin.html') },  // ✅ 多页入口
    output: {
      entryFileNames: 'js/[name].[hash].js',       // ✅ 产物命名（利于长缓存）
      chunkFileNames: 'js/[name]-[hash].js',
      assetFileNames: 'assets/[name].[hash][extname]',
      manualChunks: { vendor: ['react', 'react-dom'] },  // ✅ 把大依赖拆稳定 vendor（下一关详解）
    },
    external: ['lodash-es'],   // ✅ 排除依赖（库模式常用，不打入产物）
  },
  commonjsOptions: { include: [/node_modules/] },  // ✅ CJS→ESM 转换范围
  dynamicImportVarsOptions: {},                    // ✅ 动态 import 变量模式的处理
  lib: { entry: 'src/index.ts', name: 'MyLib', formats: ['es','cjs'], fileName: 'my-lib' },  // ✅ 库模式
}
// ❌ 普通应用（非库）却设了 external:['lodash-es'] → import lodash-es 不被打包也不提供，运行时模块缺失报错
```

### 6.1 产物哈希与缓存

`[hash]` 基于文件内容 → 内容不变则文件名不变 → CDN/浏览器可 `Cache-Control: immutable` 长缓存。`[name].[hash]` 命名让每次发版只有变动文件哈希变化 → 用户增量下载。这是 L9（01-es）讲过的 contenthash 缓存策略在 Vite 里的落地。

### 6.2 reportCompressedSize

构建时计算每个 chunk 的 gzip 大小并打印，方便快速发现超大依赖。若构建很慢（大量 chunk）可 `reportCompressedSize: false` 提速。

---

## 七、多页面应用（MPA）

```js
// 目的：多页应用 MPA—多个 HTML 各为独立入口，共享模块自动提取
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),    // ✅ 主页入口
      about: resolve(__dirname, 'about.html'),   // ✅ 第二入口
    },
  },
}
// ❌ 新增 HTML 忘登记进 input → build 不编译它，dev 能访问 /about.html 但上线后是未处理原始页
```

每个 HTML 是独立入口，共享模块自动提取。dev 时通过 `/about.html` 访问。

---

## 八、构建调优实战

```js
// 目的：一套生产构建调优模板—hidden sourcemap + esbuild 压缩 + 按包名自动拆 vendor
export default defineConfig(({ mode }) => ({
  build: {
    target: 'es2018',                                       // ✅ 兼容目标
    sourcemap: mode === 'production' ? 'hidden' : true,     // ✅ 生产不外泄源码
    minify: 'esbuild',                                       // ✅ 快压缩
    reportCompressedSize: false,                             // ✅ 关 gzip 报告提速
    rollupOptions: {
      output: {
        manualChunks(id) {         // ✅ 见下一关：把 node_modules 按包名拆块
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();   // ✅ 取包名作 chunk 名
          }
        },
      },
    },
  },
}));
// ❌ manualChunks 按包拆得过细（每个小依赖一个 chunk）→ 上百个并发小请求、总性能反而变差
```

**构建慢排查**：① `--debug` 看插件耗时；② 减少 sourcemap；③ minify 用 esbuild；④ 依赖预构（optimizeDeps）不影响 build 但影响 dev；⑤ 大型项目开 `build.chunkSizeWarningLimit` 调高或真正分包。

---

## 九、自检清单

- [ ] Vite 的构建入口为什么是 HTML 而不是 JS？
- [ ] `sourcemap: 'hidden'` 解决了什么矛盾？
- [ ] 什么时候需要切换到 Terser 而不是 esbuild？
- [ ] `cssCodeSplit` 关掉后首屏会发生什么？
- [ ] `[hash]` 文件命名如何配合 CDN 长缓存？
- [ ] `emptyOutDir` 的安全机制是什么？

---

## 🚀 部署预告

- **产物即静态**：`dist/` 可托管到任意 CDN / Nginx / OSS / Vercel——无需 Node 运行时；
- **缓存策略**：带 hash 的 JS/CSS → `Cache-Control: max-age=31536000, immutable`；index.html → `no-cache`（保证发版即生效）；
- **base 配置**：部署到子路径（如 `/app/`）需设 `base: '/app/'`，否则资源 404；
- **Sentry**：`sourcemap: 'hidden'` + CI 上传 map 后删除。

下一关 **vite-splitting** 深入代码分割与 manualChunks 手动分块。
