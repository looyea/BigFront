# vite-deps-perf 面试题精选

> 共 12 题，覆盖 预构建原理 / 缓存与失效 / 参数实战 / 剖析与提速 / 双模型综合 五类。

---

## 一、预构建原理

### 1. Vite dev 为什么需要依赖预构建？没有它会怎样？

三个瓶颈：①散装 ESM 的请求瀑布流（lodash-es 600+ 模块=600+ 请求，HTTP 串行往返）；②CJS-only 包浏览器根本无法 import；③老依赖含非浏览器语法（JSX/TS）未编译。预构建用 esbuild 把每个依赖打成单文件 ESM 放 `node_modules/.vite/deps`，一次解决三病（呼应 vite-deps-perf 第一、二节）。

**来源**：Vite 官方 — "Dependency Pre-Bundling"

### 2. 为什么预构建用 esbuild 而不是 Rollup？

预构建的诉求是**快**（阻塞 dev 启动）与**输出单文件 ESM 即可**（不需要 tree-shaking/精细 chunk 控制）——esbuild Go 原生、bundles 场景 10-100 倍快。Rollup 的强项（tree-shaking、chunk 图）在 dev 用不上、在 build 才需要。双模型的分工切面之一（呼应 vite-intro、vite-build）。

**来源**：Vite 官方 — "esbuild 在 Vite 中的角色"

### 3. 预构建产物浏览器是怎么被指过去的？（import 重写入）

Vite 在服务端 transform 入口模块时把 `import _ from 'lodash-es'` 重写为 `/node_modules/.vite/deps/lodash-es.js`（带 hash 查询参数做缓存 busted）。面试加分：这发生在 dev server 中间件的 transform 阶段，磁盘源码不动（呼应 vite-hmr 模块图、vite-plugin-api transform 钩子）。

**来源**：Vite dev 网络面板实证（deps/*.js 请求形态）

---

## 二、缓存与失效

### 4. 预构建缓存什么时候失效重建？"反复 reload"排查顺序？

失效条件：lockfile 哈希变、optimizeDeps 相关配置变、入口发现集合变。运行中反复 reload 的元凶几乎总是**动态发现的依赖**：某个路由懒加载块里的依赖首访才被扫到。排查：①补 `optimizeDeps.entries` 覆盖所有真实入口；②对确认常用的补 `include`（呼应 vite-deps-perf 第二节）。

**来源**：Vite 官方 — "optimizeDeps.entries / 重新构建行为"

### 5. 为什么 workspace 里 src 直出的包要 exclude？exclude 后它的 CJS 依赖怎么办？

被预构建=被冻结成快照，源文件改动不再实时生效（要删缓存重建）——开发期体验崩坏，所以 exclude 让 Vite 走普通源码管道（实时 HMR）。但 exclude 包的 **node_modules 依赖仍要预构建**，其中 CJS/散装的要手动写进 `include`（Vite 对被排除包的依赖发现能力有限）。`>` 语法可点名"某包内部的深路径"（呼应 vite-deps-perf 第三、二节）。

**来源**：Vite — "Monorepo & optimizeDeps 实践"

---

## 三、参数实战

### 6. include 与 exclude 的判断口诀？各给一个误用案例。

**include**："页面很快会用到但不在首屏 import 链上"（如登录后才加载的重型图表库）——不点名则首次导航触发重建 reload。**exclude**："本身打包良好的大 ESM 包"（预构建它纯属浪费数秒）或"正在改源码的 linked 包"——错 include 会得到慢启动+热更失灵两个礼物（呼应 vite-deps-perf 第三、四节）。

**来源**：Vite — "include/exclude 语义"；社区调优案例集

### 7. Vite 6 的 server.warmup 和预构建是什么关系？

不同层：预构建处理**依赖**（node_modules），warmup 处理**自家源码**——启动时按 glob 预先 transform 指定文件，把首请求的编译成本挪到空闲期。典型用法：预热主入口路由与高频组件。别写太贪（预热全项目=自己造了个 bundle 阶段）（呼应 vite-deps-perf 第三节、vite-ssr 环境 API）。

**来源**：Vite 6 — "server.warmup"

---

## 四、剖析与提速

### 8. 接手一个"dev 启动要 90 秒"的项目，你的完整诊断路径？

①`vite --debug` 分账：deps 解析/预构建耗时 vs 首次 transform；②`node --cpu-prof` 采样看热点；③检查 entries 是否把测试/故事书全扫进依赖图；④数预构建依赖清单（`node_modules/.vite/deps` 文件数与体积）：把大 ESM 移进 exclude、合并重复版本依赖；⑤monorepo 检查 linked 包与 cacheDir 归属；⑥最后才是硬件/升级。要点：**先测量归因，再动参数**（呼应 vite-deps-perf 第四节）。

**来源**：Vite 性能议题社区案例；诊断方法论通识

### 9. fs 层缓存（cacheDir）和项目硬链接在 monorepo 下有什么坑？

Vite 发现 workspace 根后默认把 cacheDir 放到 workspace 根的 `node_modules/.vite`——多应用共享缓存：A 项目配置变了可能把 B 的缓存打掉。解法：应用级 `cacheDir` 独立；pnpm 的硬链接 store 让多项目 node_modules 磁盘占用可控（呼应 vite-deps-perf 第四节、vite-deploy monorepo）。

**来源**：Vite — "Monorepo cacheDir 行为"；pnpm 文档

---

## 五、双模型综合

### 10. dev 有预构建、build 有对应物吗？两边依赖治理的镜像关系？

build 侧没有"预构建"这一步（Rollup 直接吃 node_modules），但同病同药换了形态：CJS 靠 `build.commonjsOptions`（include 名单）、散装依赖在 tree-shaking 与 chunk 图计算里同样拖慢构建、重复版本在构建里变成"双份进 bundle"事故。治理动作合并为一件事：**依赖清单少而精、单一版本、优先纯 ESM**——dev/build 双收益（呼应 vite-deps-perf 第五节、vite-build）。

**来源**：Vite — "build.commonjsOptions"；依赖治理通识

### 11. Rolldown 想解决双模型的什么痛点？过渡期工程决策怎么做？

痛点：dev（esbuild）与 build（Rollup）**两条管道行为差异**——语法转译宽松度、CSS 处理细节导致"dev 正常 build 出错"类 bug，且缓存/插件要维护两套。Rolldown（Rust、兼容 Rollup 插件生态）目标统一成一条高速管道。决策：主线锁稳定版观望，基础设施团队用 `rolldown-vite` 别名包在低风险项目试跑、备好回退（呼应 vite-deps-perf 部署预告、vite-ci-perf 第三节）。

**来源**：Rolldown/VoidZero 公开路线图叙事

### 12. 有人说"Vite 构建慢就换 Turbopack/Webpack5 持久化缓存"，从预构建视角给个公道话。

构建慢的归因要先分层：依赖量大/重复版本（治它靠依赖治理与 include 名单，换工具不换问题）、转译量（esbuild/SWC/Rolldown 都比 babel 快）、chunk 图计算（manualChunks 策略）。**缓存与并行是各家都在补的通用药**（Webpack5 filesystem cache、Turbo 任务缓存同理），换工具等于放弃现有插件/配置的沉没成本换新工具的同级能力——先把手上的螺丝拧对，再谈换电动工具（呼应 vite-deps-perf 第四节、vite-ci-perf）。

**来源**：构建工具性能对比通识；工程决策方法论
