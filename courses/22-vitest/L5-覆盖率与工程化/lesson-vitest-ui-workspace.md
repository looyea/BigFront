# UI 模式与 workspace

## 一、--ui：给测试一个界面

`vitest --ui` 打开浏览器面板：看用例树、每条状态/耗时、失败堆栈与 diff、快照变化，还能点某条单独重跑。排查「哪条慢、为什么红」比翻终端日志直观得多。CI 里不用它（用 run + 机器可读 reporter）。

## 二、projects（原 workspace）：一套配置多环境

同仓既要跑**纯逻辑（node）**又要跑**组件（jsdom）**，别全局设成 jsdom 拖慢全部。用 `test.projects` 拆子项目，各自带 `environment`/`include`/`setupFiles`：

```ts
test: { projects: [
  { test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
  { test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.dom.test.tsx'] } },
]}
```

monorepo 里每个包一个 project、共享根配置，是大型仓库的标准组织方式。

## 三、in-source testing：测试写在源码里

把 `if (import.meta.vitest) { it(...) }` 内联在源文件中，构建时被 tree-shake 掉。适合**小工具函数**就近测试、免开单独文件。团队项目谨慎推广（可读性争议），但知道有这条路。

## 四、typecheck：类型也要测

`expectTypeOf(x).toEqualTypeOf<string>()`（从 `vitest` 导入）写「类型断言」。默认**不随运行执行**，需 `test.typecheck.enabled` 开启、走独立 tsc 式流程——它查的是类型级正确性，和运行时测试互补，也和 **20-swc**「只擦类型不查类型」形成呼应（那活儿得有人干）。

## 五、并行、分片、调试

- **并行**：`fileParallelism`/`pool`/`maxWorkers` 决定多文件同时跑。
- **分片**：`--shard=1/4` 把套件切 4 份分发到多台 CI 机器横向提速。
- **调试**：`it.debug()` 或 `NODE_OPTIONS=--inspect-brk` 挂调试器打断点；IDE 装 Vitest 扩展点绿三角直接跑单条。

## 小结
--ui 可视化看用例/耗时/失败 diff（本地排查用、CI 不用）；test.projects 拆 node/jsdom 多环境（monorepo 各包一 project），别全局 jsdom 拖慢；in-source 源码内联测试构建时剔除；typecheck+expectTypeOf 做类型测试、需显式开、与运行时互补；并行 fileParallelism/pool、分片 --shard 横向扩、调试 it.debug/--inspect-brk/IDE 扩展。

## 部署预告
把项目配成 `projects`：node 跑 `*.test.ts`、jsdom 跑 `*.dom.test.tsx`，一次 `vitest run` 两类都收；再 `vitest --ui` 打开面板点某条失败用例看 diff；最后写一条 `expectTypeOf(sum(1,2)).toEqualTypeOf<number>()` 并开 typecheck 跑通。
