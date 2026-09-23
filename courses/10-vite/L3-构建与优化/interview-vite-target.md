# vite-target 面试题精选

> 共 15 题，覆盖 **target 语义 / 语法与API / polyfill / browserslist / legacy插件 / 双产物 / 决策** 七类。

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

---

## 补充（新专题 13-15）

### 13.  dev 能跑但 build 报语法/运行时错误，或反过来——dev 与 build 的目标解析差异会产生哪些不一致？

差异清单：① 转译目标不同轴——dev 的 esbuild transform 按"现代浏览器"（支持原生 ESM 的下限）基本不降级，build 按 build.target 降级/报错：某些新语法 dev 畅通、build 时 target 不支持直接编译失败（或更低版本浏览器运行时炸）；② 特性可用面≠语法——CSS 嵌套/@layer（css.target 独立通道）、原生 ES Module 行为差异（dev 逐模块 vs bundle 提升后的循环依赖顺序）；③ 树摇只在 build：dev 里"未引用但有副作用"的代码照样执行，build 后消失——依赖 import 副作用注册的东西（i18n locale 注册表、自定义元素定义）在 build 被摇掉是高频事故（sideEffects 配置与显式 import 是解）；④ 环境变量与 define 注入时机（dev 动态读、build 常量折叠改变可达性死代码）。防御清单：build 进 CI 的 PR 流程（不许只有 dev 验证）、target 与真实用户分布对齐（别用默认赌运气）、关键"副作用依赖"加集成冒烟（真打开 build 产物跑核心路径，preview 环境）。收口句：dev/build 双模型（引擎/树摇/目标三处不对称）是 Vite 架构选择的全部代价面——能把不对称清单讲全的人，排查这类鬼问题不会超过 20 分钟。

**来源**：Vite 官方 build.target 与 esbuild transform 差异文档；Rollup tree-shaking 副作用讨论；掘金《dev 一切正常，上线当天白屏》

### 14.  兼容降级怎么验收？给一个"低配安卓+企业老 Chrome"混合用户的 Web 项目的测试与监控方案。

三层验收：① 构建期静态保障——target 配置评审（数据定的基线）+ 产物语法扫描（检查输出 chunk 是否含超出目标引擎的语法：es-check/自定义正则扫顶层 await/可选链/类字段等，CI 门禁"语法合规"比"能编译"更严）；② 真机/仿真矩阵——云真机平台（browserstack 类）覆盖声明的最低引擎组合 + 一台真实低配安卓（性能与兼容双重信号，模拟器测不出 WebView 内核碎片）；legacy 产物要专测 nomodule 加载路径（禁 ESM 的仿真很麻烦，最直接是 legacy chunk 在支持的浏览器里直接当现代脚本跑的验证法）；③ 线上兜底与观测——首屏错误按 UA/引擎版本分维度上报（老浏览器集中爆 SyntaxError=降级失守的第一信号）、"Unsupported browser"软拦截页（特性检测而非 UA 嗅探：检测动态 import/optional chaining 等能力位决定展示升级提示）、错误平台聚合看板里"浏览器版本×错误类型"是常规巡检维度。性能与兼容常被合并决策的点：低配机降级不只是"能跑"，还有动画/长列表在其上的可接受度（与 performance 关的低端机预算合并）。收口句：兼容验收的成熟度=声明的基线有 CI 证明、有真机样本、有线上仪表——三者缺一就是在许愿。

**来源**：browserstack/Sauce 矩阵实践；Sentry 按浏览器版本分组；web.dev 旧设备测试

### 15.  库模式（library mode）的 target 与 polyfill 策略为什么必须比应用更保守？给出你的发布配置检查单。

库的 target 服务对象是"消费者的消费者"——你的 build.target 假设的是自己的用户，库该假设的是所有宿主应用的下限，且宿主往往已在自己侧做降级：库再降一遍=重复包裹与体积膨胀；行业默认：库出 ESM 现代产物（es2020 级语法可接受，让宿主的构建链做最终降级），polyfill 原则零内置（运行时依赖宿主环境——README 声明 engines/最低 Node/BOM 特性，peerDependencies 管框架依赖，BOM 级需求列清单）。检查单：① formats（es+cjs 双出兼容 Node 消费，UMD 按需）；② external 覆盖所有 peer 依赖与 node 内置（漏一个 peer 进产物=宿主双实例，框架类库最贵事故）；③ target 声明与 README 兼容表一致（CI 用 es-check 验证产物语法不超声明档）；④ CSS/资源出口策略（style.css 独立+导出路径进 exports 映射）；⑤ sideEffects 精确标记（宿主摇你时别摇坏）；⑥ engines.node + packageManager 锁定（发布链与消费链分离的声明源）。Vite 特有坑：lib entry 多入口时共享 chunk 的产物名治理（entries 与 formats=cjs 冲突时 Rollup 会报拆块——需要单 entry 或 advancedChunks 配合）。收口句："库不 polyfill、只声明"这六个字能挡掉发布后一半的兼容性工单——前提是你 README 里的声明诚实且可执行。

**来源**：Vite Build Library Mode 文档；node exports/engines 语义；pkg.exports 条件解析讨论
