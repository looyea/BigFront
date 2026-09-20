# 面试题 · Nuxt 3 基础与自动导入

1. **Nuxt 与 Vue SPA 的区别？**
   Nuxt = SSR/SSG/Hybrid + 文件系统路由 + Nitro 服务端 + 自动导入 + 数据获取组合式（useFetch/useAsyncData）+ 模块生态。

2. **Nuxt 的自动导入从哪些目录来？**
   `components/`、`composables/`、`utils/`、`stores/`（配 Pinia 时）、#imports（useFetch/useRuntimeConfig 等）。

3. **useFetch vs useAsyncData 的取舍？**
   useFetch = useAsyncData 的封装，自带 key 自动去重、URL 变化重取、SSR 数据传输。**默认用 useFetch**。手动控制/多源合并才用 useAsyncData。

4. **useFetch 的缓存/刷新参数？**
   `{ server, lazy, default, transform, pick, watch, immediate, key, getCachedData }`；`refresh()/refreshNuxtData(key)/clearNuxtData(key)`。

5. **中间件、路由规则（routeRules）能干什么？**
   routeRules 声明式给每条路径配：ssr / swr / isr / cache / redirect / proxy / headers。是 Nuxt 混合渲染的**中枢**。

6. **Nuxt 的生命周期钩子有哪些？**
   `app:created`、`app:beforeMount`、`vue:setup`、`page:start`、`page:finish`、`page:loading:end`。路由级：`definePageMeta({ middleware })`。

7. **插件 plugin 什么时候写？如何做鉴权全局拦截？**
   第三方库集成、注入 `nuxtApp.$xx`、全局中间件注册。`plugins/auth.ts` 里 `defineNuxtRouteMiddleware`。

8. **components 目录的自动导入命名规则？**
   `components/base/button/index.vue` → `<BaseButtonIndex>`；同名冲突会自动加路径前缀。可用 `pathPrefix:false` 关闭。
