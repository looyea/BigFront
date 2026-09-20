# 发包与 ESM/CJS 双包

> 目标：把一个包发上 npm 并在别人项目里被**正确解析**，远不止 `npm publish`。核心是 `package.json` 的**入口与导出**（`main`/`module`/`types`/`exports`/`files`）、**dual package（双包）**如何让 ESM 与 CJS 消费者各取所需而不踩"hazard"、发布流程与版本管理，以及 **provenance / 2FA / 供应链安全**（呼应 node-npm、02-typescript 的 ts-publish、node-esm-cjs）。

---

## 一、发布前的 package.json

```jsonc
{
  "name": "my-lib",
  "version": "1.0.0",
  "type": "module",                 // 源码/默认按 ESM
  "main": "./dist/index.cjs",       // 给老 CJS 解析器的兜底入口
  "module": "./dist/index.js",      // 打包器约定（非官方）指向 ESM
  "types": "./dist/index.d.ts",     // TS 类型（呼应 ts-declarations）
  "exports": { /* 见第三节 */ },
  "files": ["dist", "README.md"],   // 发布白名单（见第五节）
  "sideEffects": false,             // 利于打包器 tree-shaking（呼应 10-vite）
  "engines": { "node": ">=18" },
  "scripts": { "prepublishOnly": "npm run build && npm test" }
}
```

`prepublishOnly` 会在 `npm publish` 前自动跑构建+测试，防止发出脏代码（呼应 node-npm 第二节钩子）。

---

## 二、`exports`：现代条件导出

`exports` 取代散乱的 `main`/`module`，用**条件映射**给不同环境不同入口，并**锁住未声明的子路径**（封装性）：

```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",   // TS 先看（须在最前，呼应 ts-publish）
    "import": "./dist/index.js",    // ESM 消费者
    "require": "./dist/index.cjs",  // CJS 消费者
    "default": "./dist/index.js"
  },
  "./utils": "./dist/utils.js",     // 子路径导出：import "my-lib/utils"
  "./package.json": "./package.json"
}
```

- 条件**有顺序**，解析器从上到下取第一个匹配；`types` 放最前否则 TS 可能解析不到；
- 一旦有 `exports`，`import "my-lib/src/internal.js"` 这类**未声明路径会报错**（好的一面：强制公共 API 边界）。

---

## 三、dual package hazard（双包陷阱）

同时提供 ESM 与 CJS 两套构建时，最危险的坑：**同一个包被以两种格式各加载一份**，导致模块内单例/全局状态**出现两份实例**：

```js
// 消费者里既有 import 'x'（ESM）又有 require('x')（CJS）
// → x 的 ESM 版和 CJS 版是两个不同模块实例，instanceof / 单例 / context 全部失效
```

缓解策略：

1. **CJS 从 ESM 单向、无状态**：让 `.cjs` 只做薄壳或确保模块**无内部可变单例**；
2. 首选 **"types + import + require" 都指向各自格式**且两套产物行为等价；
3. 若无法保证，干脆**只发 ESM**（现代库趋势）或只发 CJS，避免双实例；
4. 用 `createRequire`/动态 `import` 统一取同一实例（呼应 node-esm-cjs 互操作）。

**判据**：包内若有**单例、注册表、`instanceof` 依赖的类、Symbol.iterator 常量**，dual package 极易出事。

---

## 四、构建出 ESM + CJS 两套产物

一个 `type:module` 的 ESM 源码，要额外产 CJS（`.cjs`），常见用 **tsup / rollup / esbuild / unbuild**：

```jsonc
// tsup 思路：一次产出 .js(ESM) + .cjs(CJS) + .d.ts
"scripts": { "build": "tsup src/index.ts --format esm,cjs --dts" }
```

- CJS 文件在 `type:module` 包里**必须用 `.cjs` 后缀**（呼应 node-esm-cjs）；
- 顶层 `await`、`import.meta` 等 ESM 特性在 CJS 产物里不可用→这些代码不能同时兼容双格式；
- 打包器 `sideEffects:false` + 保留各格式，利于 tree-shaking（呼应 10-vite 的 tree-shaking）。

