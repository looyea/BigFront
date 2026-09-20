# vite-hmr 面试题精选

> 共 12 题，覆盖 **HMR 原理 / API / 框架集成 / 自定义 HMR / 性能 / 降级** 六类。

---

## 一、HMR 原理

### 1. 描述 Vite HMR 的完整流程（从文件保存到页面更新）。

1. **文件保存** → chokidar 监听到 change 事件；
2. **模块图查找** → 找到变更模块及其 importers（父链）；
3. **判断 HMR 边界** → 沿父链向上找第一个有 `hot.accept()` 的模块；
4. **WebSocket 推送** → `{ type: 'update', updates: [{ url, acceptedPath, timestamp }] }`；
5. **客户端** `@vite/client` 收到 → 动态 `import(url + '?t=' + timestamp)` → 拿到新模块；
6. **dispose 旧模块** → 执行 `hot.dispose(cb)` 清理；
7. **accept 新模块** → 执行 `hot.accept(cb)` 用新模块更新 UI。

**来源**：Vite HMR docs — "How HMR Works"; Vite source — `HMRBroadcaster`

### 2. 为什么 Vite HMR 速度与项目大小无关？

因为**只重编译变更的那一个模块**（不重建 chunk）。Webpack 需要重建包含该模块的整个 chunk → chunk 里有 100 个模块就要全部重转。Vite 的 no-bundle 模型意味着每个模块独立 → HMR 也是独立的 → 恒定 O(1)。

**来源**：Evan You — "Vite HMR design"; Vue Mastery — "Vite vs Webpack HMR"

---

## 二、API

### 3. hot.accept() 有几种调用形式？

| 形式 | 效果 |
| --- | --- |
| `hot.accept()` | 自更新——模块变更时**重新执行**（不跑回调），需模块内部自己处理 state |
| `hot.accept(cb)` | 自更新 + cb(newMod) → 手动用新模块更新 |
| `hot.accept('./dep.js', cb)` | 依赖变更时执行 cb（本模块不重载） |
| `hot.accept(['a.js', 'b.js'], cb)` | 多依赖 |
| 无参 + 无 cb | 标记为 HMR 边界（Vite 自动用动态 import 替换） |

**来源**：Vite HMR API — "import.meta.hot.accept"

### 4. hot.dispose(cb) 的 data 参数是什么？

`hot.dispose((data) => { data.myState = myState; })` → data 是 **跨 HMR 共享的持久化对象**（`import.meta.hot.data`）。旧模块 dispose 时往里写 → 新模块加载时 `import.meta.hot.data.myState` 读出 → 不丢状态。常用于保存 scroll position / timer id / observer 实例。

**来源**：Vite HMR API — "import.meta.hot.dispose" / "import.meta.hot.data"

---

## 三、框架集成

### 5. Vue SFC 的 HMR 是怎么做到不丢组件内部 state 的？

@vitejs/plugin-vue 编译 SFC 时自动注入 `import.meta.hot.accept(module => __VUE_HMR_RUNTIME__.reload(module.default))`。Vue HMR runtime 的 `reload()` 对比新旧组件选项 → **patch 实例**（保留 data / refs / computed）→ 只替换 render 函数或 style。state 不丢因为实例没有被销毁重建。

**来源**：@vitejs/plugin-vue source — `handleHotUpdate`; Vue HMR runtime — `reload()`

### 6. React 的 Fast Refresh 和 Vite HMR 的关系？

@vitejs/plugin-react 集成 react-refresh：babel 转换每个导出组件 → 注册到 RefreshRuntime → HMR accept 时调 `RefreshRuntime.performReactRefresh()` → React 自己找 fiber tree 里对应组件 → 替换 render → **保留 hooks state**。Vite 提供 WS 管道 + 模块替换；React 提供 state 保留策略——两者配合。

**来源**：React Fast Refresh proposal; @vitejs/plugin-react README

---

## 四、自定义 HMR

### 7. 如何给一个非 JS/CSS 资源（如 .json 配置）加 HMR？

```ts
// 插件里
transform(src, id) {
  if (!id.endsWith('.json')) return;
  return `
    const data = ${src};
    export default data;
    if (import.meta.hot) {
      import.meta.hot.accept((mod) => updateUI(mod.default));
    }
  `;
}
```

Vite 默认只处理 `.js/.ts/.vue` 等——其他文件 import 后不会热更（触发 full-reload）。插件注入 accept 代码即声明"HMR 边界"。

**来源**：Vite — "Custom HMR"; Vite Plugin API — "handleHotUpdate"

### 8. handleHotUpdate 钩子（Vite 6 改名 hotUpdate）做什么？

文件变更时 Vite 调此钩子 → 你可以 **过滤/修改/扩展** 要推送的模块列表。用例：① Markdown 变更 → 只推送相关 article 组件；② .env 变更 → `server.restart()` 而非推模块；③ 返回自定义 `modules` 数组避免不必要的 full-reload。

**来源**：Vite Plugin API — "handleHotUpdate" / Vite 6 "hotUpdate"

---

## 五、降级与边界

### 9. 哪些情况会导致 HMR 退化为 full-reload？

1. **改 vite.config** → server restart；
2. **改 index.html** → 整页重渲染；
3. **没人 accept**（HMR 边界找不到）→ full-reload；
4. **hot.decline()** → 强制 reload；
5. **改 CSS 的 @import 链** → 有时降级为 reload（复杂循环）；
6. **改 import.meta.glob 匹配的模块** → 影响所有 importer → reload。

**来源**：Vite — "Full-reload" behaviour; Vite source — `propagateUpdate`

### 10. 如何调试"为什么我的 HMR 没生效"？

1. **Console 看 WS 消息**：DevTools → Network → WS → `/__vite_hmr` → 看推了什么 type；
2. **`server.hmr.overlay = true`**（默认）→ 错误弹浮层；
3. **`import.meta.hot = undefined`** ？→ 检查是否在生产模式 / 没在 Vite dev 环境跑；
4. **accept 缺失**：在模块里 `console.log(import.meta.hot)` 确认存在；
5. **Vite --debug 启动**：`vite --debug hmr` 打印完整 HMR 决策日志。

**来源**：Vite — "Troubleshooting HMR"; Vite debug docs

---

## 六、性能

### 11. HMR 更新时 timestamp 参数的作用？

`import('/src/App.vue?t=1695192000000')` → 浏览器 HTTP 缓存按 URL 做 key → 加 `?t=时间戳` 使 URL 唯一 → **绕过缓存** → 确保拿到最新编译内容。不带 timestamp 可能命中缓存拿到旧版本。

**来源**：Vite source — `createHotContext.update`

### 12. 多个文件同时保存会怎样？Vite 怎么优化？

**批量 debounce**（50ms 窗口）：短时间内多次 change → 合并成一个 `update` 消息 → 一次推多个 updates 数组 → 浏览器并行动态 import → 一次 accept 循环。避免连锁多次 HMR 导致的中间状态闪烁。

**来源**：Vite source — `onFileChange` debounce; chokidar `awaitWriteFinish`
