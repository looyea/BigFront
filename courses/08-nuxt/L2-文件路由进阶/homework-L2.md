# L2 作业：路由、动态段与布局

> 覆盖关卡：nuxt-routing / nuxt-dynamic / nuxt-layouts。五段式 20 题。

## 第一段：读代码找 Bug（10 题）

**题 1**
```vue
<!-- app/pages/post/[id].vue -->
<script setup>
const { id } = useRoute().params;
const { data } = await useFetch(`/api/posts/${id}`);
</script>
```
从 /post/1 跳到 /post/2 数据不变。两处问题，指出并给出两种修法。

**题 2**
```vue
<NuxtLink to="https://example.com/page">外部活动页</NuxtLink>
```
点击后跳到本站 /https://example.com/page。缺了什么？

**题 3**
```ts
definePageMeta({
  layout: user.isAdmin ? 'admin' : 'user', // user 来自 useAuth()
});
```
构建报错或行为异常。为什么？改写成正确形态。

**题 4**
```
app/pages/
  blog/[id].vue
  blog/[slug].vue
```
访问 /blog/hello 永远命中原页面且 params 名为 id。说明发生了什么，如何消除。

**题 5**
```vue
<!-- app/layouts/default.vue -->
<script setup>
const { data: menu } = await useFetch('/api/menu');
</script>
```
管理员登录后菜单在布局里永远旧值，刷新浏览器才新。两个原因（一个布局语义、一个缓存语义），各给对策。

**题 6**
```vue
<template>
  <NuxtLayout name="console">
    <NuxtLayout name="billing"><slot /></NuxtLayout>
  </NuxtLayout>
</template>
```
某页面 meta 已配 `layout: 'page-shell'`，结果渲染出三层壳且页面内容重复。NuxtLayout 的什么规则被违反了？

**题 7**
```ts
const page = route.query.page;
const items = await $fetch(`/api/list?page=${page}&q=${route.query.q}`);
```
安全审计两次打回。query 直接进 URL 模板的两个风险与修复。

**题 8**
```vue
<script setup>
definePageMeta({ transition: { name: 'fade', mode: 'out-in' } });
</script>
```
切换布局的页面偶发"整页卡住不出现"，控制台无报错。给出最可疑组合与验证思路。

**题 9**
```vue
<!-- app/pages/user/[id]/index.vue -->
<template>首页内容</template>
<!-- 同时存在 app/pages/user/[id].vue 内含 <NuxtPage /> -->
```
访问 /user/7 显示的是哪个？/user/7/edit 呢（存在 edit.vue）？说出规则。

**题 10**
```ts
await router.push('/admin'); // auth 中间件判定未登录 abort 了这次导航
```
之后一行业务代码执行时抛 unhandled rejection。修复写法并说明 router API 的 Promise 语义。

## 第二段：手写编程（5 题）

**题 11** 写一个商品路由族：/shop/[category]/[sku]，要求：validate 校验 category 属于白名单数组且 sku 匹配 `/^[A-Z]{2}\d{4}$/`；页面里响应式取数（切 sku 自动重取）；给出全部文件与关键代码。

**题 12** 用 query 驱动实现"图片列表 + 点击弹 Lightbox modal，关闭回到原滚动位置、URL 可分享"，只允许 NuxtLink/NuxtPage/useRoute/router，给出核心 30 行。

**题 13** 写 app/layouts/docs/index.vue 与 docs/api.vue 两个布局（后者套前者），页面 meta 里正确引用（写出布局名），并说明子目录命名拼接规则。

**题 14** 实现 `useBreadcrumb()` composable：从当前 route.matched 读取各层 definePageMeta 里的 `breadcrumb: { label, icon }` 生成数组，SSR 安全，布局中消费。

**题 15** 给"运行时按租户切换外壳"的最小方案：middleware 解析 host → 写入 useState('tenant') → 页面外层 <NuxtLayout :name="..."> 消费，写出三处代码。

## 第三段：场景题（1 题）

**题 16** 文档站需求：/docs/[platform]/[version]/[...slug]，平台三值、版本两值、slug 任意深；SEO 全放开；内容来自 Git 仓库（@nuxt/content 思路后续会讲，这里只设计路由与数据）。请给出：① 文件与目录方案；② validate 规则；③ 哪些组合值得预渲染（给判断依据）；④ 版本切换时 URL 保持当前页的实现思路。

## 第四段：简答（3 题）

**题 17** 一句话说清 NuxtLink 预取与 Next Link 预取分别预取了什么。

**题 18** navigateTo 与 router.push 的分工场景各两个。

**题 19** "布局同名切换不重建"的设计理由与副作用各是什么？给出两级治理方案。

## 第五段：挑战题 🏆（1 题）

**题 20** 🏆 设计"多后台"权限路由体系：/console（基础）、/console/billing（财务）、/console/admin（超管），要求：布局复用（console 为共同外壳）、按角色动态指派、越权直达 URL 时正确 403/redirect、路由 name 可读性优化、并写一份 10 条内的《pages 目录规范》给团队。下一关的渲染模式会给这套体系加上"哪些页可以静态壳"的维度——先想好你的接口。
