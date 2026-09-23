# package.json 与 npm 工作流

> 目标：`package.json` 是一个 Node 项目的"身份证 + 合同"。吃透它的关键字段（`name`/`version`/**`scripts`**/`bin`/`main`/`type`/**`dependencies` vs `devDependencies`**/`engines`/`exports`），搞懂 **semver 语义化版本**区间怎么写、**lockfile** 到底锁什么、`npm install` 背后如何解析依赖树，以及 **npm / pnpm / yarn** 三者的差异与选型。这是从"写脚本"升级到"管工程"的核心一课（呼应 02-typescript 的 ts-modules、下一关 node-publish）。

---

## 一、package.json 骨架与关键字段

```jsonc
{
  "name": "my-app",                 // 发包时全局唯一（npm registry）
  "version": "1.2.3",               // semver，见第三节
  "type": "module",                 // "module"→.js 按 ESM 解析；"commonjs"→按 CJS（呼应 node-esm-cjs）
  "main": "./dist/index.cjs",       // CJS/老解析器入口（发包时见 node-publish）
  "exports": { "." : {...} },       // 现代条件导出入口（优先于 main）
  "bin": { "my-app": "./cli.js" },  // 安装后可作为命令调用（呼应 node-cli）
  "engines": { "node": ">=20" },    // 声明 Node 版本要求
  "scripts": { /* 见第二节 */ },
  "dependencies": { /* 运行时依赖 */ },
  "devDependencies": { /* 开发期依赖 */ }
}
```

- **`type`** 决定 `.js` 按 ESM 还是 CJS 解析（呼应 node-esm-cjs 的 `.mjs`/`.cjs` 覆盖规则）；
- **`engines`** 只"提示"，要真正强制需 CI 里校验或 `.nvmrc`/`corepack` 配合。

---

## 二、scripts：项目的统一命令入口

```jsonc
"scripts": {
  "start": "node src/index.js",
  "dev": "node --watch src/index.js",       // Node 18+ 内置 watch（呼应 node-cli）
  "build": "esbuild src/index.ts --bundle", // 呼应 10-vite/esbuild
  "test": "node --test",                    // 内置 test runner（见 node-testing）
  "lint": "eslint .",
  "prepublishOnly": "npm run build"         // 发布前自动跑（见 node-publish）
}
```

- `npm run <name>` 执行；`start`/`test`/`install` 等**生命周期脚本**可省略 `run`；
- **pre/post 钩子**：`preXXX`/`postXXX` 会在 `XXX` 前后自动执行（如 `prepublishOnly`）；
- scripts 里能直接用**本依赖树 `node_modules/.bin`** 的命令（如 `eslint`）——无需全局安装（呼应 `bin`）；
- **传参**要加 `--`：`npm run dev -- --port 3000` 才会把 `--port 3000` 透传给脚本；
- 命令**跨平台**：Windows 没有 `&&`/`rm -rf` 等 bash 语法，慎用 shell 特性（呼应 node-child-process）。

---

## 三、semver：版本号与区间

版本 `主.次.补丁`（`MAJOR.MINOR.PATCH`）：MAJOR=破坏性变更、MINOR=向后兼容新增、PATCH=向后兼容修复（另有 `-beta.1` 预发布标签）。

依赖区间（写在 `dependencies` 里的值）：

| 写法 | 含义 |
| --- | --- |
| `^1.2.3` | 兼容 1.x.x（**默认**，`npm i pkg` 生成）：不改 MAJOR |
| `~1.2.3` | 只升补丁 1.2.x |
| `1.2.3` | 精确锁死 |
| `>=1.2.3 <2` | 范围 |
| `*` / `latest` | 任意（危险，别用） |

> 特例：`^0.x` 语义更保守（`^0.2.3` 只允许 0.2.x，因为 0.x 阶段任何变更都可能破坏）。

`npm outdated` 看谁过期，`npm update` 在区间内升级，`npm i pkg@latest` 跨区间升级（可能引破坏性变更→读 CHANGELOG，呼应 node-publish 的供应链风险）。

---

## 四、lockfile：区间 vs 精确锁定

- `package.json` 写的是**区间**（`^1.2.3`），`package-lock.json`（npm）/ `yarn.lock` / `pnpm-lock.yaml` 记录**本次实际解析出的精确版本 + 完整性 hash + 依赖树**。
- 意义：保证**团队与 CI 装到一模一样的树**——`npm ci` 严格按 lockfile 安装（不做解析、更快更可复现，CI 必用）。
- **lockfile 要提交进版本库**（应用项目必提交；库项目也建议提交以稳定开发环境）。
- 删掉 lockfile 重装 → 区间内可能装到更新的补丁/次版本，"我这儿能跑你那儿不行"的常见根因。

