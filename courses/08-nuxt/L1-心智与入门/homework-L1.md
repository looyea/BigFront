# L1 作业：心智、结构与自动导入

> 覆盖关卡：nuxt-overview / nuxt-directory / nuxt-auto-imports。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```
my-app/pages/Home.vue        # 根级 pages/，package.json 里 nuxt 版本为 ^4.0
```
Nuxt 4 默认 app server 布局下这个页面路由不生效。为什么？两种修法？

**题 2**
```ts
// app/utils/fsx.ts
import { readFileSync } from 'node:fs';
export const readConf = () => readFileSync('./conf.json', 'utf8');
```
某页面用了 readConf()，浏览器端构建直接报错。指出目录放错了没有，正确位置。

**题 3**
```vue
<!-- app/components/Footer.vue -->
<!-- app/layouts/default.vue -->
<template><Footer /></template>
```
另一个包也有 Footer.vue，结果页面渲染出的不是这个。自动注册规则里发生了什么？

**题 4**
```ts
// server/api/me.get.ts
import { useUserStore } from '~/stores/user';   // pinia store
```
服务端 API 里想复用前端 store 拿用户，报错。为什么这条路不通？正确共享什么？

**题 5**
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: { apiSecret: 'sk_xxx' },
});
```
生产上想不改代码换掉 apiSecret，该怎么注入？变量名叫什么？

**题 6**
```ts
// app/composables/index.ts
export * from './useAuth';
export * from './useCart';   // 内部也有一个导出的 useAuth 从别的包来
```
页面里 useAuth() 行为诡异。自动导入的哪条铁律被踩了？如何自查？

**题 7**
```json
// tsconfig.json
{ "extends": "./.nuxt/tsconfig.json" }
```
同事 clone 后 IDE 满屏 useFetch 标红。一条命令解决，写出来并解释原理。

**题 8**
```ts
// vitest.config.ts（项目裸配 Vitest）
// 测试文件里直接用了 useState()
```
测试报 `useState is not defined`，但 dev 里好好的。为什么？两种解法。

**题 9**
```
├── .env                # 含 NUXT_DATABASE_URL
├── .gitignore          # 空文件
```
这条仓库配置链上的安全隐患与正确做法。

**题 10**
```vue
<!-- app/pages/index.vue -->
<script setup>
const route = useRoute();
if (route.query.x) { /* 只在客户端想要的逻辑 */ }
</script>
```
SSR 时 query 拿不到、水合后拿到了，页面两态不一致。属于哪类陷阱？（本关只需指认，nuxt-hydration 会展开）

## 第二段：手写编程（5 题）

**题 11** 手绘（文字描述即可）Nuxt 4 标准项目树：app 三区（前端/服务端/共享）+ 两个生成目录 + 三个配置文件，每项一句话职责。

**题 12** 写一个 `useLocalStorage(key, initial)` composable（SSR 安全：服务端返回 initial、客户端挂载后读回），放入正确的自动导入目录，并在组件中零 import 使用。

**题 13** 为团队写一份 8 行的《自动导入使用规范》：允许隐式的范围、必须显式的场景、命名规则、CI 检查建议。

**题 14** 用一段脚本思路题：如何在 CI 里检测 composable 导出名冲突？（提示：扫描 app/composables 与依赖的 exports，比对符号集合，输出重复项非零退出）

**题 15** 把一个 Next 项目概念逐项映射到 Nuxt：app/page.tsx、layout.tsx、route handler、NEXT_PUBLIC_X、middleware.ts（表格作答）。

## 第三段：场景题（1 题）

**题 16** 你加入的团队从 Vue CLI 大 SPA 转向 Nuxt，老项目有 200+ 组件、自建 axios 封装、全局 eventBus。给出前三周的落地计划：脚手架、迁移顺序（先页面壳还是先组件）、自动导入引入节奏、哪些旧资产直接放弃。

## 第四段：简答（3 题）

**题 17** 说清 Nitro 与 Nuxt 的关系，并解释"产物即可运行服务"给部署带来的具体红利（两点以上）。

**题 18** app.config 与 runtimeConfig 的区别：时机、可见性、典型内容各一句话说清。

**题 19** 自动导入为什么不增加包体积？注入发生在哪个阶段、以什么粒度？

## 第五段：挑战题 🏆（1 题）

**题 20** 🏆 打开一个真实 Nuxt 4 项目的 `.nuxt/` 目录（自己 create 一个也行）：找出 imports.d.ts、components.d.ts、types/web/ 下的路由声明，回答三个问题——路由表在哪定义、自动导入符号的完整链路（声明→虚拟模块→产物 import）、删掉 .nuxt 后哪些功能立刻坏。写一页观察笔记。
