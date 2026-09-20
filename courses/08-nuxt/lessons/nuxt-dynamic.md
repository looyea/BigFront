# 动态路由与通配捕获：[id]、[...slug] 与可选参数

静态映射覆盖不了真实业务：文章详情页、电商分类树、文件浏览器——全靠参数段。Nuxt 的动态段语法直接继承 vue-router 的 path 语法，比 Next 的段模型少了"生成函数"那一半世界观（没有 generateStaticParams 对等物，静态化职责被 route rules 接管，学到那里会会心一笑，呼应 next-dynamic、nuxt-render-modes）。

## 1. 三种参数段

| 文件 | 路由 | route.params |
|------|------|--------------|
| `blog/[id].vue` | /blog/:id | `{ id: '42' }`（永远 string） |
| `files/[...path].vue` | /files/* | `{ path: ['a','b'] }`（数组） |
| `docs/[...slug].vue` + `pages/docs/index.vue` 或 `[slug].[[level]].vue` | 可选段 | 缺省时键为 undefined |

三条铁律：

1. **params 都是字符串或字符串数组**——`Number(route.params.id)` 显式转换 + NaN 防御 + validate 兜形状（上一关的钩子在这里高频复用）；
2. 同级 `[id]` 与 `[...catchAll]` 可以共存（静态段 > 动态段 > 通配的匹配优先级，vue-router 规则），但 `[a]` 与 `[b]` 两个不同名动态段同位置会互相遮蔽——永远只留一个；
3. 通配段内部再分动态（`/[...parts]/[id]`）不支持，参数段只能出现在路径片段级别。

## 2. 嵌套的动态页：children 与 NuxtPage 递归

App Router 用 layout.tsx 自动嵌套（呼应 next-routing 第 3 节），Nuxt 用**目录 + 显式出口**：

```
app/pages/user/[id]/
  index.vue          # /user/:id（若存在父文件 user/[id].vue，它渲染进父出口）
  posts.vue          # /user/:id/posts
```

要么全平铺（每层都是完整页面，简单场景够用），要么建父文件 `user/[id].vue` 内含：

```vue
<template>
  <header>用户 {{ $route.params.id }}</header>
  <NuxtPage />   <!-- 子路由出口：对应 posts.vue 渲染进来 -->
</template>
```

子页默认 name 为 `id-posts`（路径连字符化）。经验值：**三层以上嵌套或子页共享重数据才上 children 结构**，否则平铺 + layouts 的组合维护成本低得多——Next 强制段嵌套，Nuxt 把选择权给你，这是两种路由哲学的正面碰撞。

## 3. definePageMeta 的 key 与页面复用

同名路由参数变化（/blog/1 → /blog/2）时 Nuxt 默认**复用组件实例**（不重新挂载）：setup 不重跑、useFetch 不重发！这是本页头号大坑。三种对策：

```ts
// ① 让参数变化产生新 key（推荐：强制整页重建）
definePageMeta({ key: route => route.fullPath });

// ② watch params 手动刷新数据
const { data, refresh } = await useFetch(`/api/posts/${id}`);
watch(() => route.params.id, () => refresh());

// ③ useFetch 的 URL 写成响应式源，自动重取（下一关细讲）
const { data } = await useFetch(() => `/api/posts/${route.params.id}`);
```

对照 Next：App Router 每个 segment 默认按 key 重建的倾向相反——两个框架"参数变了要不要重挂载"给出相反默认值，迁移时必须重拧这颗螺丝。

## 4. Nuxt 没有并行/拦截路由，那 modal 怎么做？

Next 的 @slot/(.)拦截是段模型特供（呼应 next-dynamic 第 3、4 节），Nuxt 无对等物，modal 的两种替代：

1. **query 驱动**：`?photo=3` 控制 `<PhotoModal>` 显隐——可分享、可后退（query 变化 router.replace），实现 20 行，适合预览类；
2. **独立页面 + 布局伪装**：详情页在模态路径下用不同 layout 渲染外壳（layouts 支持动态 name），复杂交互选它。

别硬造并行路由的轮子——那是 Next 的语法树红利，不是通用模式。

## 5. 自检清单

- [ ] 三种参数段的 params 类型（string / string[] / undefined）说得清；
- [ ] /a/1 → /a/2 页面不刷新的原因与 key 方案能默写；
- [ ] validate 与 Number 转换的组合是动态页标配；
- [ ] 嵌套路由的 NuxtPage 出口知道放哪、何时干脆平铺；
- [ ] modal 两方案能按场景选。

## 6. 小结

动态路由在 Nuxt 里=vue-router 语法的直接暴露：简单、正交、坑点集中在"参数变化时的实例复用"。没有 generateStaticParams 不是缺陷，是分工——把"哪些动态页要预渲染"交给了 route rules（L3 主角）。下一关 layouts：Nuxt 用独立目录解决 Next 用嵌套 layout 文件解决的问题。

🚀 部署预告：下一关 nuxt-layouts 讲命名布局、动态布局与 NuxtLayout 局部包裹——并对比 Next 布局栈的取舍：哪种心智更适合大团队？
