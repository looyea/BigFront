# 发包视角：SWC 构建的库怎么发布

## 一、exports / typesVersions 与产物对齐

产物目录和 package.json 的映射是发布质量的脸面：

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./package.json": "./package.json"
  }
}
```

`exports` 里 `types` 放最前、`import`/`require` 分指两套产物；老解析器用 `typesVersions` 兜底。条件顺序敏感（`types`/`node`/`default` 从specific到宽泛）。

## 二、sideEffects 与 tree-shaking 友好

`"sideEffects": false`（或列出真正有副作用的文件）告诉打包器「没引用的可安全删」。SWC 产物是干净 ESM 时，下游 shake 效果最好。别在模块顶层写隐式副作用（如无条件 `window.x=...`），否则 shake 不掉、体积白涨。

## 三、source map 的发布取舍

三种做法：① 随包发 `.map`（用户调试友好）；② 上传到错误监控（Sentry）但不随包发布（保护源码 + 仍可还原栈）；③ 完全不发。SWC 的 `inlineSourcesContent` 让你选②时也能还原源码上下文。生产库常见组合：发 JS + 上传 map 到监控、公开包不带源。

## 四、npm pack --dry-run 是发布前第一关

永远先 `npm pack --dry-run` 看**实际会打进 tarball 的文件**：有没有漏 d.ts、有没有把 src/、测试、`.env` 一起打进去（用 `files` 字段白名单收口）。这一步省下的都是发布后的撤回与事故。

## 五、借鉴 SWC 自身的多平台发版思想

`@swc/core` 用 `optionalDependencies` 分发各平台二进制（darwin-arm64、linux-x64-gnu…）——你若要发**含原生模块**的库，可照此思路：主包只放 JS 胶水 + 一个可选依赖映射表，按 os/cpu 命中对应平台子包。纯 JS 库则不必，但要像 L2 那样防「本地 mac、CI linux」的锁文件坑。

## 小结
exports/typesVersions 与产物目录严格对齐（types 前置、import/require 分指）；sideEffects:false 助 tree-shaking、避免顶层隐式副作用；source map 三选一（随包/上传监控/不发）；发布前必过 npm pack --dry-run；发原生模块可借鉴 SWC 的 optionalDependencies 平台分包。

## 部署预告
给上一关的库补一份「可发布」的 package.json：写全 main/module/types/exports/sideEffects/files，跑 `npm pack --dry-run` 核对清单，再在临时目录 `npm i ./你的.tgz` 装本地包并 import/require 双验，确认 exports 条件都对得上。
