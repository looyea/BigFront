# L4 课后作业：组件通信与逻辑复用

> 覆盖 **vue-provide-inject / vue-composables / vue-async-suspense** 三关。先读代码找 bug，再动手写，最后场景与简答。环境：Vue 3 + `<script setup>`。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段 provide 为什么后代拿到的 theme 永远不更新？
```js
const theme = ref('dark');
provide('theme', theme.value);    // 想响应式共享主题
```
> 怎么改？（呼应 vue-provide-inject 第二节）

**2.** 两个不同库都写了 `inject('config')`，结果串了。为什么？怎么避免？（呼应 vue-provide-inject 第三节）

**3.** 这段 TS 注入没有类型，改用 InjectionKey 写一版：
```ts
const user = inject('user');   // unknown
```
>（呼应 vue-provide-inject 第三节、02-ts）

**4.** `inject('x')` 时上层没有任何 provider，返回值是什么？想让组件"独立可用"该怎么写？（呼应 vue-provide-inject 第四节）

**5.** 这个组合式函数返回 reactive，解构后为何不响应？给两种修法。
```js
export function useCounter(){ const s = reactive({n:0}); return s; }
const { n } = useCounter();
```
>（呼应 vue-composables 第二节）

**6.** 这段在卸载后异步回来才调用组合式函数，钩子为什么不生效？
```js
onMounted(async () => { await api(); useMouse(); });
```
>（呼应 vue-composables 第一节、interview 第 2 题）

**7.** 组合式函数里想用 `onUnmounted` 清理，但它在组件之外被调用。改用哪两个 API 更通用？（呼应 vue-composables 第四节）

**8.** 为什么 mixin 复用容易出 bug，组合式函数不会？各举一个 mixin 的硬伤。（呼应 vue-composables 第五节）

**9.** `defineAsyncComponent(() => import('./X.vue'))` 会给打包产物带来什么变化？首屏为什么受益？（呼应 vue-async-suspense 第一、二节）

**10.** 这个异步组件在网络快时 loading 会闪一下。加哪个选项能修？（呼应 vue-async-suspense 第一节）

---

## 二、手写编程题（5 题）

**11.** 用 `provide/inject` + `InjectionKey` 写一对 `<Form>`/`<FormItem>`：Form provide 一个 `{ model, validate }`，FormItem inject 后读取当前字段错误。（呼应 vue-provide-inject 第二、三节）

**12.** 写一个 `useLocalStorage(key, initial)`：返回一个 ref，读写同步到 `localStorage`，用 `watch` 持久化、初始反序列化，且**解构安全**（返回 ref）。（呼应 vue-composables 第一、二节、vue-watch）

**13.** 写一个 `useDebounce(source, ms)`：返回一个延迟更新的 ref（内部用 `watch` + 定时器 + `onScopeDispose` 清理）。（呼应 vue-composables 第四节、vue-watch 第四节）

**14.** 把一个大图表组件改成 `defineAsyncComponent`，配置 `loadingComponent`（骨架）、`errorComponent`、`delay:200`、`timeout:8000`、`onError` 里最多重试 2 次。（呼应 vue-async-suspense 第一、五节）

**15.** 写一个"组合"：`usePosts()` 内部复用第 13 题的思路 + 一个通用 `useFetch(url)`，暴露 `{ posts, loading, error, refresh }`，url 变化自动重取并处理竞态。（呼应 vue-composables 第三节、vue-watch 第四节）

---

## 三、场景题（1 题）

**16.** 你在做一个"多步骤表单向导"，步骤组件嵌套很深、要共享"当前步骤 + 表单数据 + 前进/后退方法"，其中"金额明细"这一步用了一个很重的表格组件、只有走到那步才需要。请回答：
- (a) 共享"当前步骤"这类跨多层状态，用 props 逐层传、还是 provide/inject？给出理由与 provide 的内容结构（state + actions）（呼应 vue-provide-inject 第二、五节）；
- (b) 这个"向导上下文"能否抽成一个 `useWizard()` 组合式函数 + provide？好处是什么（呼应 vue-composables 第三、五节）；
- (c) 那个重表格组件怎么做到"走到那步才加载"？会不会引起布局跳动、怎么缓解（呼应 vue-async-suspense 第一、五节）；
- (d) 若整个向导是"点击按钮才弹出的对话框"，异步加载还有什么额外注意点（呼应 vue-async-suspense 第四、五节）；
- (e) 如果这套状态将来要跨多个页面共享，你会从 provide/inject 升级到什么（呼应 vue-provide-inject 第五节、vue-pinia）。

---

## 四、简答题（3 题）

**17.** 说明 provide/inject 的查找规则、为什么要用 Symbol/InjectionKey、以及"传响应式源 vs 传快照"的区别。（呼应 vue-provide-inject 第一、二、三节）

**18.** 组合式函数的三条约定是什么？它在哪些方面取代了 mixin？`effectScope`/`onScopeDispose` 解决什么难题？（呼应 vue-composables 第一、四、五节）

**19.** 异步组件、`<Suspense>`、路由懒加载三者关系与各自适用场景？`delay`/`onError` 为什么重要？（呼应 vue-async-suspense 第一、三、四节）

---

## 五、挑战题 🏆

**20.** 🏆 实现一个 `useAsyncState(loader, { initial, delay, onError })` 组合式函数：
- 内部用异步 `loader()` + `watch` 触发重取，暴露 `{ state, error, isPending, refetch }`（呼应 vue-composables 第三节、vue-watch）；
- 用 `onScopeDispose` 保证作用域结束即取消未完成请求（`AbortController`，呼应 vue-watch 第四节）；
- 支持 `delay`：仅当请求超过 delay 才置 `isPending=true`（避免闪烁，呼应 vue-async-suspense 第一节）；
- 提供 `provideAsyncState(key, result)` 便捷注入版，让深层子组件用 `InjectionKey` 取用（呼应 vue-provide-inject 第三、四节）；
- 处理 SSR：服务端不跑浏览器/请求逻辑，水合后客户端再取（呼应 vue-composables interview 第 8 题、vue-ssr-nuxt）。写一段断言或组件用例验证四态：loading/success/error/refetch。
