# Chrome DevTools：调试与性能分析

> 目标：**熟练使用 DevTools 的 Sources / Network / Performance / Memory / Application 五大面板**；掌握条件断点、异步栈、XHR 断点；会读火焰图定位性能瓶颈；用 Memory 面板排查内存泄漏。

---

## 一、Sources 面板：调试核心

### 1.1 断点家族

| 类型 | 位置 | 用途 |
| --- | --- | --- |
| **行断点** | 点行号 | 常规暂停 |
| **条件断点** | 右键行号 → Add condition | 循环里命中特定条件才暂停 |
| **日志断点** | Right click → Add logpoint | 不暂停，只打 console.log |
| **DOM 断点** | Elements 右键 → Break on → 属性变化/子树变化/节点移除 | 追踪"谁改了这个 DOM" |
| **XHR/Fetch 断点** | Sources → XHR breakpoints → URL 关键字 | 请求发出时暂停 |
| **事件监听断点** | Event Listener Breakpoints 面板 | click / scroll / mousemove 触发时暂停 |
| **异常断点** | Pause on exceptions（⛔图标）| throw 自动暂停 |
| **Function 断点** | `debugger` 语句或 `debug(fn)` | 不知道调用栈时追踪 |

### 1.2 异步栈（Async Call Stack）

**DevTools → Settings → Sources → "Async stack traces"**（默认开）——
在 Network 请求回调里打断点，Call Stack 面板会展示**完整的异步调用链**（而非只有当前栈帧）。

### 1.3 Blackbox / Content Scripts

**右键文件 → Add script to blackbox**：忽略框架代码的栈帧（React 内部、Vue runtime）——Step Over 时不会跳进这些文件。

### 1.4 工作区（Workspace）

**Sources → Overrides** 可以**本地文件映射**到线上 JS——改一行直接刷新测试线上 bug；**不**需要重新部署。

### 1.5 Snippets

**Sources → Snippets**：写一段 JS（批量操作 DOM、测试 API、清 localStorage），随时 Ctrl+Enter 执行。

---

## 二、Network 面板：请求分析

### 2.1 关键列含义

| 列 | 含义 |
| --- | --- |
| **Queueing** | 浏览器决定请求还没发出的等待时间 |
| **Stalled** | 连接池满、代理协商 |
| **DNS Lookup** | 域名解析 |
| **Initial connection / SSL** | TCP + TLS 握手 |
| **TTFB**（Waiting） | 首字节——服务器处理 + 网络延迟 |
| **Content Download** | 响应体传输 |

### 2.2 过滤与 Throttling

- **Filter**：`mime-type:font` / `larger-than:100K` / `is:running` / `from:(cache)` 高级语法；
- **Throttling**：模拟 Slow 3G / 自定义带宽与延迟——**测弱网**必做。

### 2.3 缓存分析

- 200 (from disk cache) → 强缓存命中（Cache-Control maxAge）；
- 304 Not Modified → 协商缓存命中（ETag / Last-Modified）；
- **Disable cache** 勾上 = 开发时强制不走缓存。

### 2.4 导出 HAR

