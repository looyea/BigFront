# 面试题：DevTools 与 HMR（pinia-devtools）

### 1. (工具类) Vue DevTools 的 Pinia 面板展示了哪些信息？
**来源**：https://pinia.vuejs.org/cookbook/hot-module-replacement.html#devtools

展示所有已创建的 store 列表 → 每个 store 的 state（可展开编辑）+ getters（只读计算值）+ Actions 历史时间线。每条 action 显示名称、参数、调用后 state diff。支持时间旅行。

### 2. (实战类) acceptHMRUpdate 解决什么问题？原理是什么？
**来源**：https://pinia.vuejs.org/cookbook/hot-module-replacement.html

解决"store 文件热更新导致状态丢失"。原理：Vite HMR 通知 Pinia → Pinia 不销毁旧 store 实例，而是 patch 其 action/getter 引用到新模块 → state ref 保持指向同一值。组件侧无感。

### 3. (坑类) 没加 acceptHMRUpdate 会怎样？
**来源**：https://github.com/vuejs/pinia/discussions/1374

每次修改 store 文件 HMR 触发 → 模块被替换 → defineStore 重新执行 → 旧 state 被 GC → 组件里 store.count 回到初始值。开发体验极差。

### 4. (对比类) Pinia 时间旅行与 Redux DevTools 有何异同？
**来源**：https://pinia.vuejs.org/introduction.html#devtools

相同：都能"回放到任意历史点"。不同：Redux 记录每个 action 的完整 state 快照（内存开销大）；Pinia 记录 diff（$patch 增量）。Redux 支持 dispatch 历史 action；Pinia 的"跳回"只是 UI 展示，不真正 revert 当前 state。

### 5. (原理类) 为什么 DevTools 面板里 getter 不可编辑？
**来源**：https://pinia.vuejs.org/core-concepts/getters.html

getter 是 computed——只读。编辑它没有意义（值由 state 派生，改 state 即可改变 getter）。如果允许改 getter 返回值会破坏"单一数据源"原则。

### 6. (调试类) 如何定位"某个组件不必要的重渲染"与 Pinia 的关系？
**来源**：https://vuejs.org/guide/best-practices/performance.html

① Vue DevTools Performance 面板打开 Record → 触发操作 → 看 render 瀑布图里哪些组件被标红；② 结合 Pinia 面板 action 时间戳定位"哪次 state 变更导致的"；③ 确认组件是否 storeToRefs 后只用了部分字段（未用到的字段变更不应触发）。

### 7. (工具类) 如何在 production 禁用 DevTools 支持？
**来源**：https://pinia.vuejs.org/api/interfaces/Pinia.html#options

`createPinia({ devtools: false })` → 不记录 action 历史、不暴露 $state 给 DevTools 代理。也可 `import.meta.env.PROD && pinia.devtools = false`。

### 8. (性能类) 大量 action 历史会不会吃内存？
**来源**：https://github.com/vuejs/pinia/issues/1523

Pinia 默认只保留最近 60 条 action（可配 devtools.actionsMax）。超过后 FIFO 淘汰。$patch diff 本身很小。不像 Vuex 记录每个 mutation payload。

### 9. (实战类) 能否用 console 访问 Pinia store？
**来源**：https://pinia.vuejs.org/cookbook/hot-module-replacement.html

开发时 DevTools 面板可以。console 里需要 import：`import('/src/stores/counter.ts').then(m => m.useCounterStore())`。或把 store 实例挂到 `window.__pinia` 上（仅 dev）。

### 10. (原理类) Pinia 的 HMR 与 Vue 组件的 HMR 有什么交互？
**来源**：https://pinia.vuejs.org/cookbook/hot-module-replacement.html#hmr-support

store HMR（acceptHMRUpdate）只 patch store 本身。如果改了组件文件，组件正常 HMR 重渲但 store 不动。如果同时改了 store + 组件，Vite 按依赖图先更新 store（patch）再更新组件——不丢状态。

### 11. (TS类) DevTools 面板的 store id 来自哪里？
**来源**：https://pinia.vuejs.org/core-concepts/#define-store

defineStore 第一参数字符串即为 store.$id → DevTools 列表里展示此 id。如果两个 store 用同一 id（bug），后者覆盖前者。

### 12. (生态类) Pinia 有独立的 VS Code 扩展或 CLI 工具吗？
**来源**：https://github.com/vuejs/pinia/discussions/1071

目前无独立 VS Code 扩展——DevTools 面板是主要调试入口。有 pinia-vscode-snippets 插件提供 defineStore 快速代码片段。Nuxt 开发者可用 Nuxt DevTools 的 Pinia 模块。

### 13. (对比类) Svelte 5 runes 的调试体验与 Pinia 比较？
**来源**：https://svelte.dev/blog/depth-and-detail

Svelte 5 编译器编译时静态分析依赖 → 运行时极少开销但调试需看编译产物。Pinia 基于 Vue Proxy → DevTools 直观看到 reactive 对象。各有优劣。

### 14. (综合类) 如何写一个"自动截图当前 store 状态到日志"的插件？
**来源**：https://pinia.vuejs.org/core-concepts/plugins.html

```ts
export function snapshotPlugin({ store }) {
  let counter = 0;
  store.$subscribe((m) => {
    const log = { ts: Date.now(), action: m.type, state: JSON.parse(JSON.stringify(store.$state)) };
    sessionStorage.setItem(`snap_${store.$id}_${counter++}`, JSON.stringify(log));
  }, { detached: true });
}
```
可配合 DevTools 自定义面板读取 sessionStorage。

### 15. (最佳实践类) 团队里 Pinia DevTools 的使用规范建议？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

① 开发必装 Vue DevTools + 开 devtools=true；② 命名 action 语义化（fetchUsers 而非 doStuff）方便过滤；③ 避免一个 action 改 10 个不相关字段（拆分让 diff 可读）；④ $patch 对象形式在面板里显示为一行（函数形式显示为 function body）。
