# 依赖注入：provide 与 inject

> 目标：当一棵组件树很深，靠 props 一层层往下传同一份数据（"prop drilling"）非常累。`provide`/`inject` 提供**跨层级的依赖注入**：祖先 `provide(key, value)`，任意后代 `inject(key)` 直接拿。本课掌握其机制、**与响应式结合保持更新**、**用 Symbol/InjectionKey 避免 key 冲突**、**注入默认值**、以及"何时该用、何时是反模式"。（呼应 vue-component-basics 的 props-down、02-ts InjectionKey、node-config 的显式依赖观）

---

## 一、基本用法

```vue
<!-- 祖先 -->
<script setup>
import { ref, provide } from 'vue';
const theme = ref('dark');
provide('theme', theme);            // 提供一个可注入的依赖（这里传的是 ref 本身）
</script>

<!-- 任意后代（哪怕中间隔了多层不关心的组件） -->
<script setup>
import { inject } from 'vue';
const theme = inject('theme');       // 拿到那个 ref
</script>
<template><div :class="theme">…</div></template>
```

- 在** `<script setup>` / setup() 中同步调用**（依赖当前组件实例）；
- 注入沿组件树**向上查找**，最近的一个 provider 生效（类似原型链/作用域链查找，呼应 ES 包作用域链）；
- **传 ref/reactive 本身**（而非 `.value`）才能保持响应式更新。

---

## 二、保持响应式 + 更新函数

普通值 `provide('name', 'k')` 是**一次性快照**，之后不会更新。要保持响应式，两种正解：

```js
// ① 直接提供响应式源
provide('theme', theme);            // theme 是 ref/reactive

// ② 提供"读 + 改"的封装（推荐给全局状态，避免后代乱改）
const count = ref(0);
provide('counter', {
  count,
  inc: () => count.value++,         // 变更集中在这里，可加日志/校验
});
```
> 传 reactive 对象给后代"就地修改"会破坏单向数据流；更稳妥的是**同时提供修改函数**，让变更可控可追踪（呼应 vue-component-basics interview 第 12 题、vue-state-patterns）。

---

## 三、key：字符串 vs Symbol vs InjectionKey

`provide('theme', …)` 用字符串做 key，**父子/兄弟库之间极易撞名**（都注入了 `'theme'`）。规避：

```js
// 用 Symbol 保证唯一
export const THEME_KEY = Symbol();
provide(THEME_KEY, theme);
const theme = inject(THEME_KEY);
```

TypeScript 里用 **`InjectionKey`** 把 key 和值类型绑起来，注入端自动推断类型：

```ts
import type { InjectionKey, Ref } from 'vue';
export const THEME: InjectionKey<Ref<string>> = Symbol('theme');

provide(THEME, theme);                 // theme 必须是 Ref<string>
const t = inject(THEME);               // t: Ref<string> | undefined，类型自动
```
这就是 02-ts generics 的实战：`InjectionKey<T>` 本质是带类型标签的 unique symbol（呼应 02-ts、vue-sfc 类型化 props 同源）。

---

## 四、注入默认值与"必须提供"

```js
// 找不到 provider 时用默认值，避免 undefined（第三个参数）
const theme = inject('theme', 'light');

// 需要"必须有"：给默认值 + 工厂，或直接断言
const store = inject(STORE_KEY, () => createStore(), true);  // 第三参 true = 默认值可为工厂/允许函数

if (!user) throw new Error('UserProvider 必须在上层 provide(user)');
```

- 不传默认值且没有 provider → 返回 `undefined`（并可能告警）；
- 传默认值可**降级**（库组件单独使用时更健壮）；
- 需要强制约束就拿到后判空抛错（fail fast，呼应 node-config 启动校验）。

---

## 五、provide/inject 的定位与边界

| 通信方式 | 适用 |
|---|---|
| props / emits | **父子直连**、显式契约（首选） |
| slot / 作用域插槽 | 父定制子的**内容** |
| **provide / inject** | **跨多层**、".Provider/.Consumer"式能力注入（主题、路由实例、表单 field↔form、i18n） |
| Pinia（L6） | **跨兄弟/全局**共享状态与业务逻辑 |

- provide/inject 建立的是**隐式依赖**（后代没写 props 就悄悄依赖祖先）——用得好解耦、用不好难追踪；
- Vue Router、Pinia、很多组件库的"父子约定"（`<Form>`+`<FormItem>`）底层就是它（呼应 vue-router 的 `useRouter`、vue-pinia）。

> **反模式警告**：别把 provide/inject 当"全局变量垃圾桶"到处塞。数据流要保持可预测：能 props 显式传就优先显式；只有"横切关注点/深层配置"才用注入（呼应 vue-state-patterns 避免冗余/隐式状态）。

---

## 六、自检清单

- [ ] provide/inject 解决什么问题？查找方向是怎样的？
- [ ] 传普通值为什么不更新？要保持响应式该传什么？
- [ ] 为什么用 Symbol / InjectionKey 而不是字符串 key？
- [ ] inject 的默认值参数怎么用？"必须有"怎么保证？
- [ ] 什么时候该用 props/emits、什么时候 provide/inject、什么时候 Pinia？

---

## 🚀 部署预告

- "provide 一个带修改函数的对象"这套，正是 **vue-composables（L4）** 里"把状态 + 行为打包成可注入上下文"的基础；表单 `<Form>`/`<FormItem>`、`<Tabs>`/`<TabPanel>` 等父子组件全靠它协作；
- 当共享范围越过一棵子树、需要跨页面/全局时，升级为 **vue-pinia（L6）**；provide/inject 可理解为"局部版、显式挂树的 store"；
- Vue Router 的 `useRoute/useRouter` 内部也是注入（呼应 vue-router L5）。

下一关进入 **vue-composables**：用 `useXxx()` 组合式函数复用"有状态逻辑"，替代 mixins，并用 `effectScope` 管理副作用生命周期。
