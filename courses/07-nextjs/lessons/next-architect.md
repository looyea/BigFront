# 架构师视角：Next.js 的边界、演进与终局地图

最后一关，把镜头拉远：不再问"Next 怎么用"，而是问"Next 的边界在哪、它要去哪、什么场景不该选它"。这是从使用者到架构师的分水岭（架构思维呼应 react-architecture、vue-project-architecture、node-deploy-perf）。

## 1. 范式回顾：Next 押注了什么

八关走下来，Next 的世界观可以压缩成三句话：

1. **服务端优先**——默认一切皆 RSC，交互是例外（'use client' 是申请例外许可证，呼应 next-server-client 第 1 节）；
2. **数据跟着 UI 走**——组件即数据消费者，取数在渲染路径上完成，API 层为站外而存在（呼应 next-fullstack-project 第 7 节）；
3. **缓存是一等公民**——从请求记忆化到 Full Route Cache 到 tag 失效，框架替你管理分布式数据新鲜度（呼应 next-fetch-cache/revalidate）。

这三件事合起来是对 SPA 时代"前端拉状态、浏览器算渲染"的整体反叛——计算回流服务端，浏览器退回"渐进增强"的本位。React 服务端化叙事（呼应 react-nextjs 第 3 节）在框架层的落地就是它。

## 2. 演进时间线：正在流动的地质层

Next 的 API 仍在高速演变，架构师要能区分"地基"与"潮流"：

| 主题 | 现状 | 方向 |
|------|------|------|
| 编译器 | Webpack 默认 + Turbopack 生产可用（dev 默认） | Turbopack 全量接管，构建提速一个量级（增量编译思想呼应 vite-build） |
| 渲染 | SSR/SSG/ISR 稳定 | PPR（Partial Prerendering）→ cacheComponents：静态壳秒出 + 动态洞流式补，动静分区自动化（呼应 next-revalidate 第 4 节） |
| 数据 | fetch 缓存 + revalidate | 社区质疑缓存魔法太隐式，方向是更显式的缓存原语（use cache 提案路线） |
| Actions | 稳定 | 与 Suspense/乐观 UI 的原生整合持续加深 |
| 运行时 | Node + Edge 双轨 | Edge 中间件语义收敛，可移植 runtime 接口演进 |

判断力练习：上一关里"响应与请求者无关才能进 Full Route Cache"是地基（缓存的安全语义，不会变）；"页面级 route config 旋钮写法"是潮流（API 形态一直在调）。面试与选型都要拿得住地基、跟得动潮流。

## 3. 边界：什么场景不该用 Next

架构师的荣誉是不为简历选型。Next 的甜点位：**内容 + 交互混合、需要 SEO、Team 以 React 为主栈**。反例场景：

- **纯 API 服务/后台任务**：没有前端渲染需求还引入框架层缓存与 RSC，纯属负资产——Express/Fastify 或继续 09 包的手艺（呼应 exp-deploy）；
- **重实时协作应用**（白板、IM 主体）：CRDT + WebSocket 的长连接世界与 RSC 请求-响应模型八字不合，SPA + 本地状态引擎更顺（Next 可以只当落地页壳）；
- **工具型离线应用**：设计器、编辑器桌面形态，Vite SPA + Tauri/Electron 的路径更干净（呼应 vite-intro）；
- **团队 Vue 栈**：同构诉求 Nuxt 对等解决，别为 Next 换全家桶（呼应 vue-ssr-nuxt）；
- **超简单营销页**：一个 HTML + CDN 就够，框架是杀鸡牛刀。

一句话版本：**Next 解决的是"React 应用的内容分发与全栈缝合"，问题不在范围内，答案就不必是 Next**。

## 4. Next vs Nuxt：一张对照表留给 08 包

| 维度 | Next.js | Nuxt |
|------|---------|------|
| 组件模型 | RSC（服务端组件为一等公民） | 暂无对标物（SSR 同构，组件都在服务端执行） |
| 数据获取 | fetch + 缓存层 / Action | useFetch/useAsyncData + Nitro |
| 服务端引擎 | 自带 Node/Edge 双运行时 | Nitro：统一 server engine，产物可投 55+ 平台 |
| 路由 | 文件路由 + 段旋钮 | 文件路由 + middleware/rule |
| 心智负担 | 缓存/边界规则多且活跃演变 | 相对平滑，无 RSC 认知断层 |

这表会在你学完 08-nuxt 后被自己重写一遍——留个钩子。

## 5. 终局地图：07 包全部知识的一页收纳

```
心智        SPA三座大山 → 四合一 → 文件路由约定        (L1)
路由        Link预取 · 动态段 · 并行/拦截 · 路由组      (L2)
边界        RSC默认 · 'use client'岛 · children穿透     (L3)
            流式SSR · Suspense · PPR                    (L3)
数据        fetch四写法 · 三层缓存 · 段旋钮 · SWR        (L4)
变更        Action序列化端点 · 表单四防御 · 失效半径树    (L5)
            middleware三层纵深                          (L5)
体验        样式边界 · metadata/OG · font/image          (L6)
工程        CWV三板斧 · error/notFound/digest · 测试金字塔(上)
部署        standalone/Vercel/export · Nginx头 · 蓝绿回滚(下)
            全栈串联 = 以上所有旋钮的组合正确值           (L8)
```

每一格背后都是一关的自检清单。检验架构师成色的问题永远是三个：**为什么选它、边界在哪、坏了怎么办**——你现在对每个都能答出半页纸，这就是 24 关的意义。

## 6. 下一步

Next 教给你的"服务端优先 + 显式缓存 + 文件约定"三件套，在 Vue 生态有一个平行宇宙入口：Nuxt 与它的 Nitro 引擎。带着这张终局地图过去，你会发现自己不是在学第三个框架，而是在验证一套思想的第二次落地。

🎓 全课收官：07-nextjs 到此全部通关。你已具备从空白目录到线上运行的 React 全栈交付能力——去把 NoteDeck 做成自己的真项目，那是最好的毕业设计。
