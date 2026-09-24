# Computed Getters：惰性派生与带参筛选

## 基本形态：computed 即 getter

Setup Store 里用 `computed()` 做派生值——与组件完全一致：

```ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([]);
  const coupon = ref<string | null>(null);

  // 基础 getter
  const total = computed(() =>
    items.value.reduce((s, i) => s + i.price * i.qty, 0)
  );

  // 折扣后
  const discounted = computed(() =>
    coupon.value ? total.value * 0.9 : total.value
  );

  return { items, coupon, total, discounted };
});
```

**惰性 + 缓存**：只有 `total` 被读取且 `items` 确实变化时才重新计算——与组件 computed 行为一模一样。

## 带参数的 getter：返回函数

computed 本身不支持参数。Pinia 的做法是**让 getter 返回一个函数**：

```ts
const itemsByCategory = computed(() => {
  return (category: string) =>
    items.value.filter(i => i.category === category);
});
```

组件里：
```ts
const { itemsByCategory } = storeToRefs(store);
const electronics = itemsByCategory.value('electronics'); // 调用返回的函数
```

> ⚠️ 注意：返回函数模式下**缓存粒度变粗**——只要 items 变了，函数引用就换（旧结果全部失效）。不像 Vue 的 props 缓存按 key 分桶。

## Getter 里访问其他 getter

直接引用同 store 里的 computed 变量即可：

```ts
const count = computed(() => items.value.length);
const averagePrice = computed(() =>
  count.value ? total.value / count.value : 0
);
```

响应式链路自动建立：items → total/count → averagePrice。

## Getter 里访问其他 Store（限制！）

**不能在 computed 里 `useOtherStore()`**——因为 getter 的执行时机不确定（惰性），此时 pinia 实例可能还没注册。

正确做法：在 action 里手动算并赋给一个 ref：

```ts
const combinedTotal = ref(0);

function recalcCombined() {
  const other = useOtherStore(); // action 里安全
  combinedTotal.value = total.value + other.otherTotal;
}
```

## 对比 Options Store 的 getter

Options Store 的 getter 写法：
```ts
getters: {
  double: (state) => state.count * 2,
  doublePlusOne(): number { return this.double + 1 }, // 跨 getter 引用用 this
}
```

Setup Store 的优势：**没有 this**、类型推断自然、可捕获闭包变量。

## 与 Vue 组件 computed 的一致性

| 特性 | 组件 computed | Pinia getter |
| --- | --- | --- |
| 惰性 | ✅ 首次访问才计算 | ✅ |
| 缓存 | ✅ 依赖不变不重算 | ✅ |
| 只读 | ✅ 不可赋值 | ✅ store.count 不可写（写要 action/patch） |
| 带参数 | ❌ 不支持 | 返回函数模拟 |
| watch 源 | 可用 | 可用（`watch(store.total, cb)`） |

底层实现相同（@vue/reactivity 的 computed）——只是 Pinia 把它放在了全局单例里。

## 性能提示：避免 getter 链过深

```
items → filtered → grouped → sorted → count
```

每层 computed 都只在上游 dirty 时标记自身 dirty，但最终消费点（组件 render）触发时**整条链同步重算**。如果链长且计算重，考虑在 action 里分步算并缓存中间结果。

## 部署预告

本地 `npm create vue@latest` 选 Pinia 模板，在 stores/ 里写带 computed getter 的 store 并在组件模板展示。
