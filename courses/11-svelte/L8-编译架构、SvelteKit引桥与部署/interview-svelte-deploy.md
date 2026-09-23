# svelte-deploy 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线部署运维面试与社区事故复盘的高频主题转述。

---

### 1. (A) 从 .svelte 源文件到 dist/ 产物，画出完整链路并标注每一段的负责工具。

**来源**：构建链路读图题（10-vite 交叉考点的 Svelte 版）

`.svelte` → vite-plugin-svelte transform（preprocessor 拆 TS/SCSS → svelte.compile 出 JS+CSS 两块）→ Vite 模块图 → build 阶段 Rollup 合并分包（tree-shaking 在编译产物上照常生效，`sideEffects` 纪律见组件库发布课）→ hash 命名进 assets/ → index.html 注入引用。职责分界：编译器管"组件变成什么"，打包器管"文件如何组织"——说反了就是没拆过职责（呼应 svelte-tooling 双 config 题）。

### 2. (A) 为什么 Svelte 项目的 bundle 分析里"框架基数"几乎可以忽略？这对手写成本的核算方式有什么影响？

**来源**：体积模型面经题（编译器派选型论的量化版）

运行时只剩信号/effect/模板 helper 一小撮（internal/client），组件"框架部分"被编译进了各自的产物——体积≈你的代码+依赖，基数小但**每行 UI 逻辑都是你自己写的真代码**。核算影响：React 项目"白嫖框架能力"的空间（重渲兜底、运行时调度）在 Svelte 里换成开发工时与产物行数；优化杠杆从"减框架"变成"减自写重复逻辑/拆懒加载"（呼应 svelte-compiler-architecture 第 7 题的条件清单）。

### 3. (B) 发布后用户报"刷新个别路由 404、首页正常"，紧接着另一批用户报"点击跳转后白屏报错 ChunkLoadError"。两个事故各自的根因？

**来源**：SPA 发布事故合集 — 运维值班真实工单形态

404=history 回退缺失（try_files 没配或只回退到根路径没带 base 前缀）；ChunkLoadError=**新旧版本混跑**：用户拿着旧 index.html（被缓存/CDN 未刷新）去请求已被覆盖删除的旧 hash chunk。修复组合：index.html no-cache + CDN 发布后只对 index.html 做 invalidate、旧版本 chunk **延迟清理**（保留上一版目录若干分钟）；根治靠不可变发布目录+原子切换（呼应 vue-deploy/react-deploy 同款双事故题——三框架同一个坑）。

### 4. (B) 同事把 dist/ 直接发给运维，运维用 `python -m http.server` 起了生产。列出至少三个不专业的点。

**来源**：交付物审查题（基础设施意识的低门槛筛查）

①无缓存头控制（全部默认启发式缓存，index.html 被缓存=事故 3 预备役）；②无 gzip/brotli 压缩（Vite 产出的文本资源裸奔）；③无 HTTPS/HSTS 与 Security Headers 层；④进程无守护/无健康检查/无优雅重启；⑤SPA 回退行为不可配置（该 server 对 404 只回文件不存在）。正确姿势：Nginx/Caddy/对象存储+CDN，或容器化带配置交付——"能打开网页"≠"能生产运行"。

### 5. (C) 纯 Svelte SPA、Kit+adapter-static、Kit+adapter-node 三种交付形态，分别怎么回答"服务器上要运维什么"？

**来源**：部署形态账本题（私有化交付岗位高频）

SPA=静态桶/Nginx（零进程运维）；adapter-static 同左（多一步 prerender 产物校验与回退页配置）；adapter-node=常驻 Node 进程（进程守护、水平扩容、SSR 缓存策略、日志与优雅退出全回来——本质是 09-express 那套服务端运维税）。判据回到 SEO/首屏/算力三角（课文第四节账本），而不是"SSR 显得高级"。加分：内网离线交付场景 adapter-node+私有镜像是硬需求，静态形态反而做不到动态导出。

### 6. (C)  sourcemap 在纯 Svelte 生产构建里怎么配才既安全又能定位线上错误？

**来源**：vite-ci-perf 同款题的 Svelte 语境（跨包一致性纪律）

`build.sourcemap: true` + 发布前把 `.map` 从 dist 摘走上传错误监控（Sentry 类），公网产物不留 map 文件也不留 `//# sourceMappingURL` 注释（hidden 思路——Vite 原生 `sourcemap: 'hidden'` 一步到位）。Svelte 特有注意：map 链是 .svelte→编译 JS→bundle 两层，编译层 map 断了的话线上堆栈会指向编译产物而非源文件，排查用 playground 对段编译输出（呼应 svelte-testing 的错误定位章、exp-security 的信息泄露面）。

### 7. (A) index.html 里的挂载点、main.js 的 mount()、静态资源路径——说清"寄生老页面"集成时这三样各自怎么适配。

