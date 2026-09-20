# tsc 之外的工具链：转译、打包、Lint、运行

> 目标：把"用 TS 干活"需要的**整条现代工具链**讲清楚——为什么 `tsc` 之外还要 esbuild/swc/tsup/vite，"转译（transpile）"和"类型检查（type check）"为什么会分家，`@typescript-eslint` 如何做"带类型的 lint"，以及 `tsx`/`ts-node`/`--build` 各管什么。前面 7 关都在讲"语言"，这一关讲"工程如何把它跑起来、守起来"（呼应 ts-project 第 9 题双轨、10-vite、Express L7 CI）。

---

## 一、最重要的一件事：转译 ≠ 类型检查

`tsc` 一个人干两件事：**类型检查** + **把 TS 发射（emit）成 JS**。现代工具链把这两件事**拆开**了：

```
        类型检查（看类型对不对）      转译（删类型、降语法）
tsc     ✓ 完整                       ✓（但慢，单线程全量）
esbuild ✗ 完全不做                   ✓（Go 写的，快 10~100×）
swc     ✗ 完全不做                   ✓（Rust 写的，同样极快）
```

esbuild/swc **只删类型语法、不做任何类型检查**——这正是它们快的原因（不用做类型推断）。所以：

> **构建用 esbuild/swc 求快，类型检查单独跑 `tsc --noEmit` 求对。** 两条腿都要有，缺了后者，CI 会"打包成功但类型全是错的"（呼应 ts-project 第 9 题、10-vite 的 esbuild 只删类型）。

---

## 二、各工具的定位与选型

| 工具 | 干什么 | 何时用 |
|---|---|---|
| `tsc` | 类型检查 + 发射 + 生成 `.d.ts` | 库要发 `.d.ts`、CI 的类型门禁（`--noEmit`） |
| **esbuild** | 极速转译/打包（多文件、dev server） | Vite 的 dev 与 TS 转译底层 |
| **swc** | 极速转译 + 插件生态（Rust） | Next.js 默认编译器、替换 babel |
| **tsup** | 基于 esbuild 的**库打包器**（零配置出 ESM/CJS + `dts`） | 发 npm 库（呼应 ts-publish） |
| **vite** | 应用级 dev/build（esbuild + Rollup） | 前端应用（呼应 10-vite） |
| **tsx / ts-node** | 直接**运行** `.ts`（转译后交给 Node） | 跑脚本、CLI、dev |
| **biome / eslint** | Lint + 格式化 | 质量门禁（下一节） |

**为什么库常用 tsup 而不用裸 esbuild**：tsup 帮你顺手用 `rollup-plugin-dts`/`--dts` 生成并合并 `.d.ts`、多入口、多格式（esm+cjs）、`--watch`，把"发库"的脏活打包好了（呼应 ts-publish）。

---

## 三、`isolatedModules`：为"分文件转译"买的单

esbuild/swc 是**逐文件**转译的（拿到一个 `.ts` 就删类型，看不到全项目）。`tsc` 默认全量看得到跨文件信息。为了让代码"能被安全地逐文件转译"，开 `isolatedModules`——它**不改变 emit**，只是**禁用那些"单文件看不到全貌"的危险写法**（呼应 ts-modules、10-vite）：

```ts
// ✗ isolatedModules 下报错：re-export 一个类型却没用 export type
export { SomeType } from "./types";
// ✓
export type { SomeType } from "./types";

// ✗ 跨文件 enum 成员在纯转译器下语义不定（用 const enum 更危险）
// ✓ 用 `as const` 对象或联合类型替代（呼应 ts-modules）
```

Vite/tsup 这类工具要求（或强烈建议）开它，`tsc` 端开了能提前暴露"换构建器就崩"的隐患。

---

## 四、@typescript-eslint：会"看类型"的 Lint

普通 ESLint 只解析语法树、不懂类型。`@typescript-eslint` 提供两套规则：

- **语法类规则**（快，不需类型信息）：如 `no-unused-vars`；
- **类型感知规则**（强，但要"喂" tsconfig）：如 `no-unnecessary-condition`、`strict-boolean-expressions`、`no-floating-promises`——它们能判断"这个表达式类型上永远为真""这个 Promise 忘了 await"。

