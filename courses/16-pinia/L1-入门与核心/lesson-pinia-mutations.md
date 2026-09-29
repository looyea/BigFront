# 状态变更：直接赋值 / $patch / $subscribe

## 三种改值粒度

Pinia 去掉了 Vuex 的 mutation 层，改 state 有三种方式——从简单到复杂：

### 1. 直接赋值（最常用）

```ts
// 目的：直接赋值——最常用的改值方式，深属性也可直改
const store = useCounterStore();
store.count++;              // ✅ 触发响应式更新（等同 count.value++）
store.user.name = 'Tom';   // ✅ 深层属性也可，Vue Proxy 能追踪
// ✅ 临时 UI 态、单字段微改直接赋值最短路径
// ❌ 误以为需要像 Redux 那样 set(s=>({...s})) 返新对象→Pinia 不需不可变，直接赋即可
```

Setup Store 里的 ref 被 Pinia 包装成 reactive 对象，外部赋值等同 `.value = x`。

### 2. $patch 批量改

```ts
// 目的：$patch 对象形式——一次改多个字段，只触发一次通知
store.$patch({
  count: 10,
  name: 'Pinia',
});
// 一次通知，DevTools 只记录一条变更
// ✅ 表单 reset 回填/多字段同时改时用，DevTools 时间旅行更清晰
// ❌ 在对象形式里写 items: state.items.push(x)→对象形式不支持方法调用，应用下面函数形式
```

**何时用 $patch**：
- 同时改多个字段，想让 DevTools 记录为一次操作；
- 数组 push/splice（函数形式的 $patch）：

```ts
// 目的：$patch 函数形式——支持 push/splice 等无法用对象表达的批量修改
store.$patch((state) => {
  state.items.push({ id: 1, label: 'new' });   // 函数形式可直接改 draft
  state.loading = false;
});
// 对象形式不支持 push，函数形式可以
// ✅ 数组增删、复杂嵌套批量改走函数形式，仍是一次 DevTools 记录
// ❌ 对象形式 $patch({ items: ...push }) 把 push 当值执行→语义错乱，应改用函数形式
```

### 3. Action 封装（推荐业务逻辑走这里）

```ts
// 目的：action 封装——业务逻辑（改值+派生计算）收进一个函数，可追踪可单测
function addItem(item: Item) {
  items.value.push(item);                                        // 改 state
  total.value = items.value.reduce((s, i) => s + i.price, 0);    // 同步重算派生值
}
// ✅ 组件里 store.addItem(item)——改值+派生+日志都在一个函数里，DevTools 可追
// ❌ 把多步业务散在组件里直接改 store.items/store.total→无法集中追踪、难单测
```

组件里 `store.addItem(item)`——改值+派生计算+日志都在一个函数里。

> **规则**：组件里直接赋值适合"临时 UI 态"；$patch 适合"表单 reset 回填"；复杂业务逻辑一律走 action（可追踪、可单测）。

## $subscribe：监听 store 变化

```ts
// 目的：$subscribe 监听 store 任意变更——比 watch 免指定字段、能拿 mutation 来源
const unsubscribe = store.$subscribe((mutation, state) => {
  // mutation.type: 'direct' | 'patch object' | 'patch function'
  // mutation.storeId: 'counter'
  // mutation.events: 具体哪些字段变了
  console.log('state changed:', JSON.parse(JSON.stringify(state)));
  // 同步到 localStorage
  localStorage.setItem('counter', JSON.stringify(state));
});

// 组件卸载时停止监听
onUnmounted(() => unsubscribe());   // 记得手动退订，否则监听泄漏
// ✅ 不管何种方式改值都会触发，适合“变更后持久化”这类跨字段副作用
// ❌ 忘在 onUnmounted 里 unsubscribe()→组件销毁后监听仍在跑，重复写 localStorage/内存泄漏
```

`$subscribe` 在**任何方式**的 state 变更后触发（直接赋值、$patch、action 内部改动都算）。与 Vue 的 `watch` 区别：$subscribe 不需要指定具体字段、能拿到 mutation 来源信息。

### detached 选项

默认 $subscribe 绑定当前组件 scope，组件卸载自动清理。如需"全局监听不随组件销毁"：

```ts
// 目的：detached 选项——让监听不随当前组件 scope 销毁（全局监听）
store.$subscribe(callback, { detached: true });   // 组件卸载后仍继续监听
// ✅ 审计/全局持久化这类“跨组件生命周期”的监听用 detached: true
// ❌ 需要随组件销毁的普通监听也加 detached→组件走后回调仍跑，成为泄漏源
```

## $onAction：拦截 action 调用

```ts
// 目的：$onAction 拦截 action 调用——日志/埋点/权限，也是插件系统的基础
store.$onAction(({ name, args, after, onError }) => {
  console.log(`Action "${name}" called with`, args);   // action 开始时打印

  after((result) => {
    console.log(`Action "${name}" returned`, result);   // action 成功返回后
  });

  onError((error) => {
    console.error(`Action "${name}" failed:`, error);   // action 报错（含 async reject）
  });
});
// ✅ after/onError 回调异步 action 也能拿到最终结果/错误（await 后）
// ❌ 以为 $onAction 能拦截直接赋值 store.count++→它只监听 action，直改请用 $subscribe
```

用途：日志/埋点/权限拦截。$onAction 是插件系统的基础（L3 详讲）。

## 严格模式：阻止组件里直接改

开发时可选开启 `createPinia({ strict: true })`——此时**只有 action 和 $patch 能改 state**，组件直接赋值会 console.warn 提醒。生产无影响。

适合团队规范"所有状态变更必须通过 action"的场景。但 Pinia 官方不强制——默认允许直接赋值。

## 不可变更新需要吗？

不需要。Pinia 底层是 Vue Proxy 响应式——直接赋值就是它的设计路径。不需要像 Zustand/Redux 那样 `set(s => ({ ...s, count: s.count + 1 }))`。

如果想引入不可变约束（函数式偏好），可通过插件把 `$patch` 里的函数形式配合 immer 做 draft 修改——但这在 Vue 生态里不常见。

## 与 Vue reactive 的关系

如果你把 `defineStore` 的 setup 返回值理解为"一个 reactive 对象"，那 store 就是个**被 Pinia 管着的全局 reactive**。$subscribe 相当于 `watch(store, cb, { deep: true })`，DevTools 相当于给 watch 加了 mutation 来源标注。

## 部署预告

本地写一个带 $subscribe 的 counter store 即可验证。
