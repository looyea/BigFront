# Vite 静态资源处理

> 目标：**掌握 Vite 对各种静态资源（图片/SVG/字体/JSON/WASM/Worker）的处理方式**；理解 URL 引用 vs import vs public 三种模式的差异与适用场景；会配 `assetsInclude` 和自定义资源插件。

---

## 一、三种资源引用方式

| 方式 | 语法 | 处理 |
| --- | --- | --- |
| **import** | `import img from './logo.png'` | 走 Rollup pipeline → hash → tree shake → code split |
| **URL 字符串** | `new URL('./logo.png', import.meta.url)` | 同上（动态路径可用） |
| **public 目录** | `<img src="/logo.png">` | 原样复制 → 不 hash → 不 transform |

**推荐**：绝大多数用 import（享受 hash 缓存 + 构建优化）；public 只放不需要处理的（favicon/robots.txt）。

---

## 二、图片处理

### 2.1 import 方式

```js
import heroImg from '@/assets/hero.png';
// 开发：'/src/assets/hero.png'
// 构建：'/assets/hero.3a2f1b.png'  ← contenthash
```

```html
<!-- Vue 模板里直接用（Vue SFC 编译器自动处理） -->
<img :src="heroImg" alt="Hero" />
<!-- 或直接写相对路径（@vitejs/plugin-vue 自动转 import） -->
<img src="./assets/hero.png" />
```

### 2.2 小图片内联（Base64）

`build.assetsInlineLimit`（默认 4096 bytes）：小于此阈值的图片自动 base64 内联到 JS/CSS → 减少 HTTP 请求。

```ts
build: { assetsInlineLimit: 4096 }  // 4KB
```

### 2.3 SVG 处理

```bash
npm i -D vite-plugin-svg-icons
```

```ts
// 方式 1：作为组件
import SvgLogo from './logo.svg?component';  // → Vue/React 组件

// 方式 2：raw 字符串
import rawSvg from './logo.svg?raw';  // → '<svg>...</svg>' 文本

// 方式 3：URL（默认）
import svgUrl from './logo.svg';  // → '/assets/logo.hash.svg'
```

`?component` / `?raw` / `?url` 是 Vite 的**显式后缀查询**——覆盖默认行为。

---

## 三、字体

```css
/* @font-face 里写相对路径 → Vite 自动解析并 hash */
@font-face {
  font-family: 'Inter';
  src: url('./fonts/Inter.woff2') format('woff2');
}
```

构建后 `url('/assets/Inter.8c4d.woff2')` → contenthash + 永久缓存。

**注意**：woff2 通常 >4KB → 不会被 inline → 独立文件。

---

## 四、JSON

```js
import data from './config.json';  // 直接拿对象
// Vite 转成 export default {...}
```

**按需 Tree Shake**：JSON 的**具名导出**（Vite 支持）：
```js
import { version } from './package.json';
// Rollup 可以只保留 version 字段
```

---

## 五、Web Workers

```js
// 原生 Worker 用法
const worker = new Worker('./heavy-task.js', { type: 'module' });

// Vite 专用语法（自动处理打包）
import MyWorker from './heavy-task?worker';
const worker = new MyWorker();

// Shared Worker
import SharedW from './shared?sharedworker';
const { port1 } = new SharedW();

// Inline（打进 bundle，无额外请求）
import InlineW from './task?worker&inline';
```

Vite 自动把 worker 文件单独打包（不混入主 chunk）→ 独立 hash。

---

## 六、WASM

```js
// 默认导入 async
const { instance } = await import('./add.wasm');
const add = instance.exports.add;

// 同步（需要 top-level await）
import init, { add } from './add.wasm';
await init();
```

Vite 内置 WASM 支持——无需额外插件。`assetsInclude: ['**/*.wasm']`（已默认）。

---

## 七、动态导入 glob

```js
// 批量导入匹配文件
const images = import.meta.glob('./assets/images/*.png', { eager: true });
// { './assets/images/a.png': '/assets/a.hash.png', ... }

// 组件自动注册
const views = import.meta.glob('./views/**/*.vue');
// { './views/Home.vue': () => import('./views/Home.vue'), ... }  ← lazy
```

`eager: true` = 立即导入；`false`（默认）= 返回动态 import 函数。

---

## 八、assetsInclude 自定义扩展

```ts
export default defineConfig({
  assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.glsl'],
});
```

告诉 Vite 这些扩展是"静态资源"→ import 后返回 URL → 走 asset pipeline。

---

## 九、?raw / ?url / 默认 后缀对比

| 写法 | 返回值 | 场景 |
| --- | --- | --- |
| `import x from './a.csv'` | URL 字符串 | 正常资源引用 |
| `import x from './a.csv?raw'` | 文件内容文本 | 需要解析 CSV |
| `import x from './a.csv?url'` | URL（强制，不 inline） | 需要 URL + 确定不被 base64 |

---

## 十、自检清单

- [ ] import 图片和 public 图片的核心区别？
- [ ] assetsInlineLimit 的作用？设太小会怎样？
- [ ] `?raw` 后缀能用在 .png 上吗？返回什么？
- [ ] `import.meta.glob` 的 eager 选项区别？
- [ ] Web Worker 为什么要 `?worker` 后缀？

---

## 🚀 部署预告

- **图片 CDN**：`base` 指向 CDN → import 的 hash 文件名自动走 CDN URL；
- **Worker 跨域**：inline worker 避免 CORS 问题（打进主 bundle）；
- **大资源分桶**：`assetFileNames: (info) => info.name.includes('.glb') ? 'models/[name].[hash][extname]' : 'assets/[name].[hash][extname]'`。

下一关 `vite-css` 讲 CSS 处理管线。