启用类型感知要配 `parserOptions.projectService`（或旧的 `project`/`tsconfigRootDir`）——**lint 变慢但换来电光火石级的真 bug 捕获**（呼应 ts-strict、Express L7 的 CI 门禁）：

```js
// eslint.config.js (flat)
import tseslint from "typescript-eslint";
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,   // 类型感知规则集
  { languageOptions: { parserOptions: { projectService: true } } }
);
```

配合棘轮（呼应 ts-migration 第 10 题）：`no-explicit-any`、`no-non-null-assertion` 设成 `warn`/`error`，让 `any` 和 `!` 的引入在 PR 就报警。

**格式化交给 Prettier（或 Biome），别用 ESLint 管空格**——两者分工：ESLint 抓"对错/潜在 bug"，Prettier 抓"长相"。

---

## 五、运行 .ts：tsx vs ts-node vs 先编译

```bash
tsx script.ts        # esbuild 转译后直接跑，快、几乎零配置（推荐 dev/脚本）
ts-node script.ts    # 老牌，基于 tsc 转译，较慢，SWC 版叫 ts-node --swc
node --experimental-strip-types file.ts  # Node 22+ 原生"擦类型"直接跑（未来方向，但仍不检查类型）
```

共同点：**都只转译、不做类型检查**（呼应第一节）。要检查类型仍需单独 `tsc --noEmit`。生产部署通常是"先 `tsc`/tsup 编译出 JS，再 `node dist/`"，而不是线上跑 `.ts`（呼应 ts-publish、ts-migration 的 noEmit 双轨）。

---

## 六、Monorepo 加速：`tsc --build` + project references

大仓库/多包用**增量编译**：每个子包一份 `tsconfig.json` 带 `composite: true`，父配置用 `references` 串起来，`tsc --build` 只重编译改动及其下游、并缓存 `.tsbuildinfo`（呼应 ts-project 的 composite、ts-classes 的库拆分）。这解决"改一个文件全项目重头 typecheck"的慢问题。Biome/turbo/nx 也在此层提供并行与缓存。

---

## 七、一次真实的"本地提交流程"该长什么样

```bash
# package.json scripts
"typecheck": "tsc --noEmit"                          # 类型门禁
"lint":      "eslint . --max-warnings 0"             # 质量门禁（含类型感知规则）
"build":     "tsup src/index.ts --format esm,cjs --dts"  # 产物 + d.ts（库）
"dev":       "tsx watch src/server.ts"               # 本地跑（呼应 03-nodejs/Express）
"check":     "npm run typecheck && npm run lint"
```

把 `check` 挂进 pre-commit（lint-staged + husky）与 CI（呼应 Express L7）：**转译产物能跑 + 类型全过 + 规则全绿 + 债务棘轮不升**，四件事一起守住。

---

## 八、自检清单

- [ ] 为什么说"构建用 esbuild/swc、类型检查用 `tsc --noEmit`"是两条必须都有的腿？
- [ ] `isolatedModules` 到底改变了什么、没改变什么？它禁了哪些写法？
- [ ] 类型感知的 ESLint 规则为什么慢、值不值？怎么开？
- [ ] `tsx`/`ts-node` 会帮你做类型检查吗？生产该跑 `.ts` 还是 `.js`？
- [ ] 大仓库如何增量 typecheck？`composite`/`references`/`--build` 各扮演什么？
- [ ] 格式化该谁负责（ESLint vs Prettier/Biome）？

---

## 🚀 部署预告

- 工具链搭好只是"能跑能查"，**L8 的价值在后面两关兑现**：**ts-frameworks** 看 Vue（`vue-tsc`）/ React / Nest 如何把这条链接进框架、**ts-publish** 把带 `.d.ts` 的库发上 npm（tsup 正是它的主力）；
- `tsc --noEmit` + `@typescript-eslint` + 棘轮，直接复用 Express L7 的 CI 门禁范式；
- `isolatedModules`/esbuild 只删类型的约束，与 10-vite 的构建心智完全一致。

下一关进入 **ts-frameworks**：TypeScript 在 Vue / React / NestJS 里的真实落地姿势。
