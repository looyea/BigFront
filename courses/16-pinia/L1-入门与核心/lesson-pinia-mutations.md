# 状态变更：直接赋值 / $patch / $subscribe

## 三种改值粒度

Pinia 去掉了 Vuex 的 mutation 层，改 state 有三种方式——从简单到复杂：

### 1. 直接赋值（最常用）

```ts
const store = useCounterStore();
store.count++;              // ✅ 触发响应式更新
store.user.name = 'Tom';   // ✅ 深层属性也可
```

Setup Store 里的 ref 被 Pinia 包装成 reactive 对象，外部赋值等同 `.value = x`。

### 2. $patch 批量改

```ts
store.$patch({
  count: 10,
  name: 'Pinia',
});
// 一次通知，DevTools 只记录一条变更
```

**何时用 $patch**：
- 同时改多个字段，想让 DevTools 记录为一次操作；
- 数组 push/splice（函数形式的 $patch）：

```ts
store.$patch((state) => {
  state.items.push({ id: 1, label: 'new' });
  state.loading = false;
});
// 对象形式不支持 push，函数形式可以
```

### 3. Action 封装（推荐业务逻辑走这里）

```ts
function addItem(item: Item) {
  items.value.push(item);
  total.value = items.value.reduce((s, i) => s + i.price, 0);
}
```

组件里 `store.addItem(item)`——改值+派生计算+日志都在一个函数里。

> **规则**：组件里直接赋值适合"临时 UI 态"；$patch 适合"表单 reset 回填"；复杂业务逻辑一律走 action（可追踪、可单测）。

## $subscribe：监听 store 变化

```ts
const unsubscribe = store.$subscribe((mutation, state) => {
  // mutation.type: 'direct' | 'patch object' | 'patch function'
  // mutation.storeId: 'counter'
  // mutation.events: 具体哪些字段变了
  console.log('state changed:', JSON.parse(JSON.stringify(state)));
  // 同步到 localStorage
  localStorage.setItem('counter', JSON.stringify(state));
});

// 组件卸载时停止监听
onUnmounted(() => unsubscribe());
```

`$subscribe` 在**任何方式**的 state 变更后触发（直接赋值、$patch、action 内部改动都算）。与 Vue 的 `watch` 区别：$subscribe 不需要指定具体字段、能拿到 mutation 来源信息。

### detached 选项

默认 $subscribe 绑定当前组件 scope，组件卸载自动清理。如需"全局监听不随组件销毁"：

```ts
store.$subscribe(callback, { detached: true });
```

## $onAction：拦截 action 调用

```ts
store.$onAction(({ name, args, after, onError }) => {
  console.log(`Action "${name}" called with`, args);

  after((result) => {
    console.log(`Action "${name}" returned`, result);
  });

  onError((error) => {
    console.error(`Action "${name}" failed:`, error);
  });
});
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
