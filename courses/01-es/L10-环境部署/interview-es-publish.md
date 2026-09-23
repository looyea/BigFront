# es-publish 面试题精选

> 共 12 题，覆盖 **package.json 字段 / 构建策略 / 版本管理 / 发布自动化 / npm 安全 / Monorepo** 六类。

---

## 一、package.json 字段

### 1. main、module、browser、exports 四个字段各有什么作用？优先级如何？

- **main**：CJS 入口，Node 最老的解析字段；
- **module**：非官方标准，Rollup/Webpack/Vite 优先读它找 ESM 入口；
- **browser**：浏览器专用入口（替换 Node 原生模块的 polyfill 或纯前端版本）；
- **exports**：Node 12.11+ **正式标准**，支持条件解析（import/require/node/browser/development/production）。优先级：exports > main；Node 看到 exports 会完全忽略 main/module/browser。

**来源**：Node.js Docs — "Packages and modules (dual packages)"；Webpack Guide — "Field aliases"

### 2. "type": "module" 对包有什么影响？不加会怎样？

`"type": "module"` 让 `.js` 文件被 Node 当 ESM 解析（`import/export` 语法）。不加则 `.js` 默认 CJS → 要写 ESM 必须用 `.mjs` 扩展名。**对打包器无影响**（它们按语法特征判断）；**对 Node 运行时直接生效**。

**来源**：Node.js Docs — "Modules: package.json field"

---

## 二、构建策略

### 3. 双格式发布（ESM + CJS）的"dual package hazard"是什么？

同一个包如果 `import` 得到 ESM 实例、`require` 得到 CJS 实例 → **两个不同的模块实例** → 单例失效（instanceof 失败、共享状态断裂）。解法：① 用 `exports` 确保两种格式导出相同对象（CJS 入口用 `createRequire` 加载 ESM 版 → 仅一个实例）；② 或把共享状态放到独立 CJS 文件里两边都 require 它。

**来源**：Node.js Docs — "Loading a CommonJS module from ESM"；"Dual package hazard" GitHub Issue

### 4. tsup 和 vite build --mode lib 各适合什么场景？

- **tsup**（esbuild 内核）：零配置输出 ESM/CJS/DTS → 适合纯逻辑库（无 Vue/React 编译器处理 JSX/SFC）；
- **Vite lib mode**：能处理 CSS Modules / Vue SFC / JSX → 适合含样式的组件库；但需配 `vite-plugin-dts` 生成类型。

**来源**：tsup GitHub README；Vite Guide — "Build Library Mode"

---

## 三、版本管理

### 5. npm version 做了什么？和手动改 package.json 版本号有什么区别？

`npm version patch` 自动：① 改 package.json version 字段；② 创建 git commit "1.0.1"；③ 打 git tag v1.0.1。手动改容易忘 tag → CI 不知道发哪个版本；忘 commit → 版本与代码不一致。配合 changesets 时**不需要手动跑 npm version**——CI 自动完成。

**来源**：npm Docs — "npm-version"

### 6. 什么是 changesets？它解决了什么问题？

多人同时给一个 monorepo 提 PR → 都改了版本号 → git conflict。changesets 让每个 PR 附带一个 `.changeset/xxx.md`（记录改了哪个包、什么版本、changelog 描述）→ 合并到 main 后自动开 "Version Packages" PR → 汇总所有变更 → 你 merge → CI 发布。**解决了版本号冲突和 changelog 手写的痛点**。

**来源**：changesets GitHub README — "What is this all for?"

---

## 四、发布自动化

### 7. 为什么 npm publish 之前要跑 prepublishOnly？

保证 dist/ 是从最新 src/ 编译的——防止"改了代码忘了 build 就 publish" → 线上包是旧代码。典型 `prepublishOnly: "npm run build"`。注意：**npm pack / npm install 不触发 prepublishOnly**（只有 npm publish 触发）。

**来源**：npm Docs — "npm scripts (prepublishOnly lifecycle)"

### 8. GitHub Actions 里用 Automation Token vs Provenance 的区别？

- **Automation Token**：NPM_TOKEN 存在 GitHub Secrets → Actions 用这个 token `npm publish`。风险：token 泄露 = 包被劫持；
- **Provenance / Trusted Publishing（2023+）**：无需 NPM_TOKEN → npm 通过 OIDC 验证 Actions 身份 → 只有指定 repo + workflow 能发布 → **无长期 token 泄露风险**。

**来源**：npm Blog — "Introducing npm provenance"；GitHub Docs — "About trusted publishing"

---

## 五、npm 安全

### 9. 如何防止 npm 包被 typosquatting 仿冒？

开发者输错 `lodash` → `1odash`。防御：① 团队用 lockfile（一次确认后续 `npm ci` 精确锁定）；② 配置 **Scoped Registry** 只允许公司 scope 和审批白名单；③ `npm audit` 扫描；④ 包名在 npm 注册防御性商标（同作者发 `@myorg/pkg` + `@myorg` scope 锁死）。

**来源**：GitHub Advisory — "npm package typosquatting attacks"

### 10. npm deprecate 和 unpublish 有什么区别？

- **deprecate**：仍可安装但会打 WARN → 给用户迁移时间；适合有 bug 但有修复版的场景；
- **unpublish**：从 registry 彻底删除 → 别人 `npm install pkg@version` 直接 404 → **72 小时内**可 unpublish（之后只能 deprecate）。unpublish 可能**炸掉下游** → npm 只推荐严重安全事故时用。

**来源**：npm Docs — "npm-deprecate" / "npm-unpublish"

---

## 六、Monorepo

### 11. pnpm workspace 中 packages/core 如何引用 packages/utils？

pnpm-workspace.yaml 声明 `packages/*` → 任意子包 package.json 里写 `"dependencies": { "@myorg/utils": "workspace:*" }` → pnpm install 时自动 symlink（不发 npm 也能互相引用）。发布时 changesets 会把 `workspace:*` 替换为真实版本号。

**来源**：pnpm Docs — "Workspaces"

### 12. 一个包被其他包依赖时，如何确保构建顺序正确？

Turborepo 读 `package.json` 的 `dependsTo`（workspace 依赖图）→ `turbo run build` 按拓扑排序：utils 先于 core 先于 app。或手动 `prebuild: "cd ../utils && npm run build"`。最佳实践：**用 Turborepo/Nx 自动推导**——避免循环依赖。

**来源**：Turborepo Docs — "Task graph"
