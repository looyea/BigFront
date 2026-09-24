# ng-perf 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 budgets 门禁、@defer 策略、zoneless 性能面与渲染诊断的题组。

### 1. (A) 解释 zoneless 模式下变更检测的性能改进：从 O(N) 到 O(变化量)。

**来源**：转述自本关 §三 zoneless 性能面段

旧 zone.js：任何异步事件 → Angular 跑一遍完整组件树脏检查（O(N) N=所有组件数）。zoneless：只有被写入的 signal → 标记其依赖链上的 computed/effect/模板绑定为脏 → 只更新这些节点（O(变化量)）。效果：1000 个组件的应用改 1 个 signal → 旧=1000 次 check、新=1 个绑定更新。

### 2. (B) 上线后 Lighthouse 报 LCP 4.5s——列出三种 Angular 项目常见根因。

**来源**：转述自本关 §五包体积优化 + §二 @defer

① **主包过大**（未做路由懒加载/所有组件打在一个 chunk）→ 解析执行时间长；② **LCP 元素在 @defer 内**→ 需要等 JS chunk 下载完才渲染；③ **Resolver 阻塞导航**（慢 API → Router 等完才渲染页面主体）。修：lazy-load feature、LCP 元素不 defer、非关键数据移到组件内异步。

### 3. (C) 对比 Angular @defer 与 React lazy/Suspense：两者的组件级懒加载机制有什么异同？

**来源**：转述自本关 §二 @defer + React lazy 知识

同：都是把组件拆成独立 chunk 按需加载。异：① 触发器：@defer 有 6+ 种（viewport/idle/hover/timer/interaction/immediate）；React lazy 只在组件被 render 时触发（配合 Suspense fallback）。② 声明位置：@defer 在模板内联——粒度更细（一个组件内部可 defer 多个块）；React lazy 在 import 层面。③ 无 JS 时：@defer 输出 placeholder SSR；React lazy SSR 需要 streaming。

### 4. (D) 面试官给你一张 dashboard 页面截图：含大表格 + 3 个图表 + 侧边栏 + 顶部搜索。要求首屏 < 2s。给出 @defer + 路由懒加载的组合策略。

**来源**：转述自本关 §二+§三+§五综合

策略：① Dashboard 整页 loadChildren（路由级——从 app 主包分离）；② 表格首屏可见 → 不 defer；③ 3 个图表在折叠区下方 → `@defer (on viewport)`；④ 侧边栏静态 → 不 defer；⑤ 搜索组件 → 首屏可见不 defer 但 debounce。加分：budgets 控制 chunk 不超过 200KB + CDN 预加载 `<link rel="modulepreload">`。

### 5. (A) angular.json budgets 的 warning 和 error 分别触发什么行为？如何配置 CI 阻断？

**来源**：转述自本关 §一 budgets 段

`maximumWarning`：构建成功但控制台黄字提示；`maximumError`：构建直接失败退出非零 code。CI 中 `ng build --configuration production` → budgets 超 error → exit code 1 → pipeline 红。推荐：initial error=1MB、warning=500KB；anyComponentStyle error=4KB。加分：可加 `anyScript` 限制单个懒加载 chunk。

### 6. (B) 大列表 5000 行用了 `track $index`——用户反馈删除第 3 行后页面卡 500ms。分析根因和优化。

**来源**：转述自本关 §七 @for track 命门段

根因：track $index → 删除第 3 行 → Angular 发现 index 3-4999 全部"变了"（旧 index 3 的数据现在在 index 2）→ 销毁 4997 个 DOM → 重建 4997 个 → 巨大 layout thrash。优化：track by 稳定 id（`track item.id`）→ 只删第 3 行对应 DOM → 其余不动。

### 7. (C) 对比 Angular zoneless 与 Solid 的细粒度更新在实现路径上的本质区别。

**来源**：转述自本关 §三 + 13 包 solid-internals 知识

- **Angular zoneless**：signal 写入 → 标脏 → 模板绑定的 signal 读取方收到通知 → 只更新该绑定点的 DOM。但 **组件边界仍存在**——一个组件内多个绑定按组更新。
- **Solid**：编译器把 JSX 拆成 **每个表达式一个 effect**——DOM 操作粒度是单个文本节点/属性。没有"组件更新"概念——只有"这个 span 的文字变了"。
结论：Solid 更细（表达式级）、Angular 是组件内绑定级。

### 8. (D) 设计一个 CI 性能门禁流水线：PR 时自动 build → 检查 budgets → 跑 Lighthouse CI → 对比 baseline。给出工具链和关键配置。

**来源**：转述自本关 §一+§五与 14 包 sig-perf/vite-ci-perf 知识

