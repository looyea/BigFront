# node-npm 面试题精选

> 共 15 题，覆盖 package.json / semver / lockfile / 依赖分类 / 包管理器 五类。

---

## 一、package.json 字段

### 1. `main`、`module`、`exports` 有什么区别？优先级如何？

- **`main`**：最早的入口字段，CJS/老解析器用它；ESM 早期工具用**非标准的 `module`** 指 ESM 入口；
- **`exports`**（Node 12+）：**标准、条件化**入口，可按 `import`/`require`/`node`/`browser`/`types` 给不同路径，且**一旦定义就封锁包内部路径**（外部只能访问 exports 声明的子路径）。
- 现代解析：**`exports` 优先于 `main`**。老 `module` 字段逐步被 `exports` 条件取代（呼应 node-publish、ts-modules）。

**来源**：Node.js — "Packages exports"、webpack — "The 'module' field"

### 2. `"type": "module"` 和文件后缀 `.mjs`/`.cjs` 的关系？

`type` 给包内 `.js` 定默认口径：`"module"`→`.js` 按 ESM，`"commonjs"`（默认）→按 CJS。**文件后缀可覆盖**：`.mjs` 永远 ESM、`.cjs` 永远 CJS，无视 `type`。这决定了 `import`/`require`、`__dirname`、顶层 await 是否可用（呼应 node-esm-cjs）。

**来源**：Node.js — "Modules: packages /Determining module system"

### 3. `bin` 字段是干什么的？和 scripts 里能直接跑 `eslint` 有什么关系？

`bin` 把某个文件登记为**命令**：安装依赖（或全局安装）时，包管理器在 `node_modules/.bin`（或全局 bin）建软链，于是 `my-cli` 可当命令调用。scripts 里能直接写 `eslint`、`vite` 正是因为**npm 会把本包 `node_modules/.bin` 临时加入 PATH**（呼应 node-cli）。

**来源**：npm docs — "package.json bin"、Node.js — "Running scripts"

---

## 二、semver

### 4. 解释语义化版本 MAJOR.MINOR.PATCH，以及 `^` 和 `~` 的区别。

- **MAJOR**：破坏性变更；**MINOR**：向后兼容地新增功能；**PATCH**：向后兼容地修 bug。
- `^1.2.3`：`>=1.2.3 <2.0.0`（不动 MAJOR）；`~1.2.3`：`>=1.2.3 <1.3.0`（不动 MINOR，只升 PATCH）。

**来源**：SemVer — "Semantic Versioning Specification"、npm — "semver ranges"

### 5. `^0.2.3` 能升到 `0.3.0` 吗？为什么 0.x 特殊？

**不能**。MAJOR 为 0 时语义视 MINOR 为"破坏性边界"：`^0.2.3` = `>=0.2.3 <0.3.0`（`~0.2.3` 同）。因为 0.x 阶段尚未承诺稳定，任何升级都可能破坏（呼应 node-npm 第三节）。

**来源**：npm semver docs — "^0.x.y is treated specially"

### 6. 什么是预发布版本（prerelease）？`^1.2.3-beta.1` 会匹配 `1.2.3` 吗？

`1.2.3-beta.1` 是 `1.2.3` 正式发布前的预发布标签，排序在 `1.2.3` **之前**。默认情况下，semver 区间**不会**匹配预发布版本，除非该区间的比较基准本身带预发布标签（避免把测试版误装进生产）。

**来源**：SemVer — "Prerelease versions"、npm semver docs

---

## 三、lockfile 与安装

### 7. package.json 已有版本区间，为什么还要 package-lock.json？

区间会在每次安装时**重新解析**，不同时间/机器可能装到不同补丁版，破坏可复现性。lockfile 固定**本次解析出的精确版本 + 完整依赖树 + integrity hash**，让团队与 CI 装到**逐字节一致**的树。

**来源**：npm docs — "package-lock.json"、Node.js — "Installing with npm ci"

### 8. `npm install` 和 `npm ci` 有什么区别？CI 里该用哪个？

- `npm install`：按 package.json+lock 解析、可能**更新 lockfile**、装到现有 node_modules；
- `npm ci`：**删除** node_modules、**严格按 lockfile** 安装、绝不改 lockfile，更快更可复现；若 package.json 与 lock 不一致会**报错**。

CI/部署用 **`npm ci`**（呼应 node-deploy-perf）。

**来源**：npm docs — "npm ci"

---

## 四、依赖分类

### 9. `dependencies` 与 `devDependencies` 的区别？发 Docker 镜像时怎么处理？

前者运行时必需、后者仅开发/构建期。生产镜像用 `npm ci --omit=dev`（或 `NODE_ENV=production`）只装运行依赖，缩小体积、减少攻击面；构建阶段（如编译 TS）在单独阶段装 dev 依赖（多阶段 Dockerfile，呼应 node-deploy-perf）。

**来源**：npm docs — "package.json dependencies"、Docker — "Multi-stage builds"

### 10. 什么是 `peerDependencies`？和 `dependencies` 何时该选它？

