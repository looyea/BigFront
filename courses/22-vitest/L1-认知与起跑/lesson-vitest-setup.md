# 安装与 vitest.config

## 一、装 + scripts

```bash
npm i -D vitest
```

package.json 常用三条 script：`"test": "vitest"`（watch）、`"test:run": "vitest run"`（CI/单次）、`"test:ui": "vitest --ui"`（浏览器界面）。run 与 watch 的区别就是「跑一次退出」vs「驻留监听」。

## 二、配置放哪：两种姿势

- **独立 `vitest.config.ts`**：Vitest 专用配置，优先被读取。
- **`vite.config.ts` 里的 `test` 字段**：复用同一份 Vite 配置（别名/插件天然共享）。

两者结构一致，都 `defineConfig({ test: { ... } })`。项目已高度依赖 vite.config 的解析配置时，写在 test 字段里最省事；想隔离测试关注点就用独立文件。

## 三、environment：node 还是 jsdom

默认 `environment: 'node'`（无 DOM，测纯逻辑最快）。要测浏览器代码（DOM、组件）设 `environment: 'jsdom'`（需 `npm i -D jsdom`）或更轻的 `happy-dom`。可按文件用注解 `// @vitest-environment jsdom` 覆盖。这个概念在 L4 组件测试会真正用上。

## 四、include / exclude 匹配

默认匹配 `**/*.{test,spec}.?(c|m)[jt]s?(x)`。想改收集范围用 `include`/`exclude`（glob）。避免把 e2e、示例、构建产物纳入单元测试收集，是保持 Vitest 快的前提。

## 五、tsconfig types（不装 globals 也要配）

用全局 API（`describe/it/expect` 免 import）要 `test.globals: true` + tsconfig `"types": ["vitest/globals"]`，否则 TS 报「找不到 expect」。即便显式 import，配好 types 也让 IDE 补全顺。第一条测试跑绿，配置链路就算打通。

## 小结
装 vitest + 三条 scripts（watch/run/ui）；配置独立 vitest.config.ts 或复用 vite.config 的 test 字段；默认 environment:node、测 DOM 用 jsdom/happy-dom（可 @vitest-environment 按文件覆盖）；include/exclude 收窄收集范围保速度；用全局 API 需 globals:true + tsconfig types:vitest/globals。

## 部署预告
给项目建 `vitest.config.ts`：include 限定 `src/**/*.test.ts`、exclude 掉 dist 与 e2e；先只测纯逻辑（node 环境）跑绿，再单开一个文件顶部加 `// @vitest-environment jsdom` 写一条 `document` 相关断言，体会 per-file environment 切换。
