# 插件系统：给所有 store 注入能力

## 什么是 Pinia 插件

Pinia 插件是一个函数，注册后对**每个新建的 store 实例**自动执行——类似 Express middleware 对每个请求生效。

```ts
// plugins/persist.ts
import type { PiniaPluginContext } from 'pinia';

export function myPlugin({ store, options, app }: PiniaPluginContext) {
  // store: 当前 store 实例
  // options: defineStore 的第四参数（自定义配置）
  // app: Vue app 实例
  console.log('Store created:', store.$id);
}
```

## 注册

```ts
const pinia = createPinia();
pinia.use(myPlugin);
// 或链式
pinia.use(pluginA).use(pluginB);
```

## 插件能做什么

| 能力 | API | 场景 |
| --- | --- | --- |
| 添加属性/方法 | `return { myRef: ref(0) }` 或 `store.myProp = ...` | 全局 lastUpdate 时间戳 |
| 修改/替换 state | `store.$state = { ... }` / `store.$patch(...)` | 持久化恢复 |
| 包装 action | `context.options.myAction = wrapper` | 重试/日志/权限 |
| 订阅变更 | `store.$subscribe(cb)` | 自动存 localStorage |
| 拦截 action | `onAction({ onError, after })` | 全局错误处理 |

## 实战：持久化插件

```ts
export function persistPlugin({ store, options }: PiniaPluginContext) {
  const key = `pinia_${store.$id}`;

  // 1. 恢复
  const saved = localStorage.getItem(key);
  if (saved) store.$patch(JSON.parse(saved));

  // 2. 自动订阅
  store.$subscribe((_, state) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { detached: true });
}
```

使用：`pinia.use(persistPlugin)` → 所有 store 自动持久化。

按需排除：在 defineStore 第四参数里标记：
```ts
defineStore('temp', () => { ... }, { persist: false });
```
插件里 `if (options.persist === false) return;`。

## 实战：撤销/重做插件

```ts
export function undoPlugin({ store }) {
  const history = ref<any[]>([]);
  const future = ref<any[]>([]);

  store.$subscribe((mutation, state) => {
    if (mutation.type === 'patch object' || mutation.type === 'patch function') {
      history.value.push(JSON.parse(JSON.stringify(state)));
      future.value = [];
    }
  }, { detached: true });

  store.undo = () => {
    const prev = history.value.pop();
    if (prev) {
      future.value.push(JSON.parse(JSON.stringify(store.$state)));
      store.$patch(prev);
    }
  };

  store.redo = () => {
    const next = future.value.pop();
    if (next) store.$patch(next);
  };
}
```

## onAction：只拦截 action 而非直接赋值

```ts
export function logPlugin({ onAction }: PiniaPluginContext) {
  onAction({
    name, args, store, after, onError
  }) {
    console.log(`[Store:${store.$id}] ${name}(${JSON.stringify(args)})`);
    after((ret) => console.log(`  → returned`, ret));
    onError((err) => console.error(`  ✗ ${err.message}`));
  }
}
```

`onAction` 只在**通过 store.someAction() 调用**时触发——直接 `store.count++` 或 `$patch` 不走此路径（但走 `$subscribe`）。

## 插件注册顺序

插件按 `use()` 顺序执行。持久化 → 撤销/重做 → 日志：先恢复数据，再记变更历史，最后打日志。

## 部署预告

本地新建一个 persist 插件，验证刷新后 store 状态不丢。
