# L1 作业：Vite 初体验 / 配置 / HMR

> 覆盖：vite-intro / vite-setup / vite-hmr

---

## 一、读代码（10 题）

### 1. 分析启动耗时差异：为什么 Webpack 项目冷启动 25s，Vite 只需 0.3s？

```
Webpack:  entry → resolve 3000 modules → babel transform all → bundle → start server
Vite:     start server → optimizeDeps (esbuild, 200ms) → wait for browser requests → transform on-demand
```

### 2. 以下 vite.config 部署到 GitHub Pages（子仓库名 my-site），有什么错？

```js
export default defineConfig({
  base: '/my-site',
  build: { outDir: 'docs' }
});
```

### 3. 这个 .env 文件里，前端代码能访问哪些变量？

```bash
# .env
VITE_API_URL=https://api.example.com
VITE_DEBUG=true
DATABASE_URL=postgres://user:pass@localhost/db
JWT_SECRET=abc123
```

### 4. 以下 proxy 配置后，前端请求 `/api/users?page=1` 实际转发到后端的完整 URL 是什么？

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api/, '/v2')
    }
  }
}
```

### 5. 阅读 HMR 代码，修改 count.js 后浏览器会刷新整页还是热更新？

```js
// count.js
export let count = 0;
export function inc() { count++; }
// 没有 import.meta.hot.accept()
```
```js
// main.js
import { count, inc } from './count.js';
// 也没有 accept
```

### 6. 以下预打包结果缓存命中/失效的判断依据是什么？

```bash
# vite dev 输出
  vite:deps cache invalidated because: lockfile changed
```

### 7. `define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version) }` 在产物中是什么效果？

### 8. Vite 项目 `npm run build` 后，dist/index.html 里有 `<script type="module" crossorigin src="./assets/index.3a2f.js">`，其中 `crossorigin` 是干什么的？

### 9. 以下模块变更后 Vite 发什么 HMR 消息？

```
修改 src/styles/theme.css （@import './variables.css'）
```
（假设无插件声明 CSS 的 accept）

### 10. `import.meta.env.PROD` 和 `process.env.NODE_ENV === 'production'` 的区别？

---

## 二、手写（5 题）

### 1. 创建一个 Vite + Vue 3 + TypeScript 项目：
- 配置 alias `@` → `./src`；
- 配置 proxy `/api` → `http://localhost:3001`；
- 设置 `base: '/my-app/'`；
- `.env` 配置 `VITE_API_URL`，在组件中用 `import.meta.env` 访问。

### 2. 给一个纯 JS 模块（无框架）手写 HMR 逻辑：
该模块导出一个 `timer` 对象（每 1s console.log），要求修改此文件后热更新不丢 count、且旧定时器被清除。

### 3. 配置 Library 模式：
入口 `src/index.ts`，输出 ESM + UMD 两种格式，外部化 `vue`，输出目录 `lib/`。

### 4. 配 MPA：3 个 HTML 入口（index.html / about.html / admin/index.html），共享 `src/shared.js` 自动提为公共 chunk。

### 5. 用 `--debug hmr` 启动 Vite，修改一个组件文件，把终端输出的 HMR 决策日志截图或粘贴（分析它为什么选择 hot-update vs full-reload）。

---

## 三、场景题（1 题）

### 1. 你在一个 100+ 页面的 MPA 项目（从 Webpack 迁移到 Vite），发现 dev 首屏加载 800 个并发 ESM 请求导致 3s 白屏。如何优化？（列出 3 种方案）

---

## 四、简答题（3 题）

### 1. 解释 Vite 的 no-bundle 模型为什么需要 esbuild 预打包才能工作——不预打包会怎样？

### 2. `import.meta.hot` 在生产构建后被处理成什么？为什么产物里没有 WS 连接代码？

### 3. Vite 6 的 Environment API 统一了什么？对插件开发者有什么好处？

---

## 五、挑战题（1 题）

### 🏆 自定义 Vite 插件实现 Markdown HMR

要求：
1. 写一个 Vite 插件 `vite-plugin-md-hmr`；
2. `import content from './README.md'` 返回编译后 HTML；
3. 修改 `.md` 文件时通过 HMR 推送更新（不刷新整页）；
4. 在 demo 项目中验证热更新效果；
5. 写出插件的 `transform` + `handleHotUpdate` 代码。
