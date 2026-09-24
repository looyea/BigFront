# 面试题：Nuxt SSR 水合（pinia-ssr）

### 1. (原理类) Nuxt Pinia 模块自动做了什么？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

注册 createPinia、SSR 序列化 state 进 payload、客户端水合恢复、集成 devtools。开发者无需写 hydrate/serialize 代码。

### 2. (实战类) 为什么持久化插件要 import.meta.client 守卫？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#localStorage-and-sessionStorage

服务端无 localStorage。不加守卫 SSR crash。

### 3. (对比类) useAsyncData 和 Pinia action 的 SSR 区别？
**来源**：https://nuxt.com/docs/getting-started/data-fetching

useAsyncData 页面级、一次执行、数据注入 payload。Pinia action 全局级、可被多组件消费。首屏用 useAsyncData、交互数据用 Pinia。

### 4. (坑类) 如何避免 SSR/CSR 双重 fetch？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#fetching-data-in-a-store

action 里 `if (data.value) return` 跳过已水合数据。Nuxt plugin 里 await action → SSR fetch 一次 → 水合后 onMounted 不重触发。

### 5. (安全类) 敏感 token 能注入 __NUXT_DATA__ 吗？
**来源**：https://owasp.org/www-project-web-security-testing-guide/

不能——view-source 可见。敏感数据走 HttpOnly cookie 或 persist:false 排除。

### 6. (架构类) Nuxt plugin 里 await store.fetch() 的时序？
**来源**：https://nuxt.com/docs/guide/directory-structure/plugins

Nuxt 启动 → 依次 await 各 plugin → plugin 内 await store action → fetch 完成 → 渲染 HTML（state 已含数据）→ payload 序列化。

### 7. (调试类) 水合后 store 值不对怎么查？
**来源**：https://nuxt.com/docs/getting-started/error-handling

查看源码里 __NUXT_DATA__ JSON；Nuxt DevTools Payload 面板；Pinia 面板对比初始值与水合值。

### 8. (性能类) store state 很大时 payload 序列化会影响首屏性能吗？
**来源**：https://nuxt.com/docs/guide/advanced/bundle-size-report

大 state（>50KB）→ HTML 膨胀 → 首屏 parse 慢。优化：① 只序列化必要字段（partialize）；② 列表数据分页不一次全塞；③ 纯客户端数据 persist:false。

### 9. (工具类) $fetch vs axios 在 SSR 中有什么区别？
**来源**：https://nuxt.com/docs/api/composables/use-fetch

$fetch(ofetch) 在 SSR 内部直接调 nitro handler（不经 HTTP loopback）。axios 需配完整 baseURL + 转发 cookie。

### 10. (SSR类) 如果 store setup 里用了浏览器 API（如 navigator）怎么办？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

包 `if (import.meta.client)` 守卫；或把该逻辑移到 onMounted（仅客户端执行）。

### 11. (设计类) 哪些 store 适合 SSR 预填充？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#fetching-data-in-a-store

SEO 需要的页面内容（文章/商品详情）→ SSR。用户偏好（主题色/侧栏折叠）→ CSR。实时数据（通知/聊天）→ CSR。

### 12. (对比类) Pinia Nuxt 水合 vs Angular TransferState 有何异同？
**来源**：https://angular.dev/guide/ssr/transfer-state

相同：服务端数据序列化注入 HTML → 客户端恢复 → 避免二次请求。不同：Angular 需手动 `TransferState` + `makeStateKey`；Nuxt Pinia 全自动。

### 13. (坑类) SSR 时 store 里 new Date() 会导致什么？
**来源**：https://nuxt.com/docs/guide/concepts/rendering#client-side-hydration

hydration mismatch——服务端时间与客户端不同 → DOM 文本节点不一致 → Vue 报水合警告。用固定 seed 或客户端 onMounted 才渲染。

### 14. (综合类) 画一个完整 SSR + 水合数据流。
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

Browser → Nitro SSR → createNuxtApp + Pinia → plugin: await store.fetch() → data → Vue renderToString (with state payload) → HTML + `__NUXT_DATA__` → Browser hydration → Pinia restore → interactive。

### 15. (进阶类) ISR 场景下 store 数据过期怎么办？
**来源**：https://nuxt.com/docs/guide/concepts/rendering#hybrid-rendering

设 route rules `swr: 60`（60秒后后台重验证）或 ISR + `cache: { maxAge: 3600 }` + 手动 revalidate API 触发更新。
