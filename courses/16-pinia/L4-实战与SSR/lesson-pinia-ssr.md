# Nuxt SSR 状态水合

## Nuxt 自动处理了什么

`npx nuxi module add pinia` 后，Nuxt 自动：
1. 服务端：每请求创建 Pinia 实例 → store state → 序列化为 JSON 注入 `__NUXT_DATA__`
2. 客户端：水合时从 `__NUXT_DATA__` 反序列化 → 覆盖 store 初始值

开发者无需手动 serialize/hydrate。

## 持久化插件里的 SSR 守卫

```ts
// 目的：SSR 安全的持久化插件——用 import.meta.client 守卫，只在浏览器读写 localStorage
export function persistPlugin({ store }) {
  // 只在客户端恢复（服务端无 localStorage）
  if (import.meta.client) {
    const saved = localStorage.getItem(`pinia_${store.$id}`);
    if (saved) store.$patch(JSON.parse(saved));
  }

  // 只在客户端写
  store.$subscribe((_, state) => {
    if (import.meta.client) {
      localStorage.setItem(`pinia_${store.$id}`, JSON.stringify(state));
    }
  }, { detached: true });
}
// ✅ import.meta.client 分支服务端不执行→服务端无 localStorage 也不崩
// ❌ 不守卫直接读 localStorage→SSR 报 ReferenceError: localStorage is not defined，服务端渲染失败
```

服务端无 localStorage——不加守卫则 SSR 崩溃。

## asyncData 放 action 还是 Nuxt 页面？

| 场景 | 用什么 |
| --- | --- |
| 页面首屏关键数据（SEO 需要 HTML 里包含） | `useAsyncData` / `definePageMeta` |
| 全局共享数据（用户信息、配置） | store action + Nuxt plugin 里 await |
| 交互后按需加载 | store action（CSR only） |

```ts
// 目的：Nuxt 全局插件里 await 首屏数据——服务端就拉好并注入 state，随 HTML 水合
// plugins/auth.ts（Nuxt plugin 里 await）
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore();
  await auth.fetchProfile(); // 服务端就执行，数据注入 state 再水合（首屏 HTML 即含用户信息）
});
// ✅ 服务端 await 完再渲染，SEO/首屏直接带数据，客户端水合不重拉
// ❌ 不 await 直接发→插件未等请求完成就继续，服务端拿到 pending Promise，水合时数据缺失闪烁
```

## 避免双重请求

SSR 里 action 执行了一次 → HTML 注入 state → 客户端水合恢复 state → 组件 `onMounted` 又 dispatch 一次。

解法：action 里加缓存判断：
```ts
// 目的：防 SSR 双请求——action 里判缓存，水合恢复的数据不重拉
async function fetchProfile() {
  if (user.value) return; // 已有数据（水合恢复的），跳过
  user.value = await $fetch('/api/me');   // 仅真空时发请求
}
// ✅ 服务端取过一次、水合把 user 填上→客户端再调 fetchProfile 命中缓存直接返回，不发第二遍
// ❌ 不加 if (user.value) return→SSR 一次、onMounted 又一次，同一数据请求两遍（双请求浪费）
```

## store 里用 $fetch 还是 axios？

Nuxt 3 推荐内置 `$fetch`——自动处理 baseURL、SSR 转发内部 API（走 nitro handler 不经 HTTP）、错误格式化。axios 需要手动配 `baseURL` + SSR 透传 cookie header。

## 部署预告

`npm run build && node .output/server/index.mjs` 本地跑 Nuxt SSR，打开 DevTools 确认 `__NUXT_DATA__` 含 store state。
