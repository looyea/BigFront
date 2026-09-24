# 面试题：安装与配置（vitest-setup）

### 1. (实战类) 最小可用配置长什么样？
**来源**：https://vitest.dev/config/environment.html

很多时候零配置就能跑——Vitest 自动读 vite.config。要显式配置就建 vitest.config.ts：defineConfig({ test:{ environment, include, globals } })，或直接在 vite.config.ts 加 test 字段复用解析。

### 2. (对比类) vitest.config.ts 和 vite.config 里的 test 怎么选？
**来源**：https://vitest.dev/config/globals.html

项目已重度依赖 vite.config 的 alias/插件、想让测试天然共享→写在 test 字段；想把测试配置隔离独立、职责更清晰→单独 vitest.config.ts（Vitest 优先读它）。结构一致、二选一姿势。

### 3. (原理类) environment:node 和 jsdom 区别？
**来源**：https://vitest.dev/guide/environment.html

node 无 DOM、启动最快，适合纯逻辑；jsdom 模拟浏览器环境（document/window），测 DOM 与组件必需，需 npm i -D jsdom。happy-dom 是更轻快的替代。默认 node，按需切。

### 4. (实战类) 怎么只给某个文件用 jsdom？
**来源**：https://vitest.dev/guide/environment.html

在该测试文件顶部写 // @vitest-environment jsdom 注解，无需把全局 environment 改掉。这样纯逻辑测试仍跑在快的 node 环境、只有需要 DOM 的文件付 jsdom 成本。

### 5. (坑类) TS 报「找不到名称 expect」为什么？
**来源**：https://vitest.dev/config/globals.html

用了 globals:true 却没配 tsconfig types。修：tsconfig compilerOptions.types 加 "vitest/globals"。或干脆显式 import { expect } from vitest，最省心。

### 6. (对比类) include/exclude 默认匹配什么、要收窄吗？
**来源**：https://vitest.dev/config/include.html

默认 **/*.{test,spec}.?(c|m)[jt]s?(x)。大项目应确认没把 e2e/示例/构建产物纳入单测收集——用 include/exclude 收窄，既避免误跑也保住 Vitest 的速度。

### 7. (实战类) watch 和 run 分别在什么时候用？
**来源**：https://vitest.dev/guide/cli.html

开发期用 vitest（watch）当测试伴侣即时反馈；CI/提交前/pre-commit 用 vitest run 跑一次拿退出码挡 PR。--ui 则用于可视化排查慢/失败用例。

### 8. (原理类) Vitest 为什么不强制单独配 transform？
**来源**：https://vitest.dev/guide/features.html

因为它复用 Vite 的解析转换链：项目里怎么把 .ts/.vue/.jsx 变成可运行模块，测试就走同一套。少了 babel-jest 这一层，配置面小、行为与应用一致。

### 9. (实战类) setupFiles 是干嘛的？
**来源**：https://vitest.dev/config/setupfiles.html

在每个测试文件执行前注入的前置脚本（如注册 jest-dom 匹配器、初始化 MSW、polyfill 缺失 API）。environment 相关的全局准备常放这里，避免每个文件重复。

### 10. (坑类) jsdom 装了但组件测试仍报 document 未定义？
**来源**：https://vitest.dev/guide/environment.html

多半没设 environment:jsdom（全局或 per-file）。默认还是 node。确认配置生效、或加 @vitest-environment jsdom 注解。

### 11. (对比类) happy-dom 和 jsdom 怎么选？
**来源**：https://vitest.dev/config/environment.html

happy-dom 更轻快、覆盖常见 DOM API 足够多数组件测试；jsdom 兼容性/完整度更高但稍慢。追求速度试 happy-dom，遇到它缺的 API 再回 jsdom。

### 12. (实战类) 怎么配「跑一次失败就让 CI 非零退出」？
**来源**：https://vitest.dev/guide/cli.html

用 vitest run；它据测试结果决定退出码。想更严可加 --bail 提前失败、或配 reporters 输出机器可读结果。CI 永远用 run 而非 watch。

### 13. (原理类) globals:true 的利弊？
**来源**：https://vitest.dev/config/globals.html

利：贴近 Jest 习惯、少写 import。弊：污染全局命名、TS 需额外 types 配置、显式 import 其实更可追溯。团队二选一，但显式 import 对工具链更友好。

### 14. (坑类) 改了 vitest.config 没生效？
**来源**：https://vitest.dev/config/include.html

可能同时存在 vite.config 与 vitest.config 而优先级搞混（vitest.config 优先但字段合并规则要清楚），或 watch 没重启、或配的是被 exclude 的文件。核对读的是哪份配置。

### 15. (实战类) 怎么组织多环境项目（node + 组件）？
**来源**：https://vitest.dev/config/projects.html

用 projects/workspace 拆多个测试项目，node 项目跑纯逻辑、jsdom 项目跑组件，各自 environment/include。比全局设 jsdom 更快、也更清晰（详见 UI/workspace 关）。
