# vite-framework 面试题精选

> 共 12 题，覆盖 **框架插件 / SFC 编译 / JSX 与 Refresh / esbuild-Babel-SWC / 编译时框架 / TS 集成** 六类。

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
