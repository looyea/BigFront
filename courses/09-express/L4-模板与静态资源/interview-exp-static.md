# exp-static 面试题精选

> 共 15 题，覆盖 **express.static / HTTP缓存分层 / ETag / Content Hash / CDN / 缓存刷新** 六类。

---

## 一、express.static

### 1. `app.use(express.static('public'))` 处理一个请求的完整流程是什么？

serve-static 中间件把 `req.url` 拼到 root 目录 → `send` 模块解析文件 → 存在则：探测 MIME、生成 ETag/Last-Modified、处理条件请求（可能 304）、处理 Range、按 maxAge 设 Cache-Control → 流式 pipe 响应；不存在则 `next()`（fallthrough）交给后续中间件。含安全检查（防路径穿越、默认不暴露 dotfiles）。

**来源**：serve-static README — "How it works"; send npm — "conditional GET / Range"; Express — "serving static files"

### 2. `index` 和 `redirect` 选项分别控制什么？

`index`：请求目录（`/`）时是否返回该目录下的 index.html（默认 `'index.html'`；设 false 禁用——纯 API 服务常用）。`redirect`：请求 `/files`（目录）而没斜杠时，是否 301 重定向到 `/files/`（默认 true）。两者都影响目录型 URL 的行为。

**来源**：serve-static — "index option" / "redirect option"; Express API — "express.static"

---

## 二、HTTP 缓存分层

### 3. 强缓存和协商缓存的区别？一次请求两者如何配合？

强缓存（Cache-Control: max-age / Expires）：有效期内直接用本地副本，**不发任何网络请求**。过期后进入协商缓存：带 If-None-Match/If-Modified-Since 问服务器 → 未变返回 304（用本地副本，省 body）→ 变了返回 200 + 新内容。Cache-Control 优先级高于老的 Expires。

**来源**：MDN — "Cache-Control"; web.dev — "HTTP caching / strong & conditional"; RFC 9111

### 4. Expires 和 Cache-Control: max-age 有何不同？为什么推荐后者？

Expires 是**绝对时间**（依赖客户端时钟，时钟不同步会出错，HTTP/1.0 遗留）。max-age 是**相对秒数**（从请求算起，不受客户端时钟影响）。两者同时存在时 Cache-Control 优先。现代一律用 Cache-Control。

**来源**：MDN — "Expires" / "max-age"; RFC 9111 — "Calculation of Cache Freshness"; StackOverflow — "Expires vs Cache-Control"

### 5. 200(from disk cache) / 200(from memory cache) / 304 三者区别？

- 200 (memory cache)：资源在内存缓存（本次页面生命周期内，最快）；
- 200 (disk cache)：从磁盘缓存读取（强缓存命中，跨会话）；
- 304：强缓存过期后协商缓存命中，服务器确认未变，浏览器复用磁盘副本（有一次请求往返）。

**来源**：web.dev — "performance caching / memory vs disk"; Chrome DevTools — "Network (from disk cache)"

---

## 三、ETag

### 6. ETag 为什么比 Last-Modified 更可靠？

Last-Modified 秒级精度：1 秒内多次修改无法感知；文件修改但内容回滚（时间变了内容一样）会误判为变化；某些 CDN 不保留时间。ETag 是内容指纹（哈希）：只要内容真正变化才变，能识别这些边缘情况，且优先级更高。缺点：强校验 ETag 在集群多机器上若哈希算法不一致会失效（需用文件元数据或弱 ETag）。

**来源**：MDN — "ETag"; RFC 9110 — "ETag / weak validators"; StackOverflow — "why ETag over Last-Modified"

### 7. 集群部署下 ETag 可能引发什么问题？怎么解决？

默认 ETag 由 inode/size/mtime 生成 → 不同机器同一文件算出的 ETag 不同 → 用户请求被负载均衡到不同机器 → 缓存反复失效（永远 200 非 304）。解决：① 用内容哈希（构建期 contenthash 文件名，运行时不需 ETag）；② 用 nginx 统一配置；③ 关闭动态 ETag 改用文件名 hash；④ 弱 ETag `W/`。

