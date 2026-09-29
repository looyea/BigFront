# vue-hello-world 面试题精选

> 共 10 题，覆盖 工程与构建 / 项目结构 / SFC / 起步心智 四类。这些是"入门看似简单、面试常挖地基"的点。

---

## 一、工程与构建

### 1. 为什么现代 Vue 项目需要一个"脚手架 / 构建工具"？直接用 `<script src="vue.js">` 不行吗？

CDN 引入适合学习和小 demo，但真实项目要：**单文件组件 `.vue` 需编译**（模板要变渲染函数）、**模块打包与 tree-shaking**、**开发体验（HMR、TS、别名、代理）**、**生产优化（代码分割、压缩、hash 缓存）**。脚手架（create-vue / Vite）把这些默认配好，让你从空目录进入可开发状态。Vite 靠 `@vitejs/plugin-vue` 编译 SFC，开发用原生 ESM 按需编译、构建用 Rollup 打包。

**来源**：Vue.js — "Tooling / Vite"；Vite — "Why Vite"

### 2. `npm run dev` 和 `npm run build` 的本质区别？

`dev` 启动 Vite **开发服务器**：源码即时编译、HMR、不走完整打包，追求反馈速度；`build` 产出**静态资源**到 `dist/`（压缩、hash、代码分割），供部署。开发期靠 Vite 的 esbuild 预构建依赖 + 浏览器原生 ESM；生产是打包后的固定文件（呼应 10-vite、vue-deploy）。

**来源**：Vite — "Dev vs Build"

---

## 二、项目结构

### 3. 讲清一个 Vue 应用从"打开浏览器"到"看到页面"的启动链路。

浏览器加载 `index.html` → 其中 `<script type="module" src="/src/main.js">` → `main.js` 里 `createApp(App)` 用根组件创建应用实例 → `.mount('#app')` 找到 `index.html` 里 `id="app"` 的 div → Vue 渲染 App 组件的模板，递归渲染其子组件 → 生成真实 DOM 插入挂载点。之后数据变化由响应式系统驱动局部重渲染。

**来源**：Vue.js — "Application Instance / mount()"

### 4. `public/`、`src/assets/`、`index.html` 分别是什么角色？

- `index.html`：**Vite 的入口 HTML**（不是 Vue 项目传统意义上的静态页），含挂载点与主 script；
- `public/`：**原样拷贝**到产物根，文件名不变，用绝对路径 `/xxx` 引用，适合 favicon、robots；
- `src/assets/`：**参与构建**，可被 import、加 hash、小图内联、走别名，适合组件用到的图/样式。

判据：需要构建处理（hash 缓存、被 JS 引用）→ assets；要固定文件名直链 → public。

**来源**：Vite — "Public Directory / Static Asset Handling"

### 5. `vite.config.js` 是干什么的？起步阶段需要动它吗？

配置 Vite：注册插件（`@vitejs/plugin-vue`）、路径别名（如 `@ → src`）、开发服务器代理（`server.proxy` 解决跨域）、构建选项（`base`、分包）。起步阶段用默认即可，属🟡"用到再改"（如配 `@` 别名、后端代理时才碰）。

**来源**：Vite — "Configuration"

---

## 三、单文件组件 SFC

### 6. 什么是 SFC？`template/script/style` 三段的职责与编译关系？

SFC（Single File Component）把一个组件的**视图（template）、逻辑（script）、样式（style）收进一个 `.vue` 文件**。编译时：script 变组件逻辑、template 编译成渲染函数、style 处理作用域后注入。三段顺序不限，但一个文件通常一个 `<template>`、一个（或多个）`<script>`/`<style>`（`<script setup>` 与普 `<script>` 可共存但受约束）。

**来源**：Vue.js — "Single File Components"

### 7. `<style scoped>` 如何实现"只作用于当前组件"？有什么局限？

编译期给本组件每个元素加唯一 `data-v-xxxx` 属性，CSS 选择器被改写成带该属性，从而隔离。局限：**不影响子组件内部的元素**（穿透需 `:deep()`）、动态根类靠 fallthrough。深选择器写法属 L7 vue-sfc-compiler-macros（呼应 scoped CSS 与 :deep()）。

**来源**：Vue.js — "SFC Style Scoping / :deep()"

### 8. HMR 和 Vue 的"响应式"是一回事吗？

不是。HMR（热模块替换）是**构建工具**能力：开发时改文件、Vite 只替换变化的模块、尽量保留应用状态。响应式是**运行时**能力：数据变了 Vue 自动更新视图。二者都会让"界面变了"，但一个发生在开发期编译层、一个发生在运行期。

**来源**：Vite — "HMR"；Vue.js — "Reactivity Fundamentals"

---

## 四、起步心智与选型

### 9. Vue Router / Pinia 是 Vue 的一部分吗？为什么官方脚手架会让你"选择是否添加"？

不是本体，是**官方维护的周边库**：Router 管路由、Pinia 管全局状态。它们按需引入（`createRouter` / `defineStore` 后 `app.use(...)`）。脚手架做成可选项，是因为"渐进式框架"哲学——**小项目不需要路由/全局状态也能跑**，用到再加（呼应 L5 路由、L6 Pinia）。

**来源**：Vue.js — "Progressive Framework"；Vue Router / Pinia 文档

### 10. 作为新手，一个 Vue 项目里"最该先吃透"的是什么？为什么？

先吃透 🔴 三件事：**SFC 三段式**（能读懂一个组件）、**`<script setup>` + ref/computed**（能写状态与派生）、**组件组合 props/emits**（能把 UI 拆并复用）。因为日常 90% 时间在做这三件事；vite 配置、SSR、性能优化是 🟡/🟢，过早陷入会拖慢正反馈（呼应 vue-hello-world 第六节分层）。

**来源**：Vue.js — "Composition API / Component Basics"；社区学习路径共识
