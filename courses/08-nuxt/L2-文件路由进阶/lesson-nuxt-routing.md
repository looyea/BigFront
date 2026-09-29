# pages 路由与 NuxtLink：Vue 系文件路由的手感

地基三关（结构、约定、自动导入）打完，正式进入路由。Nuxt 的文件路由与 Next 气质迥异：Next 是"目录即段、文件名即角色"（page/layout/route 一族，呼应 next-routing 第 2 节），Nuxt 是"pages/ 下一个 .vue 就是一条路由"，简单粗暴——底层还是你熟悉的 vue-router，Nuxt 只是把路由表生成交给了文件系统（呼应 vue-router-basics）。

## 1. 文件到路由的映射

```
app/pages/index.vue        →  /
app/pages/about.vue        →  /about
app/pages/users/index.vue  →  /users
app/pages/blog/[id].vue    →  /blog/:id（下一关主角）
```

规则就三条：路径=目录结构、index=段根、其余同名即同路由。没有 layout.tsx 嵌套约定——布局是独立系统（layouts/，第 nuxt-layouts 关）。根组件 app.vue 里放一个 `<NuxtPage />` 就是路由出口（等价 Next 根 layout 的 children，但只有一个出口是常态）。

页面级"配置"集中在 `definePageMeta`：

```vue
<script setup>
// 目的：页面级配置——definePageMeta 是编译宏，只能写静态值，运行时判断请放中间件
definePageMeta({
  middleware: 'auth',        // ✅ 进本路由前先跑 auth 中间件（nuxt-middleware-auth 详解）
  layout: 'admin',           // ✅ 套上 app/layouts/admin.vue 命名布局
  alias: ['/home'],          // ✅ /home 也能命中本页
  name: '首页',              // ✅ 覆盖按路径生成的路由名，供命名跳转
});
// ❌ 传运行时变量（如 layout: userStore.role）→ 宏只认静态值，报错或被忽略；要动态布局改用 <NuxtLayout :name>
</script>
```

它是编译宏（呼应 vue-sfc-compiler-macros），只能写静态值——运行时数据判断放中间件里。

## 2. NuxtLink：一个组件管内外链

```vue
<!-- 目的：一个 NuxtLink 同时管内部 SPA 导航与外部真链接 -->
<NuxtLink to="/about">关于</NuxtLink><!-- ✅ 内部路由，渲染 <a> 但走 SPA 不刷新，视口内自动预取 -->
<NuxtLink to="https://vuejs.org" external>Vue 官网</NuxtLink><!-- ✅ 外链必须带 external，走浏览器原生跳转 -->
<NuxtLink :to="{ name: 'blog-id', params: { id: 1 } }">命名跳转</NuxtLink><!-- ✅ 按路由名+参数跳转，等价 /blog/1 -->
<!-- ❌ 外链漏写 external → 把 https://vuejs.org 当内部 path 拼成 /https://vuejs.org，跳错页 -->
```

- 内部路由自动渲染 `<a>` 并接管为 SPA 导航（不刷新页面）；外链必须 `external`，否则会把绝对 URL 当内部 path 拼出错误路由；
- **自动预取**：视口内的链接预取目标页代码与数据（默认开启，可全局 `experimental.payloadExtraction` 微调或单个 `prefetch` prop）——对照 Next 的 Link 视口预取 RSC Payload（呼应 next-link-router 第 1 节）：Nuxt 预取的是"路由 chunk + prefetch 数据请求"，语义类似但无 Payload 序列化体系；
- 激活态：`router-link-active` / `router-link-exact-active` 两个类名直接可用作高亮（vue-router 血统的福利）。

## 3. 读参数与编程式导航

```vue
<script setup>
// 目的：读参数与编程式导航——vue-router 血统，新增的只有 SSR 安全的 navigateTo
const route = useRoute();       // ✅ 当前路由对象：params/query/hash 全响应式
const router = useRouter();     // ✅ 导航实例

router.push('/users');          // ✅ 编程式前进到 /users
router.replace({ query: { ...route.query, page: 2 } }); // ✅ 改 query 且不留历史记录
await router.push('/x').catch(() => {}); // ✅ 被中间件 abort 时 push 会 reject，必须 catch 否则未处理拒绝
navigateTo('/login', { redirectCode: 302 }); // ✅ SSR 期也生效、可设响应码的跳转
// ❌ const { query } = useRoute() 解构 → 丢掉响应式代理，URL 变了 query 不更新（要 route.query 整体取）
</script>
```

两个易错点：① `useRoute()` 在 SSR 期反映当前请求、水合后跟随客户端路由——**别对 route 对象解构**（会丢响应式），要 `route => route.query` 取值；② 服务端上下文的跳转用 `navigateTo`（它知道自己在不在服务器上），对照 Next 服务端 `redirect()` 的处境（呼应 next-link-router 第 3 节）。query 永远可空、params 由路由形状保证——URL 是不可靠输入这条纪律两框架通用（呼应 exp-validation）。

## 4. 路由钩子时机速览

一次导航上 Nuxt 挂了四层钩子（详细生命周期是 nuxt-lifecycle 关的主题）：

| 层 | 时机 | 典型用途 |
|----|------|----------|
| 全局/独占 middleware | 组件渲染前，可 abort/redirect | 鉴权、AB 分流 |
| `validate`（definePageMeta） | 匹配后、中间件前 | params 合法性（404 化非法 id） |
| 页面 setup | 服务端渲染期/客户端 | useFetch 取数 |
| `onBeforeRouteLeave` 等 vue-router 守卫 | 组件级 | 未保存提示 |

对照 Next 的 middleware → 段渲染顺序，Nuxt 多出的 `validate` 是个贴心小设计：`validate: route => /^\d+$/.test(route.params.id)` 不通过自动 404，省掉页面里手写 notFound（呼应 next-error-loading 第 3 节 notFound()）。

## 5. 自检清单

- [ ] 三种路径映射规则与 index 语义脱口而出；
- [ ] definePageMeta 能配 middleware/layout/alias/validate；
- [ ] 知道外链忘写 external 的报错长相；
- [ ] 预取的默认行为与关闭方式（性能关会回收这个旋钮，呼应 nuxt-perf）；
- [ ] router.push 的 reject 必须 catch、SSR 跳转用 navigateTo；
- [ ] useRoute 不解构、query 判空。

## 6. 小结

Nuxt 路由 = vue-router 的完整能力 + 文件生成路由表 + 自动预取。学过 04 包的你几乎没有新语法要背，新增的只有 definePageMeta 这一个宏和 NuxtLink 一个组件。下一关处理带参的路由：动态段、通配与可选参数。

🚀 部署预告：下一关 nuxt-dynamic 讲 `[id]` 家族与通配路由——并顺手揭开 Nuxt 版"并行/拦截路由"为什么不存在：两种路由哲学的根本分歧点。
