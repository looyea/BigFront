# 从零发布一个 npm 包

> 目标：**完整走通 npm 包从创建到发布到被他人 import 的全流程**。包括 package.json 字段详解、exports 多入口、构建双格式（ESM+CJS）、语义化版本、changesets 自动化、npm 安全（2FA/PAT/Provenance）、Monorepo 发布。

---

## 一、项目初始化

### 1.1 目录结构

```
my-pkg/
├── src/
│   ├── index.ts        ← 入口
│   ├── utils.ts
│   └── types.ts
├── dist/               ← 构建产物（.gitignore）
├── package.json
├── tsconfig.json
├── vite.config.ts      ← 或 tsup.config.ts
├── README.md
├── LICENSE
└── .npmignore / files
```

### 1.2 最小 package.json

```json
{
  "name": "@scope/my-pkg",
  "version": "0.1.0",
  "description": "一句话描述",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./utils": {
      "types": "./dist/utils.d.ts",
      "import": "./dist/utils.js",
      "require": "./dist/utils.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup src/index.ts src/utils.ts --format esm,cjs --dts --clean",
    "prepublishOnly": "npm run build"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/user/my-pkg.git" }
}
```

---

## 二、package.json 核心字段详解

### 2.1 name

- 不能与 npm 已注册名冲突；
- `@scope/pkg` = 组织/作用域包（scope 需在 npm 创建或用 GitHub org 自动关联）；
- 全小写，可含 `-` `_` `.`。

### 2.2 version（语义化版本 SemVer）

`MAJOR.MINOR.PATCH`：
| 变更 | 版本位 | 举例 |
| --- | --- | --- |
| 破坏性变更（删/改 API） | MAJOR | 1.0.0 → 2.0.0 |
| 新增功能（向后兼容） | MINOR | 1.0.0 → 1.1.0 |
| Bug 修复 | PATCH | 1.0.0 → 1.0.1 |
| 预发布 | 后缀 | `2.0.0-beta.1`、`1.0.0-rc.3` |

### 2.3 type / main / module / exports

| 字段 | 作用 | 读取者 |
| --- | --- | --- |
| `"type": "module"` | `.js` 文件默认 ESM | Node.js |
| `main` | CJS 入口（老工具兼容） | 不支持 exports 的老 bundler |
| `module` | ESM 入口（非官方标准） | Rollup / Webpack / Vite |
| `exports` | **真正的条件入口**（Node 12+） | Node.js / 现代打包器 |

**优先级**：`exports` > `main` > `module`。如果配了 exports，Node **完全忽略** main。

### 2.4 files / .npmignore

- `files: ["dist"]` → 白名单，只打包 dist 目录 → **推荐**（精确控制体积）；
- `.npmignore` → 黑名单（类似 .gitignore 反向）→ 容易漏文件 → 不推荐。

### 2.5 peerDependencies

```json
"peerDependencies": {
  "vue": "^3.3.0 || ^3.4.0"
}
```

声明"我的包**需要**宿主安装 vue"——防止重复打包（如 UI 库和 app 各带一份 vue）。

---

## 三、构建双格式（ESM + CJS）

### 3.1 为什么需要双格式？

- Node CJS `require()` 仍大量存在（老项目、Jest）；
- 打包器（Vite/Webpack）用 ESM（Tree Shaking）；
- 单发 ESM → CJS 用户报错；单发 CJS → 打包器不能摇树。

### 3.2 tsup 一键双格式

```bash
npm i -D tsup typescript
# package.json scripts:
# "build": "tsup src/index.ts --format esm,cjs --dts --clean"
```

产出：
```
dist/index.js    ← ESM
dist/index.cjs   ← CJS
dist/index.d.ts  ← 类型声明
```

### 3.3 手写 vite-plugin-lib 方式

```ts
// vite.config.ts
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default {
  build: {
    lib: { entry: resolve('src/index.ts'), formats: ['es', 'cjs'], fileName: 'index' },
    rollupOptions: { external: ['vue'] }
  },
  plugins: [dts({ rollupTypes: true })]
}
```

