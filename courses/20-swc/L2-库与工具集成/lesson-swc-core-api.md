# @swc/core 程序化调用

## 一、三个 API 一张脸

```ts
import { transform, transformSync, transformFile } from '@swc/core';

// 异步（推荐，走内部线程池）
const { code, map } = await transform(src, { filename: 'a.ts', jsc: { parser: { syntax: 'typescript' } } });
// 同步（简单脚本/构建钩子里）
const out = transformSync(src, { /* 同上 opts */ });
// 直接读文件
const r = await transformFile('./src/a.ts', opts);
```

三者返回同构的 `{ code, map }`。给打包器写插件时你几乎必然用它们——CLI 只是这层 API 的壳。

## 二、选项对象与 .swcrc 合并

`opts` 的字段和 `.swcrc` 一一对应。设 `swcrc: true` 让 API 也读 `.swcrc`，**代码传入的选项优先级高于文件**，用于临时覆盖。不传 `swcrc` 默认不读文件（API 调用是「显式」心智）。

## 三、别忘了落 source map

`transform` 返回的 `map` 是 JSON 字符串，你要自己写 `.map` 文件并在 code 尾部补 `//# sourceMappingURL`。手搓 loader 最容易忘的就是这一步，导致线上堆栈全是编译后位置。

## 四、平台二进制与 optionalDependencies

`@swc/core` 用 npm 的 `optionalDependencies` 分发各平台预编译二进制（darwin-arm64、linux-x64-gnu…）。两个经典坑：

1. **跨平台锁文件**：在 mac 生成 lockfile 带到 linux CI，二进制没锁上会 `Cannot find module @swc/core-linux-x64-gnu`——用 `npm i @swc/core --os=linux --cpu=x64` 或在 CI 重装。
2. `--legacy` 旧 glibc 机器走纯 JS 回退包，慢但仍可用。

理解这点，就不会在「本地好好的，CI 挂了」里迷失。

## 五、@swc-node 与 tsconfig

`@swc-node/register` 系列把 SWC 挂到 Node 的 require/import hook，让 `node` 直接跑 TS——且**能读 tsconfig.json 的路径别名**。与 `@swc/core` 的分工：前者是「运行时即时转译」，后者是「构建期」。两者都活跃维护。

## 小结
三 API 同构返回 code+map；opts 对齐 .swcrc 且代码优先；map 要自己落盘；optionalDependencies 平台二进制是跨机器故障高发点；@swc-node 管运行时、@swc/core 管构建期。

## 部署预告
写一个 20 行的 `build.mjs`：用 `transformSync` 遍历 `src` 下所有 `.ts`，转成 `.js` 写进 `dist`，并正确产出 `.map` 与 sourceMappingURL；故意在 Linux 容器里跑一次，复现一次平台二进制缺失再修好。
