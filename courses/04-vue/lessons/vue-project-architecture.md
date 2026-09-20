# 大型项目架构与规范

> 目标：把前 23 关的散点组织成一个**可维护、可扩展、多人协作**的 Vue 3 工程。本课讲：目录怎么组织（**features 优先于 layers**）、组件如何分层（容器/展示、基础/业务）、composables 库与 `useXxx` 约定、**全局错误处理**（`app.config.errorHandler` + `onErrorCaptured`）、插件（`app.use`）与依赖注入边界、类型化组件，以及最重要的纪律——**避免过度全局化**（呼应 vue-state-patterns、node-config 环境分层与启动校验、ts-project、exp-patterns）。

---

## 一、目录组织：features > layers

两种流派：

```
# layers（按类型）——小项目直观，大项目一个功能散落五个目录
src/
  components/  views/  stores/  composables/  router/

# features（按领域）——一个功能自包含，推荐中大型
src/
  features/
    auth/    { components/ store/ composables/ api/ routes.ts index.ts }
    cart/    { ... }
  shared/    { ui/ utils/ composables/ }   # 跨领域通用
  app/       { router/ plugins/ layouts/ }
```
- **feature 内自包含**：改"购物车"只看 `features/cart`，认知负担低；
- **`index.ts` 作为公共出口（barrel）**：只导出对外 API，内部文件可随意重构（呼应 ts-modules 的显式导出边界）；
- 通用的沉到 `shared`，但**先放 feature、出现第二个使用者再上提**（避免过早抽象）。

---

## 二、组件分层

| 层 | 例子 | 特征 |
|---|---|---|
| **基础 UI（Base/Ui）** | `BaseButton`、`BaseModal` | 无业务、纯 props/slot、可复用、放 `shared/ui` |
| **业务组件** | `ProductCard`、`CartItemRow` | 懂领域概念、可能读 store |
| **容器（Container/View）** | `CheckoutPage` | 编排数据（拿 store/接口）、组装业务组件 |

沿袭经典的**容器/展示分离**：展示组件只吃 props、抛 events（呼应 vue-component-basics 单向流），容器负责"数据从哪来"。别教条——`<script setup>` + composables 已让边界更柔，但"谁拥有数据、谁只渲染"这条线要清楚（呼应 vue-state-patterns 第六节可回溯数据流）。

---

## 三、composables 库与约定

- 放 `shared/composables` 或 feature 内，命名 `useXxx`（`useMouse`、`useDebounce`、`useAuth`）；
- 约定：在 `setup` **同步**调用、返回 `ref`/`toRefs`（避免解构丢响应，呼应 vue-composables 第一、二节）；
- 组件外用到生命周期/副作用时用 `effectScope` + `onScopeDispose` 兜底清理（呼应 vue-composables 的 effectScope）；
- **复用逻辑放 composable，共享状态放 store**——这条线在架构上落成两个不同目录，别再混（呼应 vue-state-patterns 第五节）。

---

## 四、全局错误处理

前端没有 Node 的 `uncaughtException`，靠这三层兜底：

1. **`app.config.errorHandler`**：组件树内未捕获的渲染/生命周期/监听器错误统一入口，上报监控（呼应 node-async-errors 的"别让错误静默"）：
   ```js
   app.config.errorHandler = (err, instance, info) => {
     reportToSentry(err, info);        // info: 'componentUpdate' 等来源
   };
   ```
2. **`onErrorCaptured`**：在某个父组件拦截**其子孙**的错误，做局部降级 UI；返回 `false` 阻止继续上抛（呼应 vue-lifecycle 第五节）；
3. **异步/API 错误**：在 action 或 `try/catch` 里就地处理或转成 `emit`/state（呼应 vue-pinia-advanced 的 `$onAction onError`、node-http 错误中间件思路）。
路由层还有 `router.onError`（懒加载 chunk 加载失败重试，呼应 vue-router-guard-lazy 第六节）。

---

## 五、插件与依赖注入边界

- **插件（`app.use`）**：把"给整个 app 装能力"的逻辑封装——pinia、router、i18n、埋点都是插件（`install(app)`）。自定义插件放 `app/plugins`（呼应 vue-pinia、10-vite 插件是构建期、这是运行期）。
- **依赖注入边界**：跨子树共享用 provide/inject（局部），全局业务态才上 store；用 `InjectionKey`（TS）给 inject 建立类型化、防 key 冲突（呼应 vue-provide-inject 第三节、02-ts generics）。
- 别把"配置常量"也塞进全局 store——用普通模块导出或 `import.meta.env`（呼应 vue-deploy 环境变量、node-config）。

---

## 六、类型化组件

- props/emits 用**类型声明式宏**（`defineProps<Props>()`，呼应 vue-sfc-compiler-macros 第二节）；
- 公共组件对外类型通过 `index.ts` 导出，消费方得到模板级类型检查；
- 严格模式 + `vue-tsc` 做类型检查纳入 CI（呼应 ts-strict、ts-project；类型检查不同于 vite-testing 的运行时断言，两者互补）。

---

## 七、避免过度全局化（架构纪律）

新手通病：什么都进 store、什么都 provide、什么都 `app.config.globalProperties`。判据回到 **vue-state-patterns 第一节**：作用域多大，状态放多小。全局化的代价是**耦合、测不动、SSR 水合污染**（呼应 vue-pinia-advanced）。健康信号是：任一功能能整体删除而不牵连他处——feature 自包含 + 明确 barrel 出口正为此服务。

---

## 八、自检清单

- [ ] features 目录相比 layers 目录好在哪？barrel 出口解决什么？
- [ ] 容器/展示分离的边界你怎么划？还教条吗？
- [ ] 全局错误有哪三层兜底？各自适用场景？
- [ ] provide/inject、store、全局配置常量三者边界怎么分？
- [ ] 为什么说"过度全局化"在 SSR 下尤其危险？

---

## 🚀 部署预告

- 目录里的 `env`/启动校验/配置分层，与 **node-config**（环境分层、启动即校验）同一套哲学，构建期落地见 **vue-deploy**；
- 组件分层、barrel、错误兜底决定了 **SSR** 能不能干净水合——下一关 **vue-ssr-nuxt**：为什么要服务端渲染、hydration 水合、每请求新实例（呼应本课"避免过度全局化"）与 Nuxt 约定（呼应 08-nuxt）。
