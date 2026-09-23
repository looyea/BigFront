# ts-tooling 面试题精选

> 共 12 题，覆盖 **转译 vs 类型检查 / 构建器选型 / isolatedModules / 类型感知 Lint / 运行 .ts / 增量与 monorepo** 六类。

---

## 一、转译 vs 类型检查

### 1. 为什么 esbuild、swc 比 `tsc` 快一到两个数量级？这个"快"是用什么换来的？

因为它们**根本不做类型检查/类型推断**——只做"删掉类型注解 + 把 TS/新语法降级成目标 JS"（transpile）。`tsc` 慢恰恰慢在要构建整程序的类型图、做推断与赋值兼容性检查（呼应 ts-project）。esbuild（Go）/swc（Rust）跳过这步、又能天然并行、且本体是原生二进制，所以极快。代价：**它们眼里类型是空气**，`const x: number = "错"` 照样转译成功。因此现代工程普遍"转译交给 esbuild/swc，类型检查单独 `tsc --noEmit`"两条腿走路（呼应 ts-tooling 第一节）。

**来源**：esbuild — "Why is esbuild fast?"; SWC 官网 — "The swc compiler"; Anthony Fu — "Type checking should be separate from transpiling"

### 2. 一个 Vite 项目 `npm run build` 成功了，能说明类型没问题吗？为什么？该怎么补？

**不能**。Vite 的 TS 转译底层用 esbuild，只删类型不检查（呼应 10-vite），构建成功只证明"语法能被转译、模块能解析打包"。要证明类型正确必须**单独跑 `vue-tsc --noEmit`（Vue 项目）或 `tsc --noEmit`（纯 TS）**，并把它接进 CI（呼应 Express L7）。推荐 `build` 脚本写成 `"vue-tsc -b && vite build"`，让类型不过时构建直接失败——Vue 官方脚手架正是这么配的。

**来源**：Vite 指南 — "Building for Production / vue-tsc"; Vue — "vue-tsc (formerly vtue-check)"

---

## 二、构建器选型

### 3. 打包一个要发到 npm 的 TS 库，你会选 tsup 而不是裸 esbuild，为什么？

裸 esbuild 只出 JS、**不会帮你生成/合并 `.d.ts`**，多格式（ESM+CJS）、多入口、`--watch` 都要自己攒。tsup 在 esbuild 之上补齐了库打包的脏活：`--dts`（内部用 rollup-plugin-dts 把类型合并成单个 `.d.ts`）、`--format esm,cjs`、`--splitting`、`--target`、`--external`，零配置即用（呼应 ts-publish）。同类还有 `unbuild`（unjs）、`rollup + dts 插件`、`publint` 校验导出。选型核心：**库要发类型 + 双格式，所以用带 dts 能力的打包器**。

**来源**：tsup 文档 — "What is tsup / bundled .d.ts"; unbuild — README

### 4. tsc / esbuild / swc / Babel 在"转译"这件事上各站在哪？为什么 Next.js 从 Babel 换成了 SWC？

四者都能"把 TS/JSX 变成 JS"，差别在**速度与能力边界**：`tsc` 权威但慢、还兼类型检查；Babel 插件生态最全、可注入自定义转换，但 JS 写的、慢；esbuild/swc 原生、快，插件模型各有取舍（swc 用 Rust 插件、esbuild 用 Go/JS 插件）。Next.js 换 SWC 的公开理由：**编译快 3~17×、能覆盖它需要的 JSX/TS/JS 变换和 minify，显著改善 dev 冷启与 HMR**（呼应 ts-tooling 第二节、Express L7 构建提速思路）。

**来源**：Next.js — "Compiling: Speeding up Cold Start / SWC announcement"; Babel vs SWC 对比 — 官方博客

---

## 三、isolatedModules 与纯转译器的约束

### 5. `isolatedModules` 到底改不改 emit？它禁用了哪些"跨文件才看得懂"的写法？

它**不改变 `tsc` 的发射产物**，而是打开一组**诊断**，禁止那些"逐文件转译器（看到单个孤立文件、无全项目类型信息）无法正确转译"的模式（呼应 ts-modules、ts-tooling 第三节）。典型：① 再导出类型必须 `export type { T }`，不能 `export { T }`（否则纯转译器不知 `T` 是类型还是会删的值）；② 非模块 `.ts` 文件（无 import/export）；③ 跨文件的 `const enum` 内联、以及 `declare` 环境声明的误用；④ 无 case 兜底的可辨识联合在 `switch` 穷尽检查上的依赖。开了它，代码就能安全地在 esbuild/swc/Vite 与 tsc 间迁移而不"换构建器就崩"。

**来源**：TS 2.2 — "--isolatedModules"; 社区 — "isolatedModules is not about emit"

### 6. 为什么 Vite/tsup 这类工具会要求或建议开 `isolatedModules`？不开会怎样？

因为它们的转译管线本质是**分文件并行**的（呼应第 1 题），看不到"某个 import 进来又 re-export 的东西其实是类型"。若你的代码依赖了"全局类型视图"的写法（如把纯类型当值再导出、`const enum` 跨文件内联），在纯转译器下产出的 JS 会**缺符号或行为不一致**——运行时才炸。开 `isolatedModules` 让 `tsc` **提前**在编辑/CI 阶段就把这些写法标红，从源头保证"类型检查器认为 OK 的代码，转译器也能正确处理"（呼应 ts-project 双轨、10-vite）。

**来源**：Vite — "TypeScript / isolatedModules"; tsup — "isolatedModules note"

---

## 四、类型感知 Lint

### 7. `@typescript-eslint` 的 `recommendedTypeChecked` 相比 `recommended` 强在哪？代价是什么？怎么开？

