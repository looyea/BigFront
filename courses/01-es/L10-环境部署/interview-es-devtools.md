# es-devtools 面试题精选

> 共 12 题，覆盖 **断点技巧 / Network 分析 / Performance 火焰图 / 内存泄漏 / Core Web Vitals / 实用功能** 六类。来源仅列文章或规范标题。

---

## 一、断点技巧

### 1. 条件断点和 debugger 语句有什么区别？什么时候必须用条件断点？

条件断点 **不修改源码**，只在 DevTools 内存里生效；`debugger` 写进代码后会被打包上线（除非被 Terser drop_debugger 移除）。**必须用条件断点的场景**：循环 10 万次里只有 i=99999 时出错（加 if+debugger 影响性能且要重新部署）、第三方 minified 库里的断点（源文件不能改）、线上 Overrides 映射后临时调试。

**来源**：Chrome DevTools Docs — "Breakpoints reference"

### 2. XHR 断点如何设置？它断在请求发出前还是响应到达后？

Sources → 右侧 XHR/fetch Breakpoints → 点 + → 输入 URL 关键字（如 `/api/order`）。请求**发出时**暂停（不是响应后）——此时 Call Stack 还能看到"谁调了这个 fetch"，非常适合追查"不知道哪个组件触发了这个请求"的场景。

**来源**：web.dev — "Debug HTTP requests with Chrome DevTools"

---

## 二、Network 分析

### 3. Waterfall 里 Stalled 时间很长，可能原因有哪些？

Stalled = Queueing 之后到实际发出之间的等待。原因：① HTTP/1.1 同域 6 连接已满，后续请求排队；② Service Worker intercept 延迟；③ 代理协商（Proxy-Auth）；④ 大上传占带宽。解法：上 HTTP/2 多路复用、域名分片（老方案）、减少同时请求数。

**来源**：web.dev — "Network reference: Stalled"

### 4. 如何判断一个资源是否命中了强缓存？

Network 面板看 **Size 列**：显示 `(disk cache)` / `(memory cache)` → 强缓存命中（状态码 200）；显示 `(from ServiceWorker)` → SW 缓存。如果状态码是 **304** → 协商缓存（需要发条件请求给服务器确认）。右键 → Open in new tab → 用 DevTools Network 再看 Headers：`Cache-Control: max-age=31536000, immutable` + 200 from cache = 确认强缓存。

**来源**：MDN — "HTTP caching"

---

## 三、Performance 火焰图

### 5. Performance 面板里，为什么有些帧是紫色、有些是黄色？

- **黄色**（Scripting）：JS 执行——长时间黄块 = 计算密集逻辑需优化（Web Worker / 分帧）；
- **紫色**（Rendering）：样式计算 + Layout（重排）——大量紫块 = DOM 读写交替或复杂选择器；
- **绿色**（Painting）：绘制/合成——通常很小；大面积绿 = 触发大量 repaint（transform/opacity 改 will-change）；
- **灰**（System）：GC、编译等。

**来源**：developer.chrome.com — "Understand the performance panel"

### 6. CLS 怎么排查？举一个最常见的触发场景。

Performance → Timings track → 看 Layout shift 区域，或 Layout Shifts 轨道。最常见场景：**图片没设 width/height 或 aspect-ratio** → 加载后撑开把下方内容推下去。排查：① 在 Performance 录制里找 shift 帧 → 下面会列出**被 shift 的 DOM 节点**；② 检查是否有异步插入的广告 / 弹窗 / cookie banner 没预留空间。

**来源**：web.dev — "Optimize Cumulative Layout Shift"

---

## 四、内存泄漏

### 7. Detached HTMLDivElement 是什么？怎么产生的？

DOM 节点已从文档树移除（或从未插入），但 JS 还持有引用 → GC 不能回收 → 内存不释放。典型产生：① 组件卸载时没 removeEventListener → listener 闭包持有整个 DOM 节点引用；② 全局 Map 缓存了 DOM 节点但页面切换后旧节点残留；③ console.log 过的对象被 DevTools 保留（不算真泄漏）。

**来源**：MemLab for Node.js — "Common causes of memory leaks"；auth0 Blog — "JavaScript memory leaks for beginners"

### 8. 如何用 Allocation on stack 定位泄漏代码行？

1. Memory 面板 → ⬇️ Allocation on stack 按钮开始录制；
2. 反复执行可疑操作（打开弹窗 → 关闭 → 再打开 → 再关闭 × 5）；
3. 停止录制 → 按 **Size** 降序 → 找**不应该存在但越来越大**的对象（如本应销毁的组件实例）；
4. 点开对象 → **Allocation stack** 显示构造函数被调用的**完整代码行号**（sourcemap 需要加载）→ 直接定位代码。

**来源**：developer.chrome.com — "Fix memory issues using heap snapshots"

---

## 五、Core Web Vitals

### 9. LCP 元素可以是什么？如何优化 LCP？

LCP 元素最大可能是：`<img>` / `<video>` 的 poster / `<background-image>` / 块级文本节点。优化：① 预加载 LCP 资源 `<link rel="preload" as="image">`；② 服务器端渲染或流式渲染减少 TTFB；③ 图片 CDN + 压缩；④ 避免客户端 JS 注入主图（用 `<img>` 而非 JS 动态设置 src）。

**来源**：web.dev — "Optimize LCP"

### 10. INP 差通常是什么代码导致的？如何优化？

INP = 用户交互到下一帧渲染的总耗时。差的原因：① event handler 里有**同步 Long Task**（大 JSON.parse、DOM 批量操作）；② 响应式更新触发了**超大数据列表重渲染**；③ CSS transition 触发了 **layout thrashing**。优化：① `startTransition` / `scheduler.yield` 拆更新；② 虚拟列表；③ `will-change` 提示合成。

**来源**：web.dev — "INP"；developer.chrome.com — "Optimize INP"

---

## 六、实用功能

### 11. Overrides 面板能做什么？它和 Chrome DevTools Workspace 有什么区别？

Overrides（Persistence → Overrides）把**线上资源映射到本地文件夹**——刷新时 DevTools 拦截网络请求，用本地文件替代。**改一行 CSS/JS 立刻看效果，不需要部署或代理**。Workspace 是更早期的叫法（现在 UI 叫 "Folder scope" + "Overrides"）：Folder scope 只做 SourceMap 映射（可编辑源码但**不覆盖线上文件**）；Overrides 才真正替换网络响应。

**来源**：developer.chrome.com — "Apply changes from Chrome DevTools"

### 12. `console.table()` 和 `console.groupCollapsed()` 在调试复杂数据时怎么用？

- `console.table([{id, name, age}, ...])` 渲染二维表——排查 API 返回列表时比逐行 log 快 10 倍；
- `console.groupCollapsed('Step 1')` / `console.groupEnd()`：把相关日志折叠分组——追踪多步骤流程（表单校验 5 个 step 分别 log）时输出不混乱。
- 组合技：`console.log('%cSuccess!', 'color:green;font-weight:bold')` 加样式做高亮分界。

**来源**：MDN — "console.table()" / "console.groupCollapsed()"
