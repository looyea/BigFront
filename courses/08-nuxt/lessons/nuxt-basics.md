# Nuxt L1 · Nuxt3 的项目结构

> 🎯 目标：理解 Nuxt 的约定式路由、自动导入与渲染模式

## 一、和 Next 的镜像关系

若你已学 07-nextjs，可直接对照：`pages/` ≈ `app/`，`server/api` ≈ `route.ts`，都是"文件即路由 + SSR 全栈"。

## 二、目录约定

`pages/index.vue`→`/`，`pages/user/[id].vue`→动态段；`layouts/` 布局；`app.vue` 为入口。

## 三、自动导入

`composables/`、`utils/`、组件无需手动 import 即可使用；组合式函数如 `useFetch`、`useState`、`useRouter`。

```vue
<script setup>
const { data } = await useFetch('/api/hello')
</script>
```

> Nuxt 3 是当前主流大版本（且已有 Nuxt 4 演进），以 nuxt.com 文档为准。
---

> 🚧 骨架关卡：在 `courses/08-nuxt/lessons/nuxt-basics.md` 继续扩写，
> 小测放 `quizzes/nuxt-basics.json`，作业放 `homework/L1.md`，平台自动读取。