---

## 五、dependencies vs devDependencies vs peer vs optional

- **`dependencies`**：运行时必需（express、dayjs）——被 `require`/`import` 进生产代码的；
- **`devDependencies`**：仅开发/构建期（eslint、typescript、vitest、测试框架）——`npm i --production`/`NODE_ENV=production` 时不装；
- **`peerDependencies`**：声明"我需要你提供某个包/版本"，由宿主安装（插件库对 react/express 的期待，呼应 Express 中间件）——避免重复实例；
- **`optionalDependencies`**：可有可无，装失败不阻断；
- **`overrides` / `resolutions`**：强制传递依赖用指定版本（修底层包漏洞）。

判据：**会被生产代码 import 的→dependencies，否则 devDependencies**。发错包会让生产镜像虚胖或缺依赖。

---

## 六、node_modules 与提升（hoisting）

- 依赖被**扁平化提升**到顶层 `node_modules`，版本冲突时才嵌套——所以"幽灵依赖"（没写进 package.json 却能 `require` 到上层被提升的包）在 npm/yarn 下会发生，一旦上层结构变化就崩；
- 模块解析算法：从当前目录逐级向上找 `node_modules`（呼应 node-modules 加载缓存、node-path-url）；
- 幽灵依赖是 pnpm 要解决的核心问题之一（见下节）。

---

## 七、npm vs pnpm vs yarn

| 维度 | npm | yarn (v1/berry) | **pnpm** |
| --- | --- | --- | --- |
| lockfile | package-lock.json | yarn.lock | pnpm-lock.yaml |
| 磁盘 | 每项目各存一份 | 同 | **内容寻址全局存储 + 硬链接**，省空间 |
| 幽灵依赖 | 有（提升） | 有 | **无**（默认非扁平 `node_modules/.pnpm` 结构） |
| 安装速度 | 中 | 中 | **快**（硬链接复用） |
| monorepo | workspaces | workspaces | **workspaces 体验最佳** |

选型直觉：**大仓/多包/在意磁盘与严格性→pnpm**；生态默认→npm；老项目 yarn。三者**不要混用 lockfile**（一个项目只留一套）。

---

## 八、corepack 与包管理器版本

Node 16.9+ 内置 **corepack**：`packageManager` 字段（如 `"pnpm@9.1.0"`）+ `corepack enable`，让项目**自动用指定版本/包管理器**，团队成员不必手动全局装对版本——消除"我用 npm 你用 pnpm"的漂移。

---

## 九、常用命令速查

```bash
npm init -y                 # 生成默认 package.json
npm i                       # 按 lockfile/区间安装
npm ci                      # CI：严格按 lockfile -clean 安装
npm i pkg -D                # 装为 devDependency
npm ls                      # 看依赖树 / 找冲突
npm outdated                # 看可升级项
npm view pkg versions       # 查某包所有版本
npm run pkg-scripts -- --flag
```

---

## 十、自检清单

- [ ] `type`、`main`、`exports`、`bin`、`engines` 各管什么？
- [ ] `^1.2.3` 与 `~1.2.3`、`^0.2.3` 的区别？什么是预发布版本？
- [ ] lockfile 锁的是什么？为什么 CI 用 `npm ci`？要不要提交？
- [ ] 一个包该放 dependencies 还是 devDependencies？peerDependencies 何时用？
- [ ] 什么是幽灵依赖？pnpm 如何解决？
- [ ] `npm run x -- --flag` 里的 `--` 是干嘛的？pre/post 脚本钩子怎么用？

---

## 🚀 部署预告

- `scripts` 的 `build`/`prepublishOnly`、`bin` 字段是下一关 **node-publish**（发包、dual package、provenance）的直接铺垫；
- `dependencies` vs `devDependencies` 决定 **Docker 生产镜像**只装运行依赖（`npm ci --omit=dev`，呼应 node-deploy-perf）；
- `exports`/`main`/`type` 的互操作细节在 **node-publish** 深入（呼应 ts-modules 的 dual package hazard）；
- `npm test`/`--test` 如何写测试见 **node-testing**。

下一关进入 **node-publish**：把包发上 npm，处理 ESM/CJS 双入口、`exports` 条件与供应链安全。
