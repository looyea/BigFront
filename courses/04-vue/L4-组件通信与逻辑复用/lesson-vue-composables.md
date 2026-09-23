# 组合式函数（Composables）

> 目标：组合式函数是 Vue 3 复用**有状态逻辑**的核心手段——一个以 `use` 开头、内部用到响应式 API 的普通函数。本课掌握 **`useXxx` 约定与在 setup 中调用**、**返回 ref/reactive/toRefs 的取舍**、**可组合（composable 套 composable）**、**副作用清理与 `effectScope`/`onScopeDispose`**、为何它**取代 mixins**，以及像 VueUse 这样的通用库思路。（呼应 vue-reactivity-theory toRefs、vue-lifecycle、vue-provide-inject）

---

## 一、什么是组合式函数

```js
// useMouse.js —— 一个"追踪鼠标位置"的可复用逻辑
import { ref, onMounted, onUnmounted } from 'vue';

export function useMouse() {
  const x = ref(0), y = ref(0);
  function update(e) { x.value = e.pageX; y.value = e.pageY; }
  onMounted(() => window.addEventListener('mousemove', update));
  onUnmounted(() => window.removeEventListener('mousemove', update)); // 自带清理
  return { x, y };
}
```
```vue
<script setup>
const { x, y } = useMouse();   // 在 setup 里调用，拿到响应式状态
</script>
<template>{{ x }}, {{ y }}</template>
```

**约定（不是硬性 API）**：
- 命名以 **`use`** 开头；
- 内部使用响应式 API（`ref`/`reactive`/`computed`/`watch`/生命周期钩子）；
- **必须在组件 `setup`（或另一个组合式函数、`effectScope`）里同步调用**，这样生命周期钩子、自动清理才绑定到该组件（呼应 vue-lifecycle、vue-provide-inject interview 第 12 题）。

---

## 二、返回值：ref vs reactive vs toRefs

```js
// ① 返回多个独立 ref（最常用、解构安全、调用方清楚哪些是响应式）
return { x, y };

// ② 返回一个 reactive 对象：解构会丢响应！
const state = reactive({ a: 1 });
return state;              // ❌ const { a } = useX() 后 a 不再响应

// ③ 想返回对象又能安全解构：用 toRefs
return toRefs(state);      // ✅ 每个属性都是 ref
```
经验：**优先返回一组 ref**（解构天然安全、`x.value` 语义明确）；状态字段多又想打包，则 `reactive` + **`toRefs` 返回**（呼应 vue-reactivity-theory 第六节）。返回值不是"只能对象"——也可以只返回一个 ref 或一个函数。

---

## 三、可组合：函数套函数

组合式函数最大价值是**自由组合**：

```js
export function useFetch(url) {          // 通用：取数 + loading/error
  const data = ref(null), error = ref(null), loading = ref(false);
  async function doFetch() {
    loading.value = true; error.value = null;
    try { data.value = await (await fetch(unref(url))).json(); }
    catch (e) { error.value = e; }
    finally { loading.value = false; }
  }
  watch(url, doFetch, { immediate: true });   // url 是 ref 时自动重取（呼应 vue-watch）
  return { data, error, loading, refresh: doFetch };
}

export function useUser(id) {            // 业务：组合 useFetch
  const { data, loading, error } = useFetch(computed(() => `/api/users/${unref(id)}`));
  return { user: data, loading, error };
}
```
接受 ref、也接受普通值 → 用 `toValue`/`unref` 归一；把"取数""错误处理""缓存"分层组合，就是一个小型数据层（呼应 vue-pinia、vue-async-suspense 的取数）。

---

## 四、effectScope 与 onScopeDispose：脱离组件也能管的副作用

组件里的组合式函数靠 `onUnmounted` 自动清理。但在**组件之外**（一个全局单例、一个 store、一段 setup 后异步逻辑）创建响应式 effect，需要一个"作用域"来统一收集/释放：

```js
import { effectScope, onScopeDispose, watch } from 'vue';

export function useTicker() {                       // 内部登记"可被作用域回收"的副作用
  const stop = watch(src, cb);
  onScopeDispose(() => stop());                     // 作用域停止时自动清
  return …;
}

const scope = effectScope();
scope.run(() => { useTicker(); useMouse(); });      // 这俩的 effect 归入 scope
scope.stop();                                        // 一次性回收全部（呼应 vue-watch 第六节 stop）
```
Pinia、`useFetch` 库、SSR"每请求作用域"都靠它避免跨请求泄漏（呼应 node-deploy-perf 资源释放、vue-ssr-nuxt）。

---

## 五、为什么组合式函数取代 mixins

Options API 的 mixin 复用逻辑有硬伤：**来源不透明**（`this.xxx` 到底来自哪个 mixin？）、**命名冲突**（两个 mixin 同名方法互相覆盖）、**隐式耦合**。组合式函数是**显式的 import + 调用 + 返回命名**：清楚看到来源、可传参、可组合、可单测（就是普通函数），TS 推断友好。这正是 Vue 3 "Composition API" 的初衷（呼应 vue-component-basics interview 第 12 题、node-modules 显式依赖）。

> mixin 的"全局混入"心智在组合式里由 `app.mixin`/插件承担极少数横切场景（呼应 vue-project-architecture 插件）。

---

## 六、通用库思路（VueUse 风格）

一个成熟组合式函数往往：**参数支持 ref 或值**（`toValue`）、**返回命名清晰的 ref**、**自动随作用域清理**、**可 SSR 安全**（浏览器 API 放 onMounted 或加 `import.meta.client`）、**可被 tree-shake**（每个 `useXxx` 单独文件）。按这些约定造轮子，就能沉淀团队级 `composables/` 库（呼应 vue-project-architecture 目录组织、10-vite tree-shaking）。

---

## 七、自检清单

- [ ] 组合式函数的三条约定是什么？为什么必须在 setup 里调用？
- [ ] 返回 reactive 对象为什么解构会丢响应？怎么解决？
- [ ] 组合式函数如何"套娃"复用？接收 ref 参数要注意什么？
- [ ] `effectScope`/`onScopeDispose` 解决组件之外的什么难题？
- [ ] 相比 mixin，组合式函数在"来源/冲突/可测"上强在哪？

---

## 🚀 部署预告

- 组合式函数 + `provide/inject` = "**把一块有状态逻辑挂到某棵子树上共享**"的完整方案（局部 store 的雏形）；升级为全局则交给 **vue-pinia（L6）**；
- `onMounted` 起副作用、`onUnmounted`/`onScopeDispose` 清理，直接复用 **vue-lifecycle** 的时机判断；SSR 安全（浏览器 API 时机）在 **vue-ssr-nuxt（L8）** 再强调；
- 目录里怎么组织这些 `useXxx`、与 features 分层，见 **vue-project-architecture（L8）**。

下一关进入 **vue-async-suspense**：`defineAsyncComponent` 按需加载与代码分割（呼应 10-vite 分包）、`<Suspense>` 处理异步依赖的加载态。
