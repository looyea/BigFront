# ts-publish 面试题精选

> 共 15 题，覆盖 **产物形态 / package.json 指向 / 双包与模块解析 / 类型打包 / 版本与契约 / 发布工程与安全** 六类。

---

## 一、产物形态

### 1. 一个发布到 npm 的 TypeScript 库，消费者拿到的到底是什么？为什么不是 `.ts`？

拿到的是**编译后的 JS（运行时）+ `.d.ts`（类型声明）+ package.json 指向**。TS 类型在编译期**完全擦除**（呼应 ts-intro），Node 运行时根本不认识 `.ts`；发源码会让每个消费者各自配置编译、版本/语法不一、构建负担外泄。`.d.ts` 是"给 TypeScript 编译器读的说明书"（呼应 ts-declarations），它随包发布，消费者写代码时编辑器据此补全/检查，运行时执行的是 JS。合格的库 = 运行时产物与类型声明**一一对齐**。

**来源**：TypeScript Handbook — "Declaration Files / .d.ts"; tsup — "What is tsup"

### 2. `main`、`module`、`browser`、`types`、`exports` 这些入口字段各管什么？为什么有了 `exports` 还要留 `main`/`types`？

- `main`：CJS 时代遗留的默认入口，老解析器（及不认识 exports 的工具）读它；
- `module`：**非官方**约定，打包器（Rollup/webpack/Vite）优先用它做 ESM 摇树；
- `browser`：浏览器端替换入口（打包器识别，Node 忽略）；
- `types`：类型入口（老式，TS 读它）；
- `exports`：**Node 官方**的条件导出（subpath + conditions），优先级最高，现代解析都走它。
留 `main`/`types` 是为**向后兼容**不认识 `exports` 的旧工具链；新工具看 `exports`，二者内容要对齐否则漂移（呼应 ts-declarations 查找顺序、ts-modules）。

**来源**：Node.js — "Packages / entry points, exports field"; TS Handbook — "package type declaration entry points"

---

## 二、exports 与条件顺序

### 3. 为什么 `exports` 里 `types` 条件必须写在 `import`/`require` 前面？写反了会怎样？

Node 与 TS 对 `exports` 的**条件做有序匹配，先匹配先赢**。TS 解析类型时也是顺着条件走，若先撞上 `import`/`require`（指向 `.js`），就会去旁边找同名 `.d.ts`/或落到 `types` 之外，导致"明明配了类型却报 `Could not find a declaration file`"。把 `types` 放第一位，保证类型条件优先命中：

```jsonc
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" } }
```

这是 TS 库发布最常见的坑之一（呼应 ts-publish 第二节、ts-declarations 查找顺序）。`are-the-types-wrong` 会专门检查这点。

**来源**：TS Handbook — "conditions resolution order"; are-the-types-wrong (attw) — "types condition must be first"

### 4. 一旦写了 `exports`，会发生什么"副作用"？外部想用你的某个内部子路径怎么办？