**来源**：微前端/遗留系统集成面题（政企前端工单高频）

挂载点：老模板里放 `<div id="svelte-app"></div>`，注意 `mount` 的 target 拿法要在 DOMContentLoaded 之后（脚本放 body 尾或 defer）；mount 调用：打进一个独立 entry chunk，老页面 `<script type="module" src>` 引入即可（无框架路由争抢整页）；资源路径：`base` 指到静态服务器前缀 + **跨域时 CORS 与 import 的 module MIME  type 要对**（老 Nginx 常漏 js 的 type）。进阶形态是 L10 的 customElement（连挂载脚本都省了）。

### 8. (D) 给一个日 PV 千万的纯 Svelte 阅读站做静态部署方案：CDN、缓存、发布、回滚、监控五层各给关键决策。

**来源**：容量场景设计题（资深轮标准收官形态）

CDN：全量静态上 CDN，源站只兜 index.html 与未命中；缓存：assets immutable 一年、index.html no-cache 或秒级 TTL（两全法：内容 hash 化+边缘短缓存）；发布：不可变目录+双桶原子切换或 CDN 路径版本化（`/releases/<sha>/`+指针）；回滚=指针回切+保留旧版本 chunk 至少一个发布周期（防事故 3）；监控：RUM 采 web-vitals 分 route（LCP 看 CDN 命中、INP 看交互）+构建侧 size-limit 门禁（呼应 vite-ci-perf 五层闭环——工具课与部署课在此汇流）。

### 9. (B) 构建在 CI 绿、部署后却白屏，控制台报 `Failed to fetch dynamically imported module`。给出排查顺序（至少四步）。

**来源**：社区疑难杂症精选 — 动态 import 失败的多因题

①复现路径：是否只在"发布瞬间在线用户"出现（→旧 chunk 被删，见 3 题）；②base/公共路径错：懒加载 chunk 拼出 404 URL（Network 面板看请求前缀）；③CDN 对 `.js` 的 MIME/CORS 配置（module script 对 type 严格）；④构建产物不完整：CI 缓存把旧 dist 混进上传（rsync 未加 --delete 类事故）；⑤浏览器扩展/代理改包（内网环境常见，无痕复测）。顺序哲学：**先时间维度（发布瞬间？）再空间维度（哪个资源 404？）**。

### 10. (C) Svelte 的 CSS 编译进产物后，"按路由分包样式"和"样式全局一份"两种形态在部署层各有何坑？

**来源**：CSS 交付形态讨论的部署侧转述

分包：懒路由的 CSS 随 chunk 加载，首屏更小，但**FOUC 窗口**与 CSS 顺序（后加载组件覆盖前者）要小心，回退页/预渲染页要确保关键 CSS 内联或首包；全局一份：简单可缓存，但样式随功能线性膨胀且任何一行改动 bust 全站缓存。Svelte scoped 类名带 hash、内容变化敏感，**CSS 的 hash 稳定性比 JS 更脆弱**（组件挪文件都会变类名）——好在 immutable 策略下这只是命中率问题不是正确性问题（呼应 svelte-styling、vite-splitting）。

### 11. (A) 部署纯 Svelte SSR 应用（L10 会手搓）时，服务端 render() 抛错会把整个 500 掉——工程上怎么分级处理？

**来源**：SSR 错误面分级题（next/nuxt 同题换皮，三框架通用纪律）

三层：①页面级——关键依赖失败降级为**返回缓存的静态壳/CSR 兜底页**（SSR 失败不等于服务失败）；②区域级——`<svelte:boundary>` 的 failed snippet 只在客户端水合后生效，SSR 期错误要靠 render 的 transformError/外层 try-catch 决定吐什么（boundary 对服务端默认无效，版本以官方文档为准）；③进程级——错误上报+熔断计数，连续失败自动切 CSR 模式发布（保留业务可用性的"降级开关"）。配套纪律：压测 SSR 的 TTFB 分位（呼应 node-perf、vite-ssr 的部署章）。

### 12. (D) 终题：老板问"我们三套系统分别是 Vite+Vue、Next、纯 Svelte，运维各请一个人吗？"用本课视角给一份统一交付标准的提案。

**来源**：平台工程通识题（跨栈管理岗收官变体）

提案要点：运维不该按框架分工，按**交付物类型**分工——三套系统归一为两种产物：静态包（Vue SPA/Next export/Svelte SPA）进同一条"CDN+缓存头+原子切换"流水线；Node 服务（Next SSR/Svelte SSR via Kit adapter-node）进同一条"容器+守护+优雅退出+错误上报"流水线（09-express/03-node 的服务端标准复用）。框架差异止步于构建步骤（各仓库自己出 dist），交付层只认"不可变产物+清单文件+健康检查"三要素——这正是全课程"部署预告"反复埋线的终点：**工具是环节，流水线才是平台**（呼应 vite-ci-perf 终题闭环）。
