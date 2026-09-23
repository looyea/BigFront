# L8 作业：生态与部署实战

> 覆盖本阶段三关：**ts-tooling**（转译/检查/打包/Lint 工具链）· **ts-frameworks**（Vue/React/Nest 落地）· **ts-publish**（发库上 npm）。这是 02-typescript 收官作业，请把前面 7 关的知识串进"能跑、能查、能发"的完整工程里。

---

## 一、读代码（10 小题：说出行为/结论并解释为什么）

**1.** 一个项目用 esbuild 打包，CI 里只有 `esbuild src/index.ts --bundle`。这份流水线缺了哪一环？会导致什么后果？

**2.** 读这段 eslint 配置片段，它启用了什么能力的规则？为什么会比普通 ESLint 慢？

```js
export default tseslint.config(...tseslint.configs.recommendedTypeChecked);
```

**3.** 下面 `package.json` 的 `exports` 有什么问题？消费方 `import type { X } from "my-lib"` 会怎样？

```jsonc
"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }
```

**4.** `.js` 文件首行 `// @ts-check` + 函数上 JSDoc `@param {number} n`，此时调用 `f("3")` 会报错吗？改成 `.ts` 后还需要 JSDoc 吗？

**5.** 这段 tsup 命令产出哪些文件？`--dts` 解决的是什么问题？

```bash
tsup src/index.ts --format esm,cjs --dts --clean
```

**6.** React 里 `const ref = useRef<HTMLInputElement>(null)`，为什么后续要 `ref.current?.focus()` 而不是 `ref.current.focus()`？这体现了哪个 strict 开关的哲学？

**7.** Vue `<script setup lang="ts">` 里 `const props = defineProps<{ a: string; b?: number }>()`，`b` 在 `props` 上的类型是什么？想给默认值该用什么？

**8.** NestJS 控制器 `create(@Body() dto: Dto)`，`Dto` 上没有任何 `class-validator` 装饰器、也没配 `ValidationPipe`。这有什么隐患？

**9.** 这个库 `files: ["src", "dist"]`、没有 `exports`、只留 `main`。发布时会把什么一起发出去？对消费者用打包器摇树有什么影响？

**10.** 某库既有 `import "lib"`（ESM）又有 `require("lib")`（CJS）用法并存，且库内部有个模块级 `const registry = new Map()`。这可能出什么问题？

---

## 二、手写（5 题）

**1.** 给一个"要双发 ESM+CJS、自带类型"的新库，手写 `package.json` 的关键字段：`type`、`main`、`module`、`types`、`exports`（含 `types` 条件放第一位、`import`/`require`/`default`）、`files`、`sideEffects`。

**2.** 写一个泛型 React 组件 `Select<T>`，props 为 `{ options: T[]; value: T; onChange(v: T): void; label: (t: T) => string }`，要求 `onChange` 收到的 `v` 类型随 `options` 元素自动推断（不许用 `any`）。

**3.** 用 Vue3 `<script setup>` 写一个组件：`defineProps<{ items: string[] }>()` + `defineEmits` 声明一个 `remove: [index: number]` 事件，父组件误写 `@remove="(s: string) => ..."` 时应报错（写出这段 emit 类型声明即可）。

**4.** 用 zod 定义一个 `UserSchema`（`id: number`、`name: string`、`role: "admin" | "user"`），导出其推断类型 `type User = z.infer<typeof UserSchema>`，并写一个在 HTTP 边界安全解析 `unknown` 输入的函数（用 `.parse`/`.safeParse`，不许 `as`）。

**5.** 补全"库发布 CI"的三个 npm script：`build`（tsup）、`check:publish`（依次跑 `publint` 与 `attw --pack .`）、`release`（先 `prepublishOnly` 触发 build，再 `npm publish`，要求开 provenance/OTP）。

---

## 三、场景题（1 题，系统设计级）

你要把一个内部 TS 工具库正式发到公司私有 npm，供前端（Vite）与后端（Node/nodemon + ts-node）两端消费。请给出一份**发布方案**，至少覆盖：

- 用什么打包（为什么）+ 产出哪些文件 + `exports`/`types` 条件怎么配；
- ESM-only 还是双发？依据是什么（考虑后端可能仍 `require`）；如何规避 dual package hazard；
- 发布前跑哪些静态验收（publint/attw/pack dry-run）各查什么；
- 类型契约如何纳入 SemVer 与 CI（导出的接口删字段算哪一级）；
- 供应链安全最低三条（2FA/OIDC/files 白名单/lockfile 审查）。

（400 字以内，落到可执行。）

---

## 四、简答题（3 题）

**1.** 为什么说"转译"和"类型检查"必须拆成两条独立的腿？只跑一条各自的后果是什么？

**2.** `React.FC` 被劝退、`defineProps` 要传泛型实参、`vue-tsc` 不能省——这三件事共同的底层原因是什么？（提示：编译期魔法 / 类型擦除 / SFC 虚拟代码）

**3.** `exports`、`types`、`main` 三者关系是什么？为什么"有 `exports` 还要留 `main`/`types`"，但 `exports` 里 `types` 又必须排第一？

---

## 五、挑战题 🏆

设计一套 **"从 0 到发布 + 防回退"的 TS 库工程模板**，让团队任何新库开箱即合规。需给出：

- **目录结构**（src / test / types / .github/workflows / 多份 tsconfig 的职责划分）；
- **工具链选型与分工**：转译器、类型检查、打包器、Lint（含类型感知规则集）、格式化、本地运行，各用哪个、为什么（呼应 ts-tooling 第 12 题）；
- **package.json 关键片段**（双发 + types-first exports）与 tsup/tsconfig 对应配置；
- **CI 门禁流水线**（顺序 + 失败即 block）：`typecheck(vue-tsc 或 tsc --noEmit)` → `lint(@typescript-eslint + 债务棘轮: any / @ts-expect-error 数量只降不升)` → `build` → `publint + attw` → `test(expectTypeOf 类型测试)` → `release(带 provenance)`；
- 一个"库类型健康度"度量：至少 3 个可自动统计的指标与阈值策略。

给出目录树 + 关键配置 + CI 步骤清单。这是把整个 02-typescript（L1–L8）收敛成一份可复用工程的能力体检。
