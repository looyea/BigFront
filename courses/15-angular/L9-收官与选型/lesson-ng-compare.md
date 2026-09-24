# ng-compare：用四框架合龙——Angular 在哪、其他三家在哪

> 目标：04/05/11/13/15 五包知识点逐一对照表：响应式（signals 各家采纳）、组件模型（装饰器 vs 宏 vs 编译 vs hooks）、依赖注入（Angular 独家框架级）、模板（控制流趋同现象）、全家桶 vs 拼装；企业选型、招聘市场、遗留栈（NgModule 存量）三轴给结论——四强收官判词（呼应 sig-map、solid-overview、svelte-overview、vue-reactivity-theory）

## 一、响应式：signals 全家采纳

| 框架 | 响应式原语 | 变更检测 | 何时引入 |
|------|-----------|---------|---------|
| Angular | signal/computed/effect | zoneless(v21+) signal 精确通知 | v16 实验/v17 稳定 |
| Vue | ref/computed/watchEffect | Proxy 追踪 + 编译器静态标记 | 原生 |
| Solid | createSignal/createMemo | 细粒度 signal（编译器跟踪） | 原生 |
| React | useState/useMemo | 虚拟 DOM diff + fiber | 原生(非 signal) |
| Svelte | let 自动 + $: / Svelte 5 runes | 编译时精确更新 | v5 runes |

趋势：**TC39 Signals 提案** 源自 Angular/Solid/RxJS 团队联合——Angular 是核心推动者。Vue/Solid 语义几乎一致——只有 React 坚持 VDOM 路线。

## 二、组件模型

| 维度 | Angular | Vue | React | Svelte/Solid |
|------|---------|-----|-------|-------------|
| 声明方式 | @Component class | SFC `<script setup>` | FC + hooks | `.svelte` / JSX function |
| 类型推断 | 强（TS 原生 + typed forms） | 中（Volar 增强） | 强 | 中 |
| 模板 | HTML 模板 + 指令 | HTML 模板（最接近标准） | JSX/TSX | HTML 模板(Svelte) / JSX(Solid) |
| 编译产物 | JS + 模板函数 | render function | 运行时 diff | 无 runtime(Vue)/极少(Svelte) |

Angular 独特：装饰器元数据 + DI 注入 + 模板编译——三者绑定最紧。React FC 最自由（无约定）但也因此需要外部约束。

## 三、依赖注入：Angular 独家框架级能力

只有 Angular 内置了**层级 DI 容器**——其他三家需要第三方方案：
- React → Context（不是真正 DI，是 prop 穿透）+ 第三方 (InversifyJS)
- Vue → provide/inject（浅层级、无自动单例管理）
- Svelte → context（类似 React）
- Solid → Context（类似）

Angular 的 DI 是**架构约束工具**：providedIn 决定作用域、InjectionToken 解耦接口与实现、组件级 provider 实现可替换——在 20+ 人团队是核心协作机制。

## 四、模板控制流趋同

各框架 v2024-2026 不约而同采用了相似语法：

| 功能 | Angular | Vue | Svelte | React |
|------|---------|-----|--------|-------|
| 条件 | `@if (x) { }` | `v-if` | `{#if x}` | `{x && <div>}` |
| 循环 | `@for (x of list; track x.id)` | `v-for` | `{#each list}` | `list.map()` |
| 分支 | `@switch` | `v-if/else-if` | `{#if}/{:else}` | 三元/switch |
| 局部变量 | `@let y = x + 1` | — | `@let` (v5) | `const y = x+1` |

趋势：Angular 的 @if/@for 直接对标 Vue v-if/Svelte {#if}——都走「模板原生指令」路线而非 JSX 表达式。React 是唯一不采纳者（JSX 即控制流）。

## 五、全家桶 vs 拼装

| 能力 | Angular | Vue | React | Svelte/Solid |
|------|---------|-----|-------|-------------|
| 路由 | 内置 | Vue Router（官方） | React Router（第三方） | SvelteKit（内置）/ Solid 需装 |
| 表单 | Reactive Forms | VeeValidate/内置 v-model | 完全第三方 | 自己写 |
| HTTP | HttpClient | 需装 axios | fetch/axios/SWR | 自己写/fetch |
| 状态 | DI+signal 足够 | Pinia | Redux/Zustand/Context | stores/runo |
| SSR | @angular/ssr | Nuxt | Next.js | SvelteKit/Start |
| 测试 | Vitest（官方）| Vitest | Jest/Vitest | Vitest |
| 构建 | @angular/build | Vite | Vite/CRA/Webpack | Vite |

Angular 全家桶 = 开箱即用但更重基础包。React 拼装 = 最轻起步但需持续选型。

## 六、企业选型三轴

**1. 团队规模**
- 20+ 人 → Angular（强约定 + DI + NgRx + lint 边界让新人不犯错）
- 5-15 人 → Vue（渐进、学习曲线平缓）
- 全栈/SSR → Next.js（React 生态最成熟全栈方案）
- 极简/嵌入式 → Svelte/Solid（最小 runtime）

**2. 项目生命周期**
- 10 年长期维护 → Angular（官方 LTS + ng update 逐级迁移 + 向后兼容承诺）
- 快速 MVP → React/Vue（库组合灵活起步快）
- 内容站 → SvelteKit/Nuxt（SSR + 性能天然好）

**3. 遗留栈**
- NgModule 存量 → Angular 17→22 迁移路径清晰（自动脚本 + 渐进 standalone）
- class component → React hooks 迁移（无自动脚本、靠人）
- Options API → Vue 3 Composition（有迁移辅助工具）

## 七、招聘市场与生态锁定（2026）

- **Angular 开发者**：数量最少但薪资天花板高——企业级项目为主
- **React 开发者**：供给最大、竞争最烈——全行业通用
- **Vue 开发者**：中国/东南亚市场主力
- **Svelte/Solid 开发者**：极少、前沿项目

Angular 锁定效应：Material/CDK/DI/NgRx/Nx 一整套→项目越深越难切走。React 无锁定但也没粘性。

## 八、四强收官判词

> **Angular**：「全家桶 + 强约定 + 企业级长期维护」——不是最潮但最稳。v22 的信号栈 + zoneless + Signal Forms 补齐了现代化最后两块。
>
> **React**：「自由组合 + 最大生态 + 全栈（Next.js）」——选择无限但责任自担。
>
> **Vue**：「渐进 + 友好 + 全栈（Nuxt）」——从简到繁的平滑曲线，中文首选。
>
> **Svelte/Solid**：「编译/细粒度 + 最小 runtime + 极致性能」——理念最前瞻，生态在追赶。

四家都在往 signal 靠拢——差异不在响应式模型，而在**框架哲学**：约定 vs 自由、编译 vs 运行时、全家桶 vs 拼装。