`recommended` 只做**语法层**规则（不需类型信息，快）。`recommendedTypeChecked`/`strictTypeChecked` 额外启用**类型感知**规则：`no-floating-promises`（Promise 忘了 await）、`no-unnecessary-condition`（类型上恒真/恒假的判断）、`strict-boolean-expressions`、`no-misused-promises`（把 async 函数当同步回调传）等——能抓 `tsc` 不管、但会引发真 bug 的逻辑问题（呼应 ts-strict）。代价：必须给 parser 喂 `parserOptions.projectService`（或旧 `project`）加载类型，**明显变慢**。适合在 CI/关键库上开全（呼应 Express L7）。

**来源**：typescript-eslint — "Typed Linting / getting started"; typescript-eslint — "rules by category"

### 8. ESLint 和 Prettier 长期"打架"，社区现在的正确姿势是什么？Biome 又是什么？

姿势是**职责分离**：ESLint 只负责"正确性/潜在 bug"类规则，把**格式**类规则关掉（用 `eslint-config-prettier` 关掉与 Prettier 冲突的规则），排版交给 Prettier。这样 ESLint 报错 = 真问题，而不是"你这行该换行"。近年 **Biome**（前 Rome）用 Rust 把 linter + formatter 合成一个快工具，很多人用它替代"Prettier + 一批 ESLint 格式插件"，但**类型感知的深度 lint 目前仍以 `@typescript-eslint` 更全**（呼应 ts-tooling 第四节）。取舍：要极致类型规则 → ESLint+Prettier；要轻快一体 → Biome。

**来源**：Prettier 文档 — "Integrating with ESLint"; Biome — "Why Biome / formatter+linter"

---

## 五、运行 .ts

### 9. ts-node、tsx、以及 Node 22 的 `--experimental-strip-types` 有什么区别？它们会做类型检查吗？

三者都**只擦/转类型后运行、不做类型检查**（呼应 ts-tooling 第五节）。区别在机制与速度：`ts-node` 基于 `tsc` 转译，功能全但慢，可 `--swc` 换 SWC 提速；`tsx` 基于 esbuild，快、零配置、支持 watch，适合日常 dev/脚本；Node 原生 `--experimental-strip-types`（22.6+）直接"剥离类型"运行真正的 `.ts`（**限制**：不能靠 `tsc` 降级语法、不能 enum/params 属性等需"重写出码"的特性，且完全不碰类型检查），是"未来无需构建器就能跑 TS"的方向。生产部署通常仍"先编译出 JS 再 `node dist/`"（呼应 ts-publish）。

**来源**：Node.js — "Type Stripping (--experimental-strip-types)"; tsx — README; ts-node — README

### 10. 有人说"我本地 tsx 跑得好好的，CI 也绿，为什么线上还是 type error 崩了"？哪个环节缺失？

几乎一定缺了**独立的类型检查门禁**：`tsx`/构建器只转译不检查（第 9 题），"跑得动 + 打包过 + lint 过"都不等于"类型过"。要在 CI 加一步 `tsc --noEmit`（或 `--build`），让它因类型错误而 fail（呼应 ts-tooling 第一、七节、Express L7）。另一常见坑：`ts-node` 默认会检查、但被换成 `tsx`/`--transpile-only`/`swc` 后就静默放弃了检查——迁移工具链时要专门确认"谁还在管类型"。原则：**转译器和类型检查器职责分离，CI 必须两个都跑**。

**来源**：Effective TS — Item 43; ts-node — "--transpileOnly / type checking"

---

## 六、增量与 monorepo

### 11. `tsc --build` 配合 `composite`/`references` 解决了什么性能问题？`--noEmit` 下还能增量吗？

大项目全量 typecheck 很慢。`composite: true` 让每个子项目产出可被引用的 `.d.ts`+`.tsbuildinfo`，父 `tsconfig` 用 `references` 声明依赖图；`tsc --build` 据此**只重编译改动的包及其下游**、跳过未变部分，并做正确的跨包增量（呼应 ts-tooling 第六节、ts-project 的 composite）。关于"增量":`--noEmit` 传统上不能与 composite 构建混用（build 需要产出 `.tsbuildinfo`），但 **TS 7（Go 原生编译器）的核心卖点之一就是极快的增量 type-checking**，社区也在推动 `--noEmit`/`--checkAll` 场景下的增量（tsgo、`--incremental` 写 `.tsbuildinfo`）。选型上 monorepo 常"子包各自 build + turbo/nx 做任务级缓存并行"。

**来源**：TS Handbook — "Project References / composite"; TS 7 (Go) — "native port / incremental type-checking"; turbo — README

### 12. 给你一个新 TS 仓库从零搭工具链，你会怎么分工：谁转译、谁检查、谁打包、谁 lint、谁格式化、怎么跑？

- **转译/类型分离**：编辑器 + CI 用 `tsc --noEmit`（或 vue 用 `vue-tsc`）做类型门禁；实际出码交给构建器；
- **应用打包**：Vite（esbuild dev + Rollup build）；**库打包**：tsup（`--format esm,cjs --dts`，呼应 ts-publish）；
- **Lint**：`@typescript-eslint` 上 `recommendedTypeChecked`，配 Prettier 管格式（或 Biome 一体）；
- **本地运行/脚本**：`tsx watch`；生产部署跑编译后的 `node dist/`；
- **门禁**：pre-commit（husky + lint-staged）+ CI 里 `typecheck && lint && build && test`，再加 any/@ts-expect-error 债务棘轮（呼应 ts-migration 第 10 题、Express L7）。
一句话：**每个工具只干它最擅长的一段，靠 CI 把它们串成一条不可回退的流水线。**

**来源**：Anthony Fu — "Library creation in 2023"; tsup / Vite / typescript-eslint 官方 best-practices
