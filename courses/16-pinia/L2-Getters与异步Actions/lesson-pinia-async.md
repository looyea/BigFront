# Async Actions：HTTP + loading + 竞态

## action 直接 async——没有 thunk

与 Vuex/Redux 的 `dispatch` → thunk → commit 链路不同，Pinia 的 action **就是一个普通 async 函数**：

```ts
// 目的：async action——一个普通 async 函数直接改 state，无 thunk/commit 链路
export const useUserStore = defineStore('user', () => {
  const userInfo = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchUser(id: string) {
    loading.value = true;             // 进请求先置 loading
    error.value = null;               // 清空旧错误
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);   // fetch 不对 4xx/5xx reject，手动抛
      userInfo.value = await res.json();
    } catch (e: any) {
      error.value = e.message;        // 统一收敛到 error 态
    } finally {
      loading.value = false;          // 成败都关 loading
    }
  }

  return { userInfo, loading, error, fetchUser };
});
// ✅ loading/error/userInfo 都在 store，多处组件消费同一份数据时状态共享
// ❌ 只靠 res.ok 前不 throw→HTTP 404 仍当成功把错误页 json 写进 userInfo（fetch 不自动 reject）
```

组件里直接调用：
```vue
<script setup>
// 目的：组件里直接调 async action，模板根据 loading/error/数据三态渲染
const store = useUserStore();
onMounted(() => store.fetchUser('123'));   // 挂载即拉数据
</script>
<template>
  <!-- 三态优先：loading → error → 成功数据 -->
  <div v-if="store.loading">Loading...</div>
  <div v-else-if="store.error">{{ store.error }}</div>
  <div v-else>{{ store.userInfo?.name }}</div>   <!-- ?. 防 userInfo 为 null 时报错 -->
</template>
```

## loading / error 状态放 store 还是组件？

**规则**：如果同一份数据被多处组件消费（列表页 + 详情页 + 侧边栏预览），loading/error 放 store。只有单一组件用 → 放组件局部 `ref` 即可。

## 竞态处理：AbortController

用户快速切换筛选条件时，旧请求可能后到覆盖新数据。解决方案：

```ts
// 目的：竞态方案一 AbortController——新请求发出前取消上一次，防旧响应覆盖新数据
let controller: AbortController | null = null;

async function search(keyword: string) {
  controller?.abort();                    // 取消上一次未完成的请求
  controller = new AbortController();     // 为本次建新控制器
  loading.value = true;
  try {
    const res = await fetch(`/api/search?q=${keyword}`, {
      signal: controller.signal,          // 把 signal 交给 fetch
    });
    results.value = await res.json();
  } catch (e: any) {
    if (e.name !== 'AbortError') error.value = e.message;   // 主动取消不算错，不写 error
  } finally {
    loading.value = false;
  }
}
// ✅ 旧请求被 abort、抛 AbortError 被过滤，只有最新 keyword 的结果上屏
// ❌ 不过滤 AbortError→每次切换关键字都误报一个“错误”，error 态乱跳
```

或用**请求序号**（更简单）：
```ts
// 目的：竞态方案二 请求序号——更简单，过时响应直接丢弃、不真取消网络
let reqId = 0;
async function fetchData() {
  const id = ++reqId;                     // 本次请求领一个递增号
  const data = await api.get();
  if (id !== reqId) return;               // 期间又发了新的→当前已过时，丢弃
  result.value = data;                    // 只有最新一次能赋值
}
// ✅ 不依赖 fetch 取消能力，最后发出的请求才写 result
// ❌ 去掉 if (id !== reqId) return→旧请求后到会覆盖新结果，数据与输入不同步
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
// 目的：await 一个 action 拿返回值——fetchUser 内部 return userInfo.value
const user = await store.fetchUser('123'); // action 既能改 store 又能给调用方回数据
// ✅ 比 Vuex dispatch（只能从 state 取回）直观：返回值就是函数 return
// ❌ fetchUser 没 return 任何值→await 拿到 undefined，需补 return userInfo.value
```

这让 action 既能"改 store 状态"又能"给调用方返回数据"——比 Vuex 的 dispatch（返回 Promise 但数据只能通过 state 取）更直观。

## 批量并发

```ts
// 目的：批量并发——allSettled 并发拉多个 id，单个失败不拖垮整体
async function fetchAll(ids: string[]) {
  loading.value = true;
  const results = await Promise.allSettled(   // allSettled 不会因个别 reject 而整体抛
    ids.map(id => fetch(`/api/items/${id}`).then(r => r.json()))
  );
  items.value = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')  // 只取成功项
    .map(r => r.value);
  loading.value = false;
}
// ✅ 部分接口挂掉时，其余数据照常上屏（fulfilled 项）
// ❌ 误用 Promise.all→一个 id 失败就整批 reject，一个错误拖垮所有结果
```

## 部署预告

本地 `npm create vue@latest` + 一个 jsonplaceholder API 即可测 async action。Nuxt SSR 集成在 L4 详讲。
