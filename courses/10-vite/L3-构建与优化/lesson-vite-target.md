# Target 与兼容性

> 目标：**掌握 `build.target` 的语法降级机制**、`esbuild` 转译边界、`browserslist` 与 Vite 的关系、`@vitejs/plugin-legacy` 老浏览器方案、polyfill 策略、module vs nomodule 双产物。

---

## 一、什么是 build.target

`build.target` 决定产物 JS 允许使用的**语法特性**（不是运行时 API）。默认 `'modules'`，等价于支持原生 ESM 的现代浏览器集合：

```
['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']
```

```js
build: {
  target: 'es2015',          // 降级到 ES6 语法
  target: ['chrome61'],      // 指定最低浏览器
  target: 'esnext',          // 不降级（最新特性全保留）
}
```

Vite 用 **esbuild** 做语法转译（transform），比 Babel 快很多，但——**esbuild 只做语法降级，不 polyfill 缺失的全局 API**（`Promise.allSettled`、`Array.at`、`structuredClone` 等运行时方法不会自动补）。

---

## 二、语法 vs API：两个不同的兼容问题

| 类型 | 例子 | 谁来处理 |
| --- | --- | --- |
| **语法**（syntax） | 可选链 `?.`、空值合并 `??`、class fields、async/await | esbuild（build.target）转译 |
| **API**（运行时对象/方法） | `fetch`、`Promise`、`Array.prototype.flat`、`Object.entries` | 需 polyfill（core-js） |

新手最大误区：设了 `target: 'es2015'` 就以为兼容旧浏览器——其实只降了语法。用了 `Array.prototype.at()`（ES2022 API）在旧环境仍会 `is not a function`。API 兼容必须靠 polyfill。

---

## 三、Polyfill 策略

### 3.1 手动引入 core-js

```bash
npm i core-js
```

```js
// 入口按需引入
import 'core-js/es/array/at';
import 'core-js/es/promise/all-settled';
```

或用 `@babel/preset-env` + `useBuiltIns: 'usage'` 自动按用到注入（但 Vite 默认不过 Babel，需 `vite-plugin-babel`）。

### 3.2 polyfill.io（谨慎）

外部脚本按 UA 动态返回所需 polyfill。⚠️ 2024 年发生过 polyfill.io 供应链投毒事件 → 生产慎用第三方托管，考虑自建或 core-js。

### 3.3 现代特性检测 + 渐进增强

优先用可优雅降级的写法，特性检测（`if ('IntersectionObserver' in window)`）而非浏览器嗅探。

---

## 四、browserslist 与 Vite

Vite **不直接读 browserslist 配置文件**（`.browserslistrc` / package.json `browserslist`）来做 `build.target`——那是 Babel/Autoprefixer/PostCSS 的输入。但：

- **CSS 前缀**（Autoprefixer via PostCSS）读 browserslist；
- **esbuild target** 需手动与 browserslist 对齐（或用 `browserslist-to-esbuild` 转换）；
- **Lightning CSS**（若启用）可读 browserslist 做 CSS 降级。

```bash
npm i -D browserslist-to-esbuild
```

```js
import browserslistToEsbuild from 'browserslist-to-esbuild';
export default defineConfig({
  build: { target: browserslistToEsbuild() },  // 与 .browserslistrc 对齐
});
```

---

## 五、@vitejs/plugin-legacy（老浏览器完整方案）

针对真正需要支持旧浏览器（IE / 老安卓 WebView）的场景：

```bash
npm i -D @vitejs/plugin-legacy terser
```

```js
import legacy from '@vitejs/plugin-legacy';
export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],   // 或 ['ie 11'] 若确需
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true,                 // 给现代但缺 API 的浏览器补 polyfill
      renderLegacyChunks: true,
    }),
  ],
  build: { target: 'es2015' },
});
```

它做三件事：
1. **额外生成 legacy chunk**（经 Babel 全量转译 + core-js polyfill），输出 SystemJS 格式；
2. **modern chunk** 也注入必要 polyfill（`modernPolyfills`）；
3. HTML 里用 `type="module"` + `nomodule` **双 script 标签**分发。

---

## 六、module vs nomodule 双产物

```html
<!-- 支持 ESM 的现代浏览器 -->
<script type="module">import { injectPolyfill } from "/polyfills.js"; /* ... */</script>
<link rel="modulepreload" href="/assets/index-modern.js">
<script type="module" src="/assets/index-modern.js"></script>

<!-- 不支持 type=module 的老浏览器忽略上面，执行下面 -->
<script nomodule src="/assets/index-legacy.js"></script>
```

- 支持 `<script type="module">` 的浏览器执行 modern，忽略 `nomodule`；
- 老浏览器忽略 `type="module"`，执行 `nomodule`（SystemJS 加载 ES5 产物）。

Vite 自动注入这段。代价：产物翻倍 + SystemJS 运行时开销 → 只在确需老支持时开。

### Safari legacy 的 nomodule 坑

老版 Safari 10.1 支持 `type=module` 但不支持动态 `import()` → 需条件编译 hack（Vite legacy 插件已内置处理，用 `<script>` 检测后修正）。

---

## 七、dev 与 build 的 target 差异

```js
esbuild: { target: 'es2020' },  // 开发时也做语法降级（默认 esnext）
build: { target: 'modules' },   // 构建 target
```

默认开发几乎不降级（追求速度，dev 面向现代浏览器）。若 dev 需要在旧环境调试，单独设 `esbuild.target`。构建 target 与 dev 是两套，别混淆。

---

## 八、如何确定合理的 target？

1. **看真实用户数据**（GA / 埋点）——放弃 <0.5% 的老旧浏览器；
2. 大多数现代 SPA：`target: 'es2015'` 或默认 `modules` 已足够（覆盖近 5 年设备）；
3. 需要 IE11 → 必须 plugin-legacy + 大量 polyfill，成本高，尽量规避；
4. 移动端 WebView 混雜 → 关注 Android 5/6 WebView（ES 支持差）。

> 过度降级 = 更小兼容面但更大产物 + 更慢运行（转译出大量 helper）。target 每降一档，体积上涨。

---

## 九、自检清单

- [ ] build.target 降级的是语法还是 API？
- [ ] 为什么设了 target: 'es2015' 用 Array.at 在旧浏览器仍报错？
- [ ] Vite 默认读不读 browserslist？哪些工具读？
- [ ] plugin-legacy 生成的双产物靠什么机制分发？
- [ ] modernPolyfills 和 legacy polyfill 有什么区别？
- [ ] 为什么不能无脑支持 IE11？

---

## 🚀 部署预告

- **UA 分流**：边缘（CDN/worker）按 User-Agent 决定返回 modern 还是 legacy HTML；
- **browserslist 更新**：定期 `npx browserslist@latest --update-db` 刷新 caniuse 数据；
- **IE 终止支持**：2026 年主流站点普遍放弃 IE11，target 可大胆上调 → 产物更小；
- **feature detection**：部署后监控旧浏览器的报错率（Sentry 按 UA 聚合）→ 数据驱动决定是否保留 legacy chunk。

L3 到此完成，下一关进入 **L4 插件系统**（vite-plugin-api）——深入 Vite/Rollup 插件钩子。