---

## 五、`files` 白名单 / `.npmignore`

- **`files`**（推荐，白名单）：只发必要产物（`dist`、`README`、`LICENSE`），源码/测试/配置不发——小体积、少泄漏；
- 隐式总是包含 `package.json`/`README`/`LICENSE`；
- 与 `.npmignore` 互斥优先用 `files`；`.gitignore` 不自动作用于发包；
- **`npm pack --dry-run`** 预览将发布的文件清单，避免把 `.env`/密钥误发（呼应 node-config"别把密钥写进代码/包"）。

---

## 六、发布流程与版本管理

```bash
npm login                 # 或 npm adduser（建议用细粒度 access token）
npm pack --dry-run        # 检查产物
npm test && npm run build
npm version patch         # 改版本号 + 打 git tag（minor/major）
npm publish --access public   # scoped 包默认私有，公开要显式
```

- **semver 纪律**：破坏性变更升 MAJOR（呼应 node-npm 第三节），配 CHANGELOG；
- **废弃**：`npm deprecate my-lib@"<2" "使用 v2，含安全修复"` 给老版本用户装包时提示；
- 自动化：CI 里 `changesets`/`semantic-release` 依提交信息自动定版、发版、写 CHANGELOG；
- `npm publish` 前先 `npm pack` 本地 `npm i ./my-lib-1.0.0.tgz` 冒烟测。

---

## 七、scoped 包与私有 registry

- **scoped 包** `@acme/utils`：命名空间、避免重名，发布默认**私有**（要付费或 `--access public`）；
- 团队可用**私有 registry**（Verdaccio、GitHub Packages、Nexus）或 `npm publish --registry=...`；
- `.npmrc` 可配 `@acme:registry=https://npm.acme.com`（呼应 node-config 用环境区分配置）。

---

## 八、供应链安全：provenance / 2FA / audit

npm 供应链攻击（投毒、typosquatting、被劫持维护者账号）真实存在（呼应 OWASP LLM/软件物料清单、Express 安全关）：

- **2FA / 细粒度 token**：账号开两步验证；发布用**短期、可编程发布**的 granular token，别用 old password token；
- **Provenance（Attestation）**：`npm publish --provenance`（需在受信 CI 如 GitHub Actions）生成**密码学证明**，消费者可核验"这个包确实由这个仓库这个 commit 在 CI 里构建发布"，防账号被劫持投毒；
- **`npm audit` / `npm audit signatures`**：查已知漏洞与校验包签名/provenance；
- **lockfile 的 integrity hash** + 固定 registry + `--ignore-scripts`（防恶意 install 脚本，呼应 node-child-process 命令执行风险）；
- 发 TS 类型/产物前，别在包里塞源码与秘密（`files` 白名单 + `.npmrc` 里的 token 绝不能进包）。

---

## 九、自检清单

- [ ] `main`/`module`/`types`/`exports` 各自作用与优先级？为何 `types` 条件要放最前？
- [ ] 什么是 dual package hazard？哪些包最容易中招？如何缓解？
- [ ] `exports` 如何锁子路径、带来什么好处？
- [ ] `files` 与 `.npmignore` 区别？怎么预览发布内容？
- [ ] 发布前 `prepublishOnly`、`npm version`、`--access public` 各做什么？
- [ ] provenance、2FA、`npm audit` 分别防御什么威胁？

---

## 🚀 部署预告

- `exports`/`types`/dual package 与 **ts-publish**（TS 侧发布）互为镜像，同一个工程两边对照着看最透；
- `sideEffects`、ESM 产物与 **10-vite** 的打包/tree-shaking 直接相关（被消费时）；
- `--ignore-scripts`、命令执行面与 **node-child-process** 的注入防护同源；
- 发布自动化（CI 里 build+test+publish）是 **node-deploy-perf** 流水线的一环。

下一关进入 **node-testing**：用内置 `node:test` 给函数、CLI 和 HTTP 服务写单元/集成测试并统计覆盖率。
