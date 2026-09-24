# monorepo 与多语言覆盖

## 一、配置分层

根 `biome.json` 放公共策略，子包用 `extends` 继承 + 局部 override 差异。Biome 对**就近配置**的处理：更靠近文件的 biome.json 对该目录生效。原则和 20-swc 里「就近 .swcrc」一致——公共托管通用、子包只声明偏差。

## 二、files.include 划 workspace

monorepo 最大的坑是「扫到产物、扫到别的包」。用 `files.include` 精确圈定要管的源码目录、`files.ignore` 排除 `dist`/`node_modules`/`coverage`，或干脆 `vcs.useIgnoreFile: true` 直接复用 .gitignore——一处声明、全工具共享。

## 三、多语言格式化

Biome 不止 JS/TS：JSON、CSS、GraphQL 也有格式化支持（部分仍 experimental）。好处是**一个工具统一全仓排版**（package.json、tsconfig.json、样式、GraphQL 都用同一套缩进/宽度规范），不必再为 JSON 单装一个 formatter。用前确认目标语言在你所用版本的成熟度。

## 四、overrides：按 glob 差异化

某些规则对测试/生成代码不适用。用 `overrides` 按 glob 覆盖：例如对 `**/*.test.ts` 关掉「复杂度阈值」（测试允许直白堆断言）、对某些目录放宽命名规范。让「规则跟着文件类型走」而非一刀切。

## 五、和 pnpm workspace / Turborepo 配合

Biome 本身是「扫目录跑检查」，与任务编排正交：Turborepo 里把 `biome check` 做成一个 task 缓存结果；pnpm workspace 里根装 Biome、各包共享同一 biome.json（extends）。跨包一致格式化 + 秒级全量 check，是 monorepo 采用 Biome 的核心收益（呼应性能关）。

## 小结
根配置放公共、子包 extends+override 差异、就近配置生效；files.include/ignore 或 vcs.useIgnoreFile 划清 workspace 防扫产物；JSON/CSS/GraphQL 多语言统一排版（看成熟度）；overrides 按 glob 对测试/生成码差异化；与 Turborepo/pnpm 正交配合，把 check 做成可缓存 task。

## 部署预告
在一个 pnpm monorepo 根建 biome.json（vcs.useIgnoreFile:true + 公共 formatter/linter），给某个子包加 extends 覆写一条规则，再用 overrides 对 `**/*.test.ts` 关掉某条 complexity 规则。跑 `biome check .` 验证分层与差异化都按预期生效。
