# Vite 概览：No-Bundle 开发模型

> 目标：**理解 Vite 为什么快**——no-bundle dev server + 原生 ESM + esbuild 预打包 + Rollup build；掌握 `npm create vite` 创建项目；区分 dev 和 build 两套工具链。

---

## 一、Vite 是什么

Vite（法语"快"）是由 Evan You（Vue 作者）2020 年创建的**下一代前端构建工具**：
- **开发**：基于浏览器原生 ESM 的 **no-bundle dev server**（秒启动、按需编译）；
- **生产**：Rollup 全量打包 + Tree Shaking + Code Splitting（产物极致优化）。

解决了 Webpack 时代"改一行代码等 30 秒冷启动"的痛点。

---

## 二、为什么 Vite 快？双模型对比

### 2.1 Webpack（Bundle-first）

```
Startup:
  Entry → 递归解析 1000 个模块 → 全部 transform → 组装 bundle → 起 server
  耗时：10-60s（中型项目）
```

### 2.2 Vite（No-bundle）

```
Startup:
  起 server（<1s）→ 浏览器请求 index.html
  → 遇到 <script type="module" src="/src/main.ts">
  → 浏览器 import('/src/App.vue')
  → Vite 按需编译这一个文件 → 返回
  只有 node_modules 依赖：esbuild 一次性预打包（10-100ms）
```

**核心区别**：Vite dev 时**不打包**——把 bundle 推迟到 production build。

---

## 三、Dev 阶段三大支柱

| 支柱 | 工具 | 作用 |
| --- | --- | --- |
| **原生 ESM** | 浏览器 `<script type="module">` | 按需加载模块——只编译用到的 |
| **esbuild 预打包** | esbuild（Go） | 把 CJS/多文件 node_modules 打成单 ESM 文件 → 减少瀑布 |
| **HMR** | WebSocket + 模块图 | 改文件 → 精准推送变更模块 → 不刷新页面 |

---

## 四、esbuild 预打包详解

### 4.1 为什么需要预打包？

1. **CJS 兼容**：浏览器只认 ESM → lodash/vuex 等 CJS 包必须转换；
2. **减少请求瀑布**：`import { debounce } from 'lodash-es'` → lodash-es 有 600+ 文件 → 预打包成 1 个文件；
3. **ESM 路径解析**：把 `import 'pkg/sub'` 的 bare specifier 转成 `/node_modules/.vite/deps/pkg_sub.js`。

### 4.2 预打包结果缓存

产出在 `node_modules/.vite/deps/`——`optimizeDeps.entries` 检测变更 → 命中缓存秒启动。强制重打包：`--force`。

---

## 五、Build 阶段（Rollup）

Vite 6 底层 build 引擎：
- 默认 **Rollup**（成熟生态）；
- 可选 **Rolldown**（Rust 版 Rollup，Vite 7 可能切默认）—— API 兼容、快 10-30x。

Build 过程：入口 HTML → 解析依赖图 → Tree Shake → Code Split → Minify（esbuild/terser）→ 输出 `dist/`。

---

## 六、创建项目

### 6.1 手动创建

```bash
npm create vite@latest my-app -- --template vue-ts
cd my-app
npm install
npm run dev       # 开发 → http://localhost:5173
npm run build     # 生产 → dist/
npm run preview   # 预览构建产物
```

可用模板：`vue` / `vue-ts` / `react` / `react-ts` / `svelte` / `preact` / `vanilla` / `vanilla-ts` 等。

### 6.2 已有项目迁移

```bash
npm i -D vite
# package.json scripts:
# "dev": "vite"
# "build": "vite build"
# "preview": "vite preview"
```

添加 `index.html` 到项目根 → Vite 入口不再是 JS 文件而是 **HTML 文件**。

---

## 七、配置文件 vite.config.js

```js
// vite.config.js (支持 TS: vite.config.ts)
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': '/src' }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

`defineConfig` 提供 TypeScript 类型提示。

---

## 八、Vite 6 新特性

| 特性 | 说明 |
| --- | --- |
| **Environment API** | 统一 dev/build/ssr/module runner 为可插拔环境 |
| **`moduleRunnerTransport`** | SSR/Vite Node API 可在任意环境跑模块 |
| **`optimizeDeps.holdUntilClass`** | 精细控制预打包行为 |
| **`build.rollupOptions.output.entryFileNames`** 增强 | 更灵活命名 |
| **CSS `@layer` 支持** | 原生 cascade layers |
| **`import.meta.env` 类型自动补全** | `.d.ts` 自动生成 |

---

## 九、Vite vs Webpack vs Turbopack

| 维度 | Vite 6 | Webpack 5 | Turbopack |
| --- | --- | --- | --- |
| dev 启动 | <1s | 10-60s | 2-5s |
| HMR 速度 | 恒定（与项目大小无关） | 线性增长 | 恒定 |
| build 工具 | Rollup | 自研 | 自研（Rust） |
| 插件生态 | 极丰富 | 最丰富 | 有限 |
| 配置 | 约定优于配置 | 冗长 | 跟 Next 走 |
| 适用 | SPA/MPA/SSR/库 | 老项目/Module Federation | Next.js 专用 |

---

## 十、自检清单

- [ ] Vite dev 为什么不需要打包？
- [ ] esbuild 预打包解决什么问题？结果缓存在哪里？
- [ ] Vite 的 build 默认用什么引擎？
- [ ] `npm create vite` 的模板列表在哪看？
- [ ] Vite 和 Webpack 的本质区别（一句话）？

---

## 🚀 部署预告

Vite 部署极简：
```bash
npm run build   # → dist/
npx serve dist  # 本地预览
# 生产：把 dist/ 丢到任意静态托管（Netlify/Vercel/Nginx/S3/CF Pages）
```
HTML 里自动注入 contenthash 文件名 + 预加载标签。下一关 `vite-setup` 详解项目配置。
