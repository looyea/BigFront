# 面试题：Vuex 迁移（pinia-migration）

### 1. (实战类) Vuex 迁移到 Pinia 的核心映射关系？
**来源**：https://pinia.vuejs.org/cookbook/migration.html
state→ref, getters→computed, mutations→删除(直接赋值/action), actions→async function, namespaced→独立 defineStore。

### 2. (工具类) 官方 codemod 工具能自动做什么？
**来源**：https://github.com/posva/vuex-to-pinia
转化 module 结构为独立 store 文件、删除 mutations、把 commit/dispatch 替换为直接调用。但不能处理跨模块引用——需手动。

### 3. (坑类) 迁移后 mapState/mapGetters 怎么改？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#typescript
Options API 用 mapStores(mapState(...))；Setup API 用 storeToRefs。

### 4. (设计类) 迁移期间两种 store 共存怎么处理互调？
**来源**：https://pinia.vuejs.org/cookbook/migration.html
组件层中转：组件里同时 useVuex 和 usePiniaStore，把 Vuex state 传给 Pinia action。不能直接跨库调用。

### 5. (实战类) 灰度迁移的推荐步骤？
**来源**：https://pinia.vuejs.org/cookbook/migration.html
①新功能全用 Pinia ②逐个 module 迁移 ③全局替换 useStore ④删除 Vuex 依赖。

### 6. (TS类) Vuex 里的大量 as/infer 在迁移后怎么处理？
**来源**：https://pinia.vuejs.org/core-concepts/入门与核心.html#setup-stores
全部删除——Setup Store 类型自动推断，不需要手动标注。

### 7. (测试类) 迁移后测试怎么改？
**来源**：https://pinia.vuejs.org/cookbook/testing.html
createLocalVue + new Vuex.Store → setActivePinia(createPinia())。commit/dispatch → 直接调 store.method()。

### 8. (对比类) 迁移后对打包体积的影响？
**来源**：https://bundlephobia.com/package/pinia
Pinia 1.2KB vs Vuex 10KB——减少约 9KB gzip。

### 9. (实战类) 迁移后 DevTools 需要配置吗？
**来源**：https://pinia.vuejs.org/introduction.html#devtools
不需要——安装 pinia 后 Vue DevTools 自动显示 Pinia 面板。

### 10. (综合类) 迁移检查清单？
**来源**：https://pinia.vuejs.org/cookbook/migration.html
✅ 无 namespaced 字符串 ✅ 无 mutations ✅ store 唯一 id ✅ 测试全绿 ✅ TS 零报错 ✅ DevTools 正确。

### 11. (坑类) Vuex 的 rootState / rootGetter 跨模块访问在 Pinia 里怎么替代？
**来源**：https://pinia.vuejs.org/core-concepts/state.html

在 action 里直接 useOtherStore() 读取对方 state/getter；跨 store 派生值用 watchEffect 同步到本地 ref 再被 getter 消费——不再有 rootState 概念。

### 12. (实战类) Vuex 严格模式（禁止 mutation 外改 state）迁移后如何保留这层约束？
**来源**：https://pinia.vuejs.org/core-concepts/best-practices.html

Pinia 没有严格模式开关。改用约定 + 工具：ESLint 规则限制组件内直接赋值、Code Review 把关、敏感写操作统一收敛到 action。

### 13. (TS类) Vuex 里的 InjectionKey、手动 Store 泛型样板迁移后还有价值吗？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#typescript

基本可以删除。Setup Store 从 ref/computed/function 自动推断类型，只保留业务模型自身的类型定义，去掉 createStore<S,A,G> 这类泛型样板。

### 14. (设计类) 一个上百 mutation 的超大 Vuex module 如何安全拆分到多个 Pinia store？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

先按 getter 的消费方聚类划出边界，再把 mutation 迁成对应 action，保留一层兼容 selector 让旧组件无感调用，分阶段灰度替换，最后删除旧 module。

### 15. (综合类) 迁移过程中如何保证线上不出现 regression？
**来源**：https://pinia.vuejs.org/cookbook/migration.html

双写过渡（Vuex 与 Pinia 并行）、feature flag 控制切流、E2E 覆盖核心链路、小比例灰度放量并准备一键回滚，验证稳定后再彻底移除 Vuex。
