# layouts：Nuxt 的布局是独立目录，不是嵌套文件

Next 用"每个段一个 layout.tsx"表达布局嵌套（呼应 next-routing 第 3 节），Nuxt 走了另一条路：布局集中在 `app/layouts/` 目录，页面用名字认领。两种模型的对错之争留到 nuxt-architect，本关先把 Nuxt 这套用明白。

## 1. 基本盘：default 与命名布局

```
app/layouts/
  default.vue     # 未指定时全站套它
  admin.vue       # <NuxtLayout name="admin"> 或 definePageMeta({ layout: 'admin' })
  blank.vue       # 登录页等无壳场景
```

```vue
<!-- app/layouts/admin.vue -->
<template>
  <div class="admin-shell">
    <AdminSidebar />
    <main><slot /></main>   <!-- 页面内容注入点 -->
  </div>
</template>
```

规则：页面 + 布局合成 `<NuxtLayout>` 渲染；`layout: false` 单页脱壳；整个 app.vue 可以不要布局（自己写 <NuxtPage/>）——layouts 系统的入口开关在 app.vue 用不用 `<NuxtLayout>` 包裹。

## 2. definePageMeta 静态认领 vs NuxtLayout 动态包裹

上一关说过 definePageMeta 是编译期宏（呼应 nuxt-routing A2），布局要**运行时决定**时有两条路：

```vue
<script setup>
// ① meta 里静态指定
definePageMeta({ layout: 'admin' });
</script>

<template>
  <!-- ② 页面内动态包：按角色/数据切换外壳 -->
  <NuxtLayout :name="isAdmin ? 'admin' : 'user'">
    <PageContent />
  </NuxtLayout>
</template>
```

②的形态是"页面自包布局"——此时 app.vue 的全局 <NuxtLayout> 对它退化为透传（meta 里配 `layout: false` 防双套）。动态布局是 Nuxt 相对 Next 的显性优势：Next 要换布局得拆路由组或条件渲染 children（呼应 next-groups-matchers 第 2 节），Nuxt 一个 :name 搞定。

## 3. 布局的复用边界：它不随参数重建

layouts 的实例在"同名布局的页面之间切换"时**保持存活**（不重新挂载）——侧栏里的 `useFetch` 只发一次是特性也是坑：

- 特性：跨页共享数据（用户信息、菜单树）天然缓存，别在每个页面重复拉（对照 Next 的 layout 每段独立实例+缓存金字塔的分工）；
- 坑：A 页进 /admin/1、B 页进 /admin/2，布局里的"当前用户"数据不会因参数刷新——需要响应式的状态应该放 Pinia/useState，由页面驱动更新（nuxt-state 关展开）。

布局切换（admin → user）则是整壳换：旧布局卸载、新布局挂载，过渡期页面也重建——频繁切换外壳的交互（tab 换肤）别用布局做，用组件。

## 4. 嵌套布局的两代姿势

 layouts 目录本身是平铺的一层制，"布局套布局"的官方推荐是**在布局文件里再包 NuxtLayout**：

```vue
<!-- app/layouts/console/billing.vue（Nuxt 支持子目录，name 为 'console-billing'） -->
<template>
  <NuxtLayout name="console">      <!-- 外层壳 -->
    <div class="billing-pane"><slot /></div>
  </NuxtLayout>
</template>
```

命名规则注意：子目录会被拼进布局名（console/billing → 'console-billing'）。更干净的替代是回归组件组合：把"外壳"做成普通组件在页面/布局里自由嵌套——layouts 只留最粗的三五个皮肤。Next 的无限段嵌套是默认能力，Nuxt 是显式劳动——各自付出了什么、得到了什么，对照记忆。

## 5. 布局级数据与插件的正确姿势

- 布局要全站数据（菜单/未读数）：放在 **Nuxt 插件 + Pinia** 里初始化，布局消费 store——别在布局里 useFetch（它没有"只跑一次"保证的语义错觉）；
- 布局里挂 `<ClientOnly>` 的重部件（评论挂件）防 SSR 报错（nuxt-hydration 关的主题）；
- 布局间共享的状态若含服务端数据，注意水合传递（payload 机制，呼应 nuxt-state）。

## 6. 自检清单

- [ ] default/命名/layout:false/动态 :name 四种用法齐活；
- [ ] 知道布局实例"同名切换不重建"及其数据副作用；
- [ ] 子目录布局的命名拼接规则；
- [ ] 会判断"该用布局还是该用组件"（换皮肤 vs 换内容块）；
- [ ] 全站数据走插件+store 不走布局 useFetch。

## 7. 小结

layouts 是 Nuxt "约定优于配置"在视觉层的落点：一层命名皮肤、运行时可换、跨页存活。它与 Next 段布局是同一问题的两种答案——记住这道对照题，L3 我们转向更大的主题：同一个项目里，有的页面静态、有的页面实时，渲染模式怎么按路由分配。

🚀 部署预告：下一关 nuxt-render-modes 进入本包概念核心：ssr 开关、prerender 与 route rules——Nuxt 的"混合渲染"比 Next 的 ○●ƒ 更直白，也更接近"配置即策略"。
