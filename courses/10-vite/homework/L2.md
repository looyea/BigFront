# L2 作业：资源处理 / CSS / 环境变量

> 覆盖：vite-assets / vite-css / vite-env

---

## 一、读代码（10 题）

### 1. 以下 import 分别返回什么？

```js
import a from './logo.png';
import b from './logo.png?raw';
import c from './logo.png?url';
```

### 2. 这个配置的作用是什么？有什么问题？

```ts
build: { assetsInlineLimit: 0 }
```

### 3. 阅读代码，构建后 Worker 文件会独立输出吗？

```js
import MyWorker from './task?worker';
const worker = new MyWorker();
```

### 4. 以下 glob 导入后 images 对象的结构是什么？

```js
const images = import.meta.glob('./img/*.png', { eager: true, import: 'default' });
```

### 5. 以下 CSS Modules 使用是否正确？如果不正确，为什么？

```js
import styles from './Button.css';  // 注意不是 .module.css
<button className={styles.primary}>
```

### 6. 以下 PostCSS 配置对 Vite 有什么影响？

```js
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

### 7. 修改 .env 里 VITE_PORT=5173 为 VITE_PORT=9999 后，不重启 dev server 会怎样？

### 8. 以下 define 配置后，产物 JS 里 `__APP_VER__` 被替换成什么？

```ts
define: { __APP_VER__: '1.0.0' }
```
（注意：没 JSON.stringify）

### 9. `loadEnv('staging', process.cwd(), '')` 加载了哪些文件？

### 10. 以下代码在生产 build 后 enableDevTools() 会被打包进去吗？

```js
if (import.meta.env.DEV) {
  enableDevTools();
}
```

---

## 二、手写（5 题）

### 1. 用 `import.meta.glob` 实现一个图片画廊组件：自动加载 `./photos/*.jpg`，eager 方式，渲染所有图片 URL。

### 2. 配置 Vite 项目使其 SCSS 全局自动注入 `@use "@/styles/variables" as *;`，并开启 CSS Modules camelCase。

### 3. 写三环境 .env 文件（dev/staging/prod）+ vite.config 读取 `VITE_API_TARGET` 配 proxy（仅 dev）。

### 4. 用 `?worker&inline` 导入一个计算密集型 Worker（累加 1-1000000），在主线程 postMessage 触发并接收结果。

### 5. 配置 `build.assetsInlineLimit` 使得 .svg < 2KB 内联、其他资源不内联。

---

## 三、场景题（1 题）

### 1. 你在 monorepo 中有两个 Vite app（admin + web），各自需要不同 API URL 和不同 theme color。如何共享 CSS variables 和 env 配置？写出方案。

---

## 四、简答题（3 题）

### 1. 为什么 Vite dev 时 CSS 通过 JS 注入而不是 `<link>`？build 时又提取为 `<link>`？这带来什么 HMR 好处？

### 2. import.meta.env 的动态拼接（如 import.meta.env['VITE_' + key]）为什么不行？替代方案？

### 3. `?raw` / `?url` / `?worker` / `?component` 这些后缀查询的共同设计思路是什么？

---

## 五、挑战题（1 题）

### 🏆 构建"Vite 资源处理实验场"

创建一个项目包含：
1. 自动导入 Markdown 文章列表（`import.meta.glob` + `?raw`），渲染为页面；
2. 图片懒加载（IntersectionObserver + import.meta.glob 非 eager）；
3. Web Worker 做 JSON 大文件解析（?worker）；
4. Tailwind + CSS Modules 共存；
5. 三环境配置 + `--mode staging` 构建。

验证 dev HMR 对每种资源类型的表现。
