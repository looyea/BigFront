# Nuxt L2 · server 目录与部署

> 🎯 目标：用 server/api 写接口，并理解 Nuxt 的构建与部署方式

## 一、Server Routes

`server/api/xxx.get.ts` 导出一个 `defineEventHandler`，即后端接口——全栈闭环。

```ts
// server/api/hello.get.ts
export default defineEventHandler(() => ({ msg: "hi" }))
```

## 二、渲染与部署

支持 SSR/SSG/混合；`nuxt build` 产物可跑在 Node 服务器，也能一键部署到 Vercel/Netlify 等平台。

> 本学院外壳若换成 Nuxt 也是完全可行的方案，选 Vue 全家桶时优先考虑它。
---

> 🚧 骨架关卡：在 `courses/08-nuxt/lessons/nuxt-server.md` 继续扩写，
> 小测放 `quizzes/nuxt-server.json`，作业放 `homework/L2.md`，平台自动读取。
