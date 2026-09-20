# Pinia 进阶：订阅、补丁、重置、持久化与插件

> 目标：把 store 用出"工程级"能力。本课掌握 **`$subscribe`（订阅 state 变更）/ `$onAction`（订阅 action 生命周期）**、**`$patch` 批量改 state（性能 + 单一记录）**、**`$reset` 回到初始值**、把状态**持久化到 localStorage**（含"仅持久化部分字段"）、**写插件扩展 store**，以及 **SSR 下的水合/防跨请求污染**与 devtools。（呼应 vue-pinia-basics、vue-watch、node-config 密钥、vue-ssr-nuxt）

---

## 一、$patch：批量改 state

零散多次 `this.a++; this.b++` 会触发多次更新、产生多条 devtools 记录。用 `$patch` 一次改一堆：

```js
store.$patch({ count: store.count + 1, list: [...store.list, x] });

// 函数式（适合对数组 push/splice 等、逻辑更复杂）
store.$patch((state) => {
  state.list.push(item);
  state.meta.updatedAt = Date.now();
});
```
好处：① **一次性更新**（少几次响应式触发，呼应 vue-reactivity-theory 批量 flush）；② devtools 里是**一条记录**，好回溯；③ 在 store 外部也能安全地"逻辑性改 state"（把改动集中成一处）。`$patch` 会被 `$subscribe` 捕获为一次 `patch` 类型变更。

---

## 二、$subscribe 与 $store 变更订阅

```js
// 订阅 state 变化（含 $patch 与直接改）
const stop = store.$subscribe((mutation, state) => {
  // mutation.type: 'direct' | 'patchObject' | 'patchFunction'
  localStorage.setItem('cart', JSON.stringify(state.items));   // 每次变更落盘
}, { detached: false });   // detached:false 时随组件卸载自动停
stop();   // 手动取消订阅
```
- **用途**：**持久化**（变更后写本地）、打点、同步到 URL；
- 组件里默认随组件卸载清理；`detached:true` 可脱离组件生命周期常驻（要自己 stop，呼应 vue-watch 第六节）。

`$onAction` 则订阅 **action 执行**（开始/成功/错误），适合统一埋点/日志：
```js
store.$onAction(({ name, args, after, onError }) => {
  const t0 = performance.now();
  after((r) => track(name, performance.now() - t0));
  onError((e) => report(name, e));      // 呼应 node-config 结构化日志
});
```

---

## 三、$reset 与 state 工厂

```js
store.$reset();   // 选项式：把 state 恢复到 state() 的初始值
```
- 选项式 `$reset` 开箱可用；**setup 式没有默认 `$reset`**（没有"初始 state"概念），需自己写一个 `reset()` action 把各 ref 赋回初值（呼应 vue-pinia-basics 第一节）；
- 登出、关闭向导、表单重置常用（避免"手改一遍每个字段"漏项）。

---

## 四、持久化到 localStorage

最简手动版（利用 `$subscribe` + 初始化读回）：
```js
export const useSettings = defineStore('settings', {
  state: () => ({ theme: 'light', sidebar: true }),
  actions: {
    hydrate() {                        // 启动时读回
      const saved = JSON.parse(localStorage.getItem('settings') || 'null');
      if (saved) this.$patch(saved);
    },
  },
});
// main.js：useSettings().hydrate(); 并 $subscribe 落盘
```

**只持久化部分字段 / 自动同步** → 用官方生态 `pinia-plugin-persistedstate`：
```js
pinia.use(piniaPluginPersistedstate);
defineStore('user', {
  state: () => ({ token: '', name: '' }),
  persist: { paths: ['name'] },   // 只存 name，别把敏感 token 明文落盘！
});
```
> **安全红线**：`localStorage` 是明文、易被 XSS 读取。**token 等敏感信息谨慎持久化**，优先 `httpOnly` cookie（呼应 exp-auth session、exp-security XSS、node-config 密钥不外泄）。

---

## 五、写一个插件

插件 = 给每个 store 注入共享能力（`store.xxx`），最常用于持久化/日志/校验：

```js
const myPlugin = (context) => ({ store, options }) => {
  // 给每个 store 挂一个方法
  store.logAll = () => console.log(options.id, JSON.parse(JSON.stringify(store.$state)));
};
pinia.use(myPlugin);
```
- 通过 `pinia.use(plugin)` 注册，作用于**所有** store；可读取 `store.$id`、`options` 做差异化；
- Pinia 自身的持久化/devtools 集成都靠插件机制（呼应 vue-project-architecture 插件、Vue 的 `app.use`）。

---

## 六、SSR 与"防跨请求状态泄漏"

SSR 下 store 是**响应式共享对象**，若用**模块级单例**会把请求 A 的状态泄漏到请求 B。规则：
- **每请求新建 pinia**（`createPinia()` 放进 `createApp` 工厂里），Pinia 自动做 state 的 **序列化/水合**（服务端 `state` → 注入 HTML → 客户端 hydrate）；
- 服务端每个请求工厂函数返回全新 app + pinia（呼应 vue-ssr-nuxt、node-workers/cluster 的"每任务干净上下文"）；
- 水合后 `store.$state` 与首屏一致，避免"闪烁/二次取数"（呼应 vue-router-guard-lazy hydration）。

---

## 七、自检清单

- [ ] `$patch` 对象式与函数式分别在什么时候用？相对逐条改有什么两大数据好处？
- [ ] `$subscribe` 与 `$onAction` 分别订阅什么？典型用途？
- [ ] setup 式 store 为什么没有默认 `$reset`？怎么补？
- [ ] 持久化时哪些字段不该落 localStorage？敏感信息该走什么？
- [ ] SSR 下 store 怎么避免跨请求污染？水合是怎么发生的？

---

## 🚀 部署预告

- `$subscribe` 落盘、`$onAction` 打点，是把"副作用集中管理"落到 store 层，理念同 **vue-watch onCleanup**、**node-config 结构化日志**；
- 持久化的安全边界（token 不进 localStorage）与 **09-express** 的 httpOnly cookie/session、**exp-security XSS** 一脉相承；
- 插件式扩展与 `app.use`/`defineStore` 工厂，会在 **vue-project-architecture（L8）** 的组织章节复用；SSR 水合细节在 **vue-ssr-nuxt** 深挖。

L6 最后一关 **vue-state-patterns**：从"会用工具"上升到"会设计数据流"——什么进全局、props-down/events-up、单向数据流、避免同步冗余状态。
