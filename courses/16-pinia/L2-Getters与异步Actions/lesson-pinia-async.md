# Async Actions：HTTP + loading + 竞态

## action 直接 async——没有 thunk

与 Vuex/Redux 的 `dispatch` → thunk → commit 链路不同，Pinia 的 action **就是一个普通 async 函数**：

```ts
export const useUserStore = defineStore('user', () => {
  const userInfo = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchUser(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      userInfo.value = await res.json();
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  return { userInfo, loading, error, fetchUser };
});
```

组件里直接调用：
```vue
<script setup>
const store = useUserStore();
onMounted(() => store.fetchUser('123'));
</script>
<template>
  <div v-if="store.loading">Loading...</div>
  <div v-else-if="store.error">{{ store.error }}</div>
  <div v-else>{{ store.userInfo?.name }}</div>
</template>
```

## loading / error 状态放 store 还是组件？

**规则**：如果同一份数据被多处组件消费（列表页 + 详情页 + 侧边栏预览），loading/error 放 store。只有单一组件用 → 放组件局部 `ref` 即可。

## 竞态处理：AbortController

用户快速切换筛选条件时，旧请求可能后到覆盖新数据。解决方案：

```ts
let controller: AbortController | null = null;

async function search(keyword: string) {
  controller?.abort();                    // 取消上一次
  controller = new AbortController();
  loading.value = true;
  try {
    const res = await fetch(`/api/search?q=${keyword}`, {
      signal: controller.signal,
    });
    results.value = await res.json();
  } catch (e: any) {
    if (e.name !== 'AbortError') error.value = e.message;
  } finally {
    loading.value = false;
  }
}
```

或用**请求序号**（更简单）：
```ts
let reqId = 0;
async function fetchData() {
  const id = ++reqId;
  const data = await api.get();
  if (id !== reqId) return; // 过时响应，丢弃
  result.value = data;
}
```

## 与 Nuxt useFetch 的关系

Nuxt 提供 `useFetch` 自动处理 SSR 数据获取 + 水合。与 Pinia async action 的分工：

| 场景 | 用什么 |
| --- | --- |
| 页面级首屏数据（SSR 渲染需要） | `useFetch` / `useAsyncData` |
| 用户交互触发的按需数据（点击加载更多） | Pinia action |
| 全局共享+缓存（用户信息、权限列表） | Pinia action + store 缓存 |

> 不要把 Nuxt 的 `useFetch` 数据塞进 Pinia——会导致双重序列化（水合两次）。

## async action 的返回值

action 的返回值就是函数的 `return`——组件可以 `await store.fetchUser('123')` 拿结果：

```ts
const user = await store.fetchUser('123'); // fetchUser 里 return userInfo.value
```

这让 action 既能"改 store 状态"又能"给调用方返回数据"——比 Vuex 的 dispatch（返回 Promise 但数据只能通过 state 取）更直观。

## 批量并发

```ts
async function fetchAll(ids: string[]) {
  loading.value = true;
  const results = await Promise.allSettled(
    ids.map(id => fetch(`/api/items/${id}`).then(r => r.json()))
  );
  items.value = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map(r => r.value);
  loading.value = false;
}
```

## 部署预告

本地 `npm create vue@latest` + 一个 jsonplaceholder API 即可测 async action。Nuxt SSR 集成在 L4 详讲。
