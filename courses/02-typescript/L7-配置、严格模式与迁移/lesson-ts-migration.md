# 把存量 JS 渐进迁移到 TypeScript

> 目标：给出可落地的"JS → TS"迁移 playbook——从 `allowJs` 共存、`// @ts-check` 逐文件点亮、JSDoc 补型、文件重命名策略、`noImplicitAny`/`strict` 棘轮式收紧，到用 `unknown`+守卫消化边界、用 codemod 与 CI 守进度。迁移不是一次性大爆炸重写，而是**可持续、可回滚、每步可发布**的工程（呼应 ts-project 第 12 题、ts-strict 第 10 题、Express L7 CI）。

---

## 一、总原则：渐进、可发布、棘轮

- **别停摆重写**："重写两周、冻结所有需求"几乎必败。改成"新债不再欠、旧债逐步还"。
- **每一步都能上线**：迁移过程中的每个 PR 都应是绿的（能编译、测试通过），可独立合并。
- **棘轮（ratchet）**：允许"任意 TS 化程度"起步，但设 CI 让指标（`any` 数、`@ts-expect-error` 数、未迁移文件数）**只降不升**。

---

## 二、第一步：让 TS 和 JS 共存

```jsonc
{
  "compilerOptions": {
    "allowJs": true,          // 纳入 .js/.jsx 参与编译（与 .ts 混编）
    "checkJs": false,         // 先不检查 JS（否则爆量报错）
    "noEmit": true,           // 迁移期常只做类型检查，产物仍交给 babel/现有构建
    "target": "ES2020",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

此时 `tsc --noEmit` 能跑起来、几乎无报错（因为 JS 不检查、TS 文件还很少）。先接进 CI 建立基线。产物继续由既有构建链（babel/webpack/vite）产出，`tsc` 只当"类型检查器"用（呼应 ts-project 第 9 题双轨）。

---

## 三、第二步：`// @ts-check` + JSDoc——不改后缀先享受类型

在 `.js` 文件顶加一行 `// @ts-check`，就**只对这一个文件**开启检查，且能用 **JSDoc** 写类型而**不必改成 `.ts`**：

```js
// @ts-check
/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function sum(a, b) { return a + b; }
sum("x", 1);   // 立刻报错，即使文件还是 .js
```

意义：① 零风险地给热点 JS 文件补类型、发现现有 bug；② 大量代码（尤其要长期留 JS 的）用 JSDoc 就够，无需转语法。JSDoc 类型和 TS 类型可互转（`tsc` 能从 `.js`+JSDoc 生成 `.d.ts`）。

---

## 四、第三步：文件迁移顺序与"改名即迁移"

**从叶子到根**（依赖图边缘往核心）：先迁**无内部依赖/被依赖少**的工具、常量、类型模块，最后迁耦合重的核心。单文件迁移动作：
1. `git mv foo.js foo.ts`；
2. 修编译器报错：补参数/返回类型、消 implicit any；
3. 对"导入它的 JS 文件"——若开了 `allowJs` 且 `moduleResolution: bundler`，`import from "./foo"` 无扩展名通常照常解析；`nodenext` 下注意要写 `./foo.js`（指向编译产物名，呼应 ts-modules 第五节）；
4. 单测保持绿。

`noImplicitAny` 阶段常见批量修法：把 `function f(x){}` 补成 `f(x: unknown)`（最保守）或真实类型，再逐步把 `unknown` 收紧。

---

## 五、第四步：边界用 unknown + 守卫，别急着断言

外部数据是迁移期最大的"谎言温床"。`JSON.parse`/HTTP/`localStorage`/DOM 一律先当 `unknown`，用**类型守卫**收窄（呼应 ts-guards、ts-strict 第 11 题）：

```ts
function isUser(x: unknown): x is { id: number; name: string } {
  return typeof x === "object" && x !== null
    && typeof (x as any).id === "number" && typeof (x as any).name === "string";
}
const data: unknown = JSON.parse(text);
if (isUser(data)) greet(data.name);   // 安全；否则用 zod 做运行时校验更好（呼应 ts-declarations 第 12 题）
```

反面教材：`const u = JSON.parse(text) as User` ——运行时啥也没校验，等于把旧的 JS"裸信任"搬进 TS 只是换了身皮。迁移的**目的**恰恰是在边界补上校验，而不是用 `as` 假装类型存在。

---

## 六、第五步：给无类型的老依赖补 .d.ts

内部文件之外，第三方纯 JS 库常常无类型（呼应 ts-declarations）。策略：先查 npm 有没有 `@types/xxx`；没有就在项目 `types/xxx.d.ts` 里写 `declare module "xxx"` 覆盖**你实际用到的 API**（先 `any` 兜底占位、随用随收紧）。全局挂载的老脚本用 `declare global`/`declare namespace`。这一步常是"编译突然冒出几百个找不到模块"的解药。

---

## 七、自动化与守进度

- **codemod**：`ts-migrate`（Meta 出品）自动把 JS 转 TS 并插入 `any`/`TODO` 占位、批量加注解；jscodeshift 定制规则。
- **棘轮 CI**：`tsc --noEmit` 必过；用脚本统计 `: any` / `@ts-expect-error` 数量并对比基线，超过即 fail；配合 ESLint `@typescript-eslint/no-explicit-any: warn`（呼应 ts-tooling、Express L7）。
- **度量看板**：`% 文件已是 .ts`、`% 行有类型`（c8/自定义脚本），让"进度"可视化、给团队正反馈。
- **别用 `// @ts-nocheck` 长期苟**：临时用（自动生成的巨型迁移文件首行），但要建 backlog 逐步摘除（呼应 ts-strict 第 9 题）。

---

## 八、自检清单

- [ ] `allowJs` + `checkJs:false` + `noEmit:true` 各在迁移里扮演什么？
- [ ] 为什么"文件还不改 `.ts` 也能享受类型"？靠什么？
- [ ] 迁移为何"从叶子到根"？改名 `.ts` 后 import 路径要注意什么（nodenext）？
- [ ] 边界数据为什么优先 `unknown`+守卫而不是 `as`？
- [ ] 无类型第三方库如何补？先写哪部分？
- [ ] 用什么机制让"债务只减不增"？

---

## 🚀 部署预告

- 迁移完成只是"能编译"，真正的类型价值在 L8：用 **ts-tooling**（ESLint/swc/tsup）守质量、**ts-frameworks**（Vue/React/Nest）里体验"迁完的收益"、**ts-publish** 把带类型的库发出去；
- `unknown`+守卫的边界策略与运行时校验（zod）、`.d.ts` 补型贯穿 ts-guards/ts-declarations；
- 棘轮式 CI 与 `tsc --noEmit` 门禁直接复用 Express L7 的 CI 实践。

下一关进入 **L8 生态与部署实战**——**ts-tooling**：tsc 之外的现代工具链（tsup/swc/esbuild + `@typescript-eslint` 质量门禁）。
