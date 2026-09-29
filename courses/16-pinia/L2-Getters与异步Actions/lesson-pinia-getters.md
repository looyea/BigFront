# Computed Getters：惰性派生与带参筛选

## 基本形态：computed 即 getter

Setup Store 里用 `computed()` 做派生值——与组件完全一致：

```ts
// 目的：用 computed 做 getter——惰性+缓存，与组件 computed 行为一致
export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([]);
  const coupon = ref<string | null>(null);

  // 基础 getter：依赖 items，变化才重算
  const total = computed(() =>
    items.value.reduce((s, i) => s + i.price * i.qty, 0)
  );

  // 折扣后：依赖 total+coupon，链路自动建立
  const discounted = computed(() =>
    coupon.value ? total.value * 0.9 : total.value
  );

  return { items, coupon, total, discounted };
});
// ✅ 未被读取的 discounted 永不执行；items 不变时 total 拿缓存值
// ❌ 把 total 写成普通函数 return→每次调用都重算、失去缓存，应包成 computed
```

**惰性 + 缓存**：只有 `total` 被读取且 `items` 确实变化时才重新计算——与组件 computed 行为一模一样。

## 带参数的 getter：返回函数

computed 本身不支持参数。Pinia 的做法是**让 getter 返回一个函数**：

```ts
// 目的：带参 getter——computed 不直接收参，让它返回一个函数来模拟
const itemsByCategory = computed(() => {
  return (category: string) =>                        // 外层 computed 依赖 items
    items.value.filter(i => i.category === category); // 内层函数接收参、现取现筛
});
// ✅ 调用 itemsByCategory.value('electronics') 拿到筛选结果
// ❌ 误当普通 computed 直接 itemsByCategory.value 使用→拿到的是函数本体而非数组
```

组件里：
```ts
// 目的：组件里消费带参 getter——先 storeToRefs 取 ref，再 .value(参) 调用
const { itemsByCategory } = storeToRefs(store);              // 保持响应式
const electronics = itemsByCategory.value('electronics');    // .value 拿到函数再传参调用
// ✅ 注意是 .value('electronics')：先解包 ref、再调用返回的函数
// ❌ itemsByCategory('electronics') 直接调用→漏了 .value，对 Ref 当函数调用报错
```

> ⚠️ 注意：返回函数模式下**缓存粒度变粗**——只要 items 变了，函数引用就换（旧结果全部失效）。不像 Vue 的 props 缓存按 key 分桶。

## Getter 里访问其他 getter

直接引用同 store 里的 computed 变量即可：

```ts
// 目的：getter 里引用同 store 的其他 getter——直接引用 computed 变量
const count = computed(() => items.value.length);
const averagePrice = computed(() =>
  count.value ? total.value / count.value : 0   // 引用 count/total 时 .value 取惰性求值
);
// ✅ items → total/count → averagePrice 链路自动建立，上游 dirty 才整链重算
// ❌ 写成 total / count（漏 .value）→拿 Ref 对象做除法得 NaN
```

响应式链路自动建立：items → total/count → averagePrice。

## Getter 里访问其他 Store（限制！）

**不能在 computed 里 `useOtherStore()`**——因为 getter 的执行时机不确定（惰性），此时 pinia 实例可能还没注册。

正确做法：在 action 里手动算并赋给一个 ref：

```ts
// 目的：跨 store 计算——不在 computed 里 useOtherStore，改到 action 里手动算
const combinedTotal = ref(0);

function recalcCombined() {
  const other = useOtherStore(); // action 里安全：调用时机确定、pinia 已注册
  combinedTotal.value = total.value + other.otherTotal;
}
// ✅ 跨 store 聚合放 action，由组件/其他 action 显式调 recalcCombined()
// ❌ 在 computed 里 useOtherStore()→getter 惰性执行时机不定，可能报 no active Pinia
```

## 对比 Options Store 的 getter

Options Store 的 getter 写法：
```ts
// 目的：Options Store 的 getter 写法——跨 getter 引用靠 this（对比 Setup 无 this）
getters: {
  double: (state) => state.count * 2,
  doublePlusOne(): number { return this.double + 1 }, // 跨 getter 引用用 this.double（需显式返回类型）
}
// ✅ Setup Store 无 this、直接引用 computed 变量即可，类型自然推断
// ❌ Options 里跨 getter 忘写返回类型注解→this 循环推断失败，TS 报 implicitly has type any
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
