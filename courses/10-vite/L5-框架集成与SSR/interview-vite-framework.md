# vite-framework 面试题精选

> 共 15 题，覆盖 **框架插件 / SFC 编译 / JSX 与 Refresh / esbuild-Babel-SWC / 编译时框架 / TS 集成** 六类。

---

## 一、框架插件定位

### 1. Vite 官方框架插件（vue/react/svelte）到底做了什么？

三件事：① **语法编译**——把框架 DSL（`.vue` SFC、`.jsx`、`.svelte`）在 `transform` 钩子里编译成标准 ESM，浏览器才能执行；② **HMR 集成**——注入/对接框架的热替换协议（Vue 的组件热替换、React 的 Fast Refresh、Svelte 的 hmr 运行时），让改组件保留状态局部更新；③ **子资源处理**——SFC 里的 `<style scoped>`、`<script setup>` 宏、JSX runtime import 等的编译期变换。本质是 Vite 插件 API 的框架级应用。

**来源**：Vite — "Framework Plugins"; @vitejs/plugin-vue — "how it works"; @vitejs/plugin-react — README

### 2. 只装 `vite` 不装 `@vitejs/plugin-vue`，import 一个 .vue 会怎样？为什么？

会报错/无法加载（"Unknown file extension .vue" 或产物缺该模块），因为 Vite 核心不认识 `.vue`，没有任何 `transform` 会把它编译成 JS。框架插件是"语言能力"的来源之一。同理 React 项目缺 `@vitejs/plugin-react` 时 JSX 能靠 esbuild 转，但**没有 Fast Refresh**（HMR 退化为整页刷新）且少了 babel 插件生态。

**来源**：Vite — "Vue/React 快速上手先装插件"; Vue SFC — "tooling"; community — "unknown file extension .vue"

---

## 二、Vue SFC

### 3. `<script setup>` 的编译器宏（defineProps 等）为什么不需要 import？运行时还是编译时？

它们是**编译器宏**——不是运行时 API，而是 `@vue/compiler-sfc` 在编译期识别并展开成对应的组件选项/运行时代码（`defineProps` → props 声明与 `__props` 引用等）。因为编译器直接改写源码，所以无需 import、也不能当普通函数动态调用（参数须是可静态分析的编译时常量）。理解"宏 vs 运行时"是 Vue3 编译优化的关键。

**来源**：Vue — "SFC Script Setup / Compiler Macros"; @vue/compiler-sfc; Vue RFC — "`<script setup>`"

### 4. scoped style 是怎么实现的？会有代价吗？

编译期给组件每个元素加唯一属性（`data-v-xxxx`），并把 `<style>` 里选择器改写成带该属性的形式（`.a[data-v-xxxx]`），从而样式只作用于本组件。属于**编译时隔离**（非真正 shadow DOM）。代价：属性选择器略增特异度/体积，`:deep()` 穿透要小心，父传子的根元素会带两个 scope 需注意。构建时若开 CSS 提取（cssCodeSplit，呼应 L3）会拆进对应 chunk。

**来源**：Vue — "SFC Scoped Style"; Vue — ":deep() / slotted"; CSS — "attribute selectors"

---

## 三、React JSX 与 Fast Refresh

### 5. React 项目里 JSX 到底由 esbuild 还是 Babel/SWC 编译？区别是什么？

Vite 核心用 esbuild 能把 JSX 语法转成 `createElement`/automatic runtime。但 `@vitejs/plugin-react` 会为 `.jsx/.tsx` 接管并加**Fast Refresh** 注入（Babel），或 `plugin-react-swc` 用 SWC 注入 react-refresh。取舍：只用 esbuild 最快但无 Fast Refresh/无 babel 插件；框架插件补上 HMR 与自定义转换（SWC 更快、Babel 生态更全）。所以"能编译"和"有良好 DX"是两回事。

**来源**：Vite — "esbuild JSX"; @vitejs/plugin-react — "Babel/React Refresh"; SWC — "react-refresh"

### 6. 什么是 React Fast Refresh？它和普通 HMR 有什么不同？

Fast Refresh 是 React 的**有状态组件热替换**：编辑组件后，保留组件已挂载的 state/hooks 值，只替换渲染函数，无需刷新、不丢表单/上下文。普通 HMR（无框架支持）只能整模块重载或 full-reload，会重置状态。它依赖编译器注入 `react-refresh/runtime` 的注册与比较逻辑，并要求"一个文件基本只导出组件"（混导出非组件会破坏边界，退化为整页刷新）。

**来源**：React — "Fast Refresh"; Dan Abramov — "Fast Refresh 设计"; @vitejs/plugin-react — "refresh"

---

## 四、编译器对比

