# import 自动整理

## 一、开一下就有

`organizeImports: { enabled: true }` 后，Biome 会按**自然顺序（natural order）**重排并去重 import，把 `import` 语句按来源分组、组内稳定排序。它是 `biome check` 三件事之一，`--write` 时自动应用。

## 二、和 eslint-plugin-import / simple-import-sort 对照

如果你用惯 `simple-import-sort` 或 `eslint-plugin-import/order`，organizeImports 覆盖其主干：分块、排序、去无用。差异在于 Biome 是内置、零额外依赖、Rust 级快；而 ESLint 那套可配更细的自定义分组（如按 alias 前缀强制分层）。需要极复杂分层约束时，这是 Biome 目前偏「够用」的地方。

## 三、辅助导入注解

Biome 认识 `// biome-ignore` 之外的组织性提示：对某些必须保持在特定位置、或带副作用的 import，可用注解/配置防止被移动到「看起来不对但功能需要」的位置。副作用导入（`import './polyfill'`）要留意排序后是否仍在预期位置执行。

## 四、apply 与 check 模式

`biome check` 会**报出** import 顺序问题；`--write` 才真正重排。也可通过 `biome lint`/`assist` 相关动作单独应用。CI 用无 `--write` 的 check 挡住「没整理 import」的提交，本地交给编辑器保存即整理。

## 五、和 IDE auto-import 打架

VS Code/WebStorm 自己的「organize imports on save」若和 Biome 同时开，会出现「谁最后写盘」的竞争。约定一个真源——通常关掉 IDE 的、统一交给 Biome，保证团队所有人 import 排序规则一致、可被 CI 复现。

## 小结
organizeImports 开关即得、按自然序重排去重、是 check 三件事之一；对照 simple-import-sort 覆盖主干但自定义分层偏弱；留意副作用/需固定位置的 import；check 报问题、--write 应用、CI 无 write 挡未整理；与 IDE auto-import 择一真源避免打架。

## 部署预告
打开 organizeImports.enabled，找一个 import 顺序很乱的旧文件跑 `biome check --write`，看它如何分组排序；再故意写 `import './side-effect.css'` 这类副作用导入，确认整理后其执行位置是否仍符合预期。
