# L6 课后作业：状态管理 Pinia 与数据流设计

> 覆盖 **vue-pinia-basics / vue-pinia-advanced / vue-state-patterns** 三关。先读代码找 bug，再动手写，最后场景与简答。环境：Vue 3 + Pinia。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段为什么 `count` 不随 store 更新？怎么修（保留解构写法）？
```js
const { count } = useCounter();
```
>（呼应 vue-pinia-basics 第二节）

**2.** 下面解构里，哪些安全、哪些丢响应？
```js
const store = useTodos();
const { todos } = store;          // A
const { addTodo } = store;        // B
const { doneCount } = store;      // C (getter)
```
>（呼应 vue-pinia-basics 第二节、interview 第 5、6 题）

**3.** 这段每次改多个字段，devtools 里出现一大串记录、还多次触发更新。用什么 API 合并？
```js
store.a++; store.b = 2; store.list.push(x);
```
>（呼应 vue-pinia-advanced 第一节）

**4.** 想"每次 state 变化就写 localStorage"，用 `$onAction` 还是 `$subscribe`？为什么？（呼应 vue-pinia-advanced 第二节）

**5.** setup 式 store 里调 `store.$reset()` 报 undefined，为什么？怎么办？（呼应 vue-pinia-advanced 第三节）

**6.** 这段持久化有什么问题（安全角度）？
```js
persist: true   // user store: { token, name }
```
> token 该怎么办？（呼应 vue-pinia-advanced 第四节）

**7.** 有下面两个状态，指出"冗余同步"并改成派生：
```js
const price = ref(10), qty = ref(2), total = ref(20);
watch([price, qty], () => total.value = price.value * qty.value);
```
>（呼应 vue-state-patterns 第四节）

**8.** 两个组件各存了一份"当前用户"、互相不同步。按"作用域"原则应把它们放到哪里？（呼应 vue-state-patterns 第五节）

**9.** SSR 下用模块级单例 pinia 会导致什么严重后果？正确做法？（呼应 vue-pinia-advanced 第六节）

**10.** 组件里 `import { useCart } from ...;` 后在 `setup` 外的普通函数里 `useCart()`，偶发"no active pinia"。为什么？（呼应 vue-pinia-basics interview 第 12 题）

---

## 二、手写编程题（5 题）

**11.** 写一个 setup 式 `useCart`：`items`(ref 数组)、getter `total`、action `add/remove/clear`；在一个组件里用 `storeToRefs` 解构 `items/total`、直接解构 `add`。（呼应 vue-pinia-basics 第二、三节）

**12.** 给 `useAuth` 加异步 action `login(user)`：`fetch('/api/login')`（对接 09-express），成功后写 `token`、`profile` 到 state、失败写 `error`，全程 `loading` 管理。（呼应 vue-pinia-basics 第四节、vue-watch 竞态）

**13.** 写一个 `$subscribe`，把 `useSettings` 的 `{theme, locale}` 持久化到 localStorage（不持久化其它字段），并写一个 `hydrate()` 在启动读回。（呼应 vue-pinia-advanced 第二、四节）

**14.** 写一个 Pinia 插件 `piniaLogger`：用 `$onAction` 给每个 action 打印 name、耗时、错误。（呼应 vue-pinia-advanced 第二、五节）

**15.** 用"状态提升"改造：两个 `<ScoreBox>` 要共享"总分"。先把它提到共同父用 props+emit 实现；再说明在什么条件下你会改用 Pinia。（呼应 vue-state-patterns 第二、五节）

---

## 三、场景题（1 题）

**16.** 你在做一个"在线商城前端"，含商品浏览、购物车、结算、订单历史、用户中心。请设计状态：
- (a) 逐个判断这些状态放哪：① 商品列表接口结果 ② 加购数量 ③ 结算表单草稿 ④ 当前登录用户 ⑤ 搜索框临时输入。（呼应 vue-state-patterns 第一节）
- (b) 购物车要在多页共享、加购要有 toast、金额要随商品价刷新——哪些进 store、哪些是 getter 派生、哪些是 toast 用 composable？（呼应 vue-pinia-basics 第三、六节、vue-state-patterns 第四、五节）
- (c) 结算草稿要不要进 store？为什么它可能"有意复制一份"不算冗余反模式（呼应 vue-state-patterns 第六题）；
- (d) 购物车本地持久化，token 持久化，分别怎么做、放哪、注意什么安全？（呼应 vue-pinia-advanced 第四节）；
- (e) 若上 SSR，购物车 store 要注意什么？（呼应 vue-pinia-advanced 第六节）

---

## 四、简答题（3 题）

**17.** Pinia 相比 Vuex 的三点主要改进？为什么去掉 mutations？（呼应 vue-pinia-basics interview 第 2 题、第四节）

**18.** 说清 `$patch` / `$subscribe` / `$onAction` / `$reset` 各自的用途与注意事项（setup 式、detached）。（呼应 vue-pinia-advanced 第一~三节）

**19.** 用 single source of truth 解释："派生值不要另存、写操作要收敛、URL 也是状态"三条。（呼应 vue-state-patterns 第二、四节）

---

## 五、挑战题 🏆

**20.** 🏆 实现一个带**持久化 + 撤销**的 `useTodoStore`（setup 式）：
- state `todos`，actions `add/toggle/remove`；用 `$subscribe` 把 `todos` 持久化到 localStorage、启动 hydrate（但**跳过 hydrate 那次写入**，避免循环，呼应 vue-pinia-advanced interview 第 12 题）；
- 每次变更前把 `todos` 快照压入一个 `history` 数组，提供 `undo()`（`$patch` 回滚最近一步），`$patch` 撤销时**不再压栈**（区分"用户操作"与"回滚"）；
- 用 `$onAction` 记录动作日志供调试面板读取（呼应 vue-pinia-advanced 第二、五节）；
- 暴露 `pendingCount`/`doneCount` 为 computed，绝不另存（呼应 vue-state-patterns 第四节）；
- 写 Vitest 用例验证：add→undo 后 todos 还原、localStorage 与内存一致、hydrate 不触发多余写入（呼应 vue-testing L7、node-testing）。
