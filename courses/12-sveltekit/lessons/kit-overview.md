# SvelteKit 是什么：从引桥到主桥

> 目标：把 11-svelte L8 引桥关画的地图翻成实测里程——路由/数据/SSR/部署四大件 Kit 各拿什么兑现；文件系统路由三流派（Next App Router / Nuxt pages / Kit +文件族）的哲学差异；以及"什么时候该上 Kit"的判据终版。（呼应 svelte-sveltekit-bridge、svelte-ssr-hydration、next-overview、nuxt-overview。）

---

## 一、还账：引桥关的缺口清单，逐条对账

11-svelte L8 里手搓路由那一关，我们列过纯 Svelte 的四本缺口账。Kit 的兑现方式：

| 缺口（手搓版之痛） | Kit 的 + 文件 | 一句话机制 |
|---|---|---|
| URL → 组件映射表要人肉维护 | 目录即路由 | `src/routes/about/+page.svelte` ⇔ `/about`，构建期生成 manifest |
| 数据获取时机与缓存全靠自觉 | `+page.ts / +page.server.ts` 的 `load` | 导航前自动调用、SSR/客户端同契约跑两遍 |
| HTML 骨架、head、水合数据管线自己拼 | 内置 SSR + `render()` 编排 | 发动机还是 11 包那台，整车线束它接好了 |
| 部署形态（静态/Node/边缘）每次重造 | adapters | 一份产物三种落地，切换是改一行配置 |

当年你在 `main.js` 里手写的 `$effect + popstate + 清理函数` 三件套——Kit 里连这个都不存在：路由是编译器与运行时的**协商协议**，不是你的胶水代码。

## 二、三流派对照：文件系统路由的三种世界观

同为"目录=URL"，三家的文件语义差别不小：

| 维度 | Next.js (App Router) | Nuxt 3 | SvelteKit |
|---|---|---|---|
| 页面文件 | `page.tsx`（约定名） | `pages/foo.vue`（路径即路由） | `+page.svelte`（**+ 前缀族文件**） |
| 数据层 | Server Components 内联 fetch | `useFetch/useAsyncData` 组合式 | 独立的 `load` 函数，与组件物理分离 |
| 布局嵌套 | `layout.tsx` 自动包含 | 约定 + `<NuxtLayout>` 显式 | `+layout.svelte` 自动包含，`{@render children()}` 出口 |
| API 端点 | Route Handlers `route.ts` | `server/api/*` | `+server.ts`（HTTP 方法导出） |
| 边界声明方式 | `'use client'` 指令标记 | `server/` 目录 | **文件名后缀**（`.server.ts` 物理隔离） |

注意最后一行：Kit 和 Nuxt 站同一边——**服务端代码的私有性由文件名保证，编译期物理裁剪**；Next 靠指令+打包器魔法。这个差异决定了"会不会不小心把密钥打进 bundle"的事故概率（L3 展开）。

而 `+` 前缀族的深层哲学：**一个 URL 对应一组正交职责的文件**——渲染（+page.svelte）、数据（+page.ts）、接口（+server.ts）、异常（+error.svelte）各一个文件，谁都不许长在谁身上。Next 的 RSC 是"一个文件里两种世界观"的路线，Kit 反着来：文件边界=职责边界。

## 三、Kit 不是什么（三个反直觉点）

1. **不是 Svelte 的必需品**：11 包手搓 SSR 那一课证明纯 Svelte 能活——Kit 买的是"编排的五年工程化"（流式、预取、代码分割、渐进增强），不是渲染能力本身；
2. **不是只能全栈**：`adapter-static` 下它就是个带路由的 Svelte SPA/SSG 工厂——但只为路由上 Kit，是 L8 引桥判据里"付整车钱买自行车"的反例；
3. **SSR 默认开着但可以逐路由关**：`export const ssr = false` / `prerender = true` 是**每个 + 文件里的一个导出常量**——渲染策略是路由级声明，不是全局开关（对照 Next 的静态/动态页二分、Nuxt 的 routeRules）。

## 四、何时上 Kit：判据终版

- ✅ 新建全栈应用（页面+接口+鉴权同源部署）、SEO 敏感的面向公众站点、需要渐进增强的表单密集应用；
- ✅ 团队已经吃下 11-svelte（runes/SSR 概念零翻译成本——本包 60% 的"新"其实只是"Kit 替你把旧事编排了"）；
- ❌ 纯内部小工具、无路由单页挂件——Vite + Svelte 足够（11 包 svelte-deploy 的路线）；
- ❌ 存量 Next/Nuxt 项目单纯眼红开发体验——迁移成本按包级预算，不按组件级。

对照 07/08 毕业项目：三包里任何一个的终战项目，都可以在本包 L9 用 Kit 重写一遍——那才是"全栈框架三流派"真正内化的时刻。

## 五、本包航线预告

九阶段地图（比 11 包多一阶段，按内容面定的）：L1 地基 → L2 路由进阶 → L3 load 数据协议 → L4 表单与错误 → L5 hooks 与安全 → L6 适配部署 → L7 进阶专题（API/i18n/导航状态）→ L8 类型测试排障 → L9 内核解剖与终战。小测/作业/面试题题量上不封顶（本包按质量需要放开出）。

## 六、自检清单

- [ ] 引桥关四本缺口账，各说出 Kit 的兑现文件与机制一句话。
- [ ] 三家文件路由对照表：说出"边界声明方式"一行的事故学意义。
- [ ] "+ 文件族=职责正交"与 Next"单文件多世界观"的路线差异一句话。
- [ ] Kit 不是必需品的三个反直觉点各举一例。
- [ ] 给出"上 Kit / 不上 Kit"判据各两条，并说明与 11 包 L8 判据的继承关系。

---

🚀 **下一关**：`kit-project-structure`——发车前检查整机舱：sv create 的决策项、routes 两种布局、$lib 边界纪律、三命令各验什么、$env 为什么能防密钥出境。
