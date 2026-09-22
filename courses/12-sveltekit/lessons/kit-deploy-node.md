# 生产拓扑：standalone Node、Docker 与云

> 目标：把 adapter-node 产物跑成一台可运维的生产服务——`node build` 的启动与"静态托管 vs SSR"的分工、ORIGIN/代理头/XFF 等环境变量纪律、Dockerfile 多阶段要点、优雅停机与健康检查、Vercel/Netlify/自托管三条路的对照（呼应 svelte-deploy、next-deploy、node-deploy、docker 主题）

## 一、产物与启动：三件套 + 一条命令

`npm run build`（走 adapter-node）在 `build/`（默认，可 `out` 改）里生成**自包含 Node 服务器**。跑起来要三样：
1. `build/` 输出目录；
2. 项目 `package.json`；
3. **生产依赖** `node_modules`——复制 `package.json`+`package-lock.json` 后 `npm ci --omit dev` 生成（无依赖可跳过）。

启动就一句 `node build`，默认监听 `0.0.0.0:3000`。哪些包进 bundle、哪些留 external 由 `package.json` 归类决定：devDependencies → Rollup **打进**产物；dependencies → **外部化**（运行时真去 node_modules 要）。

分工要点：**adapter-node 的 server 同时负责 SSR 动态页与"托管预渲染页 + 静态资源"**——预渲染成的 HTML 与 `_app/immutable/**` 资源由这个 server 直接吐（生产下 `.env` 不自动加载，见下），所以通常**不需要另配 Nginx 静态根**；要压缩、TLS、多实例负载均衡，则把它放**反向代理**后面。

## 二、环境变量纪律：SvelteKit 凭什么知道自己"在哪"

HTTP 请求本身无法可靠告诉服务端"用户浏览器地址栏的真实 URL"。生产必须显式交代 origin，否则**表单 action 会撞 "Cross-site POST form submissions are forbidden"**（CSRF origin 比对拿错站点）：

| 变量 | 作用 |
|---|---|
| `PORT` / `HOST` | 改监听端口/主机（默认 3000 / 0.0.0.0） |
| `SOCKET_PATH` | 走 unix socket（设了就忽略 HOST/PORT） |
| **`ORIGIN`** | 直接告诉 Kit 部署地址：`ORIGIN=https://my.site` |
| `PROTOCOL_HEADER` / `HOST_HEADER` | 反代后从转发头重建 origin：`PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host` |
| `PORT_HEADER` | 反代+非标准端口时加 `x-forwarded-port` |
| `ADDRESS_HEADER` / `XFF_DEPTH` | `event.getClientAddress()` 读真实客户端 IP；XFF 列表**从右往左**数 `XFF_DEPTH` 个可信代理 |
| `BODY_SIZE_LIMIT` | 请求体上限（默认 **512kb**，支持 K/M/G 后缀；`Infinity` 关掉自己 in handle 校验） |

安全红线（文档明写）：`x-forwarded-*` 是**事实标准但可被伪造**——**只有当你的 server 确实躲在一个可信反代后面才设这些头**；否则客户端能 spoof。XFF 读**最左**地址易被 spoof（`<伪造>, <真客户>, <p1>, <p2>`），Kit 默认从右数，就是防这个。

`.env` 加载：**dev/preview 自动读，生产不自动读**——要么 `node -r dotenv/config build`，要么 Node v20.6+ 用 `node --env-file=.env build`。还能用 `envPrefix: 'MY_'` 给以上所有变量加前缀，避免和你不可控的环境变量撞名。

## 三、Dockerfile 多阶段要点

adapter-node 产物天然适合"构建阶段全量依赖、运行阶段只留生产"：

```dockerfile
FROM node:20 AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build          # 全量依赖构建

FROM node:20 AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit dev                 # 只装生产依赖
COPY --from=build /app/build ./build
ENV ORIGIN=https://my.site NODE_ENV=production
EXPOSE 3000
CMD ["node", "build"]
```

