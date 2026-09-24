# 面试题：插件系统（pinia-plugins）

### 1. (概念类) Pinia 插件的本质是什么？和 Vue 插件有什么区别？
**来源**：https://pinia.vuejs.org/core-concepts/plugins.html

Pinia 插件是 `(context: PiniaPluginContext) => void | object` 函数——在每个 store 实例创建后自动调用。Vue 插件是 `{ install(app) }` 或函数——在 app.use() 时执行一次。Pinia 插件是每个 store 都跑一遍；Vue 插件是整个 app 跑一遍。

### 2. (实战类) 写一个自动记录 lastAction 的插件。
**来源**：https://pinia.vuejs.org/cookbook/plugins.html#adding-properties-to-stores

```ts
export function lastActionPlugin({ store, onAction }) {
  store.lastAction = '';
  onAction(({ name }) => { store.lastAction = name; });
}
```
每个 store 多一个 `lastAction` 属性，记录最近调用的 action 名。

### 3. (设计类) 插件 return 的对象能覆盖 store 已有属性吗？
**来源**：https://pinia.vuejs.org/core-concepts/plugins.html#extending-stores

不能。return 只能**添加新属性**，同名不覆盖（Pinia 用 Object.assign 语义但内部有保护）。要修改 state 用 `$patch`；要包装 action 用 `context.options` 里重写。

### 4. (坑类) 为什么持久化插件的 $subscribe 要 { detached: true }？
**来源**：https://pinia.vuejs.org/core-concepts/plugins.html#store-subscriptions

插件在 store 创建时执行，不在任何组件的 effectScope 里。如果不 detached，store 关联的第一个组件卸载后 $subscribe 被停——持久化失效。detached 让监听永驻。

### 5. (对比类) Pinia 插件 vs Vuex 插件 有何异同？
**来源**：https://vuex.vuejs.org/guide/plugins.html

Vuex 插件签名 `(store) => { /* subscribe */ }`——只有一个 store。Pinia 多了 onAction、options、app 等注入。Pinia 插件可 return 扩展 store；Vuex 只能 store.subscribe。Pinia 支持 per-store 配置（options 字段），Vuex 全局统一。

### 6. (进阶类) 如何实现"部分 store 持久化到 Cookie、部分到 localStorage"？
**来源**：https://pinia.vuejs.org/cookbook/plugins.html#example-adding-a-global-option-to-stores

defineStore 第四参数 `{ persist: { storage: 'cookie' } }`；插件里 `const target = options.persist?.storage === 'cookie' ? document : localStorage`。按 options 字段分流。

### 7. (测试类) 如何测一个插件的效果？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#testing-plugins

```ts
const pinia = createPinia();
pinia.use(myPlugin);
setActivePinia(pinia);
const store = useMyStore();
expect(store.lastAction).toBe('');
store.myAction();
expect(store.lastAction).toBe('myAction');
```

### 8. (性能类) 多个插件叠加对 store 创建性能的影响？
**来源**：https://github.com/vuejs/pinia/discussions/1567

每个插件是同步函数——10 个插件增加 <1ms。真正影响性能的是 $subscribe 回调频率（如 persist 每次变更都 JSON.stringify）而非插件注册本身。大 state 考虑 partialize 或 throttle subscribe。

### 9. (实战类) onAction 能做权限拦截吗？
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#adding-internal-properties-to-stores

可以：`onAction(({ name, args }) => { if (!permission.includes(name)) throw new Error('Forbidden') })`。抛错阻断 action 执行（不进入 action body）。

### 10. (生态类) 社区最流行的 Pinia 插件有哪些？
**来源**：https://github.com/vuejs/pinia#used-in-the-wild

① pinia-plugin-persistedstate（持久化，1.5k⭐）② pinia-plugin-fetch（Nuxt 数据拉取）③ @pinia/testing（mock 工具）④ pinia-undo（撤销/重做）⑤ pinia-composition（类 VueUse 组合工具）。

### 11. (TS类) 如何给 store 添加插件注入的新属性并有类型推断？
**来源**：https://pinia.vuejs.org/core-concepts/plugins.html#typing-custom-properties

```ts
declare module 'pinia' {
  export interface PiniaCustomProperties {
    lastAction: string;
  }
}
```
模块增强后所有 store 类型自动包含该属性。

### 12. (坑类) 插件里能改 options（如包装所有 action）吗？
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#partial-middleware

可以：`context.options.myAction = function(...args) { /* before */ return original.apply(this, args) }`。但 Setup Store 的 action 不暴露到 options 上——只能包装 Options Store。Setup Store 用 onAction 做切面。

### 13. (架构类) 插件、composable、mixin 三者定位区别？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

插件：全局横切关注点（persist/log/undo），对"所有 store"生效。composable：局部复用逻辑（useFetch/useLocalStorage），对"调用者"生效。mixin：Vue 2 遗留，已被 composable 取代。

### 14. (综合类) 设计一个完整的"持久化 + 版本迁移"插件。
**来源**：https://prazdevs.github.io/pinia-plugin-persistedstate/guide/advanced.html#migrating-persisted-state

```ts
export function persistMigrate({ store, options }) {
  const key = `pinia_${store.$id}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    const { data, version } = JSON.parse(raw);
    const migrated = options.persist?.migrate?.(data, version) ?? data;
    store.$patch(migrated);
  }
  store.$subscribe((_, state) => {
    localStorage.setItem(key, JSON.stringify({ data: state, version: options.persist?.version ?? 0 }));
  }, { detached: true });
}
```

### 15. (调试类) 插件执行顺序与 store 创建的时序图是什么？
**来源**：https://pinia.vuejs.org/core-concepts/plugins.html#store-creation-order

useXxxStore() → Pinia 创建 reactive state → 跑 getter/action setup → 按注册顺序依次调用 plugin1(store) → plugin2(store) → ... → store 实例 ready → 组件拿到代理对象。
