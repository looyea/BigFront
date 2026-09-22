# + 文件族契约：page / layout / server / error 全家福

> 目标：把"一个 URL = 一组正交文件"的契约背成肌肉记忆——七种 + 文件各自的职责与组合规则、嵌套布局的 `{@render children()}` 出口与 data 合并遮蔽、`ssr/csr/prerender` 路由级开关，以及一个请求从 URL 到像素的全流程走查（为 L9 internals 埋好骨架）。（呼应 kit-project-structure、svelte-ssr-hydration、nuxt-routing。）

---

## 一、职责矩阵：七口文件各管什么

以 `src/routes/blog/[slug]/` 为例，一族路由的可配文件：

| 文件 | 职责 | 跑在哪 | 关键契约 |
|---|---|---|---|
| `+page.svelte` | 渲染 | SSR 服务端 + 客户端 | 收 `data` prop（load 返回值）与 `form` prop（表单返回） |
| `+page.ts` | 数据（两栖） | 服务端一次 + 客户端每次进入 | 导出 `load`；也可导出 `ssr/csr/prerender/trailingSlash` 开关 |
| `+page.server.ts` | 数据+表单 action（纯服务端） | **只有服务端** | 同导出 load，但环境是 Node；页面开关 `prerender/ssr/csr/trailingSlash` 同样可在此声明（当前版文档口径；旧版 Kit 曾限定 ssr/csr 只能在 universal 模块，老项目升级报错先查这条版本差异） |
| `+layout.svelte` | 嵌套外壳 | 两栖 | `{@render children()}` 是子路由出口，漏了子页面集体消失 |
| `+layout.ts / .server.ts` | 共享数据（如用户/导航） | 同上分工 | 只在**路由段变化跨出本层时**才重跑（见第四节） |
| `+error.svelte` | 错误页 | 两栖 | 读 `$page.error` 与 `$page.status`；就近落点规则 L4 展开 |
| `+server.ts` | API 端点 | 只有服务端 | 按 HTTP 方法导出 `GET/POST/...`，Request 进 Response 出，不碰组件 |

组合规则两条：**同目录 `+page.ts` 与 `+page.server.ts` 可以共存**——官方接力链：server load **先跑**，返回值作为 `event.data` 交给同目录 universal load 做最后一道加工（环境敏感数据进、可序列化结果出），L3 正片全量展开；**+page 与 +server 可同目录**——GET 给页面、其他方法落 +server.ts 是合法分工，但同目录有 `+layout.svelte` 时 +server 的响应**不会**被布局包裹（它是裸 HTTP，这题 L6/L7 还会撞见）。

## 二、嵌套布局：children 出口与 data 的"就近遮蔽"

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  let { data, children } = $props();
</script>
<nav>首页 · {data.user.name}</nav>
{@render children()}
<footer/>
```

- 布局层级**镜像目录层级**：根 layout → `(app)` group layout → `blog` layout → `blog/[slug]` page，层层包裹；
- 根布局**不可跳过全局生效**——想要"登录页不带壳"，出路是 (group) 分组或 `+layout@`/`+page@` 重排层级（L2 的 matcher 关一并收组）；
- 数据合并规则：子级 load 返回的对象**逐 key 遮蔽**父级（同名 key 子赢，其余保留），所以 `data.user` 在深层页面照样可用——shadowing 是 key 级的，不是整包替换。

## 三、路由级渲染开关：三常量一矩阵

`+page/+layout` 的 .ts/.server.ts 里 `export const` 三件套：

| 组合 | 效果 | 典型场景 |
|---|---|---|
| `ssr = false` | 只出空壳 HTML，全客户端渲染 | 纯内网仪表盘、地图类重交互页 |
| `csr = false` | 服务端定死，无水合无交互升级 | 法律条文静态页（表单都交 action 处理） |
| `prerender = true` | 构建期烘成静态文件 | 营销页、文档站（= SSG） |
| `trailingSlash = 'ignore'` | URL 尾斜杠策略 | SEO 统一口径 |

开关有**继承**：layout 上设了，子路由默认跟。`prerender` 与 server load 里的 `event.fetch` 有硬冲突（fetch 外部 API 的页面没法构建期烘死）——冲突表 L6 对账。

## 四、一个请求的完整旅程（骨架版，L9 上解剖刀）

访问 `/blog/svelte-guide`（首次进站，SPA 导航版差异在末段）：

1. **hooks.handle** 收 Request（L5 的主场，此刻先当黑盒）；
2. **manifest 匹配**：URL 过一遍排序后的路由表（L2 的优先级规则），定下要跑的布局链 + page；
3. **load 接力**：链上所有 `.server.ts` load **先跑**（服务端、可碰密钥）→ 产出喂给同层与下层 `.ts` universal load → **两栖 load 在 SSR 里再跑一遍**（此时它拿得到 server load 的数据）；
4. **渲染**：布局树套页面 → 11 包那台 `render()` 出 body/head，水合数据序列化进 HTML（"注入即公开"纪律在这里生效）；
5. **水合**：客户端 `hydrate` 认领，交互上线；
6. **站内导航时**：不刷整页——只算**变化深度的最小 load 集**：目标路由与当前路由的公共祖先布局**不重跑**（`/blog/a → /blog/b`，blog 层 layout load 跳过，只有 `[slug]` 层的跑）。这条"增量 load"是 Kit 导航丝滑的本钱，也是新手"为什么我的 layout load 没执行"的全部答案。

## 五、自检清单

- [ ] 七口文件职责矩阵默写；同目录 `+page.ts` 与 `+page.server.ts` 共存时的接力方向与数据交接位（event.data）一句话说清。
- [ ] data 合并是 key 级遮蔽不是整包替换——举一例说明。
- [ ] 三开关矩阵四行各配一个场景；prerender 与 fetch 的冲突点在哪。
- [ ] 请求旅程六步复述，重点第 6 步：站内导航哪些 load 会重跑。
- [ ] `+error.svelte` 读什么数据？（先写直觉，L4 对答案。）

---

🚀 **下一关**：`kit-dynamic-routes`——目录名即路由语法的全量展开：[param]/[...rest]/[[optional]]、匹配优先级的四条排序规则，以及自定义 404 的"兜底路由"手法。
