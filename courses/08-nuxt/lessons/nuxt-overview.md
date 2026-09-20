# Nuxt 定位：Vue 生态的全栈答案

这是"镜像课程"的第一关。如果你认真学完了 07-nextjs，本包 80% 的概念都能一一映射——我们会不断做 Next↔Nuxt 对照，学完你拥有的不是两个框架的记忆，而是一张"服务端优先框架"的通用设计图（呼应 next-architect 第 4 节留的那张对照表，今天开始亲手填满）。

## 1. 裸 Vite + Vue 走到生产，会撞上什么

用 vite-intro 起手的 SPA 做真项目，四堵墙迟早出现（和 next-overview 第 1 节"SPA 三座大山"同源）：

1. **SEO 与首屏**：爬虫与低端设备拿到的只有空壳 HTML——自己上手写 SSR 立刻掉进 vite-ssr 讲过的坑堆（manifest、注水数据流、双端构建、Nginx 双进程）；
2. **路由全家桶手工装配**：vue-router、pinia、SSR 安全的状态恢复……每样都要选型接线（呼应 vue-router-basics、vue-pinia-basics）；
3. **没有服务端**：接口得另起 Express 项目，跨域/会话/部署两套流水线（呼应 exp-deploy）；
4. **构建与运行时各管各的**：环境变量规则、产物形态、平台适配全靠自己攒经验。

Nuxt 的答案与 Next 如出一辙：**把 Vue 生态的工业级拼装做成默认值**，外加一个自己的服务端引擎 Nitro——这点比 Next 走得更远（第 4 节）。

## 2. Nuxt 3 是什么：三层结构

| 层 | 负责 | 对标 Next |
|----|------|-----------|
| 框架层 | 文件路由、自动导入、渲染模式、SEO 工具 | Next 的 app/ 约定 |
| Vue 集成层 | SSR 安全的数据获取、状态、组件约定 | RSC 边界（思路不同） |
| Nitro 服务端引擎 | server/ 目录、API、产物输出到 55+ 平台 | Next 的 Node/Edge server（无独立引擎） |

关键区分：Nuxt 的渲染模型仍是**同构 SSR**——一套 Vue 组件，服务端渲染成 HTML、客户端水合后接管；它没有 RSC 那种"组件分两种Runtime"的概念（这个差异会在 nuxt-architect 里彻底展开）。上手成本比 Next 平缓：没有 'use client'、没有缓存金字塔，心智负担小一个量级。

## 3. 十分钟跑起来

```bash
npm create nuxt@latest my-app   # 选 Vue+TS，对比 create-next-app
cd my-app && npm install && npm run dev
```

默认项目只有一个 `app/app.vue`（Nuxt 4 起目录收敛到 app/，旧教程里的根级 pages/ 现在挪进 app/pages/——**看 Nuxt 资料必须先核对它基于 app server 还是 pages server**，版本断层比 Next 的 pages→app 迁移更频繁）。`npm run build` 产出 `.output/`，`node .output/server/index.mjs` 直接跑——注意这个"产物即可运行服务"的形态，是 Nitro 的手笔（nuxt-deploy 详解）。

目录约定先混个脸熟（下一关 nuxt-directory 逐个拆）：

```
app/
  app.vue            # 根组件（对比 Next 的 layout.tsx）
  pages/             # 文件路由（Next 的 app/ 段）
  components/        # 自动注册组件
  composables/       # 自动导入的组合式函数
server/
  api/               # 内置后端接口（Next 没有的赠品）
public/              # 原样静态资源（同 Next/Vite）
nuxt.config.ts       # 总控台（同 next.config.js）
```

## 4. Nuxt 的独门武器：Nitro

Next 部署时你接受它的运行时；Nuxt 则把服务端引擎做成了独立产品：

- 一份代码，`preset` 一改就编译成 Node 服务 / Vercel / Cloudflare Workers / Netlify / Bun / Deno 等 55+ 目标产物（nuxt-deploy 关展开全部，对照 next-deploy 的"三选一"会很有感触）；
- `server/api/` 与前端同仓同构建——写全栈接口不用另开项目（呼应 exp-rest 的接口手艺在这里直接复用）；
- 内建缓存抽象 `defineCachedEventHandler`，把"三层缓存金字塔"压缩成一个函数调用（对照 next-fetch-cache 会轻松很多）。

## 5. 学习路线与自检清单

本包路线与 07 包刻意同构：约定（L1）→ 路由（L2）→ 渲染（L3）→ 数据与 Nitro（L4）→ 状态鉴权（L5）→ 模块体验（L6）→ 工程（L7）→ 部署架构（L8）。每关请顺手回答："这在 Next 里是怎么做的？"——对照是双倍巩固。

- [ ] 能说出裸 SPA 上生产的四堵墙，以及 Nuxt 各用哪层拆掉；
- [ ] 知道 Nuxt 没有 RSC，它是"同构 SSR + 自动导入"哲学；
- [ ] 能解释 Nitro 是什么、Next 有没有对等物；
- [ ] 分得清 app/、server/、public/ 与 .output/；
- [ ] 本地跑通了 dev → build → node .output/server 全流程。

## 6. 小结

Nuxt = Vue 全家桶的工业级预装 + 一个可移植的服务端引擎。对学过 Next 的你，它是一次"验证通用思想"的旅程：框架的姓氏不同，但"服务端优先、文件约定、构建产物即服务"这三件大事完全一致。

🚀 部署预告：下一关 nuxt-directory 把项目结构翻个底朝天——约定式目录背后的 .nuxt 生成物与 tsconfig 链路，是自动导入等一切魔法的地基。
