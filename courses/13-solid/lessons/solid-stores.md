# createStore：深层对象与数组的"按路径订阅"

> 目标：把状态从"signal 存标量/整体替换"扩展到"store 存深层对象、按具体路径细粒度订阅"——理解 store 用 Proxy 懒建 signal、读写分离，掌握 setter 的**路径语法**（字符串键/索引/索引数组/`{from,to,by}` 范围/过滤函数/动态赋值）、对象**浅合并**、数组追加的 spread vs 路径两种反应差异，以及 `produce`（可变草稿）、`reconcile`（吸收服务端新数据做差量更新）、`unwrap`（拿裸对象出追踪作用域用）三件工具（呼应 solid-signals、solid-memo、svelte-reactive-runes）

## 一、为什么 signal 不够、要 store

官方一句话点题：signal "track a single value and trigger a full re-render when updated"（相对粗），而 store "maintain fine-grained reactivity by updating only the properties that change"。用 JS 的 **Proxy**，store 的响应性穿透到**嵌套属性与数组元素**，形成"一棵反应式数据树"。

```js
import { createStore } from "solid-js/store";

const [store, setStore] = createStore({
  userCount: 3,
  users: [
    { id: 0, username: "felix909", loggedIn: false },
    { id: 1, username: "tracy634", loggedIn: true },
  ],
});
```

选型：**标量/整体替换 → signal；深层嵌套对象/数组、要按字段局部更新 → store**（呼应 solid-signals 的相等短路那节）。

## 二、读：直接 `store.x`，且 signal 是"懒建"的

store 取值**不用函数调用**，直接 `store.userCount`、`store.users[0].username`——因为在追踪作用域里，Proxy 的 get 拦截就够了。

关键点：**创建 store 时并不立刻为每个属性建 signal**，signal 是**惰性**的——只有当你在某追踪作用域（JSX return、computed、`createEffect`）里读到那个路径时，才建立对应的订阅。

```js
console.log(store.users.at(-1));                 // ❌ 不在追踪作用域，不建依赖、不会更新
createEffect(() => console.log(store.users.at(-1)));   // ✅ 建依赖
```

这解释了 store 的很多"改了不更新"：**读没发生在追踪作用域里**而已。

## 三、写：setter 的"路径语法"

`setStore(key, newValue)` 是最基础形态。真正强的是**路径语法**：前几个参数描述"到目标值的路径"，最后一个给新值（或函数）。

```js
// 追加（用 length 当索引，直接改原数组、只通知 length/新索引相关订阅）
setStore("users", store.users.length, { id: 2, username: "new", loggedIn: false });
// 改某个字段
setStore("users", 0, "username", "felix_updated");
// 一次改多个属性（对象值 → 浅合并）
setStore("users", 1, { location: "USA", loggedIn: false });
// 多个索引一起改
setStore("users", [0, 2], "loggedIn", false);
// 范围改：from/to 含端点，可加 by 步长
setStore("users", { from: 1, to: store.users.length - 1, by: 2 }, "loggedIn", false);
// 过滤函数：按条件命中
setStore("users", (u) => u.location === "Canada", "loggedIn", false);
// 动态赋值：函数收旧值算新值
setStore("users", 3, "loggedIn", (prev) => !prev);
```

一个重要细节：**一次 setter 调用会自动包进 `batch`**——批量里所有元素一起更新完，才触发下游 effect，避免中间态反复通知。

## 四、数组：spread 追加 vs 路径追加，反应不同

同样"往数组加一项"，两种写法的**失效范围**不同：

```js
// A) spread：造新数组整体替换 → 依赖整个数组/其属性的 effect 全部失效
setStore("users", (cur) => [...cur, newItem]);
// B) 路径：直接给 length 位置赋值 → 只通知依赖"新索引/length"的订阅，更省
setStore("users", store.users.length, newItem);
```

**对象修改会浅合并**：`setStore("users", 0, { id: 109 })` 等价于 `setStore("users", 0, u => ({ ...u, id: 109 }))`——你不用手动 spread 旧字段。这两点是 store 相比"整体替换的 signal"更细粒度的直接收益。

## 五、三件工具：produce / reconcile / unwrap

```js
import { produce, reconcile, unwrap } from "solid-js/store";
```

- **produce**：把某段以"可变草稿"方式写，内部改多个字段、结束产出新版本，省掉一长串路径 setter。
  ```js
  setStore("users", 0, produce((u) => { u.username = "x"; u.loggedIn = true; }));
  ```
  注意：**produce 只支持数组和普通对象**，`Set`/`Map` 不兼容。
- **reconcile**：把"服务端/外部返回的一整份新数据"和现有 store **做 diff**，只更新真正变了的部分。典型：整表刷新但只有一行变了 → 只那一行触发更新。
  ```js
  setData("animals", reconcile(newData));   // 只有新增的 'koala' 触发更新
  ```
- **unwrap**：拿 store 背后的**裸对象**——用于传给"期待普通 JS 对象"的第三方库、或做非响应式快照、或出追踪作用域避免开销。

## 六、读写分离与嵌套 store（调试友好）

官方强调：store 把**读能力与写能力分开**（`store` 只读、`setStore` 才能写），便于追踪/管控"谁在改这个值"。还有个进阶技巧——对某分支单独建 store：

```js
const [users, setUsers] = createStore(store.users);   // 派生 store
setUsers((cur) => [...cur, newUser]);                  // 改动会回流到 store.users，读也同步
```

（依赖 `store.users` 已被设置过。）这让局部操作有独立 setter，但共享同一底层数据。

## 七、自检清单

1. 一句话讲清"signal 存值 vs store 存深层对象"的选型边界；store 靠什么机制穿透嵌套属性/数组元素？
2. store 的 signal 是"懒建"的——这会导致什么常见"改了不更新"bug？为什么 `console.log(store.x)` 直接写不响应、包进 `createEffect` 就响应？
3. 写出四种路径语法：改单字段 / 一次多属性(浅合并) / 范围 `{from,to,by}` / 过滤函数命中。为什么"一次 setter 自动 batch"重要？
4. 数组追加：spread 与"用 length 当索引的路径写法"在**失效范围**上有何不同？对象赋值时"浅合并"帮你省掉了什么手写操作？
5. `produce`、`reconcile`、`unwrap` 各解决什么问题？给"整表刷新但只变一行"选一个工具并说明它为何只触发那一行的更新。

🚀 下一关：solid-lifecycle——组件只执行一次，那"生命周期"还剩什么？`onMount`（渲染后一次、SSR 不跑）、`onCleanup`（按 Owner 树回收）、`createRoot`/dispose 如何界定"谁负责清理这些订阅"。
