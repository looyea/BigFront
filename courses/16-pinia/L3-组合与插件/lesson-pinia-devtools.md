# DevTools 与 HMR 热更新

## Vue DevTools 的 Pinia 面板

安装 Vue DevTools 浏览器扩展后，Pinia store 自动出现在 **Pinia** 标签页：

- **State 树**：实时查看每个 store 的所有字段（含 getter 计算结果）
- **Actions 列表**：每次 action 调用记录名称、参数、返回值
- **变更 diff**：对比 action 前后的 state 变化（绿色高亮新增/修改）
- **编辑**：可直接在面板里点击字段值修改（dev-only，触发响应式更新）

## 时间旅行

点击 Actions 列表里的历史条目，state 面板跳转到那一刻的快照——类似 Redux DevTools 的时间旅行。但 Pinia 的实现更轻：只记录 action 调用栈 + $patch diff，不需要完整的 state 快照链（省内存）。

## 与 Vuex DevTools 对比

| 特性 | Vuex | Pinia |
| --- | --- | --- |
| mutation 记录 | ✅ | ❌（无 mutation 概念） |
| action 记录 | ✅ | ✅ |
| state diff | 粗粒度 | 细粒度（$patch 级别） |
| 编辑 state | ✅ | ✅ |
| 时间旅行 | ✅ | ✅ |
| 多 store 视图 | namespaced 树 | 独立卡片并列 |

## HMR：热更新不丢状态

Vite HMR 默认在模块变更时替换模块——但 store 文件变了一次，store 实例会被重建、状态丢失。Pinia 提供 `acceptHMRUpdate` 解决：

```ts
// stores/counter.ts
export const useCounterStore = defineStore('counter', () => { ... });

// 文件末尾加：
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCounterStore, import.meta.hot));
}
```

效果：修改 store 文件 → Vite HMR 触发 → acceptHMRUpdate **patch 现有 store 实例**（更新 action/getter 引用）→ state 值保持不变 → 组件无闪烁更新。

## 每个 store 文件都要加 HMR 代码吗？

是。除非用 `pinia-plugin-hmr` 自动注入（通过 Vite plugin 在构建时给每个 store 文件末尾加代码）。

## 调试技巧

1. **console.log 时机**：action 里 `console.log(getState())` 可能看到旧值（Vue scheduler 未 flush）。用 `nextTick` 后读。
2. **$subscribe 打变更日志**：`store.$subscribe((m, s) => console.log(m.type, JSON.parse(JSON.stringify(s))))` 追踪变更源。
3. **断点**：DevTools Sources 面板里直接在 store 源码里下断点——Pinia 不混淆、不包装。
4. **性能**：Vue DevTools 的 Performance 面板可看组件 render 瀑布图，结合 Pinia 的 action 时间线定位"哪次 state 变更触发了 N 个组件重渲"。

## 部署预告

本地开 Vue DevTools → 改 store 值 → 观察组件更新。改 store 文件 → 观察 HMR 不丢值。
