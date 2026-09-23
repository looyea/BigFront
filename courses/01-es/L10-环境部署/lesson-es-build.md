# 前端构建管线：从源码到上线

> 目标：**完整掌握一条现代前端构建管线**——模块打包 / 转译 / Tree Shaking / 代码分割 / CSS 处理 / 产物优化 / Source Map / 缓存策略 / CI/CD 集成。前 9 关🚀预告的知识**全部汇总落地**。

---

## 一、构建管线全景

```
src/
├── index.js          ← Entry
├── components/
├── utils/
├── styles/
├── assets/
└── ...
        │
        ▼
┌─────────────────────────────────────────────┐
│  1. Resolve   路径/exports/条件解析         │
│  2. Transform 转译（Babel/SWC/esbuild）     │
│  3. Bundle    依赖图合并 + Tree Shaking     │
│  4. Code Split 动态 import → 多 chunk      │
│  5. Optimize  minify / scope-hoist / CSS    │
│  6. Emit      输出 + contenthash + sourcemap│
└─────────────────────────────────────────────┘
        │
        ▼
dist/
├── index.3a2f1b.js
├── vendor.8c4d2e.js
├── lazy-chunk.1f9a0c.js
├── index.5e7b3d.css
├── logo.2c8f1a.svg
└── index.3a2f1b.js.map
```

### 1.1 三大构建器定位

| 工具 | 语言 | 特点 | 场景 |
| --- | --- | --- | --- |
| **Webpack 5** | JS | 生态最全 / Module Federation / loader | 企业老项目 |
| **Vite 6 (Rollup)** | JS→Go(esbuild) | no-bundle dev / 极快 HMR / 原生 ESM | 新项目 SPA/SSR |
| **Turbopack / Rspack** | Rust | Webpack 兼容 API / 10x 构建速度 | Next.js / 超大项目 |

---

## 二、Resolve（解析）

### 2.1 入口与别名

```js
// vite.config.js
export default {
  resolve: {
    alias: { '@': '/src', 'components': '/src/components' },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  }
}
```

### 2.2 exports 条件解析（L7 es-module-deep 知识）

打包器读 `node_modules/foo/package.json` → `"exports": { "import": "./esm/index.js", "require": "./cjs/index.js", "browser": "./browser.js" }` → 按当前环境选对应入口。

- Vite 默认 conditions：`['module', 'browser', 'development|production']`；
- Webpack 5 默认：`['import', 'module', 'browser', 'development|production']`。

---

## 三、Transform（转译）

### 3.1 Babel vs SWC vs esbuild

| 维度 | Babel | SWC | esbuild |
| --- | --- | --- | --- |
| 语言 | JS | Rust | Go |
| 速度 | 慢（1x） | ~70x | ~100x |
| 插件生态 | 最全 | 兼容 Babel 插件 | 极简 |
| polyfill | core-js 自动注入 | 不支持 | 按 target 语法降级，不 polyfill |

### 3.2 browserslist + 自动注入

```json
// package.json
"browserslist": ["> 0.5%", "last 2 versions", "not dead"]
```

- **Vite**：默认 esbuild 只降语法、**不 polyfill** → 需 `@vitejs/plugin-legacy` 补老浏览器；
- **Webpack + babel-loader**：`useBuiltIns: 'usage'` → 按需注入 core-js。

### 3.3 JSX / TS 转译

esbuild 内置 JSX/TS 转换——无需额外 loader；Vite 检测到 `.tsx` 自动调用 esbuild transform。

---

## 四、Bundle + Tree Shaking

### 4.1 Tree Shaking 生效前提（L7 六条军规）

1. 使用 ESM（`import/export`）；
2. 标记 `sideEffects: false`（或列出有副作用的文件）；
3. 避免顶层立即执行的副作用代码；
4. 用 `import { x } from 'lib'` 而非 `import * as lib from 'lib'`；
5. 包的 exports 入口本身 tree-shakable；
6. 生产模式才做（dev 为了 HMR 跳过）。

### 4.2 sideEffects 实战

```json
// my-lib/package.json
{
  "sideEffects": ["*.css", "./polyfill.js"]
}
```

打包器看到 `import 'my-lib/format.css'` → CSS 在 sideEffects 列表 → 保留；`import { trim } from 'my-lib'` → trim.js 不在列表 → 其他模块可被摇掉。

### 4.3 Scope Hoisting（Module Concatenation）

把多个模块**内联到一个函数作用域**——减少 IIFE 包装开销；Vite/Rollup 默认开启（`optimizeDeps`）。

---

## 五、Code Splitting（代码分割）

### 5.1 自动分割：动态 import

```js
// 路由懒加载
const Cart = () => import('./views/Cart.vue');
// Vite 自动拆出独立 chunk，按需加载
```

