# vue-pinia-advanced 面试题精选

> 共 15 题，覆盖 变更与批量 / 订阅 / 重置 / 持久化与安全 / 插件 / SSR 六类。

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

---

## 补充（新专题 13-15）

### 13. 手写一个生产级 pinia 持久化插件：序列化、部分字段、异步存储（IndexedDB）、SSR、版本迁移五件事各怎么做？

骨架：`pinia.use(({ store }) => { 恢复 → store.$subscribe 落 盘 })`。① 部 分 字段：插 件 选 项 `{ keys: [...] }` 白 名 单 挑 state（配 `$subscribe` 的 events.path 过 滤，减 少 无 关 写），敏 感 约 定：token 类 优 先 httpOnly cookie，若 坚 持 localStorage 就 要 接 受 XSS 提 取 风 险 并 缩 短 过 期（本关 token 风险 题 的 操 作 化）。② 序 列 化：JSON 为 底，Date/Map/Set/大 数 要 自 定 义 reviver（state 里 出 现 这 些 类 型 说 明 设 计 已 混，能 禁 则 禁）。③ 异 步 存 储：hydrate 是 异 步 的 → 给 store 挂 `store.$hydrated = promise`，守 卫/组件 await 它（解 掉 「基 础 版 永 不 工 作」的 大 坑，社区 插件 高 star issue 集 中 区）；写 盘 防 抖（subscribe 相 当 高 频，IndexedDB 事 务 不 要 每 字节 开）。④ SSR：服 务 端 跳 过 读 写（`import.meta.server`），注 水 走 官方 通 道（本 关 SSR 水 合 题），localStorage 版本 仅 客 户 端 首 屏 后 同 步。⑤ 迁 移：存 `{ v, data }`，读 时 按 v 走 `migrations[v]` 链（字 段 改 名/结 构 变 更 不 能 靠 try-catch 蒙），失 败 降 级=丢 弃 重 来（行 为 功 能 而 非 丢 用 户 数 据 可 选 择）。

**来源**：pinia-plugin-persistedstate 设计文档与已知 SSR/hydrate 议题；Pinia 官方插件教程。

### 14. devtools 时间旅行和「持久化插件 + $subscribe」同开时，为什么会出现「回滚后存储被污染」？给防御方案。

机 制：时 间 旅 行=devtools 重 放/回 滚 时 直接 改 store 的 state（`patch` 通 道），而 `$subscribe` **分 不 清** 这 次 变化 是 用 户 操 作 还 是 调试 器 时 光 机——回 滚 到 t-5 的 状 态 会 被 订阅 者 当 真 写 进 localStorage（持 久 化 了 一 个 历史 快 照，刷 新 后 用 户 的 「真 实 现在」被 覆 盖）。防 御：① 订 阅 事 件 打 标（自 研 action 包 装/插件 写 状 态 时 置 `syncing` flag，subscribe 回 调 见 flag 跳 过——时 间 旅 行 触发 的 改 变 无 法 被 标 记，所 以 只 能 靠 ②）；② 持 久 化 只 写 「来 自 action 的 变 更」（在 `$onAction after` 里 主 动 落 盘，而 不 是 `$subscribe` 监 全 量——devtools 回 滚 不 经 任 何 action，天 然 过 滤；代 价：action 外 的 手 改 不 落 盘，正好 反 逼 「改 state 走 action」 纪律，本包 基础 关 mutation 题 的 闭 环 收 尾）；③ 写 盘 带 version+ts 单 调 锁（拒 绝 更 旧 ts 覆 盖 更 新，多 标 签 页 同 步 也 需 要 同 一 件 装，本 题 加 餐：多 标 签 页 同 步 永 远 比 你 想 的 复 杂）。

**来源**：Pinia devtools 与 $subscribe 交互的已知讨论（时间旅行触发订阅）；多标签页状态同步案例。

### 15. 把「乐观更新 + 失败回滚 + 队列重放」做进 store 的完整设计：$patch、临时态、并发 mutation 三块怎么拼？

临 时 态 表 达：列 表 项 加 `pending: create|update|delete` 标 记 而 不 是 另 建 一份 状 态（UI 据 此 渲 「处 理 中」样式，无 双 状 态 同 步 问 题）；快 照：`const bak = structuredClone(pick(state, keys))` 或 只 记 **逆 操 作**（增 则 删、改 则 存 旧 值 集 合——逆 操 作 表 更 抗 并 发：同 记 录 被 两 次 乐观 改 时 快 照 回 滚 会 超 写 第 二 次 的 结果，逆 操 作 栈 按 序 弹 才 对）。并 发 策 略：同 实体 串 行（按 实 体 id 排 队，队 头 失 败 则 决 定 「仅 回 滚 自 身」还 是「连 坐 后 续 乐观 操 作」（UI 复 杂 度 换 一 致 性，要 产品 拍 板）；不 同 实体 并 行 + 失 败 独 立 回 滚。重 放：离 线 场 景（PWA 编辑）把 action 序 列 化 进 outbox（IndexedDB），在 线 后 按 序 重 放 再 拉 服 务 端 版 本 合 并——**冲 突 策 略 决 定 成 败**（last-write-wins 至 少 要 带 版 本 号 校 验，本包 架构 关 离线 同 步 的 store 视 角）。$patch 位 置：回 滚 本 身 用 一次 `$patch(bak)`（单 记 录、devtools 一 眼「回滚」事件，本关 patch 好处 题 的 最 后 应 用）。

**来源**：乐观更新/回滚的状态管理通行模式（TanStack Query onMutate 设计同构参照）；outbox 模式与离线优先文献。