工具链：GitHub Actions + `ng build --configuration production` → budgets 内置检查 → `lhci autorun`（Lighthouse CI）→ upload 到 LHCI server 对比 baseline。配置：lighthouse-ci 设 assertions（LCP < 2500ms、CLS < 0.1、Total Byte Weight < 500KB）→ 超阈值 PR 红。加分：用 `nx affected` 只 build 变更的 lib 节省 CI 时间。

### 9. (A) 解释 effect 调度在 zoneless 下的时机——与旧 zone 模式的 timing 差异。

**来源**：转述自本关 §八 effect 调度段

zoneless：signal 写入 → effect **不立即执行** → 安排在当前微任务（microtask）结束后批量执行 → 避免同一帧内多次触发。旧 zone 模式：异步事件触发 zone 的 onLeaveTask → CD 遍历中执行 effect。差异：zoneless 更确定性（明确知道 effect 在哪个时间点跑）、不依赖异步拦截——可通过 `flushEffects()` 强制同步。

### 10. (B) 项目升级 v21 zoneless 后部分组件不更新——数据变了但视图不反映。列举两种原因。

**来源**：转述自本关 §三+§四 DevTools 诊断段

① **该组件用了旧 class 字段 + OnPush + 手动 markForCheck**——zoneless 下 OnPush + 不可变数据仍依赖 markForCheck——如果代码路径没走到 → 视图不更新。修：迁移到 signal。② **第三方库改 DOM 不经 signal**（如 jQuery 插件）——zoneless 不拦截 → Angular 不知道要更新。修：afterNextRender + markForCheck / 或 `changeDetectorRef.markForCheck()`。

### 11. (C) Angular 的 `ng inspect` 与 Webpack Bundle Analyzer / Vite rollup-plugin-visualizer 各解决什么层面的性能问题？

**来源**：转述自本关 §四 ng inspect + §五包体积

- **ng inspect**：分析组件/依赖图——发现重复导出、未使用 import、懒加载边界是否生效。关注"架构正确性"。
- **Bundle Analyzer**：可视化 chunk 内容——看哪个 npm 包占了最大体积（如 moment.js 60KB）。关注"包体积组成"。
互补关系：ng inspect 告诉你"为什么这个组件被打进主包"，Bundle Analyzer 告诉你"主包里谁占了大头"。

### 12. (D) 面试官让你用最少改动把 5 年历史 Angular NgModule 项目升级到 zoneless signal 栈——给出分阶段路线图。

**来源**：转述自本关 §三与 L1 ng-version-map 知识

路线图：① v17: standalone bootstrap + 控制流语法 codemod；② v18: 新组件用 signal input/output（旧保留 @Input）；③ v19: 默认 standalone + signal 迁移核心组件；④ v20: @angular/build（Vite）切换；⑤ v21: zoneless 灰度（先 flag 后 default）+ 修复 markForCheck 遗留；⑥ v22: Signal Forms + 全量 zoneless。每阶段 CI 跑测试 + budgets 验证。

### 13. (A) `patch` 与 `set`/`update` 写 signal 的区别是什么？大对象场景 patch 的优势？

**来源**：转述自本关 §三 signal 不可变更新段

- `set(newVal)`：整个替换；`update(fn)`：fn 接收集旧值返回新值（通常 spread 创建新对象）。
- `patch(partial)`：**就地修改**（mutate）对象/数组——不创建新引用 → 需手动 `markAsDirty`。优势：100KB 对象改一个字段 → set/update 复制整个对象 O(N)；patch 只改那一个字段 O(1)。注意：patch 在 Angular signal 中不自动通知（因为 Object.is 仍为 true）——需要配合 `untracked` + 手动通知或 `@angular/core/rxjs-interop`。

### 14. (B) Chrome DevTools Performance 面板录制发现一个 3s long task——Angular 项目里最常见的三种 culprit。

**来源**：转述自本关 §四 DevTools 诊断段

① **大列表渲染**：@for 10K 行一次性 DOM 创建 → 用虚拟滚动（CDK Scrolling）+ track by id；② **重 computed**：computed 里做 sort/filter 大数组 → 用 patch 局部更新 + 只存必要派生；③ **同步 I/O**：localStorage.getItem/setItem 在循环里 → 改为内存缓存 + 异步写。定位：Performance 面板火焰图最长横条 → 看函数名。

### 15. (D) 面试官问「你如何量化性能改进的效果？」给出度量方法。

**来源**：转述自本关 §一 budgets + §四 DevTools + 业界实践

方法：① **Bundle 大小**：`ng build --prod` → budgets 报告 + `ls -la dist/ | gzip` 对比；② **Core Web Vitals**：Lighthouse CI 跑 5 次取中位数 → LCP/CLS/INP 数值对比改前改后；③ **运行时性能**：Chrome Performance 录制 → 对比 Total Blocking Time / Long Tasks 数量；④ **真实用户监测（RUM）**：Web Vitals API 上报 → BigQuery 看 P75。一句话：build 门禁 + lab + field 三层。
