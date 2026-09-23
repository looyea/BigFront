# ts-project 面试题精选

> 共 15 题，覆盖 **tsconfig 结构 / target 与 lib / 严格性开关 / extends 分层 / paths 与解析 / 项目引用与性能 / 工程实践** 七类。

---

## 一、tsconfig 结构

### 1. `tsconfig.json` 里 `files`、`include`、`exclude` 的关系与优先级？它们影响输出吗？

三者只决定**输入**（哪些文件进入编译程序），不影响输出目录结构（那由 `outDir`/`rootDir` 决定）。规则：写了 `files` 就是精确清单；`include` 是 glob 集合；`exclude` 从 `include` 结果里再剔除（默认已排除 `node_modules`/`bower`/`jspm_packages` 和 `outDir`）。若 `files` 和 `include` 都没写，默认纳入当前目录所有 TS 文件。常见坑：某个测试/脚本目录没进 `include`，导致"IDE 里报错、`tsc` 却不检查它"或反之——排查先对齐 IDE 与命令行用的是不是同一份 tsconfig 的同一 `include`（呼应第二节）。

**来源**：TypeScript Handbook — "tsconfig.json / files, include, exclude"; TS 文档 — "Configuring TypeScript"

---

## 二、target 与 lib

### 2. `target` 和 `lib` 为什么是分开的两个选项？举例"能编译、能跑但类型报错"和"类型通过但运行崩"两种错配。

`target` 决定 **emit 时把语法降级到哪一版 JS**（如 `?.`、class field、`async` 是否被转译）；`lib` 决定**编译期可见的内置 API 类型声明**（`Promise`、`Array.prototype.flat`、`DOM`）。二者正交：
- "能跑但类型报错"：`target: ES5` 但代码用了 `Object.entries`——运行时靠 polyfill 有，可 `lib` 没含 `ES2017.Object`，TS 报"属性不存在"。修：加进 `lib`。
- "类型通过但运行崩"：`lib` 含 `ES2022`、类型有 `Array.prototype.at`，但实际部署到不支持的旧浏览器且没 polyfill——编译不报错、运行时 `is not a function`。
结论：`lib` 管"类型契约"、`target`+运行环境+polyfill 管"真实可用性"，两边都要对准目标环境（呼应 ts-basics、03-nodejs 版本）。

**来源**：TypeScript Handbook — "target vs lib"; Effective TS — Item 7

---

## 三、严格性开关

### 3. `strict: true` 到底打开了什么？为什么建议所有新项目都开？有哪些"更严"的开关它不含？

