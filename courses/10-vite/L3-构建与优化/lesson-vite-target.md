# Target 与兼容性

> 目标：**掌握 `build.target` 的语法降级机制**、`esbuild` 转译边界、`browserslist` 与 Vite 的关系、`@vitejs/plugin-legacy` 老浏览器方案、polyfill 策略、module vs nomodule 双产物。

---

## 一、什么是 build.target

`build.target` 决定产物 JS 允许使用的**语法特性**（不是运行时 API）。默认 `'modules'`，等价于支持原生 ESM 的现代浏览器集合：

```
['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']
```

```js
// 目的：build.target 三写法（三选一，非同时写）—决定产物允许哪些语法
build: {
  // target: 'es2015',       // ✅ 降级到 ES6 语法
  // target: ['chrome61'],   // ✅ 指定最低浏览器
  // target: 'esnext',       // ✅ 不降级（最新特性全保留）
}
// ❌ 同一个 build 对象里重复写 target 键 → 后者覆盖前者，只留最后一个生效（本例为菜单展示，实写只选一个）
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
# 目的：安装运行时 API polyfill（core-js 按需取用）
npm i core-js
```

```js
// 入口按需引入
// 目的：语法降级不补 API—缺失的运行时方法需手动引 core-js
import 'core-js/es/array/at';             // ✅ 补 Array.prototype.at
import 'core-js/es/promise/all-settled';  // ✅ 补 Promise.allSettled
// ❌ 以为 target:'es2015' 就自动补 API → esbuild 只降语法，旧环境调 .at() 仍报 Array.prototype.at is not a function
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
# 目的：安装 browserslist → esbuild target 转换器
npm i -D browserslist-to-esbuild
```

```js
// 目的：与 browserslist 对齐—Vite 不自动读 .browserslistrc，用工具把它转成 esbuild target
import browserslistToEsbuild from 'browserslist-to-esbuild';
export default defineConfig({
  build: { target: browserslistToEsbuild() },  // ✅ 与 .browserslistrc 自动对齐，免手工同步
});
// ❌ 不转→CSS 前缀按 browserslist 降级、JS 语法按 Vite 默认 modules，两边兼容目标不一致留隐患
```

---

## 五、@vitejs/plugin-legacy（老浏览器完整方案）

针对真正需要支持旧浏览器（IE / 老安卓 WebView）的场景：

```bash
# 目的：安装 legacy 插件（老浏览器完整方案，terser 供其内部压缩）
npm i -D @vitejs/plugin-legacy terser
```

```js
// 目的：plugin-legacy—额外产出 ES5 legacy chunk + SystemJS，靠 nomodule 双标签分发
import legacy from '@vitejs/plugin-legacy';
export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],   // ✅ 默认现代浏览器；确需可写 ['ie 11']
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],   // ✅ 补 async/generator 运行时
      modernPolyfills: true,                 // ✅ 给现代但缺 API 的浏览器也补
      renderLegacyChunks: true,              // ✅ 生成 legacy 产物（关了只剩 modern）
    }),
  ],
  build: { target: 'es2015' },
});
// ❌ plugin-legacy 依赖 terser 但不自带 → 未装 terser 时 build 报 terser not found
```

它做三件事：
1. **额外生成 legacy chunk**（经 Babel 全量转译 + core-js polyfill），输出 SystemJS 格式；
2. **modern chunk** 也注入必要 polyfill（`modernPolyfills`）；
3. HTML 里用 `type="module"` + `nomodule` **双 script 标签**分发。

---

## 六、module vs nomodule 双产物

```html
<!-- 目的：module/nomodule 双产物分发—现代浏览器走 type=module，老浏览器回退 nomodule -->
<!-- 支持 ESM 的现代浏览器 -->
<script type="module" src="/assets/index-modern.js"></script>   <!-- ✅ 现代浏览器执行这个 -->
<link rel="modulepreload" href="/assets/index-modern.js">

<!-- 不支持 type=module 的老浏览器忽略上面，执行下面 -->
<script nomodule src="/assets/index-legacy.js"></script>   <!-- ✅ 老浏览器只跑这条（SystemJS 加载 ES5） -->
```

> 注：`type="module"` 与 `nomodule` 互斥，浏览器只会执行其中一条。

- 支持 `<script type="module">` 的浏览器执行 modern，忽略 `nomodule`；
- 老浏览器忽略 `type="module"`，执行 `nomodule`（SystemJS 加载 ES5 产物）。

Vite 自动注入这段。代价：产物翻倍 + SystemJS 运行时开销 → 只在确需老支持时开。

### Safari legacy 的 nomodule 坑

老版 Safari 10.1 支持 `type=module` 但不支持动态 `import()` → 需条件编译 hack（Vite legacy 插件已内置处理，用 `<script>` 检测后修正）。

---

## 七、dev 与 build 的 target 差异

```js
// 目的：dev 与 build 各一套 target—开发默认 esnext 求快，构建才降级
esbuild: { target: 'es2020' },  // ✅ 开发时语法降级（默认 esnext，面向现代浏览器）
build: { target: 'modules' },   // ✅ 构建 target（与 dev 分开）
// ❌ 以为改了 build.target 就管到 dev → dev 走顶层 esbuild.target，两套独立，调试旧环境需单独设
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