**来源**：Express — "etag setting"; Nginx — "ETag in clusters"; StackOverflow — "ETag different on each server"

---

## 四、Content Hash

### 8. 什么是 Content Hash？它如何解决"缓存 vs 更新"矛盾？

构建时把文件内容的哈希写进文件名（`app.3f8a.js`）。内容变→哈希变→文件名变（URL 变）。于是所有资源可放心设一年强缓存：未变的命中长缓存不重下，变了的文件名不同浏览器必然重新请求。失效通过"改文件名"完成，不靠清缓存。index.html 不带 hash 且 no-cache，作为指向最新资源的清单。

**来源**：Webpack — "hashing / contenthash"; Vite — "assets with hash"; web.dev — "Cache strategies / long-term caching"

---

## 五、CDN 与缓存刷新

### 9. 资源上了 CDN 后，改了文件如何让用户尽快拿到新版？

因为用了 content hash：改文件→新 hash→index.html 引用新名。只要保证 index.html 是 no-cache（或短 max-age + 主动刷新 CDN 上 index.html 的缓存），用户下次访问即拉到新 index.html → 加载新资源。旧的 hash 文件可延迟删除（正在使用的用户不中断）。无需清空所有 CDN 缓存。

**来源**：web.dev — "Content versioning"; Cloudflare/AWS — "cache invalidation"; MDN — "cache busting"

### 10. Service Worker 缓存在这套体系里的角色和风险？

SW 可编程缓存（Workbox 预缓存 app shell、运行时缓存 API）。风险：SW 自身更新时机隐蔽——旧的 SW 可能继续提供旧缓存内容 → 出现"发了版用户还是旧的"。需正确实现 SW 更新（`skipWaiting`/`clientsClaim` 或提示用户刷新），且 SW 脚本本身不能被长缓存。

**来源**：web.dev — "Service Worker lifecycle / caching"; Workbox docs — "cache strategies / update"; MDN — "ServiceWorker"

---

## 六、实战与排错

### 11. 用户报"改了代码但线上页面没变化"，你的排查路径是？

① 硬刷新 / 无痕窗口验证是否缓存问题；② DevTools Network 看 index.html 的 Cache-Control 是否 no-cache（多半被强缓存）；③ 看资源文件名 hash 是否真的变了（构建没重新 hash？）；④ CDN 是否缓存了 HTML（边缘没刷新）；⑤ Service Worker 拦截返回旧缓存；⑥ Nginx/浏览器中间层缓存。根因通常是 HTML 被缓存或 SW 未更新。

**来源**：web.dev — "Debugging caching"; Chrome DevTools — "Network / disable cache"; StackOverflow — "changes not showing / cache"

### 12. express.static 服务的文件，Content-Type 是怎么定的？乱码/下载而非预览通常是什么原因？

由 mime 库根据**扩展名**推断（`.js`→`text/javascript`、`.html`→`text/html`）。扩展名缺失/错误 → 回退 `application/octet-stream` → 浏览器当下载处理。中文乱码通常是缺 charset（应 `text/html; charset=utf-8`）→ 用 setHeaders 显式设置，或确保文件本身 UTF-8。可用 `res.set('Content-Type', ...)` 覆盖。

**来源**：express.static / send — "Content-Type / mime"; MDN — "MIME types / charset"; serve-static — "setHeaders"

---

## 补充（新专题 13-15）

### 13.  用 express.static 对外 serve 文件，完整过一遍它的安全配置面与每个选项的攻击场景。

