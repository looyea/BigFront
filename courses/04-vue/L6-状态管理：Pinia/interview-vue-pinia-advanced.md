# vue-pinia-advanced 面试题精选

> 共 12 题，覆盖 变更与批量 / 订阅 / 重置 / 持久化与安全 / 插件 / SSR 六类。

---

## 一、变更与批量

### 1. `$patch` 相比在组件里逐条改 store 字段有什么好处？

① **合并为一次更新**：减少多次响应式触发/重渲染（呼应 vue-reactivity-theory 批量 flush）；② devtools 里**一条记录**便于回溯；③ 在 store 外部也能以"一次逻辑变更"的方式安全改 state（对象式或函数式）。函数式对数组 push/splice、复杂改动更合适（呼应 vue-pinia-advanced 第一节）。

**来源**：Pinia — "Patchting Stores / $patch"

---

## 二、订阅

### 2. `$subscribe` 和 `$onAction` 分别订阅什么？给用途。

`$subscribe` 订阅 **state 变化**（mutation.type 区分 direct/patchObject/patchFunction），用于持久化、同步 URL、打点；`$onAction` 订阅 **action 的执行**（拿到 `name/args/after/onError`），用于统一日志、耗时统计、错误上报（呼应 vue-pinia-advanced 第二节、node-config 结构化日志）。

**来源**：Pinia — "$subscribe / $onAction"

### 3. 在组件里 `$subscribe` 的监听器何时清理？`detached` 是什么意思？

默认随组件卸载自动停止（绑定到组件作用域）。`{ detached: true }` 让它**脱离组件生命周期常驻**（如全局持久化插件），此时须自己保存返回的 `stop()` 并手动调用（呼应 vue-pinia-advanced 第二节、vue-watch 第六节）。

**来源**：Pinia — "store.$subscribe options"

---

## 三、重置

### 4. `$reset()` 在 setup 式 store 里能用吗？为什么？怎么解决？

不能（默认没有）。setup 式没有"初始 state 工厂"的概念，Pinia 无从知道该恢复成什么。解决：在 store 里写一个 `reset()` action，手动把各 ref 赋回初值（呼应 vue-pinia-advanced 第三节、vue-pinia-basics 第一节）。

**来源**：Pinia — "$reset / Setup Stores 无 $reset"

---

## 四、持久化与安全

### 5. 用 Pinia 做 localStorage 持久化，最基础的实现思路是什么？

初始化时从 localStorage 读回并 `$patch`；用 `$subscribe` 在每次变更后写回。可用插件（`pinia-plugin-persistedstate`）自动化并支持 `paths` 只持久化部分字段（呼应 vue-pinia-advanced 第四节）。

**来源**：Pinia — "持久化插件 / state 订阅"、社区 — "pinia persist"

### 6. 持久化时哪些数据不该落 localStorage？为什么？

**敏感信息（token、密钥）与大量数据不该**明文落 localStorage：localStorage 无过期、被 XSS 脚本可读、不参与 HTTP 认证机制。auth token 更宜放 **httpOnly cookie**（JS 读不到，配合后端 session/JWT）。只存 UI 偏好、非敏感草稿（呼应 vue-pinia-advanced 第四节、exp-auth、exp-security XSS）。

**来源**：OWASP — "HTML5 Security / localStorage"、社区 — "JWT in localStorage vs httpOnly cookie"

---

## 五、插件

### 7. Pinia 插件能做什么？如何注册？

插件是一个函数，接收 store 上下文、返回要混入每个 store 的属性/方法（或做副作用），通过 `pinia.use(plugin)` 注册、作用于**所有** store。常用于持久化、devtools 扩展、统一校验/日志。可基于 `store.$id`/`options` 差异化（呼应 vue-pinia-advanced 第五节）。

**来源**：Pinia — "Plugins"

### 8. 插件里为什么强调"用组合式 API 而不是 Vue 实例 API（$app 之类）"？

插件运行在 pinia 上下文，能访问 `store`、`options`、`pinia`、`app`。写通用能力应尽量走 **store 本身 + 组合式**，少依赖具体 app，方便 SSR/测试与跨项目复用（呼应 vue-composables、vue-ssr-nuxt）。

**来源**：Pinia — "Plugins 注意事项"

---

## 六、SSR

### 9. SSR 下 Pinia 的"状态水合"是怎么工作的？为什么要它？

服务端渲染时把各 store 的 `$state` 序列化注入 HTML（如 `window.__INITIAL_STATE__`）；客户端创建 pinia 后**自动 hydrate** 回这些 state，使首屏 DOM 与 store 一致，避免闪烁与二次请求。Pinia 内建此机制（呼应 vue-pinia-advanced 第六节、vue-ssr-nuxt）。

**来源**：Pinia — "SSR / state hydration"

### 10. 为什么 SSR 下必须"每请求新 pinia"，用模块级单例有什么后果？

若 pinia/store 是**进程级单例**，并发请求会共享同一份 state → **A 用户看到 B 用户的数据**（跨请求污染，安全事故）。故 `createApp` 工厂里每请求 `createPinia()`。这同"每个请求干净上下文"的通用原则（呼应 vue-pinia-advanced 第六节、node-deploy-perf、09-express session 隔离）。

**来源**：Pinia — "SSR / 每请求新实例"、Vue SSR — "Request State Isolation"

### 11. `$subscribe` 做持久化，SSR 环境要注意什么？

服务端没有 `window.localStorage`，`$subscribe` 里读写浏览器 API 会报错。要加 `import.meta.client`/运行环境判断，服务端跳过落盘、改由 SSR 水合机制处理初始 state（呼应 vue-pinia-advanced 第四、六节、vue-composables interview 第 8 题）。

**来源**：Pinia — "SSR caveats"、Vite — "import.meta.env / client"

### 12. store 状态既要持久化又想要 devtools 时间旅行，两者会冲突吗？

不冲突：持久化是"变更写外部存储"、时间旅行是"devtools 回放 store 内变更"，是不同层。但要小心**从 localStorage 恢复的那次 `$patch` 不应又被立即回写**造成冗余/循环，可在 hydrate 后短暂屏蔽订阅或用 `skipHydrate`（呼应 vue-pinia-advanced 第二、四节）。

**来源**：Pinia — "persist + devtools"、社区 — "persistedstate 循环写"