右键列表 → Save all as HAR with content → 导入 Charles / Fiddler 或用 [haralyzer](https://github.com/microwond/haralyzer) 分析。

---

## 三、Performance 面板：火焰图

### 3.1 录制与分析流程

1. **Ctrl+Shift+P** → "Performance" → 点击 ● 录制 → 操作 → 停止；
2. **Main** 轨道看**宏任务块**（颜色：黄=Scripting、紫=Rendering、绿=Painting、灰=System）；
3. **火焰方向**：底→上 = 调用栈；**宽 = 耗时**——越宽的函数越慢；
4. **红三角** = Long Task（>50ms），需优化。

### 3.2 Web Vitals 指标

| 指标 | 全称 | 阈值 |
| --- | --- | --- |
| **LCP** | Largest Contentful Paint | ≤2.5s 好 / >4s 差 |
| **INP** | Interaction to Next Paint（2024 替代 FID） | ≤200ms |
| **CLS** | Cumulative Layout Shift | ≤0.1 |
| **TTFB** | Time To First Byte | ≤800ms |
| **FCP** | First Contentful Paint | ≤1.8s |
| **TTI** | Time to Interactive | ≤3.8s |

Performance 面板 → **Timings track** 直接标出 LCP / CLS / FCP 帧。

### 3.3 常见瓶颈定位

- **Long Task**：拆分帧（`setTimeout / scheduler.yield / requestIdleCallback`）；
- **Layout Thrashing**：JS 读写交替 → 合并读写；
- **GC Pause**：Major GC 尖峰 → 减少短生命周期对象；
- **Network Stalls**：HTTP/1.1 6 连接上限 → 上 HTTP/2 多路复用。

---

## 四、Memory 面板：泄漏排查

### 4.1 三种快照

| 类型 | 用途 |
| --- | --- |
| **Heap snapshot** | 某时刻内存全貌——找 detached DOM / 不该存在的对象 |
| **Allocation snapshot** | 按函数标注「谁分配的」——精确定位泄漏代码行 |
| **Allocation on stack**（⬇️ 按钮）| 录一段操作 → 看这段时间的**增量分配** |

### 4.2 经典泄漏模式

1. **Detached DOM**：快照里搜 `Detached`——节点从文档移除但 JS 引用还在；
2. **闭包捕获大对象**：事件监听没 removeEventListener → listener 闭包持有整个 dataset；
3. **全局变量**：`window.data = [...1M rows]` 忘了清；
4. **定时器**：`setInterval` 没 clear → 回调里的 this 永远活着；
5. **Map/Set 无限增长**：缓存没淘汰策略 → 用 WeakMap。

### 4.3 对比技巧

拍快照 → 操作 → 再拍 → 选 **Comparison** 视图 → 按 `#Objects` 降序 → **持续增长**的就是泄漏源。

---

## 五、Application 面板：存储全景

- **Local / Session / IndexedDB / Cookie**：可视化 CRUD；
- **Service Workers**：查看状态 / 强制更新 / 离线模式测试；
- **Manifest**：PWA 配置检查；
- **Clear storage**：一键清所有（等效无痕）。

---

## 六、其它实用技巧

- **Console** `$_`：上一个表达式的结果；`copy(obj)` 复制到剪贴板；`monitor` 监控函数调用。
- **`$0`**：在 Console 里引用当前 Elements 选中的 DOM 节点；`$$('css-selector')` → querySelectorAll 数组。
- **Coverage**（Ctrl+Shift+P → Coverage）：录制后看**哪些 JS/CSS 字节实际被执行了**——dead code 检测。
- **Command Menu**（Ctrl+Shift+P）：直达任何面板/功能/设置。

---

## 七、自检清单

- [ ] 如何对"只有 id=42 的用户"暂停而不改代码？
- [ ] XHR 断点在哪设？如何只断 `POST /api/order` 的请求？
- [ ] Performance 火焰图里黄色块代表什么？红三角意味着什么？
- [ ] 如何用 Memory 面板定位 Detached DOM？
- [ ] INP 是什么？它替代了哪个老指标？
- [ ] Coverage 面板用来检测什么？

---

## 🚀 部署预告（L10 汇总关 → 直接接 es-build / es-publish）

本关是**部署后排查工具**——把前 9 关 🚀 预告里反复提到的 DevTools 能力**展开讲透**：
- **sourcemap 对应到 Sources 面板**：线上 JS 有 `.map` 时，DevTools 自动反解到**源码视图**——没有 `.map` 就只能看压缩后的 bundle。**上传 sourcemap 到 Sentry** 是部署闭环。
- **Performance 面板对应构建产物**：chunk 拆得不好 → 瀑布图里看到一长串串行 JS 加载 → 改 `manualChunks` / `preload`。
- **Network 面板验证缓存策略**：产物带 `[contenthash]` → 上线后看哪些是 200(from disk cache)、哪些是 304 → 验证 Cache-Control 配置。

下一关 `es-build` 正式把所有🚀部署预告汇总成完整构建管线。
