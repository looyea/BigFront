# ts-migration 面试题精选

> 共 15 题，覆盖 **共存与基线 / @ts-check 与 JSDoc / 文件迁移顺序 / 边界信任 / 补类型 / 自动化与守进度** 六类。

---

## 一、TS 与 JS 共存、建立基线

### 1. 接手一个纯 JS 老项目要引入 TS，为什么第一步往往是 `allowJs: true` + `checkJs: false` + `noEmit: true`，而不是一上来全量转 `.ts`？

因为"大爆炸式全量重写"几乎必败：会冻结所有业务需求、周期长、风险集中。这三件套让你**零改动地把 `tsc` 接进项目并跑通 CI**：`allowJs` 让 `.js/.jsx` 纳入编译图（与后续新增的 `.ts` 混编），`checkJs:false` 保证先**不检查** JS（否则瞬间爆出成千上万条报错、无从下手），`noEmit:true` 让 `tsc` 只当"类型检查器"、产物仍交给既有构建链（babel/webpack/vite，呼应 ts-project 第 9 题双轨）。这样先建立"绿色基线"，再逐文件点亮（呼应 ts-migration 第二节）。

**来源**：TypeScript Handbook — "JSDoc reference / Adopt TypeScript gradually"; Effective TS — Item 45

### 2. `allowJs` 和 `checkJs` 有什么区别？只开 `allowJs` 不开 `checkJs` 时，JS 文件里明显的类型错误会被发现吗？

`allowJs` 决定 **JS 文件是否被纳入编译/模块图**（能被 `import`、能参与打包、能从 `.ts` 引用）；`checkJs` 决定 **是否对这些 JS 文件做类型检查**。只开 `allowJs` 时，JS 文件里的类型错误**不会**被报——它只是"被看见"，不被"检查"。想单独检查某个 JS 文件，有两种途径：全局开 `checkJs`（激进），或在该文件首行加 `// @ts-check`（精准点亮，推荐用于渐进迁移，呼应 ts-migration 第三节）。

**来源**：TypeScript Handbook — "allowJs / checkJs"; TS FAQ — "Enabling type checking for JavaScript files"

---

## 二、@ts-check 与 JSDoc

### 3. 不改文件后缀为 `.ts`，如何给一个 `.js` 文件加上类型并让 `tsc` 报错？这套机制的意义是什么？

文件首行写 `// @ts-check`，然后用 **JSDoc 注解**描述类型：

```js
// @ts-check
/** @param {number} a @param {number} b @returns {number} */
function sum(a, b) { return a + b; }
sum("x", 1);   // 即使在 .js 里也立刻报错
```

意义：① **零语法风险**地点亮类型——不用改后缀、不用动构建、不用担心 JSX/decorator 语法差异；② 适合"要长期留 JS"或"改动成本极高"的文件；③ JSDoc 类型与 TS 类型可互通，`tsc` 甚至能从 `.js`+JSDoc 生成 `.d.ts`（呼应 ts-declarations）。它是渐进迁移里"低风险试水"的首选手段（呼应 ts-migration 第三节）。

**来源**：TypeScript Handbook — "JSDoc support in JavaScript"; TS — "@ts-check / Supported JS types in TS"

### 4. JSDoc 能表达哪些"看起来只有 TS 才有"的类型？给几个常用标签。

大部分 TS 类型系统都能在 JSDoc 里表达：`@param {string=} x`（可选，等价 `x?: string`）、`@param {number|boolean}`（联合）、`@typedef`+`@property`（接口/对象形状）、`@type {Record<string, number>}`、`@returns`、`@template`（泛型）、`@type {readonly string[]}`、`@satisfies`（TS 4.9+）。还能 `@type {import('./foo').Bar}` 引用其它模块类型。局限：复杂条件/映射/infer 类型写起来冗长、可维护性差——这类就该转 `.ts`。JSDoc 适合"中等复杂度、要留 JS"的边界（呼应 ts-migration 第三节、ts-declarations 第 12 题）。

**来源**：TypeScript Handbook — "JSDoc reference"; JSDoc — "Advanced Types"

---

## 三、文件迁移顺序与改名坑

### 5. 单文件从 `.js` 迁到 `.ts` 时，为什么推荐"从叶子到根"？改名后会遇到什么 import 路径问题？

**从叶子到根**：先迁移"几乎不依赖内部、或依赖链末端"的工具/常量/纯类型模块——它们类型清晰、牵连少、改错了影响面小、能最快见效并建立信心；越靠近核心的模块耦合越重、报错越多，留到类型基建（`.d.ts`、公共类型）铺好后再动。改名坑：`git mv foo.js foo.ts` 后，若项目用 `moduleResolution: nodenext/node16`，**指向该模块的 import 必须写编译产物扩展名 `./foo.js`**（不是 `./foo.ts`，因为运行时加载的是编译后的 `.js`，呼应 ts-modules 第五节）；而 `bundler` 模式下无扩展名 `./foo` 通常照常解析。这一步搞错会出现"文件明明在却找不到模块"。

