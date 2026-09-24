# 覆盖率与配置进阶

## 一、开覆盖率：装 provider

```bash
npm i -D @vitest/coverage-v8
```

配置里 `coverage: { provider: 'v8', reporter: ['text','html','lcov'] }`。两大 provider：**v8**（基于 V8 引擎原生覆盖，通常更快）与 **istanbul**（可移植、某些边界统计口径不同）。多数项目选 v8。跑 `vitest run --coverage`。

## 二、圈定统计范围

有两处 include/exclude，别混：

- `test.include`：哪些是**测试文件**（跑什么）。
- `coverage.include / exclude`：哪些**源文件计入统计**（算什么）。

想让**没被任何测试碰到的源文件也进分母**（否则覆盖率虚高），用 `coverage.all: true` + `coverage.include: ['src/**']`，把漏测文件按 0% 计入，戳破「只测了就 100%」的假象。

## 三、阈值挡 CI

`coverage.thresholds: { lines: 80, functions: 80, branches: 70, perFile: true }`——低于阈值直接非零退出，CI 挡下。`perFile` 防「一个巨高覆盖文件拉平整体」。阈值是**下限护栏**，不是目标。

## 四、读报告

终端 `text` 给总览；`html` 逐行看**哪行/哪个分支没跑**；重点看**分支覆盖率（branches）**低的地方——往往是有 `if/else`、`?.`、`||` 的某一侧从没被测到，正是 bug 高发区。想要「只看改动文件的覆盖」用 `--changed` 配合。

## 五、纪律：覆盖率是探针，不是 KPI

追高 100% 会诱导写「调一下不断言」的空测试——**绿色但没测任何东西**。正确心态：覆盖率帮你**找出漏测的路径**（尤其错误分支），然后补**真正有断言**的用例。排除掉生成代码、类型声明、纯 re-export（`coverage.exclude`），让数字反映真实逻辑。

## 小结
装 @vitest/coverage-v8（或 istanbul，v8 更快）跑 vitest run --coverage；分清 test.include（跑什么）与 coverage.include（算什么），all:true 把漏测文件计入分母防虚高；coverage.thresholds（含 perFile）挡 CI、是下限非目标；重点看 branches 找漏测分支；覆盖率是探针不是 KPI，别写空测凑数、排除生成物。

## 部署预告
给一个含多条 if 分支的纯函数写测试，先只测正常路径跑 `vitest run --coverage` 看 branches 未满，再补边界/错误分支把它拉起来；加一个 `coverage.thresholds.lines` 到当前值并故意删一条测试，观察 CI 退出码如何变红。
