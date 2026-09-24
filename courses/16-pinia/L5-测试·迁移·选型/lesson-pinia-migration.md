# Vuex 迁移实操

## 官方 Codemod 工具

```bash
npx @posva/vuex-to-pinia src/store
```

自动把 `src/store/modules/*.ts` 转成 `src/stores/*.ts`（Setup Store）。

预期管理：codemod 覆盖标准形态的 module（state/getters/mutations/actions 四件套直译），但动态 type 常量（`MutationTypes.SET_X`）、插件（vuex-persist/vuex-router-sync）、`subscribeAction` 类边角它不管——先跑 codemod 拿到 80% 机械翻译，剩下的手工按下方映射表收尾，别指望一条命令收官。

## 手动映射规则

| Vuex | Pinia |
| --- | --- |
| `state: () => ({ count: 0 })` | `const count = ref(0)` |
| `getters: { double: s => s.count*2 }` | `const double = computed(() => count.value*2)` |
| `mutations: { INCREMENT(s){s.count++} }` | 直接 `count.value++` 或包在 action |
| `actions: { inc({commit}){commit('INCREMENT')} }` | `function inc() { count.value++ }` |
| `namespaced: true + module` | 独立 `defineStore('module-name', ...)` |
| `rootState.other.value` | `useOtherStore().value`（action 里） |

mutation 的「同步追踪」价值在 Pinia 由 action 承担：DevTools 依然记录每个 action 调用与 state diff，只是不再强制「变更必经 mutation」这一板斧——迁移时若有代码依赖 `store.subscribe`（mutation 级订阅）需要改写为 `watch` 或 `onAction` 钩子，这是映射表之外最常漏的一处。

## 分阶段灰度策略

1. **新 store 全用 Pinia**——新增功能一律 defineStore；
2. **逐 module 迁移**——一个 Vuex module 对应一个 Pinia store，迁移后从 Vuex root 删除该 module；
3. **全局替换**——`useStore()` (Vuex) → 对应 `useXxxStore()`；
4. **删 Vuex**——所有 module 迁完，移除 `import { createStore } from 'vuex'`。

推进顺序建议「叶子优先」：先迁不被其他 module 引用的孤立 module，跨模块依赖（rootState/rootGetters）最重的核心 module 放最后——共存期互调不便的痛集中在依赖边上，先切边少的那头。

## 共存期注意事项

两种状态库可在同一 app 共存（app.use(pinia).use(vuex)）。但互调不便——Vuex module 不能直接 usePiniaStore，需通过组件中转。尽量缩短共存期。

## 检查清单

- [ ] 所有 store 有唯一 id（无 namespaced 前缀）
- [ ] mutation 调用全部替换为 action/直接赋值
- [ ] mapState/mapGetters/mapActions 替换为 storeToRefs + 直接调用
- [ ] TypeScript 错误清零（as/infer 全部移除）
- [ ] DevTools 里 Pinia 面板数据正确
- [ ] 测试全绿（setActivePinia 替代 createLocalVue+Vuex）

最后一环是 SSR 回归：Vuex 时代手写的「每请求 new Store + state 序列化水合」整段删除，Pinia 由 createPinia 自动接管（呼应 pinia-ssr）——迁移项目里 state 泄漏类 bug 常在这一段旧代码没删干净处复发，全局搜 `hybridState/__INITIAL_STATE__` 清剿。

## 部署预告

本地找一个小 Vuex 项目（或手写一个双 module store）走完整四步灰度：先跑 codemod、再手工补依赖边、测试全绿后删依赖；统计前后代码行数差——通常 300 行 Vuex 落到 180 行 Pinia，这就是迁移的说服力。