`exports` 一旦存在，就**封死了包内其它路径**——外部只能 `import` 你在 `exports` 里显式列出的入口，`import "my-lib/dist/internal"` 会抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`。这其实是好事（隐藏实现细节、明确公共面）。若确要暴露子路径，就显式加：`"./feature": { "types": ..., "default": ... }`。也别忘了按需放行 `"./package.json": "./package.json"`（很多工具要读它）（呼应 ts-modules、ts-publish 第二节）。

**来源**：Node.js — "Packages / subpath exports & non-exported paths"

---

## 三、双包与模块解析

### 5. 什么是 dual package hazard？为什么它对"有状态/有单例"的库尤其危险？

当同一库同时提供 ESM 与 CJS 两份产物，若一个应用里既有人 `import "lib"`（加载 ESM 版）又有人 `require("lib")`（加载 CJS 版），Node 会**各加载一份独立实例**——两份模块顶层状态互不相通。于是：单例不再是单例（两个注册表）、`instanceof` 失败（两份 class）、`Symbol.for` 之外的私有 token 对不上（呼应 ts-classes 单例、ts-modules）。**无状态纯函数库**基本免疫；有共享可变状态/单例/DI token 的库最容易中。缓解：ESM-only（推荐）、或让一格式转调另一格式的核心、或用跨格式稳定的注册（`globalThis`/`symbol-registry`）（呼应 ts-publish 第三节）。

**来源**：Node.js — "Packages / Dual package hazard"; sindresorhus — "package-modules-exports"

### 6. 新库你建议 ESM-only 还是 ESM+CJS 双发？各权衡是什么？

**ESM-only**（如近年的 `got`、大量 Anthony Fu/unjs 生态）：省掉双包坑、`import` 语义清晰、tree-shaking 友好、构建简单；代价是**纯 CJS、用 `require()` 的老消费者**用不了（Node < 12 或仍在 require 的项目）。**双发**：兼容性最好（`require`/`import` 都能用），代价是必须把 `exports`、`types` 条件、双份产物、双包 hazard 全部处理对（attw 常红）。结论：**看目标用户**——纯 Node 现代/前端生态可 ESM-only；要照顾最广存量 CJS 就双发并严格验收。`type: "module"` + `exports` 双条件是主流双发姿势（呼应 ts-modules、ts-publish）。

**来源**：sindresorhus — "Synthetic defaults / ESM-only stance"; Node — "ECMAScript modules in packages"

---

## 四、类型打包

### 7. 手写 `.d.ts` 和用构建器生成 `.d.ts` 有什么区别？发库时你倾向哪种？

`tsconfig` 开 `declaration: true` 让 `tsc` 从实现**自动发射** `.d.ts`（准确、免维护，但**逐文件**产出、可能碎、且要求代码类型完整可导出）；`tsup --dts`/`rollup-plugin-dts` 会把类型**合并**成单个（或少量）`.d.ts`，产物干净、少文件、发布体验好（呼应 ts-tooling 第二节、ts-declarations）。手写 `.d.ts` 只用于**给没有类型的既有 JS/第三方库**补声明（呼应 ts-migration 第六节），不适合"自己有实现的库"——那样手写必然与实现漂移。发库：优先**从源码生成 + 合并**，配 `declarationMap` 让"跳定义"回到源码（呼应 ts-project、ts-publish 第六节）。

**来源**：TS Handbook — ".d.ts statement / declaration emit"; rollup-plugin-dts — README

### 8. `typesVersions` 是干什么的？现在还需要吗？

`typesVersions` 是 TS 提供的**按 TS 版本重映射类型入口**的机制——早年为了让"用老版本 TS 的消费者"拿到一份兼容写法的 `.d.ts`、"新版 TS"拿另一份（比如用了新语法老编译器读不懂）。典型：`"typesVersions": { "<=4.2": { "*": ["./compat/ts4.2/index.d.ts"] } }`。当下多数库**不再需要**：要么最低支持的 TS 版本已经统一，要么用 `exports.types` 就够。它是**历史包袱兼容**工具，新项目慎用（复杂度上升），除非你真的要同时兼容跨度很大的 TS 版本（呼应 ts-declarations 查找顺序、ts-project）。

**来源**：TS Handbook — "version-specific types / typesVersions"; attw — "typesVersions resolution"

---

## 五、版本与契约

### 9. "导出的类型/接口"算不算库的公共 API？为什么改它比改实现更需谨慎？

**算，而且是最该守的那部分**。实现内部随便重构，只要 `exports` 的类型面不变，用户就不受影响；反过来，删字段、改签名、把参数从 `string` 收窄、把返回从 `T|null` 改成 `T`……哪怕运行时行为"看着兼容"，都可能让用户**编译报错**（类型是编译期契约，呼应 ts-conditional-infer 签名、ts-advanced Equal）。所以任何导出的 `type`/`interface`/泛型约束都进 **SemVer 破坏性判断**：删/改=MAJOR，新增可选=MINOR。用 **API Extractor** 把公共面固化成 `.api.md` 在 CI diff，是防"手滑破坏类型契约"的工程手段（呼应 ts-publish 第五节）。

**来源**：Microsoft — "API Extractor"; SemVer 2.0.0 规范

### 10. 你想移除一个仍在被大量用户使用的导出（函数/字段），怎样"负责任地"做？

别一刀切删（那是当场 breaking + 用户升级即炸）。标准流程：**① 先 `@deprecated`** 标注并在文档/CHANGELOG 说明替代方案，让用户 IDE 里看到删除线、CI 里可 lint 出告警；**② 保持至少一个 MINOR 周期的过渡**（旧 API 仍可用、只是警告）；**③ 在下一次 MAJOR 才真正移除**，写进 migration guide。这跟"strict 渐进收紧"的克制一脉相承——给用户**能自动发现、有时间响应**的信号，而不是静默断崖（呼应 ts-strict 第 9 题、ts-migration 棘轮、ts-publish 第五节）。

**来源**：TS — "@deprecated / JSDoc"; 社区 — "how to deprecate an API in semver"

---

## 六、发布工程与安全

### 11. `prepublishOnly`、`files`、`npm pack --dry-run` 在发布流程里分别防什么？

- `prepublishOnly`（npm 生命周期钩子）：`npm publish` 前自动跑，典型放 `"build": "tsup ..."`，防**发出过期的 dist**（改了源码忘了重新编译）；
- `files`：发布白名单（如 `["dist","README.md","LICENSE"]`），防把 `src`、测试、`.env`、临时文件一并打进 tarball 泄漏出去（呼应 ts-publish 第二节）；
- `npm pack --dry-run`（或 `npm pack` 看产物）：真正发布前**预览 tarball 到底含哪些文件/多大**，用肉眼和 attw 再验一遍，防"少发了 .d.ts"或"多发了隐私文件"。
三者组合 = "构建新鲜 + 内容最小 + 发布前可见"的防线（呼应 ts-tooling CI 门禁）。

**来源**：npm docs — "scripts (prepublishOnly)"; npm docs — "package.json / files"

### 12. 发布 npm 包时，从供应链安全角度你至少要做哪三件事？

① **账号侧**：开 **2FA**（发布需 OTP），更好是用 **npm Trusted Publishing / OIDC provenance**（CI 里免长期 token、并能生成可验证的"这个包由这个仓库这次 CI 发布"证明，防投毒）；② **产物侧**：`files` 白名单最小化、发布前 `npm pack --dry-run` + `publint`/`attw` 验收，别把密钥/源码误发（呼应第 11 题）；③ **依赖侧**：锁定并审查依赖（lockfile、`npm audit`、避免幽灵依赖被劫持）、`provenance` 可追溯。这与后端部署的 CI/CD 安全同源（呼应 Express L8 部署、Express L7 CI）。核心心态：**发布即供应链，一个包被劫持能波及所有下载者**（2021 起多起事件）。

**来源**：npm — "Trusted Publishing / provenance"; GitHub — "npm supply chain attacks guidance"

---

## 补充（新专题 13-15）

### 13. 类型入口的三代演进：types 字段 → typings → exports.types 条件，今天的正确姿势？

历史：`types`/`typings`（TS 1.x 时代，顶层字段）→ DT 时代 @types 兜底 → 现代：`exports` 每个条件**内嵌 types 且必须放最前**（`{types:"./dist/index.d.ts", import:"...", require:"..."}`）+ 顶层 `types` 保留给老解析器兼容。姿势清单：types 条件先于 import/require/default；按格式双发 d.cts/d.mts；`moduleResolution node16/bundler` 消费端才会走 exports；typesVersions 只服务旧 TS（<4.7）消费者，新包能不打就不打。自检：attw 跑 ESM/CJS × TS 四种解析模式矩阵。

**来源**：TS 5.x《module resolution: exports 中 types 条件》文档；attw 官方矩阵说明。

### 14. 发布 CI 上，类型质量闸门按什么顺序摆？

构建后、发布前串四关：① `publint`（package 规范：exports/files/types 完整性）；② `attw --pack .`（各解析模式可达性——ESM 包最易翻车处）；③ 类型测试（tsd/expect-type 断言导出签名形状）；④ API 快照（`@microsoft/api-extractor` 或 ts-api-measurer，diff 即评审对象）；再加体积（size-limit）。触发层：PR 跑全链 + main 分支 npm provenance 发布（OIDC 无 token）。加分：changesets 的「type check 失败 block release」+ 发布 dry-run（npm pack）进制品扫描。目标：把「类型破坏」拦在版本固化前。

**来源**：publint/attw/api-extractor 各自 CI 集成文档；npm provenance 发布指南。

### 15. "只改类型不改运行时"能不能发 patch？给一个可辩护的判断框架。

看「消费者可观察行为」：① 类型**放宽**（加可选、union 扩成员、参数变宽）→ patch（旧代码仍编译）；② 类型**收紧/删除**（去 any、删字段、可选变必填）→ major（下游可能编译失败），哪怕运行时字节不变；③ 修复型（any→unknown 之外的精确化、错误签名纠正）：DT 惯例算 patch，但严肃 SDK 走 minor + CHANGELOG 显著标注「类型收紧」+ 提供 `// @ts-expect-error` 迁移清单。框架：把「消费者的 tsc 会不会红」当唯一判据；配 changeset 模板强制「type-only change 必答 impact」。

**来源**：Semantic Versioning FAQ（类型 API 立场）；DefinitelyTyped 版本策略文档 + TypeScript 博客「types are public API」讨论。
