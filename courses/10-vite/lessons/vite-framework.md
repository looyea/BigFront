# Vue / React / Svelte 集成

> 目标：**看懂框架官方插件在 Vite 里做了什么**——`@vitejs/plugin-vue`、`@vitejs/plugin-react`（及 SWC 变体）、Svelte 插件；理解"编译时 vs 运行时"框架、JSX/TS 如何处理、框架级 HMR 边界如何借插件钩子实现。

---

## 一、为什么框架需要"官方 Vite 插件"

Vite 核心只懂 JS/TS/CSS/HTML/资源。框架的**专属语法**（Vue 的 `.vue` SFC、React 的 JSX、Svelte 的 `.svelte`）浏览器不认识，必须由插件在 `transform` 阶段编译成标准 ESM，并接上 **HMR 语义**（改一个组件只热替换该组件，而非整页刷新）。所以每个主流框架都有官方 `@vitejs/plugin-*`，本质是上一篇插件 API 的框架级应用。

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default { plugins: [vue()] };
```

---

## 二、@vitejs/plugin-vue：SFC 编译

`.vue` 单文件组件把 template/script/style 写在一起，需 `@vue/compiler-sfc` 拆解编译。插件干的活：

```js
// 概念示意
{
  name: 'vite:vue',
  transform(code, id) {
    if (!id.endsWith('.vue')) return;
    // 1) 解析 SFC：拆出 <script setup> / <template> / <style>
    // 2) template → render 函数；<script setup> 宏编译；scoped style 加哈希
    // 3) 产出标准 JS 模块（含子请求 ?vue&type=style 等）
  },
  handleHotUpdate(ctx) { /* 精确到组件的 HMR 边界 */ },
}
```

关键点：
- **`<script setup>` 编译器宏**（`defineProps`/`defineEmits`/`defineExpose`）在编译期被转换掉——不是运行时函数；
- **scoped/CSS Modules**：插件给样式选择器加唯一 hash，并把 `<style>` 拆成子模块请求（呼应 L2 CSS）；
- **`vue-tsc`**：类型检查不走 esbuild（esbuild 只删类型不校验），需在 CI/`build` 前单独跑 `vue-tsc --noEmit`（见下）；
- **HMR**：改组件热替换、保留组件状态（`createHotContext` + `import.meta.hot.accept`）。

---

## 三、@vitejs/plugin-react：JSX、Fast Refresh

React 的 `.jsx`/`.tsx` 需转成 `React.createElement`/新 JSX runtime。插件用 **Babel**（默认）做两件事：

```js
plugins: [react()]   // 默认基于 Babel
```

1. **JSX/TS/新语法转换**（也可交给 esbuild，见第四节）；
2. **Fast Refresh（HMR）**：注入 React Refresh 运行时，让组件编辑后保留 state/hook 值热替换。

> React 的 HMR 比 Vue 更依赖运行时补丁（Fast Refresh 边界），插件会往模块里注入 `refreshReg`/`isReactRefresh` 等代码——这是它必须用 Babel 精细改写的原因之一。

**SWC 变体**：`@vitejs/plugin-react-swc` 用 Rust 的 SWC 替代 Babel，**编译更快**（尤其冷启动/大项目），HMR 用 SWC 的 react-refresh 插件。功能对齐、性能更优，新项目常默认用它；需要特殊 Babel 插件（某些装饰器/宏）时才回 Babel 版。

```js
import react from '@vitejs/plugin-react-swc';
export default { plugins: [react()] };
```

---

## 四、esbuild vs Babel/SWC：谁编译什么

Vite 默认用 **esbuild** 处理 TS/JSX（快），但 esbuild **只做语法转换与删类型，不做类型检查、不跑自定义 Babel 插件**。

| 能力 | esbuild | Babel | SWC |
|------|---------|-------|-----|
| 速度 | 极快 | 慢 | 快（Rust） |
| 语法转换（TS/JSX） | ✅ | ✅ | ✅ |
| 类型检查 | ❌（只删） | ❌（需 preset-ts） | ❌（只删） |
| 装饰器/实验语法/自定义插件 | 部分/❌ | ✅ 生态最全 | 部分 |
| polyfill/降级老目标 | 有限 | ✅ | ✅ |

结论：**类型检查永远交给 `tsc`/`vue-tsc`**（编辑器实时 + CI `--noEmit`），构建用 esbuild/SWC 提速；要老浏览器语法降级用 target/legacy（呼应 L3）。框架插件（vue/react）在 esbuild 之上补充"框架专属编译 + HMR"。

---

## 五、@sveltejs/vite-plugin-svelte

Svelte 是**编译时框架**（呼应本节"编译时 vs 运行时"）：`.svelte` 在构建期被编译成**近乎 vanilla 的 JS + 精细 DOM 更新**，运行时几乎没有框架体积。插件负责：调用 `svelte` 编译器把组件转成模块、处理 store/动作、接 HMR（Svelte 有自己的热替换协议）、`svelte-check`/`svelte-preprocess` 处理 TS/SCSS 预处理。

```js
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [svelte()] };
```

---

## 六、编译时框架 vs 运行时框架（心智）

- **运行时（React/Vue 主体）**：框架 runtime 打进产物，浏览器里靠虚拟 DOM/reactive 系统做 diff/更新。灵活、生态大，代价是 runtime 体积与运行时开销。
- **编译时（Svelte/Solid）**：把组件在构建期编译成精确命令式 DOM 操作，产物小、无（或极小）框架 runtime。Solid 是"细粒度响应式 + 编译优化"，React-like API 但非 vdom。
- **对 Vite 的意义**：无论哪种，都靠 `transform` 把框架 DSL 变成 JS，靠 `handleHotUpdate`/运行时协议做 HMR。**选型看团队/生态，不是看构建工具**——Vite 对三者一视同仁。

---

## 七、多框架与共用

一个 Vite 项目通常只装一个 UI 框架插件，但可**共存**（如在 Vue 项目里嵌 React 组件、或 Astro 多框架岛）：`plugins: [react(), vue()]` 各管各的后缀（`.jsx/.tsx` vs `.vue`），互不干扰。TS 配置（`tsconfig.json` 的 `jsx`、`jsxImportSource`）要与所用框架匹配（React 用 `react-jsx`，Vue 通常不涉及 JSX）。

---

## 八、常见坑

- **忘了装框架插件**：`.vue`/`.jsx` 报"未知语法"或白屏——先查 `plugins` 是否含对应官方插件。
- **类型不报错但构建通过**：esbuild 不校验类型，误以为没类型问题——需 `tsc --noEmit`/`vue-tsc` 把关。
- **Fast Refresh 失效整页刷**：组件文件混导出了非组件（工具函数/常量），破坏 HMR 边界——把非组件导出移走，一个文件尽量只默认导出组件。
- **Babel vs SWC 行为差异**：某些 Babel 插件依赖的语法在 SWC 版缺失——切回 `@vitejs/plugin-react`。
- **JSX runtime 配置错**：React 17+ 用 automatic runtime，`tsconfig` 设 `"jsx": "react-jsx"`，别再手 import React。

---

## 九、自检清单

- [ ] 框架为什么需要专属 Vite 插件？核心用哪个钩子？
- [ ] Vue 的 `<script setup>` 宏是运行时还是编译时的？
- [ ] 类型检查为什么不能只靠 esbuild？该谁做？
- [ ] plugin-react 与 plugin-react-swc 的差异与取舍？
- [ ] 编译时框架（Svelte）和运行时框架在产物上有何不同？
- [ ] 为什么组件文件混导出会破坏 Fast Refresh？

---

## 🚀 部署预告

- **SSR 也靠框架插件**：Vue/React 的 SSR（渲染成 HTML 再 hydration）建立在框架插件 + Vite SSR 能力上（下一关 vite-ssr）；
- **构建即编译时优化**：框架插件的产物质量决定 tree-shaking/分包效果（呼应 L3 splitting）；
- **部署**：SPA 静态产物上 CDN/Nginx；SSR/预渲染另有服务端要求（vite-deploy）。

下一关 **vite-ssr**——用 Vite `createServer` + `transformIndexHtml` + Environment API 手写/理解服务端渲染。
