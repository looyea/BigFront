# L7 作业：配置、严格模式与迁移

> 覆盖本阶段三关：**ts-project**（tsconfig 全景）· **ts-strict**（严格开关逐个击破）· **ts-migration**（JS 渐进迁移）。先读透、再手写、最后回到场景与简答收束。

---

## 一、读代码（10 小题：说出每段的行为/结论，并解释为什么）

**1.** 下面 tsconfig 片段里 `target` 与 `lib` 错配会引发什么？只改 `target` 够吗？

```jsonc
{ "compilerOptions": { "target": "ES5", "lib": ["ES2020"], "strict": true } }
```

**2.** `include: ["src"]` 和 `files: ["src/main.ts"]` 有什么区别？若某文件既不在 include 也没被任何文件 import，它会被类型检查吗？

```jsonc
{ "include": ["src"], "exclude": ["src/**/*.test.ts"] }
```

**3.** 为什么下面这段在 `strict` 关时一片绿、开 `strictNullChecks` 后报错？给出**不用 `!`** 的两种修法。

```ts
function len(s?: string) { return s.length; }
```

**4.** 开了 `noUncheckedIndexedAccess` 后，这两行的类型分别是什么？为什么第 2 行仍报错？

```ts
const arr = [1, 2, 3];
const x = arr[0];      // ?
x.toFixed();           // ?
```

**5.** 读 `tsconfig` 的 `extends`：子配置覆盖了父配置的 `strict:false`，但 `include` 呢？数组字段是"合并"还是"整体替换"？

```jsonc
// base: { "compilerOptions": { "strict": true }, "include": ["src"] }
// child: { "extends": "./base", "compilerOptions": { "strict": false }, "include": ["app"] }
```

**6.** 迁移期这个配置组合，`tsc` 会产出 JS 文件吗？产物从哪来？

```jsonc
{ "compilerOptions": { "allowJs": true, "checkJs": false, "noEmit": true } }
```

**7.** 下面 `.js` 文件首行的注释起什么作用？没有它会怎样？

```js
// @ts-check
/** @param {number} n */
function double(n) { return n * 2; }
double("3");
```

**8.** `paths` 只影响编译期还是运行时？为什么单靠 `paths` 别名常常"编译过、运行崩"？

```jsonc
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
```

**9.** 迁移后 import 路径：`moduleResolution: "nodenext"` 下 `import "./foo.js"` 指向的是源码还是产物？为什么不写 `./foo.ts`？

**10.** 这一行是清债的好实践还是坏实践？换成什么指令能让"债还清时自动暴露"？

```ts
// @ts-ignore
const y: number = "x";
```

---

## 二、手写（5 题）

**1.** 手写一份"新项目推荐"的 `tsconfig.json`：开 `strict`，并**额外**手动开启三个不在 `strict` 里但价值高的开关（写出名字与一行注释说明各拦什么）。

**2.** 给下面的类补齐，使其在 `strictPropertyInitialization` 下不报错，且**分别演示**三种合法手段：构造器赋值、`!`（definite assignment）、改可选 `?`。写明每种手段各自传达的"意图"。

```ts
class Config {
  host: string;
  port: number;
  token: string;
  constructor(input?: { host: string; port: number });
}
```

**3.** 写一个类型守卫函数 `isJsonObject(x: unknown): x is Record<string, unknown>`，用它安全地读取 `JSON.parse(text)` 结果里的 `name` 字段（不许用 `as`）。

**4.** 用 JSDoc（**不改后缀、文件仍是 `.js`**）给下面函数标注：参数 `ids` 是只读数字数组，返回 `Promise<string>`。让 `// @ts-check` 下调用 `f(["1"])` 报错。

```js
// @ts-check
async function names(ids) { return ids.map(String); }
```

**5.** 写一段"棘轮"脚本思路（伪码/真实皆可）：统计仓库里 `@ts-expect-error` 的数量，与基线 JSON 比较，超过则 `process.exit(1)`。说出它应挂在 CI 的哪一步。

---

## 三、场景题（1 题，系统设计级）

你入职一个 12 万行纯 JS 的老项目，老板要求"全面 TS 化但不许停业务、不许大爆炸重写、每步可发布"。请给出一份**分阶段迁移 playbook**，至少覆盖：

- 第 0 步如何让 `tsc` 先接进 CI 且基线为绿（写清关键 tsconfig 选项及理由）；
- 单文件迁移的顺序原则与一次迁移的具体动作（含 nodenext 路径坑）；
- 面对无类型第三方库、面对 `JSON.parse`/HTTP 边界数据分别怎么处理；
- 用什么机制保证"团队不会边迁边欠新债"（给出可量化指标）；
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` 三者在这个流程里的正确用法与禁区。

（400 字以内，落到"可执行"。）

---

## 四、简答题（3 题）

**1.** 有人说"我 `strict: true` 全开了，所以我的 TS 是类型安全的"。请举出至少 3 个 strict **管不到**的"信任边界/谎言入口"，并各给一句应对。

**2.** `allowJs`、`checkJs`、`// @ts-check` 三者关系是什么？"只开 allowJs 不开 checkJs"和"某文件加 @ts-check"分别适合什么迁移阶段？

**3.** `noUncheckedIndexedAccess` 带来的 `| undefined` 噪音，你有哪几种优雅消化方式？为什么它其实更贴近运行时真相？

---

## 五、挑战题 🏆

设计一套"**strict 渐进开启 + 棘轮防回退**"的完整工程方案，让一个仓库能从现在的 `strict:false` 平滑走到 `strict:true` 且**期间每个 PR 都是绿的、可发布的**。需包含：

- 如何用**多份 tsconfig**（如 `tsconfig.strict.json` + 分目录 extends）实现"新代码从严、老代码从宽"；
- 每开一项 strict 子开关（`noImplicitAny` → `strictNullChecks` → …）时的**批量修法**（哪些交给 codemod、哪些留人工）；
- CI 门禁的**最小规则集**（哪些必须 fail、哪些只 warn、如何统计 any / expect-error / nocheck 三类债务并只降不升）；
- 一个可展示的**进度度量**（%文件已 .ts / %行有类型 / 债务趋势），说明数据从哪来、多久刷新。

给出目录结构 + 关键 tsconfig 差异 + CI 步骤清单（可用任意 CI 语法描述）。
