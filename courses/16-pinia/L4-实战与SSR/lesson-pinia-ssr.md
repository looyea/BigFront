# Nuxt SSR 状态水合

## Nuxt 自动处理了什么

`npx nuxi module add pinia` 后，Nuxt 自动：
1. 服务端：每请求创建 Pinia 实例 → store state → 序列化为 JSON 注入 `__NUXT_DATA__`
2. 客户端：水合时从 `__NUXT_DATA__` 反序列化 → 覆盖 store 初始值

开发者无需手动 serialize/hydrate。

## 持久化插件里的 SSR 守卫

```ts
export function persistPlugin({ store }) {
  // 只在客户端恢复
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
```

服务端无 localStorage——不加守卫则 SSR 崩溃。

## asyncData 放 action 还是 Nuxt 页面？

| 场景 | 用什么 |
| --- | --- |
| 页面首屏关键数据（SEO 需要 HTML 里包含） | `useAsyncData` / `definePageMeta` |
| 全局共享数据（用户信息、配置） | store action + Nuxt plugin 里 await |
| 交互后按需加载 | store action（CSR only） |

```ts
// plugins/auth.ts（Nuxt plugin 里 await）
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore();
  await auth.fetchProfile(); // 服务端就执行，数据注入 state 再水合
});
```

## 避免双重请求

SSR 里 action 执行了一次 → HTML 注入 state → 客户端水合恢复 state → 组件 `onMounted` 又 dispatch 一次。

解法：action 里加缓存判断：
```ts
async function fetchProfile() {
  if (user.value) return; // 已有数据（水合恢复的），跳过
  user.value = await $fetch('/api/me');
}
```

## store 里用 $fetch 还是 axios？

Nuxt 3 推荐内置 `$fetch`——自动处理 baseURL、SSR 转发内部 API（走 nitro handler 不经 HTTP）、错误格式化。axios 需要手动配 `baseURL` + SSR 透传 cookie header。

## 部署预告

`npm run build && node .output/server/index.mjs` 本地跑 Nuxt SSR，打开 DevTools 确认 `__NUXT_DATA__` 含 store state。