### 7. esbuild、Babel、SWC 三者在 Vite 构建中各自的定位？

- **esbuild**（Go）：Vite 默认，负责 TS/JSX 语法转换、依赖预打包、（可）minify，主打极速；只删类型不校验，不支持实验语法/自定义插件。
- **Babel**（JS）：语法转换 + 最丰富的插件/预设生态（装饰器、polyfill 生态、codemod），慢。
- **SWC**（Rust）：类 Babel 能力、速度快，可作 Babel drop-in（plugin-react-swc、TS 转译），自定义插件走 Wasm。
Vite 里：默认 esbuild 打底，框架插件按需引入 Babel/SWC 做框架专属编译 + HMR。

**来源**：esbuild docs; Babel — "plugins/presets"; SWC — "why swc / vs babel"; Vite — "esbuild integration"

### 8. 既然有 esbuild，为什么还要单独跑 `tsc --noEmit`/`vue-tsc`？

因为 esbuild/SWC 转译时**只剥离类型标注，不做类型检查**——类型写错也照样构建成功，问题会溜到运行时或误导后续开发。`tsc --noEmit`/`vue-tsc` 做完整类型校验（含跨文件推断、泛型、严格规则）。最佳实践：编辑器实时提示 + CI/构建前置一步类型检查门禁（呼应 Express L7 质量门禁理念），构建本身仍用快编译器。

**来源**：TypeScript — "tsc --noEmit"; Vue — "vue-tsc / type-check"; esbuild — "no type checking"

---

## 五、编译时 vs 运行时

### 9. 编译时框架（Svelte/Solid）与运行时框架（React/Vue）在 Vite 产物上的差别？

运行时框架：产物含框架 runtime（vdom diff / 响应式系统），组件在浏览器里"跑起来"更新 DOM——体积与运行时开销随 app 规模常驻。编译时框架：构建期把组件编译成直接命令式 DOM 操作，产物小、几乎无 runtime（Svelte）或极小细粒度 runtime（Solid）。对 Vite 而言都靠 `transform` 编译 DSL，差别在编译器策略。选型看团队/生态/交互复杂度，而非构建器。

**来源**：Svelte — "Svelte vs React / compiler"; Solid — "performance / no vdom"; Rich Harris — "Rethinking reactivity"

### 10. 一个 Vite 项目能同时存在多个框架吗？要注意什么？

可以：`plugins: [react(), vue()]` 各自按文件后缀/`include` 过滤处理，作用于不同文件互不冲突（Astro/Nuxt 的多框架"岛屿"、渐进迁移都这么用）。注意：① 两套 runtime 都进产物 → 体积叠加，慎用大面积混用；② HMR/构建配置分别配；③ tsconfig `jsx`/`jsxImportSource` 要匹配各框架；④ 尽量按目录/后缀清晰隔离，避免同文件混语法。

**来源**：Astro — "UI frameworks islands"; Vite — "multiple plugins / include filter"; Nuxt content

---

## 六、集成实践

### 11. TS + 框架项目在 Vite 里如何配置才顺畅？

要点：`tsconfig.json` 与 `tsconfig.node.json` 分离（应用代码 vs vite.config 等 Node 侧），设 `jsx`（React 用 `react-jsx`）、`types`、`moduleResolution`（bundler）、`verbatimModuleSyntax`/`isolatedModules`（esbuild 友好：别用会破坏单文件转译的构造，如非 `const enum`、re-export 类型不加 `type`）。`vite-env.d.ts` 引入框架类型与 `ImportMetaEnv`。类型检查独立跑 `tsc --noEmit`（呼应第 8 题）。路径别名 `resolve.alias` + tsconfig `paths` 两边对齐。

**来源**：Vite — "Build Options / TS / tsconfig"; TypeScript — "isolatedModules / verbatimModuleSyntax"; Vue/React TS 指南

### 12. 升级到 Vite 大版本后框架集成常踩的坑？

① 框架插件版本要与 Vite 主版本匹配（peerDependencies），旧插件在新 Vite 可能钩子不兼容；② Vite 6 **Environment API** 变化影响 SSR/自定义环境插件；③ Rollup 大版本升级带来 `manualChunks`/treeshaking 行为微调（呼应 L3）；④ esbuild/SWC target 变化影响降级产物（vite-target）；⑤ 依赖预打包 `optimizeDeps` 默认项变化导致 dev 偶发"outdated optimize dep" 504/白屏。升级后跑：dev/build/preview 三模式 + 类型检查 + 关键 HMR 手工验证。

**来源**：Vite — "Migration guides"; @vitejs/plugin-vue / react releases; Vite 6 — "Environment API"

---

## 补充（新专题 13-15）

