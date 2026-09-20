# 代码分割与手动分块

> 目标：**掌握 Vite 的代码分割机制**——动态 import 自动分割、`manualChunks` 手动分块策略、`modulepreload` 预加载、产物分析与体积优化。理解首屏加载性能的关键杠杆。

---

## 一、为什么要代码分割

单一大 bundle 的问题：① 首屏下载所有代码（含用户永远不会访问的页面）→ FCP/LCP 慢；② 任何改动让整个 bundle hash 变化 → 用户全量重下。

代码分割 = 把应用拆成多个按需加载的小 chunk：
- **自动分割**：动态 `import()` 产生异步 chunk；
- **公共依赖提取**：多入口共享的模块自动合并；
- **手动分割**：`manualChunks` 精确控制 vendor 分组。

---

## 二、动态 import 自动分割

```js
// 路由懒加载（Vue Router）
const routes = [
  { path: '/about', component: () => import('./views/About.vue') },
];

// 条件加载
button.addEventListener('click', async () => {
  const { heavyCalc } = await import('./utils/heavy.js');
  heavyCalc();
});
```

Rollup 遇到 `import()` → 把 `heavy.js` 及其独有依赖打成独立 chunk（如 `heavy-a1b2c3.js`），主 chunk 里只保留一个加载器。构建日志会显示：

```
dist/assets/index-f3x2.js    45.20 kB │ gzip: 16.80 kB
dist/assets/heavy-a1b2c3.js  120.50 kB │ gzip: 40.10 kB
```

### 2.1 静态资源 vs 动态 import 的变量路径

```js
// ✅ 完整字面量 → 可静态分析
import(`./locales/${lang}.json`)      // ⚠️ 动态变量，Rollup 把整个目录都打进来
// 用 import.meta.glob 更可控（见 L2）
```

`import()` 里含变量时，Rollup 无法精确 tree-shake → 会把匹配目录的所有文件纳入。尽量用 `import.meta.glob` + `{ eager: false }` 显式声明。

---

## 三、manualChunks 手动分块

### 3.1 对象式（简单）

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        charts: ['echarts', 'dayjs'],
      },
    },
  },
}
```

把指定包固定打进 `vendor.js` / `charts.js`。缺点：手动维护列表，依赖变化易漏。

### 3.2 函数式（推荐，按 node_modules 自动分组）

```js
manualChunks(id) {
  if (id.includes('node_modules')) {
    // 按包名拆分：react 相关一个 chunk，其他 UI 库一个
    if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
    if (/[\\/]node_modules[\\/](echarts|zrender)[\\/]/.test(id)) return 'echarts';
    return 'vendor';   // 其余第三方兜底
  }
}
```

### 3.3 分包的坑：循环依赖 & React 报错

把所有第三方塞进一个超大 `vendor` → 首次仍要下全部，失去按需优势。拆太细 → chunk 间相互引用可能出现"初始化顺序"问题（如 `Uncaught ReferenceError: Cannot access 'x' before initialization`）。经验：按"稳定基础设施"分组（framework / ui / utils / charts），避免跨 chunk 循环。

> Vite 5 起 `manualChunks` 遇到跨 chunk 循环引用会警告；Vite 6 提供更稳定的实验性 `advancedChunks` API（`build.rollupOptions.output.experimentalMinChunkSize` 等）。

---

## 四、modulepreload 与预加载

Vite 构建自动为动态 import 的 chunk 在 HTML 注入 `<link rel="modulepreload">`（入口依赖）；异步 chunk 被触发时，其依赖通过 `__vitePreload` helper 提前加载。

```html
<link rel="modulepreload" crossorigin href="/assets/react-vendor-x1y2.js">
<link rel="modulepreload" crossorigin href="/assets/index-a1b2.js">
```

- **modulepreload**：预取并编译 ES 模块（含执行前的 parse），比普通 preload 更适合 module；
- Vite 自动注入 `modulePreload.polyfill` 兼容不支持的浏览器；
- 路由级预取：鼠标 hover 时提前 `import()`（Vue Router `<Link>` / 手动 prefetch），点击即秒开。

```js
// hover 预取
a.addEventListener('mouseenter', () => import('./views/About.vue'));
```

---

## 五、产物分析

```bash
npm i -D rollup-plugin-visualizer
```

```js
import { visualizer } from 'rollup-plugin-visualizer';
export default defineConfig({
  plugins: [visualizer({ open: true, gzipSize: true, filename: 'stats.html' })],
});
```

`vite build` 后打开 `stats.html` → treemap 视图，一眼看出哪个依赖体积最大 → 决定：换轻量库、动态加载、还是 external 到 CDN。

推荐工具链：
- `rollup-plugin-visualizer`：体积 treemap；
- `vite-plugin-externals` / `rollup-plugin-external-globals`：把大库外链到 CDN；
- Chrome DevTools Coverage 面板：运行时未用代码检测。

---

## 六、体积优化组合拳

| 手段 | 效果 |
| --- | --- |
| 路由懒加载 | 首屏只下当前页代码 |
| manualChunks 提取 vendor | 依赖变化少 → 长期缓存命中 |
| 按需引入（lodash-es / antd） | 避免全量打包 |
| `import { x } from 'lib/es'` | ESM 深路径 tree-shake |
| external CDN | 大库不进 bundle（echarts/three） |
| 动态加载重量库 | 用到才 import |
| 关闭 sourcemap（生产） | 减产物体积 |
| Brotli 压缩（服务端） | 传输体积再降 15-20% |

### Tree-shaking 前提回顾（呼应 01-es L9）

必须 **ESM**（`import` 而非 `require`）+ 无副作用（或 package.json `"sideEffects": false`）+ 静态可分析。`import _ from 'lodash'`（CJS）无法 shake → 用 `lodash-es` + 具名 import。

---

## 七、preload / prefetch 控制

```html
<!-- 关闭某 chunk 的自动预加载 -->
<script type="module" src="/src/main.js"></script>
```

```js
build: {
  modulePreload: false,   // 完全关闭自动 modulepreload
}
```

手动 prefetch 次要资源：

```html
<link rel="prefetch" href="/assets/NextPage-y3z4.js">
```

`preload` = 当前导航关键资源高优先级；`prefetch` = 未来可能用到，空闲时低优先级。

---

## 八、自检清单

- [ ] 动态 import 和静态 import 对打包结果的影响差异？
- [ ] vendor 全塞一个 chunk vs 按包拆分，各有什么问题？
- [ ] manualChunks 函数返回同一字符串意味着什么？
- [ ] modulepreload 和普通 preload 的区别？
- [ ] 为什么 lodash 用 lodash-es 才能 tree-shake？
- [ ] 如何用 visualizer 定位体积大头？

---

## 🚀 部署预告

- **HTTP/2 / H3 多路复用**：多个小 chunk 并行下载，不再有 HTTP/1.1 6 连接限制；
- **CDN 预热**：发版后主动 push 新 hash 文件到 CDN 边缘节点；
- **长缓存分组**：framework chunk（变化少）设 `max-age=31536000`，app chunk 变化频繁但体积小；
- **Service Worker**：配合 Workbox 预缓存核心 chunk → 离线可用 + 二次访问秒开。

下一关 **vite-target** 讲解构建目标、浏览器兼容与 polyfill 策略。