要点：①运行镜像**只 `--omit dev`**（前提是你的 SSR 外部化依赖都在 `dependencies`）；②`ORIGIN` 等**运行时**注入而非构建期烤死（同一镜像多环境复用）；③`EXPOSE` 只是文档性、真正端口靠 `PORT`；④precompress 默认 true 已产 `.br/.gz`，反代直接 serve 省 CPU（Node 单线程，压缩尽量交给反代）。

## 四、优雅停机、健康检查与可观测

- **优雅停机**（默认 server 自带）：收 SIGTERM/SIGINT → ①`server.close` 拒新请求 → ②`closeIdleConnections` 等在途完成 → ③`SHUTDOWN_TIMEOUT`（默认 30s）后 `closeAllConnections` 强关。要清理 DB/队列，监听 **`sveltekit:shutdown`** 事件（支持 async，且保证连接全关后才发，比 Node `exit` 可靠）。
- **自定义 server 的陷阱**：用 `handler.js` 自己挂 Express 时，**只有 ORIGIN/PROTOCOL_HEADER/HOST_HEADER/PORT_HEADER/ADDRESS_HEADER/XFF_DEPTH/BODY_SIZE_LIMIT 生效**；`PORT/HOST/SHUTDOWN_TIMEOUT/IDLE_TIMEOUT/...` 这些**生命周期变量默认 server 才认**，自定义 server 得自己实现（示例里 hardcode `listen(3000)` 无视 PORT）。
- **健康检查**：自定义 server 最顺手——`app.get('/healthcheck', ...)` 再 `app.use(handler)`，给编排器（K8s readiness / LB 探活）一个不打业务逻辑的轻端点。
- **日志**：把访问日志/错误日志放 handle 与（L5 的）handleError 里，结构化输出 errorId，与 Sentry/DD 关联。

## 五、三条部署路对照：自托管 vs Vercel vs Netlify

| 维度 | 自托管 adapter-node（Docker/裸机） | Vercel / Netlify（平台适配器） |
|---|---|---|
| SSR 落点 | 一个常驻 Node 进程 | 拆成 serverless function（Netlify）/ serverless+edge（Vercel，靠 `config.runtime` 逐路由分） |
| 冷启动 | 无（进程常驻） | 有（函数冷启，edge 缓解） |
| 静态资源 | 自己/反代托管，缓存头自己配 | 平台 CDN 自动托管 + 边缘缓存 |
| TLS/HTTP2 | 反代（Caddy/Nginx/Traefik）配 | 平台默认给 |
| 环境变量 | 自己注入 ORIGIN 等 | 平台自动填 origin/代理头，一般无需手写 |
| 控制粒度 | 全权（自定义 server、连接池、优雅停机） | 靠 adapter options + 每页 `export const config` |

选型：要**长连接/慢计算/精细进程控制/合规自持**→ adapter-node 自托管；要**零运维/边缘/自动扩缩**→ 平台适配器。同一份代码换 adapter 即换落地形态——这正是 L6 开篇"一份代码 N 种形态"的收口。**别忘 form action 的 origin 坑**：平台通常帮你处理好，自托管反代后一定要设对 `ORIGIN` 或 `PROTOCOL_HEADER/HOST_HEADER`，否则跨站检查误伤。

## N、自检清单

1. adapter-node 产物跑起来需要哪三样、一条什么命令？devDependencies/dependencies 如何决定"打进 vs 外部化"？
2. 为什么自托管反代后不设 ORIGIN/代理头会让表单 action 报"Cross-site"？生产 `.env` 为什么不自动加载、怎么补救？
3. `XFF_DEPTH` 为什么"从右往左数可信代理"而不是读最左地址？
4. 用 handler.js 写自定义 server 时，哪些环境变量还生效、哪些失效？健康检查放哪最顺手？
5. 同一份代码，"自托管 adapter-node"与"Vercel/Netlify"在冷启动、静态托管、TLS、控制粒度上各自的取舍是什么？

🚀 **下一站 L7**：kit-api-design——`+server.ts` 的 API 工程：各 HTTP 方法路由组织、错误响应一致性、Response 流式返回与 Cache-Control/ETag 策略。
