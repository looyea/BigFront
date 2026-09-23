# 状态管理与 SSR 水合：useState、Pinia 与"每请求新建"的自由午餐

## 1. 先接住上一门课的伏笔

在 04-vue 的 L6 我们学过 Pinia：SPA 里一个 app 一个 store，实例活到用户关标签页为止。在 07-nextjs 的 L5 我们学过 React 服务端组件根本无法用 context，客户端状态要靠 RSC payload 或外部库两头凑。Vue 阵营在 Nuxt 里运气好得多——**因为 Nuxt 的 SSR 是"每个请求现场 new 一个 Vue app"（呼应 nuxt-lifecycle 第 3 节），store 天然就是请求级作用域**，不存在 React 世界里"两个用户共享同一份全局 useState"的经典事故。

这是本关最重要的心智：**Nuxt 里你写的任何"全局状态"，只要挂在 Nuxt 上下文中，服务端分支就是每个请求独享一份，请求结束整棵树连同状态一起被 GC。** 泄露、串号这类问题在模型层被消掉了，剩下的问题只有一个：**状态怎么跨过 SSR→CSR 那道边界活下来**。

## 2. 状态的三条生命周期，先分清楚

| 状态种类 | 载体 | 能否跨 SSR→CSR | 典型用途 |
|---|---|---|---|
| 组件局部 | `ref` / `reactive` | ❌（组件卸载即亡） | 表单草稿、展开折叠 |
| 页面/应用级 | `useState` | ✅（进 payload） | 侧栏开关、跨组件共享的搜索条件 |
| 业务 store | Pinia | ✅（官方自动水合） | 用户信息、购物车、字典缓存 |
| 持久化 | `useCookie` / localStorage | ✅（下一位访客也有） | 登录态、主题、next 里的"上次浏览" |

第三行是下一关的主题，先把边界画清：**内存态（随进程/请求死亡）与持久态（写进浏览器）是两套东西，用错方向就会造成"刷新丢失"或"敏感信息进 localStorage"两类事故。**

## 3. useState：最低成本的同构状态

```ts
// composables/useSidebar.ts
export const useSidebar = () => {
  const open = useState<boolean>('sidebar-open', () => false);
  const toggle = () => (open.value = !open.value);
  return { open, toggle };
};
```

`useState(key, init)` 三个要点：

1. **key 是全局注册表的命名空间**——和 nuxt-usefetch 第 4 节那套 key 撞车机制一模一样：两处 `useState('count')` 拿到的是同一个 ref。这是特性不是 bug，跨组件共享就靠它；不想共享就把 key 起得足够具体（配合模块名前缀）。
2. **init 只在服务端首访执行一次**，结果被序列化进 payload（呼应 nuxt-hydration 第 2 节 `window.__NUXT__.state`）。因此 init 函数里**只能放可 JSON 序列化的值**：`Date` 会变字符串、`Map/Set` 变空对象、函数直接丢——和 payload 瘦身是同一条约束（nuxt-perf 会再算一次账）。
3. **它不是持久化的**：用户强刷新后回到初始值。要持久请用 `useCookie`（下一关）或 `app.config` 那种构建期常量（nuxt-runtime-config 第 4 节）。

一句话判定：**"刷新后希望回到默认值" → useState；"刷新后希望还在" → cookie / storage。**

## 4. Pinia：官方模块 + SSR 的自动水合

```bash
nuxt ts pinia@latest   # 或 nuxt mod add pinia（呼应 nuxt-directory 的模块生态）
```

写法与 04-vue 里几乎完全相同，Setup Store 优先：

```ts
// stores/cart.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartLine[]>([]);
  const total = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0));
  async function hydrateFromServer() {
    const { data } = await useFetch('/api/cart', { pick: ['items'] });
    if (data.value) items.value = data.value.items;
  }
  return { items, total, hydrateFromServer };
});
```

Nuxt 的 Pinia 模块在背后做了三件事，值得知道而不是当成黑箱：

- 在 `vue:setup` 时机（呼应 nuxt-lifecycle 第 4 节钩子表）为当前 Nuxt app `createPinia()` 并 `app.use()`——**每个请求一个新 pinia 实例**；
- 服务端渲染完成后把 `pinia.state.value` 整棵树塞进 payload；客户端启动时 `action` 级别的 `hydrate` 覆盖回来；
- 因此 devtools 里能看到"水合"这条记录，也意味着 **state 里塞了不可序列化东西 = 又一次 payload 事故**。

