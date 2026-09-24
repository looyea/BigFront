# 为什么这么快 + 大仓实测

## 一、快的四个来源

Biome 相对 Prettier/ESLint 的数量级速度差来自四件事叠加：

1. **Rust 单二进制**：原生执行、无 Node/V8 冷启动、无 GC 停顿；
2. **一次解析多处用**：formatter 与 linter 共享同一份 AST，不像「Prettier parse 一遍 + ESLint parse 一遍」；
3. **并行处理文件**：多核同时跑不同文件，而非 JS 主线程串行；
4. **常驻 daemon/LSP**：编辑器里进程不重启，保存即检几乎零延迟（呼应 20-swc 的原生+常驻思路）。

## 二、大仓实测：万文件是什么体验

在 monorepo（万级文件）里，ESLint + Prettier 全量常是**分钟级**，Biome 全量 check 可压到**秒级**。这不是微调、是数量级——它把「全量跑一遍」从「算了只检改动的」变成「随手就跑」。测法：同一仓库、同一机器，分别计时 `eslint .` + `prettier --check .` 与 `biome check .`，看总墙钟时间。

## 三、「快」带来的工程习惯改变

慢工具逼你妥协：pre-commit 只敢跑改动、CI 里 lint 单独占几分钟、本地懒得格式化。快工具**取消这些妥协**：保存即格式化、提交前全量秒过、CI 检查快到可以忽略它的存在。速度不只是省时间，它改变了「你愿不愿意一直跑」这个行为本身。

## 四、何时性能不是卖点而是必需

对绝大多数项目，快是「锦上添花的体验」。但对**超大 monorepo / 大量小 PR 的高频团队 / 把 lint 放进 pre-commit 每个 commit** 的场景，慢工具的时间会被乘上海量次数变成真实成本。这时 Biome 的速度直接决定「lint/format 到底能不能常驻在开发循环里」。

## 五、排查「感觉变慢了」

若某次 Biome 变慢：多半是扫描范围失控（忘了 ignore 产物）、单文件异常大、或磁盘 I/O。用 `biome check` 的范围参数收窄、确认 files.include/vcs.useIgnoreFile 生效，别急着怀疑 Rust 内核——先查是不是把 `node_modules` 也扫进去了。

## 小结
快的四来源：Rust 单二进制/一次解析多处用/多文件并行/常驻 daemon-LSP；万级 monorepo 全量 check 从分钟到秒、是数量级差；速度会改变工程习惯（保存即格式化、pre-commit 全量、CI 秒检）；对超大仓/高频小 PR 快是必需而非锦上添花；变慢先查扫描范围失控与 I/O、别疑内核。

## 部署预告
在你手上最大的仓库分别计时 `npx eslint .`（若配了）+ `npx prettier --check .` 与 `npx biome check .`，记录墙钟时间做成一张前后对比表；再故意去掉一个 ignore 让 Biome 扫 dist，观察耗时如何飙升，验证「范围失控」的影响。