**来源**：社区 — "how to migrate a JS project to TypeScript incrementally"; TS 4.7 — "nodenext / ESM in Node"

### 6. 开启 `noImplicitAny` 后，成百上千个"参数隐式 any"报错，最稳妥的批量修法是什么？为什么不能直接 `: any`？

最稳妥是把参数先标成 `unknown`（最保守、不撒谎），再在真正用到的地方用类型守卫收窄成具体类型（呼应 ts-strict 第 3 题、ts-guards）。直接标 `: any` 是最危险的"消音"：`any` 会沿赋值链把检查关掉、污染整条类型链，等于"用迁移之名把旧 JS 的裸信任搬进 TS 换了身皮"（呼应 ts-any-unknown）。批量操作可交给 codemod（`ts-migrate`）插入 `any`/`TODO` 占位，但占位之后**必须**建 backlog 逐个收紧——否则债务只是从"没类型"变成"全是 any"，没本质改善（呼应 ts-migration 第七节）。

**来源**：Effective TS — Item 8/44; Meta — "ts-migrate" 工具文档

---

## 四、外部边界的信任问题

### 7. 迁移时处理 `JSON.parse(text)` 的结果，为什么 `const u = JSON.parse(text) as User` 是反面教材？正确姿势是什么？

`as User` 是**纯编译期假设**，运行时**什么都没校验**——如果 `text` 实际是别的形状（接口改版、恶意输入、字段缺失），程序会带着"假的 `User`"继续跑，在离崩溃点很远的地方炸（呼应 ts-any-unknown 断言、Express L5 校验）。正确姿势：把外部数据先当 `unknown`，用**类型守卫**（`function isUser(x: unknown): x is User`）或运行时校验库（**zod**/io-ts，解析即校验并推导类型，呼应 ts-declarations 第 12 题）在边界"建立类型证据"后才使用。迁移的目的恰恰是在这些信任边界补上校验，而不是绕过它。

**来源**：Total TypeScript — "the lies of TypeScript / assertions"; zod — "parse is the boundary"

### 8. `catch (e)` 里为什么不该直接 `e.message`？迁移到 TS 后这块要注意什么？

JS 里 `throw` 可以抛**任意值**（`throw "boom"`、`throw undefined` 合法），所以 `e` 不保证是 `Error`。TS 4.4+ 在 strict 族下把 `catch` 变量定为 `unknown`（`useUnknownInCatchVariables`，呼应 ts-strict 第 12 题），直接 `e.message` 会报错。正解是先收窄：`const msg = e instanceof Error ? e.message : String(e);`。盲目 `(e as Error).message` 只是把断言当止痛药，若真抛的是字符串就得到 `undefined`、又埋一个 bug（呼应 ts-guards）。

**来源**：TS 4.4 — "useUnknownInCatchVariables"; Effective TS — Item 8

---

## 五、给无类型依赖补 .d.ts

### 9. 迁移进行到一半，`tsc` 突然报一堆"Could not find a declaration file for module 'xxx'"，怎么回事、怎么办？

因为你开始检查的 TS 文件 `import` 了一些**纯 JS、无类型**的第三方库。TS 需要类型信息才能检查对它们的调用。处理优先级：① 先查社区 DefinitelyTyped 有没有 `@types/xxx`（有就装，注意版本要与库大版本对齐，呼应 ts-declarations 第 2 题）；② 没有就在项目里写 `types/xxx.d.ts`，用 `declare module "xxx"` **只声明你实际用到的那部分 API**（可先 `any` 兜底占位、随用随收紧）；③ 老式全局挂载脚本用 `declare global` / `declare namespace`。别一上来给整个库补全类型——按需、增量、可维护（呼应 ts-migration 第六节、ts-declarations）。

**来源**：TypeScript Handbook — "Declaration Merging / declare module"; DefinitelyTyped — "README"

---

## 六、自动化与"守进度"

### 10. 什么是迁移里的"棘轮（ratchet）"策略？举例说明怎么用 CI 让 TS 债务只减不增。

"棘轮"= 允许任意进度起步，但**只准向好的方向走、禁止回退**。落地：写脚本统计当前 `: any` 出现数、`@ts-expect-error` 数、仍是 `.js` 的文件数，存成基线（一个 JSON）；CI 每次 PR 重新统计，**若某指标超过基线就 fail**（新增了 any/expect-error/未迁文件即红灯），若下降则提示"可下调基线"。这样存量债不会被"新写的 any"继续抬高，团队每合并一个 PR 只能持平或还债。配合 `tsc --noEmit` 必过、ESLint `@typescript-eslint/no-explicit-any: warn`（呼应 ts-tooling、Express L7 CI 门禁、ts-migration 第七节）。

