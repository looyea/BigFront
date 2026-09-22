# kit-deploy-node 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) adapter-node 的产物结构是什么？`node build` 跑起来后这个 server 负责哪些事？
**来源**：standalone server 职责题的转述。

产物在 `build/`（可 `out` 改）里，含 `index.js`（起服务器）与 `handler.js`（可挂载的 handler）。运行需要 build 目录 + package.json + 生产依赖（`npm ci --omit dev`）。这个常驻 Node server **既做动态页 SSR，又托管预渲染 HTML 与 `_app/immutable/**` 静态资源**，默认监听 `0.0.0.0:3000`，自带优雅停机与（默认开的）precompress 产物。

### 2. (A) 为什么生产要显式设 ORIGIN 或 PROTOCOL_HEADER/HOST_HEADER？不设会怎样？
**来源**：origin 推断题的转述。

HTTP 请求本身无法可靠告诉服务端"用户地址栏真实 URL"（尤其反代后）。SvelteKit 需要 origin 来重建绝对 URL、跑 CSRF origin 比对。不设会导致表单 action 误判 "Cross-site POST form submissions are forbidden"、绝对 URL 生成错误。`ORIGIN=https://my.site` 最简；反代场景用 `PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host`。

### 3. (A) devDependencies 与 dependencies 如何影响 adapter-node 产物？
**来源**：打包 vs 外部化题的转述。

devDependencies 会被 **Rollup 打进** bundle（运行时不再需要它们在 node_modules）；dependencies **外部化**，运行时真从 node_modules 加载。所以生产镜像 `npm ci --omit dev` 只装 dependencies 即可——前提是把只在构建期用的都归 dev、SSR 运行要用的留 dependencies。

### 4. (B) 本地跑得好、Docker 里 500 找不到某包，多半是什么归类错了？
**来源**：容器化依赖错分排坑题的转述。

该包被放进了 devDependencies（构建期打进/或运行期 node_modules 里没有它），但 SSR 运行时需要它——而运行镜像 `--omit dev` 不装 dev 依赖。修法：把运行时外部化依赖移到 dependencies。反向错（把纯构建工具放 dependencies）会让镜像虚胖但通常不报错。

### 5. (B) 生产 .env 明明在，进程却读不到，为什么？两种补救？
**来源**：环境变量加载时机排坑题的转述。

`.env` 只在 dev/preview 由 Vite 自动读，**生产 adapter-node 不自动加载**。补救：①`node -r dotenv/config build`（先装 dotenv）；②Node v20.6+ 用 `node --env-file=.env build`。或直接由编排系统（Docker `-e`、K8s ConfigMap/Secret）注入真实环境变量——生产更推荐后者，别把 .env 打进镜像。

### 6. (A) 描述 adapter-node 的优雅停机流程与 sveltekit:shutdown 事件的价值。
**来源**：停机语义题的转述。

收到 SIGTERM/SIGINT：①`server.close` 拒新请求；②`closeIdleConnections` 等已发未完成的请求空闲后关闭；③超过 `SHUTDOWN_TIMEOUT`（默认 30s）后 `closeAllConnections` 强关剩余。`sveltekit:shutdown` 在"所有连接关完"后发出，**支持 async、即使有 dangling 工作（如开着的 DB 连接）也保证触发**，比 Node `exit` 可靠——适合 `await db.close()`。

### 7. (B) 用 handler.js 自建 Express server 后 PORT/SHUTDOWN_TIMEOUT 突然不生效，为什么？
**来源**：自定义 server 变量陷阱题的转述。

生命周期类变量（PORT/HOST/SOCKET_PATH/SHUTDOWN_TIMEOUT/IDLE_TIMEOUT/KEEP_ALIVE_TIMEOUT/HEADERS_TIMEOUT/LISTEN_*）**只有默认 `node build` server 认**。自定义 server 只有 handler 自身读的变量（ORIGIN/PROTOCOL_HEADER/HOST_HEADER/PORT_HEADER/ADDRESS_HEADER/XFF_DEPTH/BODY_SIZE_LIMIT）生效；端口、优雅停机得你自己实现。

### 8. (C) ADDRESS_HEADER + XFF_DEPTH 解决什么？为什么从右往左数而不是取最左？
**来源**：真实客户端 IP 题的转述。

反代后 `event.getClientAddress()` 拿到的是最内层代理 IP。设 ADDRESS_HEADER（如 X-Forwarded-For）后按 XFF_DEPTH（可信代理数）**从右往左**取值。读最左易被伪造（攻击者在列表左侧塞假地址）；从右数可信代理个数才抗 spoof。要最左（真实优先于可信，如地理定位）得自己在 handle 读头。

### 9. (C) 自托管 adapter-node vs 上 Vercel/Netlify，在冷启动、静态托管、TLS、控制粒度上怎么选？
**来源**：三条部署路对照题的转述。

自托管常驻进程**无 serverless 冷启动**、进程/连接/停机全权可控、合规自持，代价是 TLS 与静态缓存头要自己经反代配。平台适配器：CDN 自动托管静态 + 边缘缓存 + 默认给 TLS + 自动填 origin 环境变量，运维近乎零，但 SSR 变函数有冷启动、控制粒度受平台约定与逐页 `config` 约束。长连接/慢计算选自托管，零运维/边缘选平台。

### 10. (C) adapter-node 与 Node 生态里的 Express/Next standalone 部署心智比？
**来源**：跨栈部署对比题的转述。

类似 Next `output:'standalone'`（产自包含 server.js）与 Express 自建 http server。Kit adapter-node 的差异：SSR 与静态托管**开箱合一**、优雅停机/环境变量协议/precompress 内置、要嵌进已有 Express 时提供 handler.js 作中间件而非从零写。且"换 adapter 即换落地"的抽象是它相对单体框架最灵活的点。

### 11. (D) 给 adapter-node 写一个多阶段 Dockerfile，并说明 ORIGIN 为何运行时注入而非构建期。
**来源**：容器化设计题的转述。

build 阶段 `npm ci && npm run build`；runtime 阶段 `npm ci --omit dev` + `COPY --from=build /app/build`，`CMD ["node","build"]`。ORIGIN/HOST/PORT 等属**部署位置信息**，同一镜像要复用 staging/prod 多环境，构建期烤死会锁死环境——故用运行时 `-e`/K8s 注入。EXPOSE 仅文档性，真正端口靠 PORT 变量。

### 12. (D) 设计"健康检查 + 结构化日志 + Sentry"三件套挂在 adapter-node 上的落点。
**来源**：可观测性集成情景题的转述。

健康检查：用 handler.js 自定义 server 加 `app.get('/healthcheck',...)`（不跑业务逻辑）供 K8s/LB 探活。日志：在 handle（L5）计时+打访问日志、`resolve` 后按需加响应头（不可变头先 clone）。错误：`handleError`（服务端那份）生成 errorId、送 Sentry、返回安全的 `{ message, errorId }`，并扩 App.Error 带 errorId，供用户报障时关联——三条都用 hooks/handler 收口，不改业务码。

🚀 **下一组**：L6 课后作业——生产拓扑与环境变量纪律的综合复盘。
