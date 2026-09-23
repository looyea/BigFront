# tsconfig.json 全解与工程结构

> 目标：把 `tsconfig.json` 从"抄来的黑盒"变成"能解释每一行"的工程基石。掌握三大类选项（**编译目标 / 严格性 / 模块与工程组织**）、`include`/`exclude`/`files`/`extends`、项目引用（project references）与 monorepo、以及"多个 tsconfig（app / lib / test）"的组织范式。严格性开关的细节留给下一关 ts-strict，本关先建全局地图。

---

## 一、tsconfig 的三段结构

```jsonc
{
  "compilerOptions": { /* 编译/检查选项 */ },
  "files": ["src/main.ts"],           // 显式文件清单（少用）
  "include": ["src/**/*"],            // glob 纳入编译的文件
  "exclude": ["node_modules", "dist"],// 从 include 里再排除
  "extends": "./tsconfig.base.json",  // 继承基配置
  "references": [{ "path": "./packages/ui" }]  // 项目引用
}
```

`include`/`exclude` 只决定**哪些文件进入编译**，不决定输出结构；`outDir` 决定产物目录。`tsconfig.json` 放在项目根，`tsc` 会向上查找；`tsc -p <dir>` 指定。IDE 读取的是**同一个** `tsconfig`，所以"编辑器报错和命令行不一致"多半是 tsconfig 边界/`include` 差异或存在多份配置。

---

## 二、编译目标与产物

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",           // 语法降级到哪一版 JS（决定 class/#、可选链等是否转译）
    "lib": ["ES2022", "DOM"],     // 提供哪些"环境类型声明"（不转译、只给类型）
    "outDir": "./dist",
    "rootDir": "./src",           // 影响输出目录结构
    "sourceMap": true,
    "removeComments": true,
    "module": "ESNext",           // 产物模块格式（见 ts-modules 第五节）
    "moduleResolution": "bundler"
  }
}
```

关键区分：**`target` 转译语法、`lib` 提供类型环境**，二者独立。跑老环境想要 `Promise.allSettled` 的类型，`target` 可以是 ES5 但你必须把 `lib` 或 polyfill 类型加进来，否则"运行时能跑但类型报不存在"。`target` 还连带影响 `useDefineForClassFields` 默认值（ES2022+ 为 true，呼应 ts-classes 第 3 题）。

---

## 三、严格性家族（详见 ts-strict）

```jsonc
{
  "compilerOptions": {
    "strict": true,                    // 一揽子打开下面这些
    // "noImplicitAny": true,
    // "strictNullChecks": true,
    // "strictFunctionTypes": true,
    // "strictBindCallApply": true,
    // "noImplicitThis": true,
    // "useUnknownInCatchVariables": true,
    // "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,  // 需单独开，strict 不含
    "exactOptionalPropertyTypes": true // 需单独开
  }
}
```

`strict: true` 打开的是**一组** `strict*` 开关的总闸（呼应 ts-functions 逆变、ts-basics null 检查）。但有几个"更严"的开关（`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noPropertyAccessFromIndexSignature`）**不包含**在 `strict` 里，要手动加。所有细节、逐个报错样例放到下一关 ts-strict 深讲。

---

## 四、`extends` 与"多份 tsconfig"

现代前端工程常见三份配置分层：

```
tsconfig.base.json     // 共享：strict、paths、编译器偏好
apps/web/tsconfig.json  // extends base，target=DOM，types=vite/client
packages/ui/tsconfig.json // extends base，声明输出、composite
tsconfig.node.json      // 给 vite.config.ts / 脚本用（types=node、module）
```

`extends` 只做**对象合并**（`include`/`exclude` 会被子配置**覆盖**而非叠加，`compilerOptions` 逐键合并）。这带来"路径解析相对父/子文件"的坑——`extends` 里的相对路径按**被继承文件**解析。用 `@tsconfig/*` 预设包（如 `@tsconfig/strictest`）能快速继承社区推荐组合（呼应 ts-tooling）。

---

## 五、paths 别名与根目录

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"], "@ui": ["packages/ui/src"] }
  }
}
```

`paths` 让 `import "@/util"` 在**类型层**解析到真实目录。但 `tsc` 只解析类型、**不改写**产物里的 import 路径——运行时还得靠打包器（Vite `resolve.alias`、webpack alias、Node 子路径 `imports`）对齐（呼应 10-vite）。"TS 不报错但运行 `Cannot find module`"几乎都是 paths 只配了一半（只给了 tsc、没给 bundler）。

---

## 六、项目引用与增量编译

```jsonc
// tsconfig.json
{ "files": [], "references": [{ "path": "app" }, { "path": "lib" }] }
// lib/tsconfig.json
{ "compilerOptions": { "composite": true, "declaration": true }, "include": ["src"] }
```

`composite` + `references` 让 monorepo 里的包"只编译变更部分、复用上游 `.d.ts`"（增量、并行）。`tsc -b`（build 模式）按依赖拓扑构建。配合 `incremental`/`tsBuildInfoFile` 与 `skipLibCheck`（呼应 ts-declarations 第 8 题）能把大型工程 `tsc` 时间压到可接受（呼应 ts-advanced 第 9 题性能）。这是 Nx/turbo 之外 TS 原生的多包编译方案。

---

## 七、常见选项速查与"别乱抄"

| 选项 | 作用 | 备注 |
|---|---|---|
| `noEmit` | 只做类型检查不产文件 | CI/`tsc --noEmit`、vite 开发用（呼应 Express L7 CI） |
| `emitDeclarationOnly` | 只出 `.d.ts` | JS 交给 tsup/rollup（呼应 ts-publish） |
| `isolatedModules` | 禁用不可单文件转译的写法 | Vite/SWC 必开（呼应 ts-modules 第 7 题） |
| `verbatimModuleSyntax` | import 原样保留 | 配 `import type` 用 |
| `resolveJsonModule` | 允许 import json | |
| `allowJs`/`checkJs` | 纳入/检查 JS | 渐进迁移用（呼应 ts-migration） |
| `jsx` | JSX 编译模式 | react-jsx 等（呼应 ts-frameworks） |

忠告：`tsconfig` 不是"从网上复制一大段"就完事——每个开关都在改变"哪些代码合法"。团队里维护一份 `tsconfig.base.json` 并**逐条注释为什么这么设**，比十份互相矛盾的散装配置强（呼应 ts-advanced 第 11 题务实哲学）。

---

## 八、自检清单

- [ ] `target` 和 `lib` 分别管什么？为什么会"运行时能跑、类型报不存在"？
- [ ] `include`/`exclude`/`files` 决定的是输入还是输出？`outDir`/`rootDir` 呢？
- [ ] `strict: true` 打开哪些子开关？哪几个"更严"的要单独加？
- [ ] `extends` 合并时 `include` 是叠加还是覆盖？相对路径按谁解析？
- [ ] `paths` 只配 tsc 不配 bundler 会怎样？
- [ ] `composite` + `references` 解决 monorepo 的什么问题？

---

## 🚀 部署预告

- 本关是"L7 配置/严格/迁移"的地基图；下一关 **ts-strict** 把第三节一笔带过的每个严格开关**逐个**展开（含真实报错样例与踩坑）；
- 再下关 **ts-migration** 讲如何把 `allowJs`/渐进 strict/`checkJs` 用于存量 JS 项目，正对应第四节 `allowJs`、本关"别乱抄"；
- `paths`/`module`/`moduleResolution` 与 Vite（10-vite）、Node（03-nodejs）构建链的关系，会在 ts-tooling、ts-frameworks 继续落地。

下一关进入 **ts-strict**：严格模式全开关逐个击破。