---

## 四、发布前检查

### 4.1 npm pack --dry-run

```bash
npm pack --dry-run
# 输出将要打包的文件列表和总大小
```

确认：只含 dist/ README LICENSE，**不含** src/ node_modules tests。

### 4.2 npm publish --dry-run

模拟发布（不实际上传），检查 package.json 字段完整性。

---

## 五、发布流程

### 5.1 手动发布

```bash
npm login          # 或 npx auth login（OAuth 浏览器）
npm publish        # 默认 latest tag
npm publish --tag next   # 预发布/RC
```

### 5.2 版本管理三件套

```bash
npm version patch   # 1.0.0 → 1.0.1 + git tag v1.0.1
npm version minor   # 1.0.1 → 1.1.0
npm version major   # 1.1.0 → 2.0.0
```

### 5.3 撤销发布（72h 窗口）

```bash
npm unpublish my-pkg@1.0.1 --force   # 彻底删除
npm deprecate my-pkg@1.0.1 "use 1.0.2 instead"  # 标废弃（仍可装，警告）
```

---

## 六、自动化发布（changesets + GitHub Actions）

### 6.1 changesets 工作流

```bash
npm i -D @changesets/cli
npx changeset init
```

开发者提交功能 → `npx changeset`（选包+版本号+变更描述）→ 生成 `.changeset/xxx.md` → commit。

### 6.2 GitHub Actions 自动版本+发布

```yaml
# .github/workflows/release.yml
name: Release
on: { push: { branches: [main] } }
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm run build
      - uses: changesets/action@v1
        with: { publish: npx changeset publish }
        env: { NPM_TOKEN: '${{ secrets.NPM_TOKEN }}' }
```

合并 PR 到 main → changesets 自动创建 "Version Packages" PR → 你 merge → CI 发布到 npm。

---

## 七、npm 安全

### 7.1 认证方式

| 方式 | 场景 |
| --- | --- |
| `npm login` (legacy) | CLI 交互 |
| **Granular Access Token** | CI（限定包+只读/发布权限） |
| **Automation Token** | CI（不需 2FA） |
| **Provenance** (OIDC) | GitHub Actions 免配 NPM_TOKEN |
| **Trusted Publishing** | npm 9.7.3+，用 OIDC 身份链证明来源 |

### 7.2 防供应链攻击

- **package-lock.json 提交 git** → CI `npm ci` 锁定版本；
- **`npm audit` / `npm audit --production`** → 扫描已知漏洞；
- **lockfileVersion: 3** → 支持 provenance 字段；
- **最小化依赖树**：`npm ls --all` 检查传递依赖。

---

## 八、Monorepo 发布（pnpm workspace + changesets）

```
monorepo/
├── packages/
│   ├── core/        → @scope/core
│   ├── vue/         → @scope/vue
│   └── react/       → @scope/react
├── pnpm-workspace.yaml
├── .changeset/
└── package.json
```

```yaml
# pnpm-workspace.yaml
packages: ['packages/*']
```

一个 repo 多包 → changesets 自动跟踪各包独立版本 → 一次 CI 发布所有有变更的包。

---

## 九、自检清单

- [ ] exports 和 main 的优先级？
- [ ] sideEffects: false 对打包器意味着什么？
- [ ] `npm version` 做了什么？为什么需要 prepublishOnly？
- [ ] SemVer MAJOR 什么时候递增？
- [ ] peerDependencies 和 dependencies 的区别？
- [ ] 如何用 changesets 避免手动改版本号？
- [ ] npm Provenance 解决了什么问题？
- [ ] unpublish 的时间窗口是多少？

---

## 🚀 课程总结

这是 **01-es JavaScript 课程** 最后一关。从这里毕业：
- 你的库可发布到 npm（`npm publish` / `npx create-my-app`）；
- 你的应用可部署到任意平台（Vercel / Cloudflare Pages / Nginx）；
- 你理解了从语法到构建到发布的**完整链路**。

下一站：09-express（后端）或 10-vite（构建工具深挖）。