`strict` 是总闸，一键打开 `noImplicitAny`、`strictNullChecks`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitThis`、`alwaysStrict`、`useUnknownInCatchVariables`（4.4+）等。建议必开：这些是 TS "静态捕获 bug" 价值的核心（漏 null、隐式 any、this 丢失、函数逆变检查），一开始疼、之后省掉大量运行时事故（逐个样例见 ts-strict）。但它**不含**几个"锦上添花"的更严开关：`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noPropertyAccessFromIndexSignature`、`noImplicitOverride`、`noFallthroughCasesInSwitch`——要单独加（很多这些正是"数组索引可能 undefined"这类 bug 的解药，呼应 ts-strict）。

**来源**：TypeScript Handbook — "strict"; @tsconfig/strictest

### 4. `compilerOptions.types` 和 `typeRoots` 是干什么的？为什么有时装了 `@types/xxx` 却不生效？

`typeRoots` 指定"去哪找全局 `@types` 包"（默认所有 `node_modules/@types`）；`types` 指定"**自动引入**哪些 `@types` 全局包"（默认引入 typeRoots 下全部）。设了 `types: ["node"]` 就只会自动加载 `@types/node`，其余即便装了也**不**自动进全局——这正是"装了 `@types/jest` 却找不到 `describe`"的常见原因（要么加进 `types`，要么该包本就该靠 `import`/三斜线引用）。合理用法：显式列 `types` 能减少无关全局污染、加快编译（呼应 ts-declarations 第二节、ts-modules 第 1 题）。

**来源**：TypeScript Handbook — "types / typeRoots"; TS 文档 — "@types not being picked up"

---

## 四、extends 与分层

### 5. 用 `extends` 组织多份 tsconfig 时有哪些坑？`include` 里的相对路径按谁解析？

坑：① **数组字段是覆盖不是合并**——`include`/`exclude`/`files` 在子配置里一旦写就**整体替换**父配置，不会叠加（只有 `compilerOptions` 逐键合并）；② **相对路径解析基准**：`extends` 中被继承文件里的 `paths`/`extends` 相对路径按**所在文件**解析，而 `include`/`files` 按**最终生效配置所在目录**解析，跨目录继承极易指错；③ 多层 `extends` 链条调试困难。最佳实践：一份 `tsconfig.base.json` 放共享 `compilerOptions`，各 app/lib/node 配置各自写 `include`（显式），别指望继承数组；用 `@tsconfig/*` 预设起手（呼应第四节、ts-tooling）。

**来源**：TypeScript Handbook — "extends"; TS — "relative path resolution in extends"

### 6. 为什么一个前端仓库常同时有 `tsconfig.json`、`tsconfig.node.json`、`tsconfig.app.json`？

因为它们要检查的代码**运行环境不同、需要的类型与选项不同**：`tsconfig.app.json`（浏览器代码：`lib: DOM`、`types: vite/client`、`jsx`）；`tsconfig.node.json`（`vite.config.ts`、构建脚本：`types: node`、`module`/`lib` 面向 Node）；根 `tsconfig.json` 常是"解耦壳"（`files: []` + `references` 指向 app 与 node，或用 `include` 聚合）。混成一份会导致"给浏览器代码引 node 类型""`vite.config` 用 DOM 类型报错"等错配。VSCode 会按文件匹配最近的 tsconfig，故拆分也让编辑器行为与构建一致（呼应 ts-modules、10-vite）。

**来源**：create-vue/Vite 脚手架 — "tsconfig.app/node.json"; TS — "solution style tsconfig"

---

## 五、paths 与解析

### 7. `paths`/`baseUrl` 只影响类型还是也影响运行时产物？为什么"改了 paths 运行时找不到模块"？

`paths`/`baseUrl` **只影响 tsc 的类型解析**，让 `import "@/x"` 能找到 `.d.ts`/`.ts` 做检查；它**不会重写** emit 出来的 JS 里的 import 说明符——产物里仍是 `"@/x"`。所以运行时（Node/浏览器/打包器）必须**另行**提供同样的别名解析：Vite 的 `resolve.alias`、webpack `resolve.alias`、`tsconfig-paths`（Node 运行时）、或子路径 `imports`。"TS 不报错、运行时 `Cannot find module '@/x'`"就是只配了 tsc 那一半。新代码更推荐用包 `exports`/`imports` 或相对路径，减少对 paths 的双份维护（呼应 ts-modules 第五节、10-vite）。

**来源**：TypeScript Handbook — "paths"; 社区 — "paths doesn't rewrite runtime imports"

---

## 六、项目引用与性能

### 8. `incremental`/`tsBuildInfoFile`、`skipLibCheck`、项目引用（composite）分别在优化什么？三者能一起用吗？

都为了缩短 `tsc` 时间，但层次不同：`skipLibCheck` 跳过对第三方 `.d.ts` 内部的检查（少检查海量声明，呼应 ts-declarations 第 8 题）；`incremental` + `tsBuildInfoFile` 让**单次项目**在下次编译时只重检查受影响文件（存一张构建信息缓存）；`composite` + `references`（`tsc -b`）是**跨包**增量——上游包产出的 `.d.ts` 被下游复用，改动只重建依赖链上的包。三者可叠加，是 monorepo 标配（配合 `isolatedDeclarations` 还能进一步加速）。定位瓶颈用 `tsc --extendedDiagnostics`/`--generateTrace`（呼应 ts-advanced 第 9 题）。

**来源**：TypeScript — "incremental / tsc -b / project references"; TS Wiki — "Performance"

### 9. `noEmit` 和 `emitDeclarationOnly`、以及"`tsc` 只做类型检查、JS 交给 esbuild/swc" 的分工是什么？

现代构建常**双轨**：`tsc --noEmit`（或 IDE）专司**类型检查**（产出诊断、不产 JS），实际**转译**交给 esbuild/SWC/Vite（快，呼应 ts-intro "esbuild 只删类型不查类型"、10-vite）；发布库时 `tsc` 用 `emitDeclarationOnly` + `declaration` 只产 `.d.ts`，JS 产物由打包器生成。意义：把"慢但正确的类型检查"与"快的转译"解耦，开发时靠转译秒级热更、CI/提交前靠 `tsc --noEmit` 把关（呼应 Express L7 CI 门禁）。切记 esbuild/swc **不做类型检查**，别以为"构建过了=类型没问题"。

**来源**：tsup / esbuild / SWC 文档; TypeScript — "noEmit / emitDeclarationOnly"; 10-vite

---

## 七、工程实践

### 10. `sourceMap`、`declarationMap`、`removeComments`、`newLine` 这些"产物"选项在什么场景要关心？

`sourceMap` 生成 `.js.map`，让浏览器/Node 调试时断点映射回 `.ts` 源码（生产可配 `sourceMap` 上传错误监控但不下发）；`declarationMap` 让库消费者"跳转到定义"从 `.d.ts` 回到你的 `.ts` 源码（发布库强烈推荐，呼应 ts-declarations 第 6 题）；`removeComments` 压缩产物、去掉注释（库发布常开）；`newLine` 处理跨平台换行（历史坑，现代多为 `lf`）。这些不影响类型正确性，但直接影响**可调试性、发布体验、体积**，是"库 vs 应用"配置分野的一部分。

**来源**：TypeScript Handbook — "sourceMap/declarationMap"; 错误监控 sourcemap 实践

### 11. `allowJs`、`checkJs`、`@ts-check` 组合如何支撑"渐进迁移"？默认要不要对 JS 报错？

`allowJs` 让 tsc **纳入** `.js`/`.jsx` 文件参与编译（可与 TS 混编），但默认**不检查**它们的类型；`checkJs`（或在单文件顶加 `// @ts-check`）才对这些 JS 做类型检查并报错。渐进迁移策略：先 `allowJs:true`+`checkJs:false` 把 TS 引入 JS 项目共存 → 用 `// @ts-check` 逐文件点亮检查 → 文件逐个改名 `.ts` 补类型（呼应 ts-migration）。全量 `checkJs` 一开往往爆出成百错误，所以"按文件粒度开启"是关键（配合 tsconfig 分目录）。

**来源**：TypeScript Handbook — "JS Support / @ts-check"; Effective TS — Item 44

### 12. 有人把 `strict` 关掉图省事，你怎么说服团队保持严格？给一套"从很松的祖传配置迁移到 strict"的务实路径。

论点：`strict` 关掉省的是"改代码的十分钟"，赔的是"线上排查空值/隐式 any 引发的数小时事故"——TS 的核心价值恰恰在严格模式（非严格 TS ≈ 带类型的 JS）。务实迁移路径（呼应 ts-migration、ts-strict）：① 从 `@tsconfig/strictest` 或全 `strict` 起手新代码，**新文件零历史包袱**；② 老代码用分目录 tsconfig 暂时放宽，逐目录收紧；③ 开关**一项一项**开（先 `noImplicitAny` 再 `strictNullChecks`……），每项配一个 codemod/`// @ts-expect-error` 计数下降看板；④ 兜不住处写 `unknown`+类型守卫而非 `any`（呼应 ts-any-unknown、ts-guards）；⑤ 把 `tsc --noEmit` 纳入 CI 防回退（呼应 Express L7）。渐进但方向坚定，比"一步到位再全线崩溃后回滚"更可执行。

**来源**：@tsconfig/strictest; Effective TS — Item 44; 社区 — "adopting strict incrementally"

---

## 补充（新专题 13-15）

### 13. 一个前端仓库该有几份 tsconfig？给一份职责表。

主流分层：`tsconfig.base.json`（compilerOptions 公共、路径/严格度唯一真源）→ 按**消费环境**拆分：app（浏览器 lib+jsx）、node（服务端 target 与 lib 不同）、test（vitest types，允许更宽松）、tsconfig.node.json（vite.config 单独，composite 引 dependencies）。职责：include 精确圈文件域（别让测试配置把 src 全吃进 program 重查）、types 白名单防 @types 雪崩。加分：vite 脚手架正是这份拓扑；库再加 tsconfig.build.json（declaration+emit、exclude 测试），CI 用 build 配置、本地用全配置。

**来源**：TS Handbook《tsconfig references 与 base 模式》；create-vite 模板 tsconfig 分层源码。

### 14. target、lib、@types 三层各管什么？一个「Node 脚本用了 at()」的完整案例。

target：语法降级目标 + 默认 lib 基线（es5 时代连 Map 都没有）；lib：**声明**可用的 API 池（不影响产物，只影响类型存在）；@types：环境全局（node/dom/process）。案例：`arr.at(-1)` 在 Node 16+ 运行时可用，但 target:es2018 的默认 lib 不含 ES2022 声明 → 类型报错；解法是 `lib:["es2022", "dom"]` 或升 target；反例：lib 写了 dom、跑在 Node → 类型过运行时崩（setTimeout 句柄类型都不一样）。口径：**lib 写你运行环境的超集交集，@types 精确圈环境**，target 由产物消费端决定。

**来源**：TS Handbook《compilerOptions 各条原文》；TS 文档 target→default lib 对照表。

### 15. CI 里类型检查怎么搭最快最稳？（--build、noEmit、矩阵）

三层：① PR 门禁：`tsc -p tsconfig.json --noEmit`（纯检查零 emit，配 incremental+缓存 tsbuildinfo 进 cache）；② monorepo 用 `tsc -b`（references 拓扑序 + 只重编变更下游）或 nx/turbo 任务图 + remote cache；③ 类型产物验证（库仓）：attw/publint 跑 pack 后的包而不是源码。细节：noEmitOnError 让「构建成功但类型红」不可见——CI 禁用 emit 混检；`typescript` 版本钉死 lockfile；TS Server 内存（maxNodeModuleJsDepth、plugin 数量）影响 CI 冷启动——大型库可试 tsgo（5.7+ 预览）提速 10x。

**来源**：TS《Project Reference 的 tsc -b 增量》文档；TypeScript 5.7 博客（tsgo/go 端口预告）。
