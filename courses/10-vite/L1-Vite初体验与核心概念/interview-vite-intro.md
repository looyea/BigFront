# vite-intro 面试题精选

> 共 15 题，覆盖 **架构原理 / 工具链对比 / esbuild 预打包 / 生态定位 / 性能** 五类。

---

## 一、架构原理

### 1. 一句话解释 Vite 和 Webpack 的本质区别。

Webpack 是 **bundle-first**：启动时构建完整依赖图并打包后才能 serve；Vite 是 **no-bundle**：直接起 server，浏览器请求哪个模块就即时编译哪个——把打包推迟到 build 阶段。

**来源**：Evan You — "Vite: The next generation front-end tooling" VueConf 2019; Vite Guide — "Why Vite?"

### 2. 为什么 Vite dev 不做 bundle？bundle 有什么问题？

bundle 是 O(n)——项目越大启动越慢（Webpack 解析/编译所有模块）。Vite 利用 **浏览器原生 ESM**：import 是 lazy 的 → 没访问的模块不编译 → 启动时间恒定。代价：开发时 HTTP 请求数多（几百个模块几百个请求），HTTP/2 多路复用下这不是问题。

**来源**：Vite — "How Vite works"; web.dev — "HTTP/2 head request caching"

### 3. 为什么 Vite 生产构建还要用 Rollup（不直接输出 ESM 多文件）？

原因：① 减少 HTTP 请求数（Rollup 合并/分割 → 最优 chunk 数）；② Tree Shaking 全量分析；③ 跨 chunk 公共依赖提取；④ 老浏览器兼容（target）；⑤ 资源 hash + preload 注入。裸 ESM 多文件在 HTTP/1.1 环境下性能极差，且不能做到最优分割。

**来源**：Evan You — "Why bundle for production?"; Vite Guide — "Production Build"

---

## 二、工具链对比

### 4. Vite / Turbopack / Rspack 三者的定位？

| | Vite | Turbopack | Rspack |
| --- | --- | --- | --- |
| 出品 | VoidZero | Vercel | ByteDance |
| dev | no-bundle ESM | lazy 模块图 | bundle（但 Rust 快） |
| build | Rollup | 自研 | Webpack 兼容 |
| 生态 | 独立（插件丰富） | Next.js 专属 | 可替代 Webpack |
| 适用 | 全场景 | Next.js 项目 | 存量 Webpack 项目迁移 |

**来源**：Turbopack docs; Rspack docs — "Why Rspack?"

### 5. Vite 6 引入的 Environment API 解决了什么问题？

之前 dev/build/ssr/moduleRunner 是**四套不同内部机制**——插件作者要写四遍适配。Environment API 统一为 **可插拔环境**（`new Environment({ name: 'ssr', ... })`），每个环境有自己的 module graph + transform 链 → 插件只需 hook 环境生命周期 → SSR/Edge/Wasm 都是一种 environment。

**来源**：Vite 6 Blog — "Environment API"; Vite RFC #16057

---

## 三、esbuild 预打包

### 6. 预打包和 build 打包有什么区别？

| | 预打包 (optimizeDeps) | Build |
| --- | --- | --- |
| 阶段 | dev 启动时 | `vite build` |
| 工具 | esbuild | Rollup |
| 范围 | 只处理 node_modules | 全部（源码+依赖） |
| 目的 | 把 CJS 转 ESM / 合并小文件 | Tree Shake / Code Split / Minify |
| 输出 | `node_modules/.vite/deps/` | `dist/` |
| 缓存 | 有（命中秒启动） | 无 |

**来源**：Vite Dep Optimization guide

### 7. 什么时候需要手动配 optimizeDeps.include / exclude？

- **include**：动态 import 的 CJS 依赖（esbuild 静态分析发现不了）；
- **exclude**：link 本地开发的包（自己已 build 好 ESM → 不需要打包 → exclude 后走源码直接加载 → 改本地包代码即时生效）；
- **exclude**：monorepo 里 workspace 包（pnpm link 后 Vite 默认不打包它）。

**来源**：Vite — "optimizeDeps.include/exclude" docs

---

## 四、生态定位

### 8. Vite 只是 bundler 吗？它还能做什么？

Vite 是 **前端工具链平台**：① dev server + HMR；② build 优化；③ **Plugin Container**（可编程转换任何模块）；④ **Module Runner**（Node.js 里 import TS/Vue/任意格式）；⑤ SSR 框架基础（Nuxt/Remix/SvelteKit 底层）；⑥ Library 构建；⑦ 未来：Rolldown（统一 dev/build 为同一引擎）。

**来源**：Vite Conf 2023 — "Vite as a platform"; VoidZero 愿景

### 9. Vite 支持非 Vue 项目吗？

完全支持框架无关：React（@vitejs/plugin-react）、Svelte（@sveltejs/vite-plugin-svelte）、Solid、Preact、Angular（experimental）、Lit、vanilla TS/JS。任何 HTML+JS 项目都能用 Vite。

**来源**：Vite GitHub — "Framework Templates"; awesome-vite

---

## 五、性能

### 10. Vite 冷启动 vs Webpack 冷启动为什么快？

Webpack 5 项目 3000 个模块 → 冷启动 30s（所有模块 transform + bundle）。Vite 冷启动 <1s（起 server）+ 预打包 node_modules（esbuild 100-300ms）+ 用户访问首页 → 只编译当前路由涉及的 50-100 个模块。

**来源**：Vite benchmark issues; Webpack Performance guide