**来源**：社区 — "ratcheting / tightening lint rules over time"; GDS — "ratchet pattern for tech debt"

### 11. 清债时为什么推荐 `@ts-expect-error` 而不是 `@ts-ignore`？

`@ts-ignore` 只抑制下一行错误、**即使那行其实已经没错它也静默残留**——债务还清后你不会知道，指令变成误导后人的"僵尸注释"。`@ts-expect-error` 同样抑制下一行，但**若下一行其实没有错误，它会反向报错**"Unused '@ts-expect-error' directive"——于是当你把类型修好、或在别处补上校验后，这条临时豁免会**自动暴露**提醒你删掉。这让"临时闭眼"变成"可追踪、会自动到期提醒的债"，天然契合棘轮式迁移（呼应 ts-strict 第 9 题、ts-migration 第七节）。建议每条 `@ts-expect-error` 后都跟一句原因注释。

**来源**：TypeScript 3.9 — "ts-expect-error"; TS Handbook — "Error Suppression"

### 12. 有人图省事在迁移初期给一堆老文件首行加 `// @ts-nocheck`。这有什么问题？怎么补救？

`@ts-nocheck` 关闭**整个文件**的类型检查，等于"这些文件暂时完全裸奔"。作为**应急**（自动生成的巨型迁移文件、或一次性让 CI 变绿）可短期用，但**长期留着**就是自欺——你宣布"项目已用 TS"，实际这些文件一点类型保护都没有，且没人会主动回来摘。补救：① 把每个带 `@ts-nocheck` 的文件登记进 backlog/看板（可用脚本统计数量并纳入棘轮基线，只降不升）；② 排期逐文件移除，配 codemod 补基础类型；③ 移除时用 `@ts-expect-error` 精准兜住暂时改不动的**单行**而非整文件（呼应 ts-migration 第七节、ts-strict 第 9 题）。核心：让"逃避范围"从"整文件"收缩到"具体某行 + 有到期信号"。

**来源**：TypeScript Handbook — "@ts-nocheck"; 社区 — "gradual migration pitfalls"

---

## 补充（新专题 13-15）

### 13. 接手纯 JS 老项目引入 TS，第一个月做什么？

第一刀是**配置层不是代码层**：① 上 tsconfig（allowJs+checkJs+noEmit，noImplicitAny 先 false）拿「全量类型报告」不碰文件；② CI 挂 `tsc --noEmit`（baseline：当前错误数入棘轮）；③ 建 `types/` 手写核心 DTO/API 契约（收益最大）；④ 新文件一律 .ts + 严格从 src/shared 起步；⑤ 转译链不动（babel/vite 继续产 JS，TS 纯旁路）——「类型检查与构建解耦」让风险归零。里程碑：错误数下降曲线 + 新代码 100% TS，再谈 noImplicitAny 开与文件批量改名。反模式：第一天全量 rename .ts + strict 全开 = 报错雪崩回滚、团队抵触。

**来源**：TS 官方《Growing up with TypeScript》指南；Airbnb/Stripe 迁移复盘公开演讲。

### 14. noImplicitAny 一开冒出 800 个隐式 any，怎么消化？

分类手术：**70% 是回调参数**（map/filter/事件）——给最外层 API 补类型后推断自动灌进来，根本不用逐个改，从「类型源」开刀；**20% 是解构/默认参数**——函数签名显式化，配合 codemod（ts-morph 批量加 `: unknown` 占位再逐个收窄）；**10% 是真难**（第三方无类型库）——先 @types/手写 declare 或 `any`+TODO 进豁免清单。批处理策略：按目录分片放开（ts-strict-plugin 逐文件夹跑），每 PR 20-50 个可控；原则「让推断替你干活，只标边界与源头」。

**来源**：TS 文档 noImplicitAny 最佳实践；ts-morph API（批量 AST 改写）案例库。

### 15. 迁移半途的「双轨税」有哪些？「迁完」的定义是什么？

税单：① allowJs 下 `.js/.ts` 同名解析漂移（bundler 与 tsc 优先级不一致，幽灵模块）；② JSDoc 与 TS 类型两套真源互相腐烂；③ d.ts 手工 stub 与实际 API 脱节；④ 测试/构建链双份（babel 转译 vs tsc emit）——正解是**永远单一转译方**（TS 只做 noEmit）。终点定义（可验收）：type-coverage ≥95% 且 any 豁免清单为空；`allowJs` 关（或仅 tests）；strict 全开无 per-file 豁免；CI 类型检查与构建同源配置。文化口径：把「迁完」定义成**配置开关集合**而不是「所有文件名后缀」，防止假完成。

**来源**：TS《Type migration guide（Matt Bierner 版）》；Google JS→TS 迁移论文（ICSE 2023《How do JS developers migrate to TS》）。