### 13.  @vitejs/plugin-react 为什么核心是 Babel 而不是 esbuild？它如何利用 Babel 做 Fast Refresh 边界处理？

分工：语法剥离（TS/JSX 转译）esbuild 就够，但 dev 期插件要注入 React Refresh runtime（前段 import react-dom/client 的注入代码、后段注册判断、按模块导出形状决定"组件替换还是 remount"的边界包裹），这类"按 AST 结构注入"必须 AST 级工具，Babel 插件形态最成熟——SWC 路线（原 plugin-react-swc）是另一条以 Rust 换性能的实现，函数组件默认走 SWC、需要 babel 配置命中时回退 Babel 的混合架构。Fast Refresh 边界的细节：模块顶层只有组件导出时可直接热替换；导出了非组件值（常量/上下文）会退化为 reload 或保守失效；createContext、React.memo 包裹、HOC 结果的"组件身份"保持是边界算法难点——这解释"有时改了组件整页刷新"（呼应 quiz 既有题）。工程选项：React Compiler 接入后 babel 管道复用（插件配置 babel 钩子注入 compiler）；用 SWC 版换构建速度但要核对自定义 babel 插件（如 styled-components、jsx 装饰器类）在 SWC 有无对应。加分句：这题的陷阱是把它答成"转译器选型"——真实考点是 dev 期"编译器注入 + 运行时 registry"的协同协议，转译只是顺带。

**来源**：@vitejs/plugin-react README（Babel 与 SWC 选项）；React Fast Refresh spec；Vite 官方 HMR 文档

### 14.  同一文件被多个插件 transform，链是怎么排的？出现顺序冲突你怎么排查？

排序规则：config 数组顺序为基线，全局按 enforce 分三段（pre → 普通（核心插件与用户普通插件按数组序交织）→ post），同段内数组序；transform 链上每个插件拿到的 code 是上一环输出。排查工具链：vite-plugin-inspect（Transform Result 面板逐环节看代码与 map 覆盖率）是第一选择；无 GUI 环境给可疑插件的 transform 加 DEBUG 输出 code 首行哈希，二分定位"哪一环把代码改坏/把 map 丢了"。典型冲突形态：① map 拼接断裂——中间某插件不返 map，其后所有 map 指错行（DevTools 断点漂移的真因）；② 语法超前消费——B 插件按原始 Vue 语法匹配，但 A 插件已改写（enforce 没对齐"谁先看源码"的合同）；③ import 注入与依赖分析时序——注入方必须 pre，否则核心分析已完成；④ 同钩子多插件对 return 值的形状假设不同（ast 共享是实验特性别依赖）。修复手段按成本升序：调数组顺序 → 加 enforce → 用 apply/filter 缩小彼此射程 → 找插件替代品。收口句：插件顺序不是 bug 是合同——写插件时文档化"我要看谁的输出/我改完给谁用"，比任何事后排查都便宜。

**来源**：Rollup 官方插件顺序文档；Vite 插件 enforce 文档；vite-plugin-inspect 使用说明

### 15.  一个 TS+React 项目，从编辑器红线到 CI 构建，tsc、esbuild、SWC/Babel 各管哪段？为什么说类型检查必须独立跑？

管线切片：编辑器语言服务（tsserver，实时增量）管开发体验；tsc --noEmit 管类型正确性（CI 独立步骤，产不出代码所以叫"纯检查"）；esbuild 管 dev/build 的类型语法擦除（不看类型系统，只按语法规则删 : Type 与 interface——快且语义固定的原因）；Babel/SWC（框架插件里）管 JSX 运行时与框架特有转译。为什么必须独立：esbuild 的降级转译对"类型误用"完全无感（任何值当任何类型都跑得通），且跨文件类型推断它根本不做——类型是"编译期契约"，执行期不存在，只有 tsc 全量图能验。tsc 与 esbuild 的语义缝隙要防：const enum（esbuild 无法安全内联）、import type 的 elision 差异、装饰器实验语法版本——isolatedModules 标志的意义就是"把每个文件当独立转译单元写代码"，Vite 项目必开（开了 tsc 会拦截所有"跨文件类型优化语法"）。CI 顺序设计：tsc --noEmit 与构建并行跑（互不依赖），测试用 vitest（其类型检查默认也关，同哲学——测试跑绿靠运行时）。加分句：把"Vite 为什么不做类型检查"答成"为了快所以放弃"是初级答案；正确表述是"类型检查是跨文件全局问题，转译是单文件局部问题，两类问题分开收费才可能各自优化到极致"。

**来源**：TS 官方 isolatedModules 文档；esbuild 官方 What esbuild does not do 章节；Vite 构建指南
