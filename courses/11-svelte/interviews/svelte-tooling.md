# svelte-tooling 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与工程化面经高频主题的转述。

---

### 1. (A) 从 Vite 的视角画出 .svelte 文件被加载的全链路。

**来源**：10-vite 交叉工程题 — 插件机制读图

浏览器 import `App.svelte` → Vite dev server 命中请求 → 插件管线 `load/transform`：`vite-plugin-svelte` 调 `svelte.compile()` 得 JS（含 preprocessor 先拆 `<script lang=ts>/<style>`）→ 结果进 Vite 模块图（ESM、依赖预构建旁路）→ 浏览器拿到普通 JS。生产 build 同理只是 Rollup 阶段。考点：Vite 的"万物皆模块+插件钩子"架构与 Svelte 编译器的嵌入点——答出 transform 钩子即懂插件本质。

### 2. (B) `svelte.config.js` 和 `vite.config.js` 都叫 config，职责怎么划？举一个"放错文件"的事故。

**来源**：社区答疑精选 — 双配置文件困惑高频题

vite.config 管**打包器**（插件、别名、代理、构建 target）；svelte.config 管**编译器与 Kit**（preprocess、compilerOptions、kit.adapter——纯 Svelte 项目 kit 段无效）。事故样例：把 `resolve.alias` 写进 svelte.config → 静默失效，路径解析全按 vite 默认；或 TS 项目忘在 svelte.config 配 `preprocess: vitePreprocess()`，编辑器满屏"Cannot find name"而 vite build 却正常（vite 插件自带兜底）——两边行为差正是定位线索。

### 3. (A) `compilerOptions.runes` 三档（不设/true/false）分别什么行为？大型代码库迁移时怎么用？

**来源**：Svelte 5 迁移指南 — 编译模式说明转述

不设=**按文件探测**（含 runes 走新模式，纯 legacy 文件按 Svelte 4 编译，同仓可混跑）；true=全库钉 runes，旧语法直接编译错；false=钉 legacy。迁移节奏：先"不设"保业务连续，配合 `sv migrate` 与 eslint 规则圈禁旧语法增量，模块翻新到一定比例后一把钉 `runes: true` 清账（单文件过渡期用 `<svelte:options runes>` 逐组件钉）。考点是"配置旋钮服务迁移策略"，细节 L10 全课展开。

### 4. (C) 为什么 Svelte 工程 CI 里 `svelte-check` 无法被 `tsc --noEmit` 取代？反过来 eslint 配了 typescript 插件也不行？

**来源**：工具链原理对比面试题

三者输入域不同：tsc 只解析 `.ts`（.svelte 直接看不见）；typescript-eslint 靠 `@typescript-eslint/parser` 解析 ts 片段，模板部分仍需 svelte 的解析器桥接（eslint-plugin-svelte 正是干这个，但其类型规则覆盖面≠全量诊断）；svelte-check= svelte2tsx 翻译 + 完整 TS 程序 + 模板级检查（未使用导出、a11y 编译诊断）。结论：**静态检查工具按"能看见哪些字节"分工**，CI 并排跑而不是二选一。

### 5. (D) 公司老项目是 Svelte 4 + webpack + eslint-config-svelte，老板让你"升级到 5 并保持可发布"，给工程路线图。

**来源**：技术升级专项面经 — 存量工程迁移设计

① 冻结基线：CI 先补 `svelte-check`/测试/构建产物比对三件套，没有度量没有迁移；② 打包层：webpack+svelte-loader → Vite+vite-plugin-svelte（构建体系独立升级，风险隔离——参照 10-vite 的迁移话题）；③ 编译层：升级 svelte@5，runes 保持"探测档"混跑，`sv migrate` 批量转事件/插槽等机械项；④ 逐模块 runes 化 + eslint 新规则圈禁残留 legacy；⑤ 钉 `runes: true`、删 legacy 依赖、升 prettier/eslint flat config。每步可发布=灰度回滚单元。加分：按"包大小/构建时长/hydration 指标"量化收益汇报。

### 6. (A) 预处理器（preprocessor）和编译器选项都能"改代码"，机制区别？`vitePreprocess()` 到底做了什么？

**来源**：Svelte 文档 — preprocessors 章节转述

preprocessor 在 **svelte.compile 之前**改写源码字符串：`<script lang=ts>` 丢给 esbuild 转 JS、`<style lang=scss>` 编 CSS——输出仍是合法 Svelte 语法；compilerOptions 则影响**编译阶段行为**（dev/hydration/runes）。`vitePreprocess()` = 按 tsconfig/esbuild 选项做 TS/JSX 预处理的官方实现，且复用 Vite 的 tsconfig 解析。推论题：preprocessor 里不能引用编译器生成的东西（时序在前），报错行号偏移常怪 preprocessor sourcemap 链断。