`peerDependencies` 声明"我需要你（宿主）来提供某个包/版本"，**不由我安装、也不期望被嵌套多份**。典型：UI 组件库对 `react`、Express 插件对 `express`——若各装各的会出现两份实例/单例失效。若该包无论如何都要独立可用则用 `dependencies`（呼应 node-npm 第五节）。

**来源**：npm docs — "peerDependencies"、社区 — "when to use peer deps"

---

## 五、包管理器与工程化

### 11. npm、yarn、pnpm 的核心差异？为什么 pnpm 更省磁盘、更严格？

pnpm 用**内容寻址的全局存储 + 硬链接/符号链接**组织 `node_modules`：同一包版本全局只存一份（省磁盘）；默认**非扁平结构**（`node_modules/.pnpm` + 精确软链），因此**没有幽灵依赖**——只能用 package.json 里显式声明的包（更严格）。npm/yarn 采用扁平提升，安装更快落地但存在幽灵依赖。monorepo 下 pnpm workspaces 体验普遍最佳（呼应 node-npm 第七节）。

**来源**：pnpm — "Motivation / How node_modules work"、yarn — "What is Yarn"

### 12. corepack 解决什么问题？`packageManager` 字段有什么用？

corepack（Node 16.9+ 内置）让项目**锁定并自动使用指定版本/种类的包管理器**：`"packageManager": "pnpm@9.1.0"` 后，团队成员执行 `pnpm`/`yarn`/`npm` 命令时由 corepack 分派到对应版本，无需各自手动全局安装、消除版本漂移与 lockfile 打架（呼应 node-npm 第八节）。

**来源**：Node.js — "Corepack"、pnpm — "packageManager field / corepack"

---

## 补充（新专题 13-15）

### 13. semver 区间在团队策略层面怎么管：lockfile、renovate、灰度三者分工？

声明层（package.json 区间）表达**兼容意愿**、锁定层（lockfile）表达**本次真相**、机器人层（renovate/dependabot）把「升级」变成可评审小 PR。策略示例：应用：区间宽松（^）+ lockfile 全锁 + renovate 按标签批量升（patch 自动合并、major 单独评审）；库：区间下限尽量保守（peer 从宽声明）、CI 跑「最小版本（--legacy-peer-deps 时代用 npm install 无 lock）」+ 最新双矩阵防「你装旧版就崩」。冲突面：同一依赖两处不同区间 → npm 嵌套/pnpm 各版本共存（内存双实例风险回到本包 modules 关）；发布前 `npm ls` 0 invalid 是门禁。灰度：升级 PR 分「安全/功能/大版本」三档节奏，lockfile diff 审查（新增包数/维护者变更）当供应链审计做。

**来源**：semver 官方区间文档；Renovate 配置策略（separateMajorMinor/组并 PR）与 npmRFC「minimal version compatibility」讨论。

### 14. npm/yarn/pnpm 在 monorepo 里各自的杀手特性与痛点？选型给一版。

npm：workspaces 原生零装、但幽灵依赖（提升式）+ 安装性能垫底；痛点=大规模 hoist 冲突。yarn classic→berry：PnP（无 node_modules、zip 直载）理论最优但**生态兼容税**（部分工具链假定物理目录，需 patches）；workspaces+constraints 成熟。pnpm：内容寻址 store（磁盘占用碾压）、严格解析（phantom 绝迹）、workspace protocol（catalog 统一版本）、与 node_modules 兼容共存——当前「monorepo 默认答案」；痛点=store 磁盘 IO 平台差异、bin 软链在 Win 的老 bug 史。附加件：Nx（任务图/缓存/影响分析，与包管器解耦）、turbo（同类更薄）。选型口径：JS 团队无平台预算 → pnpm+Nx/turbo 组合最快成型；重度 Windows/CI 磁盘受限实测先行；PnP 只有在「依赖规模巨大+接受生态摩擦」时才值。

**来源**：各包管器官方 workspaces/性能对比文档；pnpm catalog 与 Nx caching 说明（2024 生态共识综述）。

### 15. 把「装依赖」变成安全动作：你 CI 里会挂哪些 npm 相关检查？

装机面：`npm ci`（只认 lockfile，禁自动改版本——本关 npm ci 题的 CI 侧）、--ignore-scripts 起步 + 白名单（prebuild/node-gyp 类确需的单独放行，postinstall 是供应链攻击第一入口）。审计面：lockfile diff 门禁（新增包数、作者/维护者突变、typosquat 名单比对——install 名与目标包名差一字符报警）、`npm audit`（高危阻断，中低进周报）、license 检查（GPL 传染进商业产品红线）。运行时面：provenance 校验（本包 publish 关：消费侧 npm audit signatures）、SBOM 产出（cyclonedx-npm）。权限面：私有 registry 代理（Verdaccio/Nexus 缓存+白名单源）、组织账号 2FA 强制 + granular tokens。演练：投一个假包走全链，看哪层漏。制度：「依赖=外部代码」心态，装它=引入一次 PR 评审。

**来源**：npm 官方 supply chain 文档（provenance/签名/2FA）；Aqua/StepSecurity 依赖混淆与 install-script 攻击案例汇编。
