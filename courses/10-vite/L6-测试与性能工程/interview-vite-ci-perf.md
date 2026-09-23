# vite-ci-perf 面试题精选

> 共 15 题，覆盖 CI 缓存分层 / Turbo 任务图 / 构建提速 / 预算门禁 / 线上度量 五类。

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

---

## 补充（新专题 13-15）

### 13.  把 Vite dev 与 build 的耗时拆开度量：各阶段怎么测、优化优先级怎么排？

dev 耗时分解：冷启动 = config 解析 + 依赖扫描 + 预构建 + 首模块转换链（DEBUG=vite:transform 给每模块 ms；--debug 加插件名细分到钩子级）；稳定启动 = 缓存命中后的纯 config+首转换；HMR 延迟 = 文件事件 → 模块图失效 → 受影响链重转换 → 客户端 patch（影响因子：模块图宽度、插件 transform 成本、循环依赖放大失效范围）。build 耗时分解：输入解析/预构建对应物 + chunk 图计算 + transform 并行度 + 压缩（terser/esbuild 选项差异大）+ 报表（reportCompressedSize 可关，见 vB 批 quiz）。度量方法：固定硬件、关无关插件跑基线、按阶段计时（vite-plugin 埋点或官方 --profile）；"优化优先级"的排序依据是"频率×成本"——HMR 影响每次保存（开发者每天数百次）优先于冷启动，冷启动优先于 build（除非 CI build 已成队列瓶颈）。加分句：讲得出"我在团队里设了 HMR p95 与冷启动预算并接入 CI 度量防回潮"，性能工程就从个人英雄主义变成制度。

**来源**：Vite 官方 performance 讨论；Chrome devtools performance 面板；DEBUG=vite:transform 输出格式

### 14.  一次 Vite 升级的完整工程剧本：从评估到全量落地，你的步骤与回滚设计？

六步剧本：① 读 breaking changes 并按"影响面分类"（默认值变更最阴——target/browserslist、Node 版本下限、CJS Node API 弃用；删 API 最响；行为微调靠产物 diff 兜底）；② 生态预检——依赖的 Vite 插件/框架版本对 Vite n 的支持声明（peer range）全列清单，任一关键阻塞就推迟或绕行；③ 开升级分支跑三验（类型/测试/构建），产物 diff 是独立必做项（体积、chunk 清单、hash 传染度）；④ 真实回归重点放"默认值受益/受害面"（旧浏览器加载新语法是升级最贵事故，拉 UA 分布验证 Baseline）；⑤ 灰度——按应用/按路由分批，监控 404 资源与脚本错误率（版本维度分组，呼应 quiz 题）；⑥ 文档化 + lockfile 与 CI 版本对齐（全员开发机版本统一策略：corepack 钉 packageManager 字段）。回滚设计：升级分支隔离（不混业务改动）、dist 产物与 map 保留旧版本可整目录切回、回滚演练比回滚计划更重要。加分句：升级最大的隐性成本是"生态跟进窗口"——把插件/内部框架包的兼容矩阵当项目管理（而不是当天现查），这是平台团队的价值。

**来源**：Vite 官方 Migration Guides；Vite 7 发布说明（基线 target、Node 版本 EOL）；cnpmcore 包统计（生态跟进度）

### 15.  前端交付的质量门禁组合：类型、测试、体积预算、a11y、视觉回归——你在 CI 里如何排布成本与信号强度？

排布原则："便宜且强信号的先跑、按失败代价分层"——顺序：install 校验（lock 一致）→ 类型（秒级，拦最多低级错误）→ lint → 单测（--changed 增量）→ 构建 → 体积预算（构建产物上算，size-limit 对关键 chunk 设硬阈值+软告警双档）→ 组件/集成测试 → 视觉回归（最贵，PR 标签/主干触发控制频率）→ a11y（静态 axe 进 CI 拦低级违规，手动/审计层做复杂项）。成本模型：每项门禁的"日均运行时长 × 全队人数"是它的组织成本，门禁的存在理由=它拦住问题的平均修复成本；两股力量都要量化进季度回顾（跑不动的门禁会被绕过，形同虚设比没有更坏——绕过成为惯例后真信号也挡不住）。信号设计：失败必须"可行动"（体积超标输出 diff 表与责任依赖链；视觉回归输出遮罩图+容差说明），不可行动的失败会被整个团队训练成"重跑一次"。加分句：门禁组合的终局形态是"PR 上的决策仪表盘"——每道门给出通过证据而非红绿点，评审人据此合并，这是对"CI 绿了就放心"文化风险的解药。

**来源**：size-limit 文档；Playwright component testing/视觉回归实践；axe-core 与 CI 集成
