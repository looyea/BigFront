# Vue 3 性能优化

> 目标：Vue 3 的快，一半来自编译器**自动做的优化**（静态提升、`patchFlag`/`block` 树、`hoists`），一半来自你**别亲手把它们抵消掉**。本课讲清：编译期为什么能跳过静态节点、`v-memo`/`v-once` 何时手动兜底、`shallowRef`/大列表为什么别整棵深度代理、虚拟滚动、`key` 与 diff 的关系、组件级代码分割与预加载，最后落到**生产构建分析**（呼应 vue-reactivity-theory 的 Proxy/懒代理、vue-conditional-list 的 key、vue-sfc-compiler-macros 的编译期、10-vite build 分包与产物）。

---

## 一、编译器替你做的优化：静态提升 & patchFlag

模板会被编译成 render 函数。编译器在编译期就把模板分了类：

- **静态提升（hoist）**：完全不变的节点/属性只创建一次，提到 render 外层复用，每次渲染不再重新 `createVNode`：
  ```html
  <div class="card">            <!-- class 永远不变 → 提升为常量 -->
    <span class="label">状态：</span>   <!-- 纯静态 → 整段提升 -->
    {{ status }}                <!-- 唯一动态点 -->
  </div>
  ```
- **`patchFlag`（差分标记）**：给动态节点打标签（`TEXT=1`、`CLASS=2`、`PROPS=4`、`FULL_PROPS=8`、`STYLE=16`……），更新时 Vue 只看被标记的那一处，而**不是逐条 diff 所有属性**（呼应 vue-reactivity-theory 的按需更新思路）。
- **`block` 树**：动态节点串成一条"快线"，patch 时沿 block 直接跳，跳过中间静态内容。

一句话：**写得越"静态"，编译器提升得越多、patchFlag 越精确**。

---

## 二、v-once / v-memo：把"静态"显式告诉编译器

有些"其实不变"的东西编译器判断不了（依赖外部、复杂表达式），可手动标记：

- **`v-once`**：元素/子树只渲染一次，之后完全跳过：
  ```html
  <header v-once>这段永远不变</header>
  ```
- **`v-memo`**：按依赖数组缓存子树，依赖不变就复用上次的 VNode（对**大 `v-for`** 尤其有效）：
  ```html
  <li v-for="item in list" :key="item.id"
      v-memo="[item.selected === props.selected]">
    <!-- 只有该项的 selected 变了才重渲染，其余整段跳过 -->
  </li>
  ```
  `v-memo` 相当于"给这段一个 computed 式的缓存"，别忘了它要求配 `:key`（呼应 vue-conditional-list 的 key 一节）。

---

## 三、别过度响应式：shallowRef 与大列表

深度 `reactive`/`ref` 会**懒代理**整棵嵌套对象（呼应 vue-reactivity-theory Proxy），对上万条只读明细、图表数据、ECharts 实例，代理开销和 track 成本都很高：

```js
const list = shallowRef([]);           // 只追踪 .value 的替换
list.value = newList;                  // ✅ 整体替换触发更新
// list.value[0].x = 1;                // ❌ 深层改动不触发（这是特性）
list.value.push(x); triggerRef(list);  // 非要原地改，手动 triggerRef
```
- 大列表/不可变数据优先 `shallowRef` + 整体替换；
- 纯常量（不参与 UI 的大配置、字典）用 `markRaw`/`Object.freeze` 免代理（呼应 vue-reactivity-theory 的 markRaw/customRef）；
- 组件里能用 `computed` 派生就别再多存一份响应式（呼应 vue-state-patterns 的 single source of truth）。

---

## 四、虚拟滚动：只渲染视口内的 DOM

万级列表真正的杀手不是响应式，是**几万个 DOM 节点**。虚拟滚动只渲染可视区域 + 缓冲区：

```
总高 = 条数 * 行高
可见起始 = floor(scrollTop / 行高)
渲染 slice = list[start - buffer .. end + buffer]
用 transform/padding-top 把这段"顶"到正确位置
```
可用 `vue-virtual-scroller`、`@vueuse/core` 的 `useVirtualList`，或配合 `shallowRef`。要点：定高最省，变高要预估+测量回流（呼应 vue-conditional-list v-for 的性能讨论）。

---

## 五、key 与 diff：让复用命中

`v-for`/条件分支的 `key` 是 diff 算法判断"能否复用节点"的依据：

- 用**稳定唯一 id**，别用 index——逆序/删除时 index 会变，导致大量错误重渲染甚至状态错位（呼应 vue-conditional-list）；
- 切换 `v-if` 分支时给不同分支**不同 key**，强制重建而非复用（表单场景常见坑）。

---

## 六、组件级代码分割与预加载

首屏只加载需要的 chunk：

- **路由懒加载**：`component: () => import('./Views/X.vue')`（呼应 vue-router-guard-lazy）；
- **异步组件**：`defineAsyncComponent(() => import('./Heavy.vue'))` 把重组件/弹窗延后（呼应 vue-async-suspense）；
- **预加载**：鼠标 hover/空闲时提前 `import()` 下一个路由 chunk，点击即秒开；
- 这些 `import()` 就是 Vite/Rollup 的**分包点**，产物如何 hash、拆 vendor 见 **10-vite build / vue-deploy（L8）**。

---

## 七、生产构建分析

优化别拍脑袋，先测量：

- `vite build` 后看 chunk 体积，`rollup-plugin-visualizer` / `vite-plugin-visualizer` 出 treemap 找"体积大户"（呼应 10-vite）；
- Vue Devtools 的 **Perf/组件渲染耗时** 面板定位重渲染热点；
- 浏览器 Performance 面板 + `app.config.performance = true`（开发环境打点组件渲染）；
- 上线前确认：生产构建（非 dev）、`shallowRef` 生效、大列表虚拟滚动、路由分包。

---

## 八、自检清单

- [ ] 静态提升和 patchFlag 分别在优化"创建"和"更新"的哪一步？
- [ ] `v-memo` 适合什么场景？它和 `:key`、computed 缓存的关系？
- [ ] 上万条只读数据为什么用 `shallowRef`？原地改了怎么触发更新？
- [ ] 虚拟滚动解决的是响应式开销还是 DOM 开销？
- [ ] 哪些 `import()` 写法会成为 Vite 的分包点？

---

## 🚀 部署预告

- 本课的"编译期优化"承接 **vue-sfc-compiler-macros**——宏用对了，编译器才更好做静态提升与 patchFlag；
- `shallowRef`/懒代理/`triggerRef` 的机制根因见 **vue-reactivity-theory**；`key`/diff 见 **vue-conditional-list**；分包/预加载的产物落地见 **10-vite** 与 **vue-deploy（L8）**；
- 性能优化最终要能被**验证**——下一关 **vue-testing** 讲用 Vitest + Vue Test Utils 给组件行为上锁，防止"改快了三毫秒、埋了个 bug"。

下一关进入 **vue-testing**：`@vue/test-utils` 的 mount/shallowMount、find/触发事件/断言 props+emit、mock Pinia/Router，以及快照测试的边界（呼应 node-testing 的 test runner 思想）。