选项逐项过：① root/index——目录必须绝对路径且来自代码常量，绝不能拼 req 输入（path.join 拼接外部输入=路径穿越经典面，serve-static 自身防穿越但运维改造成自定义 fs 后就防不住）；② dotfiles 默认 ignore，allow 的动机（serve .well-known 证书校验目录）要用具体规则而不是全局开；③ index 列表开启=目录枚举（上传目录开了等于公开文件清单，配合可猜文件名直接拖库备份）；④ follow symlink——上传目录里一个软链指向 / 就是 LFI 跳板（历史 CVE 场景），永远别对用户上传目录开；⑤ extensions 数组（自动补 .html/.json）可能让同一路径命中意外文件类型。更深一层：Content-Type 由扩展名推断，可上传文件名若被 serve，攻击者传 .html 获得"你域名下的同源页面"（存储型 XSS 借你的域执行）——用户内容永远独立域 + X-Content-Type-Options: nosniff。审计动作：CI 里用 curl 遍历探测 .git/config、.env、.DS_Store、备份 zip（编辑器留下的 index.js~ 是最常见泄露源），把"静态根清单"当 API 一样做变更审查。收口：express.static 五分钟能挂上，它的攻击面审查要一小时——多数人把顺序过反了。

**来源**：serve-static 官方选项文档；OWASP 文件包含（LFI） Cheat Sheet；掘金《一个 dotfiles: allow 拖垮的营销站》

### 14.  一个日活百万的站点，静态资源从构建到用户浏览器，完整讲一遍你的分发与缓存架构。

链路分层：构建层（资产 hash 命名+manifest 产物）→ 分发层（对象存储单一源 + CDN 多 vendor 或主备）→ 边缘缓存（按文件类型分 Cache-Control 模板：hash 资产 immutable 一年、html 协商/短缓存、接口不缓存）→ 浏览器缓存。发版原子性：新 html 引用的新资产必须先全部上传成功再切 html（"资产先于入口"的顺序，反过来=用户拿到新入口配 404 资产的白屏窗口）；旧版本资产保留一个缓存过期周期再清理（正在浏览旧页面的用户还要用它们）。CDN 治理：命中率监控（miss 直穿源站=成本与延迟双杀）、URL 规范统一（尾斜杠/大小写/参数排序造 key 分裂）、刷新策略按"路径刷新兜底、版本化免刷新"设计（hash 体系本不该依赖刷新，需要刷新的是错误配置了弱缓存的资产——这是配置审计信号）。源站防护：CDN 回源限定网段/签名回源，否则攻击者绕 CDN 直打源站等于没上 CDN。多实例角度：静态文件绝不在应用 pod/服务器磁盘上留"唯一副本"，对象存储是唯一事实源，应用只发 API——这条做到，ETag 漂移、发布不一致、扩容慢三类问题一次清零。

**来源**：MDN Caching；CloudFront/S3 静态托管最佳实践；InfoQ《一次发版引发的白屏复盘》

### 15.  容器化/K8s 部署 Express 时，静态资源还放在镜像里吗？给出版本化的存储方案。

镜像内静态的隐性成本：镜像膨胀（每次发版全量资产随镜像走 registry→node 拉取链路，构建与调度变慢）、多副本各存一份内存/磁盘浪费、CDN 刷新与镜像发布两套系统难原子对齐。方案对比：① 镜像保留（小站点、无 CDN、求简单）——可接受但要 build 阶段裁剪（只打包 public 产物，源码与 devDeps 出镜像，多阶段构建）；② 对象存储 + CDN（主流）——CI 独立上传步骤（内容寻址天然幂等），应用镜像变纯计算；③ 独立静态服务 pod——多一个要运维的服务，收益只在"不能出公网"的内网环境。进阶决策点：前后端是否同镜像同版本——SPA + API 同域部署时，html 入口留在应用（sendFile）还是也上 CDN（带源站 fallback）取决于灰度系统：入口走 CDN 则发版与灰度全在 CDN 配置层，应用只做 API；入口在应用则 Nginx/Ingress 要能按版本路由 html 请求。K8s 细节：Pod 里不挂 PV 存静态（节点漂移/多副本分叉），initContainer 拉资产是反模式（拉取成为启动依赖）。收口句："计算无状态、存储上服务"在静态资源上的投影就是：文件的家是对象存储，镜像的家是计算，混住的家庭都难打扫。

**来源**：12-Factor 构建层（Backing Services）；Knative/S3 静态托管实践；SegmentFault《我们的镜像从 80MB 涨到 400MB》
