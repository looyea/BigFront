# Setup Store：defineStore 的 Composition API 写法

## 一个 store 就是一个 setup 函数

上一关我们看到 Pinia 有两种写法，本关聚焦 **Setup Store**——本包全程使用此风格。

```ts
// 目的：一个 Setup Store 的标准骨架——ref=computed=函数，靠 return 划定公共 API
// stores/counter.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCounterStore = defineStore('counter', () => {
  // ===== state =====
  const count = ref(0);              // 响应式数据源
  const name = ref('Pinia');

  // ===== getter =====
  const double = computed(() => count.value * 2);   // 惰性派生+缓存

  // ===== action =====
  function increment() {
    count.value++;                    // 直接改 ref，无 mutation/commit
  }

  // 必须 return：只有暴露的属性/方法才能被外部访问
  return { count, name, double, increment };
});
// ✅ return 的字段在组件里 store.count/store.increment() 均可用
// ❌ 漏 return double→组件访问 store.double 为 undefined
```

**对应关系一目了然**：
| Setup Store | Vuex 等价 | 本质 |
| --- | --- | --- |
| `ref()` / `reactive()` | state | 响应式数据源 |
| `computed()` | getters | 惰性派生+缓存 |
| `function` | actions（mutations 合并进来） | 普通函数（可 async） |

## storeToRefs：保留响应式地解构

```ts
// 目的：storeToRefs 保留响应式地解构 state/getter，action 则直接解构
// 组件里
const store = useCounterStore();
const { count, double } = storeToRefs(store); // ✅ 仍是 ref，模板里自动解包、保持响应式
const { increment } = store;                   // ✅ action 直接解构（函数引用稳定，不依赖 this）
// ✅ state/getter 走 storeToRefs、action 直接解构，是官方推荐的三分类取用法
// ❌ const { count } = store→相当于 store.count 取了快照值，之后 store 变了 count 不再更新
```

直接 `const { count } = store` 等于 `const count = store.count`——解引用了，响应式丢失。`storeToRefs` 是 Pinia 专用工具，只对 state/getter 做 toRef 映射。

## 私有状态：不 return 就不暴露

Setup Store 的返回决定**公共 API**——没 return 的东西外部不可见：

```ts
// 目的：私有状态——不 return 的 ref/函数外部不可见，逼外部只经 action 改动
export const useSecretStore = defineStore('secret', () => {
  const password = ref('');           // 公共（被 return）
  const _rawToken = ref('...');       // 私有（不 return）——外部摸不到

  const isValid = computed(() => password.value.length > 6);

  function setPwd(v: string) { password.value = v; }   // 唯一改动入口

  return { password, isValid, setPwd }; // 外部只见这三个
});
// ✅ 封装内部实现：外部无法绕过 action 直改 _rawToken
// ❌ 把 _rawToken 也 return 出去→私有形同虚设，外部能 store._rawToken = 'x' 破坏封装
```

好处：封装内部实现细节，外部无法绕过 action 直接改 `_rawToken`。

## 组合其他 composable

Setup Store 可以调用任何 Composition API：

```ts
// 目的：Setup Store 内组合其他 composable（router/fetch/本地存储）
export const useUserStore = defineStore('user', () => {
  // ⚠ 下面这行作模块顶层写法有陷阱，见块尾说明
  const router = useRouter();          // vue-router——若在 app.use(router) 前执行会拿到 undefined
  const { data, pending } = useFetch('/api/me'); // Nuxt / VueUse
  const theme = useLocalStorage('theme', 'dark'); // VueUse

  const isDark = computed(() => theme.value === 'dark');

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    theme.value = 'dark';
    router.push('/login');
  }

  return { data, pending, isDark, logout };
});
// ✅ 把 useRouter() 移到 action 内部调用→那时 app 已初始化，总能拿到有效 router
// ❌ 在 setup 顶层调 useRouter()，而 store 在 import 时就执行→router 为 undefined，logout 里 push 报错
```

> **注意**：store 文件在 `app.use(router)` 之前不能调用 `useRouter()`。如果 store 的 setup 在模块顶层就执行（import 时），`useRouter()` 会返回 undefined。安全做法：把 `useRouter()` 移到 action 内部。

## TypeScript 零标注：类型怎么推断的

Setup Store 返回 `{ count, double, increment }` 后，`useCounterStore()` 的类型自动是：

```ts
{ count: Ref<number>, double: ComputedRef<number>, increment: () => void } & StoreGeneric
```

你不需要写任何泛型参数或 `as`。Vue 的 ref/computed 本身携带类型信息，Pinia 直接透传。

如果 state 类型需要约束（如枚举），用显式泛型：

```ts
const role = ref<'admin' | 'user'>('user'); // 推断为 Ref<'admin' | 'user'>
```

## 命名与导出规范

社区最佳实践：

- 文件名：`stores/<domain>.ts`（如 `stores/cart.ts`、`stores/auth.ts`）
- 导出名：`use<Domain>Store`（如 `useCartStore`）——与 Vue composable 命名一致
- defineStore 第一参数：全局唯一字符串 id（DevTools 显示用）

```ts
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => { ... });
```

## Options Store 什么时候还用

- 团队有 Vuex 老成员，暂时不熟悉 Composition API；
- 需要 `$reset()` 一行重置（Setup Store 默认没有 $reset，需手动实现）；
- 纯 CRUD store、逻辑极简无组合需求。

本包后续一律用 Setup Store。

## 部署预告

本关示例在本地用 `npm create vue@latest`（勾选 Pinia）即可跑通。Nuxt SSR 部署在 L4 统一讲。
