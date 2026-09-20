# node-publish 面试题精选

> 共 12 题，覆盖 入口与导出 / 双包 / 构建产物 / 发布流程 / 供应链安全 五类。

---

## 一、入口与导出

### 1. `main`、`module`、`exports` 有什么区别？现在推荐用哪个？

`main` 是最老的（CJS）入口兜底；`module` 是打包器社区的**非标准**约定（指向 ESM）；`exports` 是 **Node 标准的条件导出**，可按 `import`/`require`/`node`/`browser`/`types` 分派并锁子路径。现在推荐以 **`exports` 为主**、保留 `main` 兼容极老工具（呼应 node-npm interview 第 1 题）。

**来源**：Node.js — "Packages exports"、webpack — "The 'module' field"

### 2. `exports` 里的 `types` 为什么要放在 `import`/`require` 前面？

条件解析**自上而下取第一个匹配**。若把 `types` 放后面，TypeScript（node16/nodenext 解析）可能先命中 `import`/`require` 而拿不到 `.d.ts`，导致类型丢失。放最前保证类型条件优先命中（呼应 node-publish 第二节、ts-publish）。

**来源**：TypeScript — "Declaration file resolution / exports"、Anders Dley / 社区博文 — "The TypeScript exports types ordering"

### 3. `exports` 会封锁子路径，这是优点还是缺点？

多数是**优点**：强制公共 API 边界，外部只能 `import 'pkg/utils'` 你显式声明的路径，内部实现可自由重构。需要开放某些子路径时显式列出（甚至 `"./package.json": "./package.json"`）。（呼应 node-publish 第二节）

**来源**：Node.js — "Encapsulation via exports"

---

## 二、dual package hazard

### 4. 什么是 dual package hazard？为什么危险？

当一个包**同时提供 ESM 和 CJS 两套产物**，若消费者项目里既 `import` 又 `require` 它，Node 会把两套产物当**两个不同模块**各加载一份——于是包内的**单例、注册表、`instanceof` 判定的类、共享 Symbol**都出现**两份**，逻辑悄悄错乱（`a instanceof B` 为 false、context 丢失）。

**来源**：Node.js — "Dual package hazard"、sindresorhus — "Package-Setup: dual package hazard"

### 5. 如何规避或降低 dual package 风险？

1. 让包**尽量无内部可变单例/全局状态**（纯函数库天然安全）；
2. CJS 产物用 `createRequire` 或从**同一份 ESM 派生**、避免各自初始化；
3. 干脆**只发一种格式**（现代库趋势：纯 ESM）；
4. 若必须双发，充分测试"混用"场景，确保两套行为等价、类型共享同一实例。

**来源**：Node.js — "Mitigating dual package hazard"

### 6. 一个含 class 且用户会 `instanceof` 的库，发 ESM/CJS 双包要特别注意什么？

`instanceof` 依赖"同一个类对象"。双包下 ESM 用户与 CJS 用户拿到的 class 是**不同对象**，跨格式比较必 false。要么统一入口/单一格式，要么提供不依赖 `instanceof` 的判断（如品牌属性/`Symbol.hasInstance`/duck typing）（呼应 node-publish 第三节）。

**来源**：Node.js — "instanceof and dual packages"

---

## 三、构建产物

### 7. 在 `"type": "module"` 包里，CJS 产物为什么必须叫 `.cjs`？

因为 `type:module` 会把该包内所有 `.js` 按 **ESM** 解析；要让某文件被当 CJS，只能用 **`.cjs`** 后缀显式声明（或放到另一个 `type:commonjs` 的子目录 package.json 里）。这是 Node 判定模块体系的规则（呼应 node-esm-cjs、node-publish 第四节）。

**来源**：Node.js — "Determining module system"

### 8. `sideEffects` 字段有什么用？和打包有什么关系？

`"sideEffects": false` 告诉 webpack/rollup/esbuild：**模块导入若未被使用，可安全 tree-shake 掉**（无副作用）。能显著减小消费者产物体积。若有样式/ polyfill 等真实副作用文件，需列白名单，否则会被误删（呼应 10-vite 的 tree-shaking）。

**来源**：webpack — "Tree shaking / sideEffects flag"、package.json docs — "sideEffects"

---

## 四、发布流程

### 9. 说出发一个包的标准流程，以及 `prepublishOnly` 的价值。

`login` → `npm pack --dry-run` 核对文件 → 本地 `npm i ./x.tgz` 冒烟 → `npm version <patch|minor|major>`（改版本+打 tag）→ `npm publish`（scoped 公开加 `--access public`）。`prepublishOnly` 脚本在 publish 前**自动 build+test**，杜绝发出未构建/未测试的脏代码（呼应 node-publish 第一、六节）。

**来源**：npm docs — "npm publish / scripts prepublishOnly"、Node.js — "Publishing packages"

### 10. `npm deprecate` 是干什么的？为什么不直接删旧版本？

`npm deprecate pkg@'<2.0.0' "有安全漏洞，请升 2.x"` 给命中区间的安装**打警告**，引导用户离开坏版本。**不能删除**已发布的公共版本（保持依赖图稳定、避免别人 lockfile 悬空）——只能废弃（yank 仅限极少情况）。

**来源**：npm docs — "npm deprecate"、社区 — "You can't unpublish, you can deprecate"

---

## 五、供应链安全

### 11. npm provenance / attestation 解决什么信任问题？

传统 `npm publish` 无法证明"这个 tarball 确实来自你看到的源码仓库/CI"——攻击者**劫持维护者账号**就能投毒。**provenance** 在**受信构建环境**（如 GitHub Actions）为发布生成**密码学证明**，消费者 `npm audit signatures` 可核验来源，把信任从"账号"升级到"可验证的构建链"（呼应 node-publish 第八节）。

**来源**：npm — "Provenance & attestations"、OpenSSF — "Supply chain levels / SLSA"

### 12. 作为消费者，装第三方包时有哪些降低供应链风险的做法？

开 **2FA**、用**私有 registry/镜像**、`npm ci` + 锁定 `integrity`、`npm audit`、审查**install/postinstall 脚本**（可 `--ignore-scripts`）、警惕**typosquatting**（拼写仿冒）、最小依赖、定期升级并读 CHANGELOG、校验 provenance（呼应 node-npm、node-child-process 命令执行风险）。

**来源**：OWASP — "Software Supply Chain Security"、npm — "Security updates"
