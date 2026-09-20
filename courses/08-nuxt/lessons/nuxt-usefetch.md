# useFetch / useAsyncData / $fetch：三件套的分工表

Nuxt 数据获取的全部魔法都建立在一个朴素的 fetch 增强上，但组件里该用哪个 API，是新手第一课。三件套一句话定调：**useFetch=SSR 安全的声明式取数钩子，useAsyncData=它的万能底层，$fetch=命令式调用的工具函数**——对照 React 侧的 React Query 心智（呼应 react-data-fetching、vue-async-suspense），但 Nuxt 把它们做进了框架层。

## 1. 从一次点击看三者的世界

```vue
<script setup>
// ① useFetch：首屏 SSR 跑一次→数据进 payload→水合复用；SPA 导航再来一次
const { data, pending, error, refresh } = await useFetch('/api/articles', {
  pick: ['data', 'total'],              // payload 瘦身首选（呼应 nuxt-hydration C1）
  // watch: [page]                      // 默认已监听 route 参数变化
});

// ② useAsyncData：任意异步逻辑的 SSR 收集器（不 fetch 也行）
const { data: geo } = await useAsyncData('geo', async () => {
  const cfg = useRuntimeConfig();
  return serverSideOnlyLookup(cfg);      // 直接调函数/DB，不发 HTTP
});

// ③ $fetch：命令式，不参与 SSR/payload——事件里用
async function like(id) {
  await $fetch(`/api/articles/${id}/like`, { method: 'POST' });
  refresh();                              // 手动让 useFetch 重取
}
</script>
```

记忆锚点：**进 payload 的只有 ①②**（它们把结果登记进服务端收集器，nuxt-lifecycle 第 3 站的 payload 就来自这里）；③ 在浏览器控制台等价于增强版 fetch（ofetch：自动 JSON、 baseURL、重试拦截器），什么时候都可用但没有 SSR 语义。

## 2. key：三件套的灵魂参数

useAsyncData(url, handler) 的结果按 **key** 缓存进 Nuxt 应用的 payloads 注册表；useFetch 不给 key 时用 URL 自动生成。推论：

- **同 key 并发去重**：组件 A、B 同时 `useFetch('/api/user')` → 只发一次请求，共享结果（Next 请求记忆化的 Nuxt 版，呼应 next-fetch-cache 第 2 节）；
- **SPA 导航同 key 秒回**：访问过的数据从注册表直给，不发请求——要"每次新鲜"就得换 key 或 `getCachedData: () => undefined`（nuxt-hydration C2 的出口在此落地）；
- key 撞车事故：列表页与详情页都 `useFetch('/api/list')` 但参数不同却忘了把参数编进 key → 详情拿到列表缓存。纪律：**URL 带参或 key 显式带参**，`key: \`list-${page}\``。

## 3. 响应式三兄弟：URL / watch / lazy

```ts
// URL 可以是函数（响应式源自动重取）——动态路由页正解（呼应 nuxt-dynamic B2）
const { data } = await useFetch(() => `/api/posts/${route.params.id}`);

// watch 指定依赖源重取
const { data } = await useFetch('/api/search', { watch: [keyword] });

// lazy: true —— 不阻塞导航/渲染，页面先出、数据后补（客户端水合期语义不同，慎用 SSR 首屏）
const { data } = await useFetch('/api/heavy', { lazy: true });
```

`await useFetch` 会挂起渲染（Suspense 机制）——这是"SSR 烘数据"的代价与收益同源；不 await 则变"客户端取数+骨架先行"，对照 Next 的 Suspense 流式取舍（呼应 next-context-streaming 第 4 节骨架屏三标准）。

## 4. 错误与重试：数据通道的容错设计

```ts
const { data, error, status } = await useFetch('/api/maybe-fail', {
  server: true,
  retry: 2,                       // ofetch 内建：仅客户端层重试
  onRequestError({ error }) { report('req-fail', error); },
  onResponseError({ response }) { if (response.status === 401) navigateTo('/login'); },
  // 服务端 SSR 里 handler 抛错 → error 是 Ref<AppError>，页面渲染错误分支
});
```

三个要点：① SSR 期 useFetch 失败**不会**让整页 500（除非你 throw createError）——data undefined + error 有值，页面要处理"无数据态"；② 401/403 这类会话信号用 onResponseError 统一处置（鉴权关回收，呼应 nuxt-middleware-auth）；③ retry 只对客户端请求生效——SSR 请求失败重试是性能自杀，Nuxt 默认不重（这层设计值得点赞）。

## 5. 与 Next 数据模型的总对照

| 维度 | Nuxt | Next |
|------|------|------|
| 服务端取数 | useFetch/useAsyncData（组件内） | 直接 async 组件里 await（RSC） |
| 客户端取数 | $fetch + 手写或 VueUse useFetch | SWR/React Query |
| 去重 | key 注册表 | fetch 记忆化 |
| 跨请求缓存 | getCachedData/payload + Nitro 层 | Full Route Cache/unstable_cache |
| 失效 | refresh()/换 key | revalidatePath/Tag |

Nuxt 的模型**没有把缓存做成平台**（少掉 Next 那套金字塔认知税），代价是跨请求/CDN 层的策略要自己在 routeRules+Nitro 组合（呼应 nuxt-render-modes、next-fetch-cache 第 3 节）。

## 6. 自检清单

- [ ] 三件套分工与"谁进 payload"说得清；
- [ ] key 去重/秒回/撞车三种行为能解释；
- [ ] 动态页取数用响应式 URL 或 watch；
- [ ] SSR 失败不 500、页面要处理空数据态；
- [ ] lazy 与 await 的渲染阻塞差异知道怎么选。

## 7. 小结

useFetch 是"SSR 感知的取数声明"，$fetch 是"纯工具"，中间人 useAsyncData 管万物。三件套的心智比 Next 轻，但 key 与 payload 两个概念必须一次打通——它们决定了数据什么时候发、什么时候不发。下一关深入服务端：server/api 与 Nitro 的事件世界。

🚀 部署预告：下一关 nuxt-server-routes 打开 server/ 目录：event handler、H3 工具箱与 defineCachedEventHandler——Nuxt 全栈的后端半边天在这里，和 Next 的 Route Handler 正面PK。
