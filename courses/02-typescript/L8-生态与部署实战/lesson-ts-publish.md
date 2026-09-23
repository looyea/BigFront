# 把 TypeScript 库发上 npm

> 目标：走完"一个自带类型的 TS 库从打包到发布"的全流程——理解**发布的是 JS + `.d.ts`（不是 `.ts`）**、`exports` 双格式映射、`types` 条件为什么必须排第一、ESM/CJS 双包陷阱、以及用 tsup 一键产出并用 `attw`/`publint` 验收。这是整条 TS 链路的"最后一公里"（呼应 ts-modules dual package、ts-declarations `.d.ts`、ts-tooling tsup）。

---

## 一、心智：你发的不是 TS，是 "JS + 类型说明书"

TS 编译期擦除（呼应 ts-intro），npm 上没有人跑你的 `.ts`。一个合格的 TS 库产物是：

```
dist/
  index.js      (ESM 运行时)
  index.cjs     (CJS 运行时)
  index.d.ts    (类型"说明书"，消费方 TS 编译器读它)
  index.d.map   (可选：点 d.ts 跳回源码)
```

三件套对齐：**每个运行时格式（esm/cjs）都要有配套 `.d.ts`**，且 `package.json` 要把它们指对（下一节）。用 tsup 一条命令即可产出（呼应 ts-tooling 第二节）：

```bash
tsup src/index.ts --format esm,cjs --dts --clean --target es2020
```

---

## 二、package.json 的"指向"字段（最容易错的地方）

```jsonc
{
  "name": "my-lib",
  "version": "1.0.0",
  "type": "module",                       // 声明默认是 ESM（呼应 ts-modules）
  "main": "./dist/index.cjs",             // CJS 老解析器的入口（兼容）
  "module": "./dist/index.js",            // 打包器（bundler）惯用的 ESM 提示（非官方）
  "types": "./dist/index.d.ts",           // 老解析器的类型入口（兼容）
  "exports": {                           // ★ Node 现代解析 & 打包器首选，优先级最高
    ".": {
      "types": "./dist/index.d.ts",       // ★ types 条件必须放在最前！
      "import": "./dist/index.js",        // 被 import 时
      "require": "./dist/index.cjs",      // 被 require 时
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md"],         // 只发这些（否则连 node_modules 都想发）
  "sideEffects": false                    // 利于摇树（呼应 10-vite、ts-modules barrel）
}
```

铁律：
- **`exports` 里 `types` 条件必须是该对象第一个键**——Node/TS 按顺序匹配，排在 `import`/`require` 后面就永远轮不到，消费方"找不到类型"（呼应 ts-declarations 查找顺序）；
- 一旦写了 `exports`，它就**接管**子路径导出，没列出的路径外部 `import "my-lib/foo"` 会失败（可按需加 `"./foo": {...}`）；
- `main`/`types` 仍保留是为兼容不认识 `exports` 的老工具。

---

## 三、ESM / CJS 双包陷阱（dual package hazard）

同一份库若被 `import`（吃到 ESM 版）又被 `require`（吃到 CJS 版），Node 会加载**两份实例**——单例失效、`instanceof` 失败、模块级状态各一份（呼应 ts-modules dual package、ts-classes 单例）。应对：
- 尽量 **ESM-only**（新项目推荐，省掉一半坑）；
- 必须双格式时，让 CJS 版**转调** ESM 版的共享核心，或保证无跨格式共享的可变单例；
- ESM 里 `import` 一个纯 CJS 包时默认导出互操作微妙——用 `esModuleInterop` 心智但**消费方**行为不由你控（呼应 ts-modules esModuleInterop）。
用 **`are-the-types-wrong`（attw）** 静态检查你的双包配置，它会红绿标出每种消费姿势（bundler/node16/nodeNext）解析到什么、是否踩坑。

---

## 四、发布前验收清单（别裸发）

```bash
npx publint                 # 检查 package.json 字段/exports/files 是否规范
npx attw --pack .           # Are The Types Wrong：各解析模式下类型/运行时是否正确
npm pack --dry-run          # 看清 tarball 里到底进出了哪些文件（files 白名单对不对）
npm publish --dry-run       # 演练发布
```

发布动作：`npm login`（**开 2FA / 建议用 OIDC provenance**，供应链安全，呼应 Express L8 部署）→ `npm version patch`（semver，呼应下节）→ `npm publish`。`prepublishOnly` 脚本会自动先 build，防"发了旧 dist"。

---

## 五、语义化版本与"公共 API 的形状"

库是**契约**，版本是承诺（SemVer）：`MAJOR.MINOR.PATCH` = 破坏性变更 / 向后兼容新增 / 修 bug。要点：
- **导出的类型/接口就是公共 API 的一部分**——删字段、改签名、收窄参数都算 **breaking**，该升 MAJOR（呼应 ts-conditional-infer 的签名、ts-functions）；
- 用 **API Extractor**（微软）把"公共 API 面"固化成 `.api.md` 审阅文件，CI 里 diff 出破坏性变更；
- 想要"看起来能传其实禁止"的收窄，发布前谨慎（用户会立刻炸），可先 `@deprecated` 过渡一个大版本再删（呼应 ts-strict 棘轮般"只渐进收紧"的克制）。

---

## 六、给 TS 用户的体验优化

- **`"types"` 或 `exports.types` 缺了**，用户就得自己写 `declare module` —— 一定要发全（呼应 ts-declarations）；
- 保留源码映射：`declarationMap: true` 让"跳转到定义"跳进你的 `.ts` 源码而非干巴巴的 `.d.ts`（呼应 ts-project）；
- 泛型 + 条件类型的**推导友好**：公共函数别把可推断的参数写成需要用户手动传泛型实参（用 `NoInfer`/重载兜住，呼应 ts-advanced、ts-generic）；
- README 给 TS 用例、类型签名贴出来；发完用 **`pnpm dlx` 起个临时项目 `import` 一下**做真机冒烟。

---

## 七、自检清单

- [ ] 为什么发的是 JS + `.d.ts` 而不是 `.ts`？三件套指什么？
- [ ] `exports` 里 `types` 条件为什么要排第一？写了 `exports` 后子路径怎么导出？
- [ ] 什么是 dual package hazard？ESM-only 为什么能省坑？
- [ ] `publint` 和 `attw` 各帮你查什么？
- [ ] 导出的类型算不算公共 API？删字段该升哪一位版本号？
- [ ] `declarationMap` 给用户带来什么体验？

---

## 🚀 部署预告

- 这一关是 **L8（也是整个 02-typescript）的收官**：至此你从"语言基础"一路走到"把带类型的库发上 npm、被全生态正确消费"；
- `exports`/dual-package 直接复用 ts-modules 的模块解析与 esModuleInterop 心智；
- `.d.ts` 生成与查找顺序回扣 ts-declarations，打包工具（tsup）回扣 ts-tooling，供应链（2FA/OIDC）与 Express L8 部署一脉相承。

恭喜完成 02-typescript 全部 8 阶段——下一步回到全课程：**重启验证零告警**，再推进 03-nodejs。