## 5. SSR 阶段的"取数放哪"：三种姿势与各自代价

```
姿势A：页面里 await useFetch → 组件 setup 阻塞（vue-async-suspense 的顶层 await 模型）
姿势B：store action 里 useFetch → 组件更薄，复用性↑，但要保证 action 在 setup 内 await
姿势C：全局插件里预取 → 只在 app:created/page:loading 时机跑得动，容易变成"未登录也拉全量"反模式
```

推荐 **B 为主、A 为辅**：

```vue
<script setup>
const cart = useCartStore();
await cart.hydrateFromServer();   // 顶层 await → Nuxt 挂进 Suspense（nuxt-lifecycle 第 5 节）
</script>
```

为什么不能"随手在 onMounted 里 fetch"？——**onMounted 只在客户端跑**（呼应 nuxt-hydration 的两侧执行模型），SSR 出来的 HTML 就是空的，SEO 与首屏全丢。这是从 SPA 迁移过来的团队犯的第一号错误。

## 6. 串号迷思与真正的坑

面试常问"SSR 下 Pinia 会不会把 A 用户的数据给 B 用户"。在 Nuxt 里默认**不会**（每请求新建），但仍有三种自毁方式：

1. **把 store 提到模块顶层**：
   ```ts
   // ❌ 模块作用域只执行一次，所有请求共享
   const store = useCartStore();
   export function helper() { store.items.push(...) }
   ```
   `useCartStore()` 必须在 setup / 请求上下文内调用，它靠 `getCurrentInstance()` 找回"当前这个请求的 pinia"。
2. **在 Nitro 侧手写全局变量缓存用户数据**：`server/api` 里 `const cache = {}` 是**整个进程共享**的（呼应 nuxt-server-routes 的 Nitro 常驻模型），多请求并发必然串。要缓存请走 `useStorage()` 并按用户 id 拼 key。
3. **把 payload 里的私密状态当鉴权依据**：客户端可以任意改 `__NUXT__`，任何权限判断必须在服务端 middleware 再走一遍（本关第 7 节 + 下一关）。

## 7. 与 Next.js 对照记分

| 维度 | Nuxt | Next.js App Router |
|---|---|---|
| SSR 状态作用域 | 每请求新 app，天然隔离 | RSC 每请求，但客户端 state 需 hydrate |
| 状态跨边界 | payload 自动带 Pinia/useState | RSC payload / `hydrate` 手工，或 Redux/TanStack 定制 |
| 轻量共享 | `useState` 一行 | 无对应物，只能 context 或外部库 |
| 请求级数据缓存 | `useFetch` key 注册表 | `fetch` + Full Route Cache |
| 生态成熟度 | 官方模块开箱即用 | 库多但选型负担重 |

结论：Nuxt 的状态模型"更 boring 也更省心"，代价是灵活度与 Edge Runtime 适配不如 Next 细腻（呼应 next-state-mgmt 的讨论）。

## 8. 自检清单

- [ ] 这个状态刷新后需要在吗？需要 → cookie/localStorage；不需要 → useState/Pinia
- [ ] `useState` 的 init 返回值能 `JSON.stringify` 往返无损吗？
- [ ] Pinia state 里有没有 class 实例、函数、循环引用？
- [ ] 取数是在 setup 顶层 await（SSR 可见）还是 onMounted（仅客户端）？
- [ ] 有没有在模块顶层调用 `useXxxStore()` / `useRuntimeConfig()`？
- [ ] 服务端有没有用进程级普通对象缓存用户数据（应改 useStorage + 用户维度 key）？
- [ ] 权限判断是否只在前端做过一次（必须服务端再判）？

## 9. 🚀 部署预告

状态能跨水合活下来了，但"关掉浏览器还在"需要真正落到浏览器与服务器之间——下一关 **nuxt-cookie-session**：`useCookie` 的同构读写、服务端 session 与 JWT 的取舍，以及为什么 `httpOnly` 是防 XSS 偷身份的唯一硬防线。