### 11. HMR 更新时 Webpack 为什么慢？Vite 怎么做到恒定速度？

Webpack HMR：重新构建**包含变更模块的 chunk**（一个 chunk 可能含 100+ 模块）→ 500ms+。Vite HMR：只重新编译**变更的那一个模块** → 通过 WS 推给浏览器 → 动态 import 替换 → 与项目大小无关（10ms）。

**来源**：Evan You — HMR design; Webpack HMR docs

### 12. 大型项目（10000+ 模块）Vite 的优势还明显吗？有什么坑？

dev 仍然快（no-bundle）。坑：① **首屏请求瀑布**——HTTP/2 下 3000 个并发 import 仍可能导致浏览器排队；② **预打包发现动态 import** → 需手动 include；③ **build 时** Rollup 本身可能慢（10000 模块 build 2-5min）→ 关注 Rolldown 迁移进度。

**来源**：Vite GitHub Discussions — "Large project optimization"

---

## 补充（新专题 13-15）

### 13.  Vite 的 dev 安全攻击面（历史 CVE）主要在哪？你的项目怎么加固？

攻击面盘点：① /@fs 与查询参数绕过系列（用 ?raw?? 之类畸形查询、双重编码绕过路径校验实现任意文件读——多个 CVE 的同一主题变奏），根因是"dev server 天生要 serve 源码"；② host 头与 allowedHosts（早期无校验被用于缓存投毒/CSRF 跳板，新版默认拦陌生 Host）；③ HMR WebSocket（恶意页面诱导连你的 ws 端口可触发热更新注入代码）；④ CI/内网里跑 vite --host 0.0.0.0 暴露调试实例（扫描器已把 5173 列为常规目标）。加固清单：dev server 永远只在 localhost/内网段，端口暴露必须过 SSH 隧道或零信任；server.fs.strict 保持默认 true 且 allow 列表收窄到 workspace 根；升级纪律把 Vite 的安全公告当 P0 依赖更新（dev 工具也是供应链）；预览用 vite preview 或静态服务器而不是"临时把 dev 暴露出去"。加分句：这道题的深层考点是"开发者工具的信任模型"——dev 期的便利（serve 源码、热更新、任意模块执行）每一项都是生产不可接受的权限，边界意识比背 CVE 编号重要。

**来源**：Vite 官方安全公告（CVE-2023-34570 任意文件读、CVE-2025-31112 等）；GHSA 公告库；InfoQ《dev server 不该是你的公网入口》

### 14.  esbuild 与 Rollup 双引擎模型给 Vite 带来过哪些"dev 正常 build 出鬼"的具体问题？Rolldown 如何收场？

双模型的裂缝逐条数：① 语义差异——esbuild 不做真正的作用域提升与跨模块优化，循环依赖处理顺序与 Rollup 不同，dev 能跑的代码 build 后行为漂移（经典：TDZ 报错只在 build 出现）；② 插件两套钩子——同一家框架插件要写 serve/build 双分支（apply 判断满天飞），transform 时机与可改范围不一致；③ 预构建产物与 Rollup 产物格式/命名对不上（CJS 依赖的 interop 差异、CSS 注入方式不同）；④ Tree-shaking 只在 build 发生，dev 里死代码照样执行（副作用型模块 dev 正常）；⑤ sourcemap 拼接质量差异导致断点行为不一致。Rolldown 收场路线：Rust 内核实现 Rollup 兼容插件钩子（一套插件两处跑）、dev 预构建与 build 共用它（保留 esbuild 做转译/压缩的角色——职责收缩为"单文件级"），以 rolldown-vite 作为可切换的过渡发行版让生态按项目迁移，最终 Vite 大版本默认切换。工程迁移注意：依赖 prebundle 行为变化要重验、少数依赖 Rollup 特定钩子的插件是最大存量阻力。加分句：统一引擎省下的不只是 bug 面，还有"插件作者心智的一半"——这句能体现你在跟踪生态整合而不是背新闻。

**来源**：Vite 官方 Rolldown 整合路线图；vite#10939（统一打包器讨论）；rolldown-vite 文档

### 15.  用 Vite 做 dev 时浏览器 Network 面板出现几十条瀑布请求，是 bug 吗？要不要管？

机制正名：dev 不打包→入口 import 图逐条揭示（浏览器发现一条 import 才发下一条），串行深度=依赖图最长链，这是"原生 ESM 按需加载"模型的固有形态而非故障。何时要管：① 深链（A→B→C…上千层）在 HTTP/1.1 或高延迟链路（远程开发机、VPN）下放大明显——HTTP/2/3 多路复用能压住并发但压不住"揭示深度"，解法是 vite-plugin 层的 warmup 预转换（server.warmup 把热点模块链提前 transform）、以及 modulepreload 在 HTML 的预发现；② 依赖图扁平化本身是架构健康度信号——入口同步 import 扇出过大说明首屏依赖没收敛。不该做的：为消灭瀑布把 dev 切到打包模式（esbuild dev 中间件类方案），牺牲 HMR 粒度换面板美观是本末倒置。诊断姿势：按 initiator 链看深度来自业务代码还是某依赖的 barrel 文件（index 全量 re-export 是瀑布放大器，也是预构建体积炸弹——与 deps-perf 关呼应）。收口句：dev 的 Network 面板是"依赖图的 X 光片"——Vite 用户应该学会读它而不是关掉它。

**来源**：Vite 官方 Why Bundling for Production；web.dev HTTP/2 连接复用实践；MDN 优先级提示
