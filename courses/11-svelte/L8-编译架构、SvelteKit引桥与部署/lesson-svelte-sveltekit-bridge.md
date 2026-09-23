# 通往 SvelteKit：从组件到全栈

> 目标：说清"纯 Svelte"作为一个组件框架的能力边界——路由、SSR、服务端逻辑、表单端点都得自己造；SvelteKit 补上了什么、代价是什么；以及本包（11-svelte，组件与编译器的世界观）与 12-sveltekit 包（全栈工程）的分工地图（呼应 vue-ssr-nuxt、react-nextjs、07-nextjs、08-nuxt 的三框架同款叙事）。

---

## 一、先造一遍轮子，才知道轮子多贵

给一个纯 Svelte 应用加"两个页面"，你要亲手处理的事：

```svelte
<!-- App.svelte —— 手搓路由的冰山一角（注意：runes 只能出现在 .svelte/.svelte.ts 里） -->
<script>
  let page = $state(location.pathname);
  $effect(() => {
    const sync = () => (page = location.pathname);
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);   // L6 生命周期课的清理函数纪律
  });
</script>

{#if page === '/'}<Home />{:else if page === '/about'}<About />{/if}
```

这只是**能跑**。生产级路由还差：链接拦截（SPA 内跳转不整页刷）、动态段（`/user/:id`）、代码分割（路由级懒加载）、滚动恢复、预取、`<svelte:head>` 的标题管理、404……社区路由器（历史上有 svelte-spa-router 等）能领一部分，但**每条路都不是官方亲儿子**——Svelte 官方对"应用框架"的回答就是 SvelteKit。

同类问题再列三个，全是纯 Svelte 的边界：

| 需求 | 纯 Svelte 的现实 | SvelteKit 的答案 |
|---|---|---|
| SEO/首屏要服务端 HTML | 自己搭 Express + `render()` + 水合管线（L10 专关会带你手搓一遍最小版） | 内置 SSR + streaming，`+page.svelte` 天生双端执行 |
| 页面数据"在路由上"加载 | 组件里 fetch + 自己管 loading/error | `+page.ts`/`+page.server.ts` 统一 load 契约 |
| 表单提交带服务端逻辑 | 手写 POST + 重定向 + 错误回显全套 | form actions：`enhance` + 渐进增强免费拿到 |

## 二、SvelteKit 是什么：一句话与一张图

**SvelteKit 之于 Svelte，= Next.js 之于 React = Nuxt 之于 Vue**：官方应用框架，管路由/渲染模式/服务端边界/构建编排，组件语法本身还是那套 runes（呼应 07/08 包的对照表纪律）。

```
src/routes/
  +layout.svelte      # 布局（嵌套路由）
  +page.svelte        # 页面组件 —— 本包教的就是写它的能力
  +page.ts            # load：通用（客户端+服务端都跑）的数据加载
  +page.server.ts     # load：只在服务端跑，secret 不进 bundle
  +server.ts          # API 端点（fetch handler）
  +error.svelte       # 路由级错误边界
```

心法对照（各包反复出现的母题）：
- **文件即路由**：约定目录结构，Next App Router 同款思路；
- **服务端边界靠"文件名"表达**：`*.server.ts` 永远不进客户端 bundle——比 Next 的 `'use client'` 指令更物理（呼应 next-server-components 的边界讨论）；
- **渲染模式是每页的选择**：SSR/CSR/预渲染/adapter 部署形态，Kit 都备好出口。

## 三、Kit 为什么和 Svelte 特别亲

三件其他组合做不到或做别扭的事：

1. **编译器协作**：Kit 直接驱动 `@sveltejs/vite-plugin-svelte` 的编译管线（L7 工具链课接头理论的官方大客户），路由级代码分割、预加载 hint 都吃编译器红利；
2. **表单即一等公民**：HTML form + `enhance` action（L5 表单课的 action 机制原语）+ 服务端 form action——无 JS 也能提交，这是 Svelte 小团队哲学（少运行时、多标准）在全栈层的投影；
3. **adapter 部署谱系**：`adapter-static`（纯 SPA/SSG）→ `adapter-node`（常驻 Node）→ `adapter-vercel/netlify/cloudflare`（serverless/edge），同一份代码换部署形态——比"绑定某平台的框架"中立得多。

## 四、代价清单（面试反向题防线）

"为什么不无脑上 Kit？"——三个真实成本：
- **心智面翻倍**：要同时懂组件层（本包）与路由/load/服务端层（12 包），小部件项目用不上全栈能力；
- **版本联动**：svelte/kit/vite 三者有兼容矩阵，升级要成套（历史上 kit 路由目录大重构 `sv migrate routes` 就是这类税，呼应 svelte-tooling）；
- **部署自由度悖论**：adapter 灵活，但相比"一个静态桶托管纯 SPA"，SSR 形态引入了常驻算力与缓存策略的运维面（下一关部署课先在纯 Svelte 侧把这笔账算清）。

判据一句话：**要 SEO/服务端数据/表单端点 → Kit；纯内网交互件/嵌入式组件包 → 纯 Svelte 足够**（Web Components 路线在 L10，也是"不背全栈"的出口）。

## 五、本包与 12-sveltekit 的分工地图

| 层 | 归属 | 你已/将学到 |
|---|---|---|
| 语言与组件模型 | 11-svelte L1–L9 | runes、snippet、action、过渡、内核、边界 |
| 编译与渲染形态 | 11-svelte L8/L10 | 产物、SSR/水合原理、Web Components |
| 应用框架工程 | 12-sveltekit 全包 | 路由矩阵、load 契约、hooks、adapter 实操 |
| 构建工具 | 10-vite | Kit 脚下的 Vite 管线 |

本包末三关（L8–L10）就是这座桥的引桥：先懂原理（本课）、再会部署裸应用（下关）、最后能读 Kit 生成代码背后发生了什么（12 包）。

## 六、自检清单

- [ ] 能手搓纯 Svelte 路由雏形，并列出生产级还差的至少 5 件事。
- [ ] 说出 Kit 目录约定里 5 个 `+` 文件各自的职责与执行端。
- [ ] 讲清"服务端边界靠文件名"与 Next `'use client'` 指令式的差异。
- [ ] 给出"上 Kit / 不上 Kit"的判据与三条代价。
- [ ] 能画出 11-svelte → 12-sveltekit → 10-vite 的知识分工图。

---

🚀 **下一关（L8 收官）**：`svelte-deploy`——先把纯 Svelte 的裸 SPA 送上天：vite build 产物、base、history 回退、hash 缓存纪律，以及静态与 SSR 两种部署形态的账本（呼应 10-vite-deploy、vue-deploy、react-deploy 同款终关仪式）。
