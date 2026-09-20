# 状态管理与单向数据流设计

> 目标：会用 store 只是工具层，**如何组织状态**才是架构能力。本课把 L1~L6 串成一套"数据流设计观"：**什么状态该放哪里**（局部 / 提升 / 共享 / 服务端缓存）、**props-down / events-up** 的单向数据流、**v-model 双向的本质**、**组合式函数 vs store 的边界**、**状态提升**、以及最重要的反模式——**避免"同一份真相被复制成多处同步"**（single source of truth）。（呼应 vue-reactivity、vue-composables、vue-pinia、vue-provide-inject）

---

## 一、先分类：状态有四种"家"

| 类型 | 例子 | 放哪 |
|---|---|---|
| **UI 局部状态** | 输入框草稿、展开/收起、hover | 组件内 `ref`（呼应 vue-reactivity） |
| **可复用局部逻辑** | 鼠标追踪、防抖、弹窗开合 | **composable**（每组件一份，呼应 vue-composables） |
| **跨组件共享业务状态** | 登录用户、购物车、主题 | **Pinia store**（单例，呼应 vue-pinia） |
| **一棵子树内的共享** | 表单 field↔form、Tabs 面板 | **provide/inject**（呼应 vue-provide-inject） |
| **服务端数据缓存** | 列表、详情接口结果 | store + 请求态，或数据层（TanStack Query 思路） |

判断口诀：**作用域有多大，状态就放多小**——能留组件内就别提升，能用 computed 派生就别再存一份。

---

## 二、props-down / events-up：单向数据流的骨架

```
父 ──props──▶ 子        数据向下流
父 ◀──emits── 子        变更向上报告
```
- 子**不直接改**父的数据（呼应 vue-component-basics 单向流），而是 `emit` 让父决定怎么改；
- 层级很深时，props 一路往下传很累 → 用 provide/inject（局部）或 store（全局）；
- 但"共享"不等于"随便改"：写操作仍应收敛到**一处**（provider 的 action、store 的 action），保持可追踪（呼应 vue-pinia interview 第 8 题、provide-inject 第二节）。

---

## 三、v-model 双向绑定的"真相"

```vue
<MyInput v-model="text" />   ≡   <MyInput :model-value="text" @update:model-value="text = $event" />
```
所谓"双向"，仍是**props 向下（值）+ emit 向上（变更）**的组合糖，本质上仍单向（呼应 vue-component-basics 第五节）。理解这点就不会以为"v-model 是魔法、可以随便乱改"——多个 `v-model:x`、修饰符也都是这套机制。

---

## 四、Single Source of Truth：最该戒的反模式

**同一份信息被复制成多份、再靠 watch/手动同步保持一致**，是一切 bug 之源。

```js
// ❌ 冗余 + 手动同步：全名和名、姓各存一份
const first = ref('A'), last = ref('B'), full = ref('A B');
watch([first, last], () => full.value = first.value + ' ' + last.value);

// ✅ 只存"真相"(first/last)，full 用 computed 派生
const full = computed(() => `${first.value} ${last.value}`);
```
准则：
1. **派生值一律 computed/getter，不另存**（呼应 vue-reactivity 第四节、vue-watch interview 第 2 题、pinia getters）；
2. **别把服务端数据到处复制**——缓存集中一处（store/query），组件读同一份；
3. **本地编辑副本要显式**（"表单草稿"是有意为之，非"同步 bug"，提交后再回写源）；
4. URL 也是一种状态来源：路由 query/params 与筛选态同步，用 `router.replace` 而非到处存（呼应 vue-router-nested-dynamic 第五节）。

---

## 五、状态提升 vs 下放

- **提升(lifting)**：两个组件要共享一份状态 → 提到**共同父**持有，父下传子回抛（props/events）。共享范围扩大再升级 store；
- **下放/就地**：只有单组件用 → 别提升到 store，避免"全局化一切"。过度全局化 = 到处 import store、耦合飙升、测不动（呼应 vue-pinia-basics 第六、十题）。

`composable` 是"可复用的就地状态逻辑"，`store` 是"共享的集中状态"——**复用逻辑≠共享状态**，这条线要分清（呼应 vue-composables interview 第 4、11 题）。

---

## 六、把数据流"画"出来（可预测性）

一个健康的 Vue App 数据流应是**有向、可回溯**的：
```
用户事件 → action/emit → 唯一状态源(store/父) → 响应式 → computed 派生 → 组件 render
```
任一时刻"这个值从哪来、谁改它"都能一眼追溯。若某状态有**多个写入点散落各处**、或**两份状态互相同步**，就是重构信号（呼应 vue-project-architecture）。

---

## 七、自检清单

- [ ] 拿到一个状态，你会按什么顺序判断它放组件/composable/store/inject？
- [ ] props-down/events-up 的图能画出来吗？深层传递怎么升级？
- [ ] v-model 是"真双向"吗？它底层是什么？
- [ ] 举一个"冗余同步"的例子并改成 computed。
- [ ] "复用逻辑"和"共享状态"分别对应什么工具？

---

## 🚀 部署预告

- 本课是 L1~L6 的"合流"：响应式(L1)、组件契约(L3)、注入(L4)、组合式(L4)、路由态(L5)、store(L6) 在同一套**单向数据流**观下各归其位；
- 具体到"目录怎么组织 store/composables/views、错误与数据流兜底"，进入 **L7**：先看 **vue-sfc-compiler-macros**（`<script setup>` 宏如何把上面这些 API 用编译期糖写得更干净）。

L6 完成。下一关进入 **L7**：SFC 编译器与宏——`defineProps/defineEmits/defineModel/defineExpose/withDefaults` 与 `<style scoped>`/`:deep()`/CSS `v-bind`。
