# Store 组合：跨 store 调用与派生

## 基本用法：action 里 useOtherStore()

```ts
// stores/cart.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([]);
  const total = computed(() => items.value.reduce((s, i) => s + i.price, 0));

  return { items, total };
});

// stores/order.ts
export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>([]);

  async function submitOrder() {
    const cart = useCartStore(); // ← 跨 store 引用
    await api.post('/orders', { items: cart.items, total: cart.total });
    orders.value.push({ id: Date.now(), total: cart.total });
    cart.items.length = 0; // 清空购物车
  }

  return { orders, submitOrder };
});
```

**规则**：只在 action 里跨 store（getter 里不能——L2 已讲原因）。

## 跨 store 派生：陷阱与修复

如果想在 order store 的 getter 里"实时反映购物车总价"：

```ts
// ❌ 错误：getter 里不能 useOtherStore
const grandTotal = computed(() => orderTotal.value + useCartStore().total);
```

**正确做法**：在 action 里手动同步到一个 ref：

```ts
const cartTotalRef = ref(0);

function syncCartTotal() {
  const cart = useCartStore();
  cartTotalRef.value = cart.total;
}

// 或在初始化时用 $subscribe
watch(() => useCartStore().total, (v) => { cartTotalRef.value = v; });
```

## 拆分粒度判据

什么时候该拆成独立 store？

| 信号 | 决策 |
| --- | --- |
| 两个字段永远一起变 | 同一个 store |
| 某字段只在特定 action 里用 | 可拆（减少无关组件的重渲染） |
| 多个页面共享同一份数据 | 独立 store |
| 字段名重复出现（如 name） | 不同 store（不同域） |

原则：**一个 store = 一个业务域**（cart / user / ui-theme），不是一个页面。

## 避免循环依赖

A store 的 action 里调 B store，B store 的 action 里调 A store——可以吗？

可以。Pinia 的 store 实例在首次 `useXxxStore()` 时创建——import 的只是"工厂函数"引用。Vite 的 ESM 循环 import 不会报错（函数声明被 hoisted）。但注意**不要在 setup 顶层（return 前）直接调用另一 store 的方法**——那时另一个 store 可能还没创建。

安全模式：
```ts
// ✅ action 里用（此时所有 store 都已注册）
function myAction() {
  const other = useOtherStore();
  other.someMethod();
}
```

## 组合模式 vs 事件总线

旧 Vuex 时代用 event bus 解耦跨模块通信。Pinia 直接推荐 **store 互调**——更类型安全、DevTools 可追踪。如果确实需要"一对多通知"，用 `$subscribe` 或在 action 里遍历一组 store。

## 部署预告

本地建两个 store（cart + order），在组件里调用 order.submitOrder() 看跨 store 联动效果。
