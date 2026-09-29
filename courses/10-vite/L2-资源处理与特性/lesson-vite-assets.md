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
// 目的：import 图片—走 asset pipeline，开发给源路径、构建自动换成带 hash 的 URL
import heroImg from '@/assets/hero.png';
// ✅ 开发：'/src/assets/hero.png'
// ✅ 构建：'/assets/hero.3a2f1b.png'（contenthash，可 immutable 长效缓存）
// ❌ 把需 hash 缓存的图放进 public/ → 不参 pipeline/不 hash，改名不失效导致缓存错乱
```

```html
<!-- 目的：模板里引用图片的两种写法—变量绑定或直写相对路径（插件自动转 import） -->
<!-- Vue 模板里直接用（Vue SFC 编译器自动处理） -->
<img :src="heroImg" alt="Hero" />
<!-- ✅ 或直接写相对路径（@vitejs/plugin-vue 自动转 import，享 hash 优化） -->
<img src="./assets/hero.png" />
<!-- ❌ src="@/assets/x.png" 静态不转换时→浏览器把 @/ 当真实路径 404（应用 :src 绑定 import 变量） -->
```

### 2.2 小图片内联（Base64）

`build.assetsInlineLimit`（默认 4096 bytes）：小于此阈值的图片自动 base64 内联到 JS/CSS → 减少 HTTP 请求。

```ts
// 目的：小图内联阈值—小于此字节数的图自动转 base64 内联，减少 HTTP 请求
build: { assetsInlineLimit: 4096 }  // ✅ 4KB：小于则内联，大于则独立文件带 hash
// ❌ 设成超大(如 100MB) → 所有图都 base64 内联进 JS，bundle 爆炸且无法单独缓存/并发加载
```

### 2.3 SVG 处理

```bash
# 目的：安装 SVG 雪碧图插件
npm i -D vite-plugin-svg-icons
```

```ts
// 目的：SVG 三种显式后缀查询—用 ?component/?raw/?url 覆盖默认的 URL 返回行为
// 方式 1：作为组件
import SvgLogo from './logo.svg?component';  // ✅ → Vue/React 组件（可上色、内联 DOM）

// 方式 2：raw 字符串
import rawSvg from './logo.svg?raw';  // ✅ → '<svg>...</svg>' 文本（直接插innerHTML）

// 方式 3：URL（默认）
import svgUrl from './logo.svg';  // ✅ → '/assets/logo.hash.svg'（当图片 src 用）
// ❌ 小写拼错 './logo.svg?Component' → 后缀查询大小写敏感，退化成默认 URL 或报错
```

`?component` / `?raw` / `?url` 是 Vite 的**显式后缀查询**——覆盖默认行为。

---

## 三、字体

```css
/* 目的：@font-face 写相对路径—Vite 自动解析 url 并 hash，构建后变永久缓存 URL */
/* @font-face 里写相对路径 → Vite 自动解析并 hash */
@font-face {
  font-family: 'Inter';
  src: url('./fonts/Inter.woff2') format('woff2');   /* ✅ 构建后→ url('/assets/Inter.8c4d.woff2') */
}
/* ❌ 字体放 public/ 不 hash → 新版字体同名覆盖，用户旧缓存不刷看不到新字体 */
```

构建后 `url('/assets/Inter.8c4d.woff2')` → contenthash + 永久缓存。

**注意**：woff2 通常 >4KB → 不会被 inline → 独立文件。

---

## 四、JSON

```js
// 目的：JSON 直接 import—Vite 转成 export default，且支持具名导出做 Tree Shake
import data from './config.json';   // ✅ 直接拿对象（Vite 转成 export default {...}）

// ✅ 具名导入：Rollup 可只保留 version 字段，大 JSON 也能摇树
import { version } from './package.json';
// ❌ 以为 import { version } 仍会把整个 package.json 打包→实际具名导入才能 tree-shake；默认导入整对象才全量进 bundle
```

---

## 五、Web Workers

```js
// 目的：Web Worker 专用后缀—Vite 把 worker 文件单独打包，?worker/?sharedworker/?worker&inline 三种形态
// 原生 Worker 用法（手写，构建时路径不会自动处理）
const worker = new Worker('./heavy-task.js', { type: 'module' });   // ⚠️ 裸路径打包易失效，推荐下面 ?worker

// Vite 专用语法（自动处理打包）
import MyWorker from './heavy-task?worker';    // ✅ 得到一个构造器
const worker2 = new MyWorker();                // ✅ Vite 自动单独打包 worker

// Shared Worker
import SharedW from './shared?sharedworker';   // ✅ 多页共享一个 worker
const { port1 } = new SharedW();

// Inline（打进 bundle，无额外请求）
import InlineW from './task?worker&inline';    // ✅ base64 内联，免跨域/多文件
```

Vite 自动把 worker 文件单独打包（不混入主 chunk）→ 独立 hash。

---

## 六、WASM

```js
// 目的：WASM—Vite 内置支持，默认异步导入或同步(需 top-level await)
// 默认导入 async
const { instance } = await import('./add.wasm');   // ✅ 动态 import 返回带 instance 的模块
const add = instance.exports.add;                  // ✅ 从导出取函数

// 同步（需要 top-level await）
import init, { add as addSync } from './add.wasm';  // ✅ 静态导入 init 与导出
await init();                                       // ✅ 先实例化再用
```

Vite 内置 WASM 支持——无需额外插件。`assetsInclude: ['**/*.wasm']`（已默认）。

---

## 七、动态导入 glob

```js
// 目的：import.meta.glob—按 glob 批量动态导入，eager 决定是立即取值还是返回懒加载函数
// 批量导入匹配文件
const images = import.meta.glob('./assets/images/*.png', { eager: true });   // ✅ 立即求值→值为 URL 字符串
// { './assets/images/a.png': '/assets/a.hash.png', ... }

// 组件自动注册
const views = import.meta.glob('./views/**/*.vue');   // ✅ 默认懒加载→值为 () => import(...) 函数
// { './views/Home.vue': () => import('./views/Home.vue'), ... }
// ❌ glob 模式写相对路径忘了以 ./ 开头 → glob 不匹配任何文件，静默返回空对象
```

`eager: true` = 立即导入；`false`（默认）= 返回动态 import 函数。

---

## 八、assetsInclude 自定义扩展

```ts
// 目的：assetsInclude—把非标准扩展声明为静态资源，import 后返回 URL 走 asset pipeline
export default defineConfig({
  assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.glsl'],   // ✅ 这些后缀不再当 JS 解析，而是当作资源
});
// ❌ 不声明就 import model.glb → Vite 不知如何处理，报 Unknown extension/当代码解析失败
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
