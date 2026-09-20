# 面试题 · 模块系统与包管理

1. **CJS 与 ESM 在 Node 里怎么共存？**
   - `.mjs` 一定是 ESM，`.cjs` 一定是 CJS，`.js` 看最近 package.json 的 "type"。
   - 混合用 `await import()`（CJS 里）或 createRequire（ESM 里）。

2. **npm semver：`^1.2.3` 与 `~1.2.3` 允许升级到哪个版本？**
   - `^`：允许 **minor + patch**（<2.0.0）。
   - `~`：只允许 **patch**（<1.3.0）。
   0.x 上 `^0.2.3` 特殊：<0.3.0（因为 0 版本约定不保证 minor 兼容）。

3. **lockfile 存在的意义？为什么 CI 要用 `npm ci` 而不是 `npm install`？**
   lockfile 锁定完整依赖树的**确切版本 + 完整性校验**。CI 用 `npm ci`：完全按 lock 装，不改动 lock，更快、可复现、更安全。

4. **peerDependencies 和 dependencies 的取舍？**
   peer：「我需要一个宿主提供」，常见于库对 React / webpack 版本的要求，避免多份实例。dependencies：完全自包含时使用。

5. **npm 装包时如何防止供应链攻击？**
   用 lockfile + `integrity` 哈希；用 `npm audit`；用 `--ignore-scripts` 或 approve-scripts 白名单；只从官方源；CI 里 `npm ci` 而非 install。

6. **exports 字段有什么用？和 main 的区别？**
   exports 是**条件导出**（ESM/CJS/浏览器/类型），可以锁住内部子路径。有 exports 后，包外无法 import 未在 exports 里声明的路径（比 main 更安全）。

7. **workspace / monorepo 常用工具？**
   npm/pnpm/yarn workspace、Nx、Turborepo、Lerna（现代）。核心价值：原子提交、依赖去重、跨包重构方便。
