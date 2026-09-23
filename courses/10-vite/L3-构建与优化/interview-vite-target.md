# vite-target 面试题精选

> 共 12 题，覆盖 **target 语义 / 语法与API / polyfill / browserslist / legacy插件 / 双产物 / 决策** 七类。

---

## 一、target 语义

### 1. Vite 的 build.target 默认值 'modules' 具体指什么？

'modules' 是一组浏览器版本的别名，表示"支持原生 ESM + 动态 import + 顶层 await + import.meta 的浏览器"，当前约为 `['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']`。因为 Vite 产物本身就是 `<script type="module">`，所以最低门槛是原生支持 ESM 的浏览器。

**来源**：Vite — "build.target / browser compatibility"; Vite — "Production Deployment (browser targets)"

### 2. 'esnext' 作为 target 会发生什么？适合什么场景？

产物保留最新语法不做任何降级 → 体积最小、构建最快，但只支持最新浏览器。适合：Electron/内部工具（环境可控）、或明确面向现代用户且监控报错率低的场景。

**来源**：Vite — "build.target esnext"; esbuild — "target option"

---

## 二、语法与 API

### 3. 转译（transpile）和 polyfill 的本质区别是什么？

转译 = 把新**语法**改写成语义等价的旧语法（编译期，纯代码变换，如 `?.` → 三元判断）；polyfill = 在运行时补齐缺失的**内置 API/对象**（如给没有 Promise 的环境注入一个 Promise 实现）。转译改的是源码写法，polyfill 补的是全局环境。一个可编译期完成，一个必须运行期注入。

**来源**：Mozilla — "Polyfills / what they are not"; MDN — "Glossary polyfill"; Babel — "polyfill vs transform"

### 4. async/await、可选链、Promise 三者分别需要转译还是 polyfill？

- async/await：既需语法转译（generator + regenerator）也需要 `Promise` 这个 API 存在；
- 可选链 `?.`：纯语法，esbuild 可直接转成等价的 `!== undefined` 判断，无需 polyfill；
- Promise：是运行时 API，需 polyfill（core-js）。
所以旧浏览器要跑 async/await，既要转语法又要补 Promise。

**来源**：MDN — "Optional chaining"; core-js — "Promise"; regenerator — "async/await"

---

## 三、Polyfill

### 5. 如何只给用户实际用到的 API 注入 polyfill（而非全量 core-js）？

用 `@babel/preset-env` 的 `useBuiltIns: 'usage'` → 按源码里用到的特性自动注入对应 core-js 模块；Vite 里通过 plugin-legacy 的 `modernPolyfills` / `additionalLegacyPolyfills`，或 Rollup 的 `rollup-plugin-polyfill-node`。全量引 core-js 会显著增大产物。

**来源**：Babel — "preset-env useBuiltIns usage"; Vite — "plugin-legacy polyfills"; core-js — "usage"

### 6. polyfill.io 事件给了前端什么教训？

2024 年 polyfill.io 域名被出售给新公司后注入恶意脚本 → 大量依赖它做 UA 动态 polyfill 的站点被投毒。教训：① 不盲目信任第三方运行时注入；② 关键基础设施应自托管（core-js 打进自己 bundle）；③ 引入的外部 script 要有 SRI（Subresource Integrity）+ 监控；④ 依赖的域名归属变化也是供应链风险。

**来源**：Wikimedia — "Incident involving polyfill.io"; Cloudflare blog — "polyfill.io compromise"; SRI MDN

---

## 四、browserslist

### 7. Vite 项目和 browserslist 是什么关系？哪些工具会用到它？

Vite 的 `build.target` 不直接消费 browserslist（用 esbuild 自己的 target 语法）。但 **Autoprefixer（PostCSS CSS 前缀）**、**@babel/preset-env**、**eslint-plugin-compat**、**Lightning CSS** 会读 browserslist。用 `browserslist-to-esbuild` 可把 browserslist 结果转成 esbuild target，保持 JS/CSS 兼容目标一致。

**来源**：browserslist npm README; Vite — "CSS / Autoprefixer"; browserslist-to-esbuild GitHub

---

## 五、plugin-legacy

### 8. @vitejs/plugin-legacy 为什么依赖 terser 而不是复用 esbuild 压缩？

legacy chunk 走的是完整的 Babel 转译链（输出 SystemJS），需要更严格/可控的压缩，且该插件在引入 esbuild minify 之前就存在，沿用 terser 保证 legacy 产物正确性。因此开 legacy 时需额外 `npm i -D terser`，构建会变慢（terser 比 esbuild 慢）。

**来源**：Vite plugin-legacy README — "requires terser"; Vite — "build.minify terser"

### 9. plugin-legacy 会给现代浏览器也加负担吗？如何控制？

产物里会多出 legacy 文件（体积增大 dist，但现代浏览器不下载 nomodule 脚本 → 运行时不加载）。现代浏览器唯一潜在开销是 `modernPolyfills`（若开启则给"现代但缺个别 API"的浏览器补 polyfill）。不设 modernPolyfills → 现代产物纯净。dist 变大 ≠ 用户下载变大。

**来源**：Vite plugin-legacy — "modernPolyfills / how legacy works"; web.dev — "nomodule cost"

---

## 六、双产物与坑

### 10. `<script nomodule>` 为什么能实现新老浏览器分流？有什么历史坑？

`nomodule` 属性：支持该属性的现代浏览器（都支持 type=module）会**跳过** nomodule 脚本；不支持 ESM 的老浏览器不认识 nomodule → 当作普通 script 执行。坑：老版 Safari 10.1 支持 type=module 但不支持动态 import，却也不认 nomodule → 会误下 legacy 又跑不了现代；需一段 inline script 检测 UA 修正（legacy 插件已内置该 workaround）。

**来源**：MDN — "script/nomodule"; HTML5Rocks — "The async function / nomodule"; Vite legacy Safari 10 fix

### 11. SystemJS 在 legacy 方案里扮演什么角色？

legacy chunk 被转成 ES5，但 ES5 没有原生模块系统 → 用 **SystemJS**（动态模块加载器 polyfill）加载这些 ES5 模块并处理 import 依赖解析/异步加载。代价是引入 ~15KB 运行时 + 更慢的模块解析。这也是开 legacy 后老浏览器体验明显差于现代的原因之一。

**来源**：SystemJS GitHub — "dynamic module loader"; Vite plugin-legacy — "SystemJS output"

---

## 七、决策与趋势

### 12. 2026 年做一个新的面向 C 端的 SPA，你会怎么定兼容策略？

① 默认 `build.target: 'modules'`（或 es2017/2018）覆盖近 5-6 年设备，放弃 IE 与极老 Android WebView；② 用真实埋点看 UA 分布，<0.5% 的浏览器不为难；③ 不默认上 plugin-legacy（成本高、收益低），仅当有政企/老旧内网需求时再针对性开；④ 用 feature detection 而非 UA 嗅探；⑤ 监控老浏览器报错率数据驱动回补；⑥ CSS 用 browserslist + Autoprefixer，JS API 需要时按需 core-js。

**来源**：caniuse — "browser usage"; web.dev — "Baseline / modern defaults"; 前端趋势 — "放弃 IE" 公告
