# vite-ci-perf 面试题精选

> 共 12 题，覆盖 CI 缓存分层 / Turbo 任务图 / 构建提速 / 预算门禁 / 线上度量 五类。

---

## 一、CI 缓存分层

### 1. 一条前端 CI 流水线，时间一般花在哪？你的缓存策略分层？

大头依次：装依赖、构建、测试。对应三层缓存：①包管理器 store（lockfile 哈希为 key，setup-node/pnpm cache）；②任务级（Turbo/Nx：输入+上游+env 哈希，命中回放 dist）；③工具内（node_modules/.vite、cacheDir）。**顺序先量耗时账**：装包 30 秒就别为它建缓存（呼应 vite-ci-perf 第一节）。

**来源**：GitHub Actions caching 文档；CI 优化通识

### 2. 缓存 key 里的 hashFiles 应该包含什么？漏了配置文件的后果？

lockfile 必含；构建配置（vite.config/turbo.json/tsconfig）按缓存对象而定。漏 lockfile：依赖变了照用旧 store——**构建用了错版本还绿灯**；漏配置：产物缓存永不失效，改了 minify 配置发布的还是老包。**缓存事故的共同根因：key 没覆盖影响产物的全部输入**（呼应 vite-ci-perf 第一、二节）。

**来源**：CI 缓存失效事故通识（invalidation 是 CS 两大难题）

---

## 二、Turbo 任务图

### 3. Turbo 的缓存 key 由哪些要素构成？dependsOn: ['^build'] 是什么意思？

key = 本任务声明的 inputs 文件哈希 + 依赖任务的哈希 + 环境变量（白名单）+ 平台。`^build` = "所有上游依赖包的 build 先完成"（^ 指依赖图上游）——monorepo 里 ui 包没 build 出 dist，app 包构建必然失败或读旧产物。任务图+哈希共同保证：**任何会影响产物的改动都会反映为 miss**（呼应 vite-ci-perf 第二节、vite-deploy）。

**来源**：Turbo 文档 — "Caching / task graph"

### 4. Remote Cache 值不值得搭？给判断依据。

收益模型：本地/CI 双向回放——开发者 `turbo build` 过的任务 CI 直接命中（反之亦然），团队越大、包越多、机器差异越大收益越高。判断三问：①构建/测试总时长 × 每日流水线次数是否让你心疼；②任务 outputs 声明是否规范（垃圾进垃圾出）；③有没有存放点（Vercel 免费层/自建 S3 兼容端点）。三问皆 yes 就上，个人小项目不必（呼应 vite-ci-perf 第二节）。

**来源**：Turbo — "Remote Caching"

---

## 三、构建提速

### 5. Vite 构建时间的钱花在哪几处？每处一颗可拧的螺丝。

①依赖解析与模块加载（重复版本/散装依赖→依赖治理）；②transform（TS/JSX 编译——esbuild 已快，target 设高免多余转译）；③chunk 图与 tree-shaking（模块数线性相关，manualChunks 别过度拆分）；④压缩与 size 报告（minify:'esbuild'、reportCompressedSize:false）；⑤sourcemap（预览环境直接 false）（呼应 vite-ci-perf 第三节、vite-build、vite-splitting）。

**来源**：Vite build 性能议题；Rolldown 动机分享同源

### 6. sourcemap 的 true/false/'hidden' 三种策略分别用在哪？

false：预览/开发构建（省时间，本来就有 devtools 源文件）；true：内部系统（浏览器可直接调试）；**'hidden'**：公网生产——map 文件生成并上传错误监控（Sentry），但不留 `//# sourceMappingURL` 注释，用户 404 拿不到源码、告警堆栈却符号化。加料：map 的密钥纪律（源码泄露面）（呼应 vite-ci-perf 第三节、exp-security）。

**来源**：Vite — "build.sourcemap"；Sentry 上传实践

---

## 四、预算门禁

### 7. bundle 预算怎么定数？谁来背"以后都得低于这个数"？

定数法：从**性能目标反推**——目标网络环境（如 4G）与 LCP 预算，扣除 HTML/CSS/图片份额，剩给 JS 的字节数按包型拆分（首屏 chunk/路由块/vendor）；工具落 size-limit/bundlestats 进 CI，超阈值 fail。**背锅机制**：预算进 ADR/性能章程，调预算需性能数据评审——不写明就没人背（呼应 vite-ci-perf 第四节、vite-splitting）。

**来源**：performance budget 通识（Firefox/Google 实践）；size-limit 文档

### 8. PR 里怎么把"体积变化"讲到人能看懂？

三件套：①产物 diff 机器人（bundlestats 类）列每个 chunk 的 ±KB；②归因链接（哪个依赖/文件涨的，source map 或 rollup-plugin-visualizer 数据支撑）；③阈值分级：>50KB warn、>150KB block——避免"每次都红就没人看了"的告警疲劳（呼应 vite-ci-perf 第四节）。

**来源**：bundle diff 工具实践（bundlestats/size-limit CI 模式）

---

## 五、线上度量

### 9. Lab 数据与 Field 数据各是什么？为什么两条腿缺一不可？

Lab：受控环境跑出来的（Lighthouse CI/WebPageTest）——可比、防回退，但不是真实用户体验分布；Field（RUM）：真实用户的 web-vitals 上报（分位数 p75 看）——有设备/网络/地域方差，才反映真相。**Lab 拦回退、Field 定基线与发现长尾**：只在 Lab 优化的项目常出现"分数没跌用户骂声变多"（呼应 vite-ci-perf 第五节）。

**来源**：web.dev — "Lab vs field data"；CrUX 模型

### 10. INP 为什么取代了 FID？它对前端工程提出了什么新要求？

FID 只测"首次输入到下一帧"的延迟起点、一次性且不反映交互处理成本；INP 覆盖**整个会话中所有交互**的输入→处理→下一帧渲染，取最差近似（p98）——直接惩罚长任务。新要求：事件处理器里的大计算要拆分/让路（scheduler.yield/`setTimeout(0)` 分片思想）、React 侧并发特性、Svelte/Vue 侧控制响应式更新的同步成本——性能课的执行端在交互里（呼应 vite-ci-perf 第五节、react-performance、svelte-performance）。

**来源**：web.dev — "INP 取代 FID" 官方说明

### 11. web-vitals 上报为什么用 sendBeacon 而不是 fetch？

页面卸载时序：点击链接/关闭标签时 `fetch` 的 in-flight 请求会被杀掉（keepalive 可救但有体积限），`navigator.sendBeacon` 交由浏览器在卸载后异步低优先级投递、不阻塞卸载。工程细节：POST 字节上限（64KB）、重试语义无——打点协议要能容忍丢包（呼应 vite-ci-perf 第五节、01-es 网络课）。

**来源**：MDN — sendBeacon；web-vitals 官方推荐

---

## 六、终题综合

### 12. 终题：把"构建工具"升维成"交付流水线"，画出完整闭环。

分包决策（vite-splitting 预算制）→ 构建执行（vite-build 螺丝 + deps-perf 治理）→ CI 编排（三层缓存+Turbo 命中）→ 产物门禁（diff+size budget+覆盖率线）→ 部署（CDN/hash 长效缓存，vue-deploy/exp-deploy 同款）→ 线上 RUM（web-vitals p75 分 route）→ **告警与数据回流**：LCP 劣化 → 定位增长 chunk → 回到分包/依赖治理。每一环有数字、有负责人、有回退开关——工具是环节，闭环才是工程（呼应 vite-ci-perf 全课、全包十关卡地图）。

**来源**：平台工程（Platform Engineering）通识；本课程 10-vite 收官综合