### 7. (B) `npx sv add tailwind` 和手工装依赖+改四个配置文件，差别的本质是什么？

**来源**：sv CLI 集成系统发布讨论

`sv add` 是**声明式集成器**：按目标库的官方 recipe 改 `package.json`/`vite.config`/`svelte.config`/入口 CSS，且 recipe 由库方维护随 CLI 分发——版本配对知识（Tailwind v4 的 vite 插件接法）从"人肉查文档"变成"可执行代码"。本质与 `create-react-app eject`、Nuxt modules 同一命题：**把生态接线的易错知识固化进工具**。风险提示也必备：会覆盖自定义配置，CI 建议锁 `sv` 版本。

### 8. (C) Svelte 的 HMR"保留组件状态"是怎么做到的？React Fast Refresh 同层机制有何不同？

**来源**：vite-plugin-svelte HMR 设计说明转述

编辑 `.svelte` 后插件发特化 HMR 载荷：新编译的组件定义**热替换**进旧实例（模板/更新函数换、`$state` 值留）——组件实例是显式对象，替换点清晰。React 没有"组件实例"驻留，Fast Refresh 靠重跑新函数体 + 按 hook 顺序保 state，改 hook 结构即 reset。答出"实例派 vs 函数派"的状态载体差异，顺带解释为何 Svelte 里改模块顶层 `$state`（.svelte.js）需要 `import.meta.hot` 手工兜底（L4 HMR 话题，呼应 svelte-global-state）。

### 9. (B) 同事把 `svelte` 装成了 dependencies 而不是 devDependencies，CI 构建炸出"compiler version mismatch"。解释链路。

**来源**：monorepo 依赖治理 issue 高频案例

编译器只应存在**一份**：vite-plugin-svelte 内部 import svelte/compiler，若 hoist 后出现两个版本（包 A 锁 5.2、根 5.3），组件由一个编译器产出、运行时 helper 来自另一份 → 产物与 runtime 版本断言失败。排查三板斧：`npm ls svelte @sveltejs/vite-plugin-svelte`、pnpm dedupe、overrides 钉版本。svelte 属 devDeps 的理由：它是**构建期依赖**，产物里被打进 runtime 的是 `svelte/internal/client`，不需要用户 npm 安装。

### 10. (D) 为一个三人小组设计 Svelte 项目的"质量闸门"：从 pre-commit 到 CI 到预览部署。

**来源**：团队工程化设计题 — 质量设施白板题

pre-commit（lefthook/husky）：lint-staged 跑 eslint --fix + prettier（秒级反馈放最小环）；PR CI：`sv check` + vitest（含覆盖率水位）+ build 产物 size 对比（size-limit 基线）；main 合入：自动部署预览环境 + Playwright 冒烟 + Lighthouse CI 阈值；发布 tag：e2e 全量。设计原则：**慢检查往后站、失败要指到层**（类型错不配触发 e2e）。加分：.svelte 三段各有格式化冲突史，锁 prettier 单一 formatter 写进 CONTRIBUTING。

### 11. (A) 编辑器和浏览器是 Svelte 开发的两大"外置大脑"，各装什么、开什么？

**来源**：官方工具链页 + 工作流问答汇总

编辑器：Svelte for VS Code（语言服务=svelte2tsx 引擎，负责跳转/补全/诊断）+ 显式 `editor.defaultFormatter` 指 svelte/prettier，禁内置格式化打架；浏览器：无运行时 devtools 但有 **playground**（分享最小复现、读编译产物双用途）+ `$inspect` 补观察位。冷知识加分：模板高亮依赖 Svelte 扩展的嵌入语言注入，纯 Tailwind IntelliSense 需在 `tailwindCSS.includeLanguages` 手动加 svelte——"两家扩展互不认识"是常见配色失踪根因。

### 12. (C) "vite 模板有 svelte 和 svelte-ts 两个，还有 sv create——到底谁官方？"给一个版本嗅觉答案。

**来源**：脚手架生态变迁讨论 — create-vite vs sv

当前官方推荐链：**sv（新站点文档首页指路）**——交互式选 TS/Kit/lint/test，产物含 svelte-check 接线；`npm create vite@latest -- --template svelte(-ts)` 仍维护但面向"只要最小 SPA"场景，集成度低（无 check/测试预设）。历史层：`create-svelte`、`degit sveltejs/template` 已退役。答题价值不在背名字，而在展示"查三源交叉验证（官网/ npm 发布时间 / GitHub 归档声明）"的核实方法论——课程内容反复埋的"版本嗅觉"母题（呼应 svelte-overview 信息素养节）。