### 5.2 手动分割（Rollup output.manualChunks）

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['vue', 'vue-router', 'pinia'],
        charts: ['echarts'],
      }
    }
  }
}
```

### 5.3 预加载

Vite 自动给动态 chunk 注入 `<link rel="modulepreload">`——hover 时提前拉资源（配合 `<link rel="prefetch">`）。

---

## 六、CSS 处理管线

### 6.1 现代 CSS 方案

| 特性 | 处理 |
| --- | --- |
| `@import` | PostCSS 内联 |
| Nesting（CSS 原生嵌套） | PostCSS / esbuild 降级 |
| `:has()` / 容器查询 | 现代浏览器直接用 |
| Tailwind / UnoCSS | PostCSS 或 Vite 插件 |
| CSS Modules | Vite 内置（`.module.css`） |
| Scoped / :deep() | Vue SFC 编译器 |
| PurgeCSS / 未用规则 | Tailwind JIT 自带按需 |

### 6.2 Minify + 安全提取

Lightning CSS（Rust）或 cssnano（JS）——生产环境自动去注释、合并、最短化；`css.codeSplit: true` → 每个路由 chunk 带自己的 CSS。

---

## 七、产物输出与缓存策略

### 7.1 contenthash

文件名 `index.3a2f1b.js` 中 `3a2f1b` = **文件内容哈希**。内容不变 → 文件名不变 → 浏览器命中强缓存（`Cache-Control: max-age=31536000, immutable`）；内容变 → hash 变 → 文件名变 → 缓存失效。**这就是"改一行代码 → 用户不用清缓存"的底层原理**。

### 7.2 长缓存 + HTML 入口

- **JS/CSS/图片** → 带 hash → CDN 永久缓存（immutable）；
- **index.html** → `Cache-Control: no-cache` → 每次协商 → HTML 里引用最新 hash 文件名。

### 7.3 Source Map 策略

| 环境 | 设置 | 说明 |
| --- | --- | --- |
| 开发 | `sourcemap: true`（inline/cheap） | 精确到行，快速重建 |
| 预发 | `sourcemap: 'hidden'` | 生成 .map 但**不**加 `//# sourceMappingURL` 注释 → 线上不暴露源码 |
| 生产 | 上传 Sentry / Bugsnag 后删除 .map | 错误监控可反解堆栈 |

---

## 八、优化清单与指标

### 8.1 Bundle 分析

- **Vite**：`rollup-plugin-visualizer` 或 `vite-plugin-inspect`；
- **Webpack**：`webpack-bundle-analyzer`；
- 关注：① 单 chunk >500KB？拆分；② 重复打包？dedupe；③ 外部化 CDN（React/echarts）。

### 8.2 压缩 & 传输

- **JS**：Terser（变量名/死代码/条件折叠）/ esbuild minify；
- **图片**：AVIF/WebP（sharp 自动转换）；
- **文本传输**：Brotli > Gzip > 无压缩——CDN 通常自动 Brotli；
- **HTTP/2/3**：多路复用消除队头阻塞——老 "域名分片" / "合并小文件" 优化已过时。

### 8.3 核心产物指标

| 指标 | 目标 |
| --- | --- |
| JS Bundle (gzipped) | 首屏 <170 KB |
| CSS | <50 KB gzipped |
| 单张图片 | <200 KB (AVIF/WebP) |
| LCP | ≤2.5 s |
| TBT (Total Blocking Time) | ≤200 ms |
| 覆盖率 (Coverage 面板) | >70% |

---

## 九、CI/CD 集成

### 9.1 典型流水线

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run lint && npm test        # 质量门禁
      - run: npm run build                    # 产物
      - run: npx size-limit                   # bundle 大小门禁
      - uses: actions/upload-artifact         # 上传 dist/
  deploy:
    needs: build
    steps:
      - run: npx wrangler pages deploy dist   # Cloudflare Pages
      # or: vercel --prod
      # or: aws s3 sync dist/ s3://bucket --delete
      # or: rsync -avz --delete dist/ user@server:/var/www/
```

### 9.2 size-limit 门禁

```json
// package.json
"size-limit": [
  { "path": "dist/index.*.js", "limit": "170 KB" }
]
```

PR 超预算 → CI 红叉 → 阻止合并。

---

## 十、自检清单

- [ ] Tree Shaking 的六个前提是什么？
- [ ] contenthash 如何实现"永久缓存 + 即时更新"？
- [ ] 动态 import() 在打包器里做了什么？
- [ ] Vite 的 dev 和 build 用的工具链有什么不同？
- [ ] browserslist 影响哪些构建步骤？
- [ ] Source Map 在生产环境应该怎么处理？
- [ ] size-limit 在 CI 里的作用？

---

## 🚀 部署预告

本关**就是**部署管线汇总——前 9 关预告的所有工具/策略在此收口。下一关 `es-publish` 解决"你的代码 → npm 注册表 → 别人能 import" 的最后一公里。
