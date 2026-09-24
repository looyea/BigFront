# Setup Store：defineStore 的 Composition API 写法

## 一个 store 就是一个 setup 函数

上一关我们看到 Pinia 有两种写法，本关聚焦 **Setup Store**——本包全程使用此风格。

```ts
// stores/counter.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCounterStore = defineStore('counter', () => {
  // ===== state =====
  const count = ref(0);
  const name = ref('Pinia');

  // ===== getter =====
  const double = computed(() => count.value * 2);

  // ===== action =====
  function increment() {
    count.value++;
  }

  // 必须 return：只有暴露的属性/方法才能被外部访问
  return { count, name, double, increment };
});
```

**对应关系一目了然**：
| Setup Store | Vuex 等价 | 本质 |
| --- | --- | --- |
| `ref()` / `reactive()` | state | 响应式数据源 |
| `computed()` | getters | 惰性派生+缓存 |
| `function` | actions（mutations 合并进来） | 普通函数（可 async） |

## storeToRefs：保留响应式地解构

```ts
// 组件里
const store = useCounterStore();
const { count, double } = storeToRefs(store); // ✅ 仍是 ref
const { increment } = store;                   // ✅ action 直接解构（函数引用稳定）
```

直接 `const { count } = store` 等于 `const count = store.count`——解引用了，响应式丢失。`storeToRefs` 是 Pinia 专用工具，只对 state/getter 做 toRef 映射。

## 私有状态：不 return 就不暴露

Setup Store 的返回决定**公共 API**——没 return 的东西外部不可见：

```ts
export const useSecretStore = defineStore('secret', () => {
  const password = ref('');           // 公共
  const _rawToken = ref('...');       // 私有（不 return）

  const isValid = computed(() => password.value.length > 6);

  function setPwd(v: string) { password.value = v; }

  return { password, isValid, setPwd }; // 外部只见这些
});
```

好处：封装内部实现细节，外部无法绕过 action 直接改 `_rawToken`。

## 组合其他 composable

Setup Store 可以调用任何 Composition API：

```ts
export const useUserStore = defineStore('user', () => {
  const router = useRouter();          // vue-router
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
