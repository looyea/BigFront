# Pinia 是什么：取代 Vuex 的官方状态库

## 从 Vuex 的痛说起

如果你用过 Vuex 4，下面这些场景一定不陌生：

```ts
// Vuex 的"仪式感"：改一个 count 要写四层
const module = {
  state: () => ({ count: 0 }),
  mutations: { INCREMENT(state) { state.count++ } },  // 同步只能写这里
  actions: { inc({ commit }) { commit('INCREMENT') } }, // 组件只能 dispatch action
  getters: { double: (s) => s.count * 2 },
};
// 还有 namespaced 字符串路径、TypeScript 全靠 as 强转……
```

痛点总结：**mutation 冗余**（同步改 state 非要过一层 commit 字符串）、**module 割裂**（自动导入/跨模块引用要 rootState 绕路）、**类型推断几乎为零**。

Pinia 的口号就一句话——"把这些痛全部干掉"。它由 Vue 核心团队成员 posva（Anthony Fu 赞助）设计，Vue 3 官方文档已把 Pinia 列为**唯一推荐的状态库**，Vuex 进入维护模式。

## Pinia 做了什么

| Vuex 痛点 | Pinia 的解法 |
| --- | --- |
| mutations 多余 | 直接赋值 / `$patch` / action 里改 |
| 模块 namespaced 字符串 | 一个文件一个 `defineStore`，import 即可 |
| TypeScript 支持靠 plugin | 类型从 ref/computed 自动推断，零标注 |
| DevTools 体验一般 | 原生 Vue DevTools 面板、时间旅行、热更新 |
| Composition API 不亲和 | Setup Store 就是 setup 函数 |

## 两种写法：Setup Store vs Options Store

Pinia 提供两种定义 store 的方式：

```ts
// ===== Options Store（Vuex 用户上手友好，但推荐用 Setup）=====
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: (s) => s.count * 2 },
  actions: { inc() { this.count++ } },
});

// ===== Setup Store（推荐）=====
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);           // state
  const double = computed(() => count.value * 2); // getter
  function inc() { count.value++ } // action
  return { count, double, inc };
});
```

Setup Store 的好处：
- **与 Vue 组件的 `<script setup>` 完全同构**——ref 即 state、computed 即 getter、函数即 action；
- 类型推断天然正确，不需要 `ThisType` 或 `as`；
- 可以组合其他 composable（`useRouter()`、`useFetch()`）直接放进 store。

本包后续一律用 Setup Store 写法。

## 安装与注册

```bash
npm install pinia
```

```ts
// main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const app = createApp(App);
app.use(createPinia());   // 一行注册
app.mount('#app');
```

> **Nuxt 3 用户**：`npx nuxi module add pinia` 即可——SSR 水合自动处理（L4 详述）。

## 与 Composition API 的天然亲和

在 04-vue 包学过 `<script setup>` 和 `ref/computed/watch`。Pinia 的 Setup Store 就是一个 setup 函数，所有你已知的响应式工具在这里**原封不动工作**：

```ts
const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([]);
  const coupon = ref<string | null>(null);

  // 用 computed 做 getter
  const total = computed(() =>
    items.value.reduce((s, i) => s + i.price, 0) * (coupon.value ? 0.9 : 1)
  );

  // 用 watch 做副作用
  watch(total, (v) => localStorage.setItem('cartTotal', String(v)));

  // 组合其他 composable
  const { data: prices } = useFetch('/api/prices');

  return { items, coupon, total };
});
```

没有 mutation 字符串、没有 dispatch、没有 namespaced path——就是普通的响应式代码。

## Pinia vs Vuex 定位

| 维度 | Vuex 4 | Pinia |
| --- | --- | --- |
| Vue 版本 | 2 + 3 | 仅 3 |
| API 风格 | Options（store 配对象） | Setup（函数）/ Options 兼容 |
| 体积 | ~10KB gzip | ~1.2KB gzip |
| TypeScript | 手写推断极痛苦 | 自动推断 |
| DevTools | Vuex 面板 | Vue DevTools Pinia 面板 |
| 模块 | namespaced + rootState | 多 store import 直接组合 |
| 维护状态 | 维护模式 | 活跃开发 |

官方数据：**新 Vue 项目选 Pinia，不需要理由**。选 Vuex 才需要理由（比如 Vue 2 遗留）。

## 与 14-signals 包的衔接

在 14-signals 包学过 Zustand 的 za-core——三行 `create()` 一个 store。Pinia 的定位与之类似但更"Vue 原生"：
- Zustand 是 React 外部 store（走 useSyncExternalStore）；
- Pinia 直接活在 Vue 响应式系统内部（ref/computed 就是它的 state/getter），无额外桥接层。

两者的"哲学"相同：**少仪式感、类型友好、插件/中间件做增强**。差异来自框架生态。

## 部署预告

本关只需在本地 `npm create vue@latest`（选 Pinia 模板）跑通 counter 例子即可。CI/CD 部署在 L4 SSR 一关统一讲。
