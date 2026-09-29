# 插件系统：给所有 store 注入能力

## 什么是 Pinia 插件

Pinia 插件是一个函数，注册后对**每个新建的 store 实例**自动执行——类似 Express middleware 对每个请求生效。

```ts
// 目的：一个最小插件—每个新建 store 实例时自动执行一次
// plugins/persist.ts
import type { PiniaPluginContext } from 'pinia';

export function myPlugin({ store, options, app }: PiniaPluginContext) {
  // store: 当前 store 实例
  // options: defineStore 的额外配置项（第四参数）
  // app: Vue app 实例
  console.log('Store created:', store.$id);   // 新 store 创建即触发
}
// ✅ 插件对全局所有 store 统一注入能力，类 Express middleware 逐 store 生效
// ❌ 在插件里直接 return 一个非对象值→注入无效，要补充属性/方法需 return { ... }
```

## 注册

```ts
// 目的：注册插件——pinia.use() 可链式，按注册顺序逐个执行
const pinia = createPinia();
pinia.use(myPlugin);
// 或链式
pinia.use(pluginA).use(pluginB);   // 两者都注册，A 先于 B 对每个 store 执行
// ✅ 多个插件链式叠加，能力（持久化→日志）按 use 顺序组合
// ❌ 先 app.mount 后才 pinia.use(plugin)→已创建的 store 错过插件注入
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
// 目的：持久化插件——创建时先恢复，之后订阅变更自动存，无侵入地给全 store 加盘持久
export function persistPlugin({ store, options }: PiniaPluginContext) {
  if (options.persist === false) return;   // 按自定义配置排除特定 store
  const key = `pinia_${store.$id}`;

  // 1. 恢复：新实例先从 localStorage 回灌 state
  const saved = localStorage.getItem(key);
  if (saved) store.$patch(JSON.parse(saved));

  // 2. 自动订阅：之后任何变更都序列化写盘
  store.$subscribe((_, state) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { detached: true });   // 不随组件销毁
}
// ✅ pinia.use(persistPlugin) 后所有 store 自动持久化，刷新不丢数据
// ❌ 不判 options.persist 就全量存→含 token 等敏感 store 也被写进 localStorage（安全隐患）
```

使用：`pinia.use(persistPlugin)` → 所有 store 自动持久化。

按需排除：在 defineStore 第四参数里标记：
```ts
// 目的：按需排除——在 defineStore 第三/四参数标 persist: false
defineStore('temp', () => { ... }, { persist: false });   // 插件里靠 options.persist 识别
// ✅ 临时/UI 瞬态 store 标 persist:false，不进 localStorage
// ❌ 插件根本没读 options.persist→标了 false 也被持久化，排除失效
```
插件里 `if (options.persist === false) return;`。

## 实战：撤销/重做插件

```ts
// 目的：撤销/重做插件——订阅 patch 类变更存历史栈，提供 store.undo/redo 回放到快照
export function undoPlugin({ store }) {
  const history = ref<any[]>([]);   // 已发生状态栈
  const future = ref<any[]>([]);    // 被撤销的状态栈（供 redo）

  store.$subscribe((mutation, state) => {
    if (mutation.type === 'patch object' || mutation.type === 'patch function') {
      history.value.push(JSON.parse(JSON.stringify(state)));   // 深拷贝入历史
      future.value = [];             // 新操作清空 redo 栈
    }
  }, { detached: true });

  store.undo = () => {
    const prev = history.value.pop();
    if (prev) {
      future.value.push(JSON.parse(JSON.stringify(store.$state)));   // 当前态入 future
      store.$patch(prev);            // 回放到上一快照
    }
  };

  store.redo = () => {
    const next = future.value.pop();
    if (next) store.$patch(next);    // 前滚到下一快照
  };
}
// ✅ 只在 patch 类型入栈，避免把每次直改都存一份撑爆内存
// ❌ 快照用浅引用 state 本身→后续修改污染历史，undo 时拿到的已是最新值（需深拷贝）
```

## onAction：只拦截 action 而非直接赋值

```ts
// 目的：日志插件——用 onAction 拦截每次 action 调用（修正原代码的回调签名写法）
export function logPlugin({ onAction }: PiniaPluginContext) {
  onAction(({ name, args, store, after, onError }) => {   // 入参是一个解构对象，且为回调函数
    console.log(`[Store:${store.$id}] ${name}(${JSON.stringify(args)})`);   // 开始时打印调用
    after((ret) => console.log(`  → returned`, ret));     // action 成功后打印返回值
    onError((err) => console.error(`  ✗ ${err.message}`)); // action 报错（含 async reject）
  });
}
// ✅ after/onError 能接住异步 action 的最终结果/错误
// ❌ 写成 onAction({ name, args }){ ... } 这种无回调函数的对象字面量→语法错误、接不到任何调用
```

`onAction` 只在**通过 store.someAction() 调用**时触发——直接 `store.count++` 或 `$patch` 不走此路径（但走 `$subscribe`）。

## 插件注册顺序

插件按 `use()` 顺序执行。持久化 → 撤销/重做 → 日志：先恢复数据，再记变更历史，最后打日志。

## 部署预告

本地新建一个 persist 插件，验证刷新后 store 状态不丢。
