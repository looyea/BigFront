# Derived Atom：读依赖其他 atom

## 一、只读派生

```ts
// 目的：只读派生——传 getter 得到派生原子，get 即“拉值+登记依赖”，源变则订阅者自动更新
const firstNameAtom = atom('Ada');
const lastNameAtom = atom('Lovelace');
const fullAtom = atom((get) => get(firstNameAtom) + ' ' + get(lastNameAtom));   // 无初值只 getter → 只读
// ✅ 组件 useAtomValue(fullAtom) 即订阅两个源，改任一名都驱动 full 重算并更新该组件
// ❌ 想直接 set(fullAtom, 'x')→它是只读派生、没有 write，Jotai 报警/no-op，派生值只能由 firstName/lastName 驱动
```
fullAtom 无初值、只有 getter → 只读。任何源 atom 变化，读取 fullAtom 的组件自动更新。

getter 里的 `get` 是「拉取 + 登记依赖」二合一：没 get 的 atom 与本派生无关，源变了不惊动它——依赖图完全由函数体自己声明，无需任何配置数组（对比 useEffect 依赖数组手动维护之痛）。

## 二、惰性 + 缓存
派生 atom 惰性求值，Jotai 缓存其结果；依赖未变则不重算（与 Vue computed、Pinia getter 一致，呼应 pinia-getters）。

「惰性」的准确含义：**没人读就没有这次计算**——没有组件 useAtomValue(fullAtom)，改一万次 firstName 也不会跑 full 的 getter。这与 Zustand selector「每次 set 后对所有订阅者跑一遍」形成对照：派生成本只在被消费时发生。

## 三、派生可再派生
getter 里可 get 另一个派生 atom，构成依赖图/DAG。循环依赖会抛错。

```ts
// 目的：派生可再派生（DAG）——getter 里 get 另一个派生，源变沿图向下游各重算一次
const priceAtom = atom(100);
const qtyAtom = atom(2);
const subtotalAtom = atom((get) => get(priceAtom) * get(qtyAtom));            // 一级：小计
const taxAtom = atom((get) => get(subtotalAtom) * 0.1);      // 二级：税，依赖 subtotal
const totalAtom = atom((get) => get(subtotalAtom) + get(taxAtom));            // 三级：总价，汇 subtotal+tax
// ✅ 改 price 一次 → subtotal→tax→total 下游各重算一次，同帧合并成一次渲染
// ❌ 写出 a 依赖 b、b 又依赖 a 的环 → Jotai 抛“circular dependency”错，图无法建
```

改 price 一次：subtotal → tax → total 沿图向下游各重算一次，同帧合并成一次渲染（见 jo-dependencies）。链条越长越要警惕「末端一动、全链重算」的成本（jo-perf-test 有治理清单）。

## 四、与 Zustand selector / MobX computed 对比
- Zustand selector：每次 store 变化都重跑，不缓存。
- Jotai derived / MobX computed：惰性 + 缓存，依赖变才重算。
- Vue computed：同源思想（呼应 tc39-core、vue-computed-watch）。

面试深挖点：Zustand 的「不缓存」其实影响有限（selector 通常极轻），真正分化在**昂贵派生**（大列表过滤排序）——Jotai 把它写成 derived atom 就免费获得缓存，Zustand 侧要手写 memo 组合（reselect 思路）。派生即缓存，是原子范式最实在的红利。

## 五、可写派生（get+set）
atom(getter, setter) 可同时读依赖并写回源（见 jo-write-only），实现 v-model 式双向。

```ts
// 目的：可写派生（get+set 双函数）——读是换算、写是换算回源，UI 无需知道底层存储格式
const celsiusAtom = atom((get) => ((get(fahrenheitAtom) - 32) * 5) / 9);   // 纯读派生：华氏→摄氏
const tempAtom = atom(
  (get) => get(celsiusAtom),                                               // 读：给 UI 摄氏值
  (get, set, next: number) => set(fahrenheitAtom, (next * 9) / 5 + 32)     // 写：把摄氏换算回华氏源
);
// ✅ 组件 set(tempAtom, 20) 传摄氏，底层华氏自动算成 68 写入——双向映射对调用方透明
// ❌ 只给第一个 getter 参数、漏写第二参→tempAtom 退化成只读，dispatch(set) 时报错/不生效
```

读是派生、写是换算回源——「受控表单字段映射到不同存储格式」的标准解法，UI 层完全无需知道底层存的是华氏。

## 六、三个常见误用

1. **把派生当缓存容器**：`atom((get)=>get(listAtom).filter(...))` 每次依赖变必重算——它不是 memo 工具，重计算量大时考虑把输入拆细或降级到 action 里预计算。
2. **getter 里做副作用**：getter 可能被任意次求值/丢弃（并发渲染），埋点、fetch、set 别的 atom 都禁止——副作用归 write（jo-write-only）。
3. **在 getter 里条件 get**：`if (flag) get(a)` 会让依赖集随分支变化——这是特性不是 bug（切 flag 自动换订阅），但依赖集必须**只由 get 调用决定**，用变量控制 get 与否要心中有数。

## 小结
派生 atom = 惰性缓存的只读计算，靠 get 建立依赖图；可写派生做「读换算 + 写回源」；昂贵计算放进派生即自带 memo，副作用与条件依赖是两大纪律线。

## 部署预告
本地写 price/qty/subtotal/tax/total 五级链，React DevTools Profiler 里改一次 price 数重渲次数；再把某层 getter 加 console.log 验证「没人读就不算」。
