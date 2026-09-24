# 面试题：Store 组合（pinia-compose）

### 1. (概念类) Pinia 中如何在 store A 的 action 里调用 store B？
**来源**：https://pinia.vuejs.org/core-concepts/composing-stores.html

直接 `import { useBStore } from './b'` 然后在 action 函数体内 `const b = useBStore()`。不需要注册/注入——useBStore 本身就是工厂。首次调用时创建实例，后续调用返回同一单例。

### 2. (坑类) 为什么不能在 computed getter 里调用 useOtherStore()？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html#using-other-stores

computed 是惰性的——执行时机不确定（可能早于 Pinia 实例就绪）。且 getter 应无副作用，跨 store 调用是"读取另一个响应式源"，会引入不可预测的依赖链。官方明确规定只能在 action 里。

### 3. (设计类) 怎么组织跨 store 的数据流？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

推荐"单向"：父域 store 的 action 调子域 store 并取数据；子域 store 不知道父域存在。避免双向耦合。用 action 做编排层（orchestration），getter 只做本域派生。

### 4. (实战类) 跨 store 派生值的正确写法是什么？
**来源**：https://pinia.vuejs.org/core-concepts/composing-stores.html#store-in-services

```ts
const localRef = ref(0);
watch(() => otherStore.total, v => { localRef.value = v });
const combined = computed(() => ownTotal.value + localRef.value);
```
或用 `$subscribe` 在 action 后同步。

### 5. (循环类) 两个 store 互相在 action 里调用，会栈溢出吗？
**来源**：https://github.com/vuejs/pinia/discussions/1429

不会。import 的是函数引用，调用时才执行——V8 的调用栈只在运行时展开。除非两个 action 互相 await 对方无限递归（逻辑 bug），否则无问题。

### 6. (SSR类) SSR 中跨 store 调用的初始化顺序是什么？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#fetching-data-in-a-store

Nuxt 的 plugin 或页面 setup 里按序 await 各 store 的 init action。Pinia 实例在每请求开头创建，store 工厂在首次 use 时执行。建议：layout 里 await appStore.init() → 页面里 await pageStore.init()。

### 7. (测试类) 测 store A 的 action 如何 mock 其对 store B 的依赖？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#stubbing-plugins-and-actions

`createPinia(); setActivePinia(pinia); const b = useBStore(); b.getSomething = vi.fn().mockReturnValue(42);` 然后调 A 的 action 断言。或用 vi.mock('./b') 整个文件替换。

### 8. (对比类) Pinia 的 store 组合与 Angular DI 的 service 注入有何异同？
**来源**：https://pinia.vuejs.org/core-concepts/composing-stores.html

相同：都是"把状态与逻辑集中到独立模块，按需组合"。不同：Angular 用构造函数注入（`constructor(private b: BService)`），有 token + scope 控制；Pinia 直接 import 调用函数，全局单例为主（可配 EffectScope 做隔离）。

### 9. (规范类) 一个 store 可以调用多少个其他 store？有上限吗？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

无硬上限，但如果 action 里 use 了 5+ 个 store——说明这个 store 是"编排层"（orchestrator），应考虑提取为 composable 或 service 而非 store。store 职责是持有 state，编排逻辑可独立。

### 10. (进阶类) 如何实现"store 工厂 + scope 隔离"（非全局单例）？
**来源**：https://pinia.vuejs.org/cookbook/composing-stores.html#shared-state-in-composables

不用 defineStore，而是写 `function createCartStore() { const items = ref([]); ... return { items, ... } }`，配合 provide/inject 在组件子树里传递——每个 provide 作用域一份独立实例。

### 11. (模式类) 用 composable 做"编排层"的模式是什么？
**来源**：https://pinia.vuejs.org/cookbook/composing-stores.html#composing-stores

```ts
// composables/useCheckout.ts
export function useCheckout() {
  const cart = useCartStore();
  const user = useUserStore();
  async function submit() {
    await api.checkout({ items: cart.items, userId: user.id });
    cart.clear();
  }
  return { submit };
}
```
不增加新 store，而是组合已有 store 的动作放在 composable 里——组件只 import 该 composable。

### 12. (坑类) import store 文件但不调用 useXxxStore()，store 会被创建吗？
**来源**：https://pinia.vuejs.org/core-concepts/#setup-stores

不会。`defineStore()` 返回的是一个"创建函数"——只有被调用（`useXxxStore()`）时才真正创建 store 实例。import 不触发。

### 13. (性能类) 跨 store 调用是否影响响应式追踪粒度？
**来源**：https://vuejs.org/guide/extras/reactivity-in-depth.html#render-effect

不影响。每个 ref/computed 独立追踪。A store 的 action 读 B store 的 total → 如果 B.total 变了，只有"在 A 的 computed 里读了 total"的那个 computed 被标记 dirty——其他不受影响。

### 14. (TS类) 跨 store 调用的类型安全怎么保证？
**来源**：https://pinia.vuejs.org/core-concepts/composing-stores.html#typescript

Setup Store return 什么类型，`useOtherStore()` 就返回什么类型——TS 推断跨文件自动生效。唯一注意：循环 import 时 TS 编译器偶尔报 "circularly references itself"——用 `import type` 规避。

### 15. (综合类) 请设计购物车 + 订单 + 用户三 store 的依赖关系图。
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

user ← order（order 读 user.id）；cart ← order（order 读 cart.items 后清空 cart）；cart 与 user 无直接依赖。依赖方向：order 依赖 cart 和 user，cart/user 互不依赖。
