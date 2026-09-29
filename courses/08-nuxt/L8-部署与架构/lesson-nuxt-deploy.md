# 部署：Nitro preset、.output 与把应用跑在生产上

## 1. build 产物：`.output` 才是交付物

```bash
# 目的：build 出 .output 产物并直接运行——交付物是产物而非源码
nuxt build     # ✅ 产物落在 .output/（server+public 合一，自带依赖闭包）
node .output/server/index.mjs     # ✅ 直接能跑，不需 nuxt 命令、不需全量 node_modules
```

`.output/` 结构（Nitro 打包的一切）：

```
.output/
├─ server/index.mjs      # SSR + API 合一的 Node 服务入口（自带依赖闭包）
├─ public/               # 静态资源（含构建哈希的 JS/CSS、public 目录拷贝）
└─ nitro.json            # 运行时元信息
```

这与 07-nextjs 的 standalone 思路一致：**框架已把服务端代码与依赖打成一个可独立运行的产物**（呼应 next-deploy 第 1 节）。`nuxt dev` 永远不能替代 build 验证——很多 preset 行为、缓存、压缩只在产物里成立（呼应 nuxt-testing 第 2 节的"以产物为准"）。

## 2. preset：一份代码，N 种部署目标

`nitro.preset` 决定产物形态（不写则 build 时按平台自动探测）：

| 目标 | preset | 产物/运行方式 |
|---|---|---|
| 自有服务器/容器 | `node-server` | `.output/server` 起 Node HTTP（默认自托管） |
| 纯静态托管 | `static`（配 `nitro.prerender`） | 全站预渲染成 HTML+资源，丢 CDN/OSS |
| Vercel / Netlify | `vercel` / `netlify` | 平台函数 + CDN |
| Cloudflare | `cloudflare` | Workers/ Pages（Edge 运行时） |
| AWS Lambda / Bun / Deno | `aws-lambda` / `bun` / `deno-deploy` | 对应运行时 |

`nuxt build --preset=static` + `nitro: { prerender: { routes: [...] } }` 得到纯静态站（呼应 nuxt-render-modes 的 SSG）。**静态预设下没有服务端运行时**：`server/**`、route middleware、`useFetch` 的服务端分支、鉴权拦截全不可用——和 Next 的 `output:'export'` 同一限制（呼应 next-deploy 第 3 节）。

## 3. 环境变量：运行期注入，别烧进产物

这是 Nuxt 相对 Next 最舒服的地方（呼应 nuxt-runtime-config 第 5 节）：`runtimeConfig`（含 public 栏）在**服务端启动时**读取，改值重启即可，不必重新构建。

```bash
# 目的：环境变量运行期注入——改值重启即生效，不必重新构建（密钥绝不烧进产物/镜像）
# 生产（容器/系统服务）注入，不写 .env 进镜像
NUXT_PUBLIC_SITE_URL=https://site.com \   # ✅ NUXT_ 前缀 + 声明字段才覆盖 runtimeConfig
NUXT_DATABASE_URL=postgres://... \        # ✅ 私密栏只在服务端读到，不进前端 payload
PORT=3000 HOSTNAME=0.0.0.0 \             # ✅ 容器必设 0.0.0.0，否则只听 127.0.0.1
node .output/server/index.mjs
# ❌ 忘设 HOSTNAME=0.0.0.0 → server 只听本地回环，“本机 curl 通、外部/反代连不上”（容器第一排查项）
```

三条纪律：①密钥只在运行期注入、绝不进 `.env` 提交/镜像（`NUXT_` 前缀 + 声明字段才生效，呼应 nuxt-runtime-config 第 3 节）；②`.env` 只用于本地；③构建环境与生产环境分离——CI 构建机拿不到生产密钥（呼应 nuxt-modules 面试第 12 题、node-deploy-perf）。`HOSTNAME=0.0.0.0` 是容器里"本机通、外部不通"的第一排查项（和 next-deploy 第 4 节同一个坑）。

## 4. 容器化（自托管主力）

```dockerfile
# 目的：多阶段构建——构建层装全量依赖出 .output，运行层只带产物（几十 MB），非 root 跑
# ---- 构建阶段（可用较高 Node）----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci            # ✅ 按 lockfile 精确安装，构建可复现
COPY . .
RUN npm run build     # ✅ 产出 .output/

# ---- 运行阶段（只带产物，瘦身）----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000   # ✅ 关 dev 行为 + 容器必听的 0.0.0.0
COPY --from=build /app/.output ./output   # ✅ 只拷产物，不带 node_modules/源码
EXPOSE 3000
USER node             # ✅ 非 root 运行，降权限
CMD ["node", "output/index.mjs"]
# ❌ 用 alpine(musl) 构建却带 glibc 编译的原生依赖（sharp/bcrypt）→ 运行时 "module not found / GLIBC_x not found"
# ❌ 漏 USER node → 容器以 root 跑，逃逸时权限过大
```

要点：多阶段构建只把 `.output` 带进运行镜像（几十 MB 级，呼应 node-deploy-perf 的镜像瘦身）；运行用户非 root；`NODE_ENV=production` 关闭 dev 行为；健康检查打一个轻量端点（`/api/health`，呼应 nuxt-modules 第 6 题）。原生依赖（sharp、bcrypt 等）要保证构建与运行基座一致（musl vs glibc，呼应 node-deploy-perf）。

## 5. Nginx 反代与静态长缓存

SSR 应用应把静态资源尽量从 Node 卸载到 Nginx/CDN：

```nginx
# 目的：反代卸载静态长缓存 + 透传转发头——静态走 immutable、SSR/API 交 Node
server {
  listen 443 ssl http2;
  server_name site.com;

  # ✅ 带构建哈希的产物：一年不可变缓存（呼应 next-deploy 第 5 节）
  location /_nuxt/ {
    proxy_pass http://127.0.0.1:3000;   # 或直接 alias .output/public/_nuxt/
    proxy_cache_bypass 0;
    add_header Cache-Control "public, max-age=31536000, immutable";   # ✅ 文件名含哈希，改内容即换名，可放心长缓存
  }
  # ✅ 其余交给 Node（SSR + /api）
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;                                        # ✅ 服务端才知道真实域名（生成 canonical 用）
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;        # ✅ 透传真实客户端 IP（限流/日志）
    proxy_set_header X-Forwarded-Proto $scheme;                         # ✅ 透传 https，否则 secure cookie 判定失败
  }
}
# ❌ 漏配 X-Forwarded-Proto → 服务端以为请求是 http，secure cookie/重定向判断出错，甚至 http↔https 死循环
```

`X-Forwarded-*` 必须透传，否则服务端拿到的请求协议/客户端 IP/域名会错（影响 secure cookie 判定、canonical 生成、限流、日志，呼应 node-http）。多实例时 `defineCachedEventHandler`/session 的缓存要放 Redis 等共享存储，内存缓存不跨实例（呼应 nuxt-server-routes、nuxt-perf 面试第 12 题）。

## 6. 进程与可扩展性

- **单进程吃单核**：Node SSR 是 CPU+IO 混合，容器里用 `node --max-old-space-size` 控内存、靠**多副本**而非多线程扩缩（呼应 node-cluster）；重 CPU 任务下 worker_threads（node-workers）。
- **优雅退出**：处理 SIGTERM 摘流量、完成在途请求（K8s preStop + `terminationGracePeriod`，呼应 node-deploy-perf）。
- **SSR 每请求建 app**（nuxt-lifecycle），无跨请求内存态可依赖——任何进程级缓存都按"会被并发共享"对待（呼应 nuxt-state 第 6 节）。

## 7. Nuxt vs Next 部署对照

| 维度 | Nuxt（Nitro） | Next.js |
|---|---|---|
| 产物 | `.output`（server+public） | standalone server.js / `.next` |
| 一份代码多目标 | preset 家族（含 Edge/静态/各云） | Vercel/自托管/`output:export` |
| 运行期配置 | runtimeConfig（重启即生效） | 非 public 变量运行期、public 构建期 |
| 静态 | `--preset=static`+prerender | `output:'export'` |
| Edge | cloudflare preset（Nitro 跑 Workers） | Edge Runtime（受限 API） |

Nitro 的"preset 覆盖几乎所有运行时"是 Nuxt 部署上最被称道的差异化能力——同一份 `.output` 逻辑，换个 preset 就换一个目标平台。

## 8. 自检清单

- [ ] 用 `nuxt build` 产物验证过，而非只跑 dev？
- [ ] 密钥走运行期环境变量注入、构建机不含生产密钥？
- [ ] 容器设了 `HOSTNAME=0.0.0.0`、`NODE_ENV=production`、非 root？
- [ ] `/_nuxt/` 走 immutable 长缓存、`X-Forwarded-*` 透传？
- [ ] 多实例的缓存/session 是否共享存储？
- [ ] 有无健康检查端点与优雅退出？
- [ ] 静态预设下是否清楚哪些服务端能力失效？
- [ ] 原生依赖的构建/运行基座是否一致？

## 9. 🚀 部署预告

部署链路打通，下一关 **nuxt-fullstack-project**：把八阶段能力收拢进一个真实全栈应用（NoteDeck-N），从目录规划、数据层、鉴权、缓存到部署串成一条完整交付线——用工程顺序检验前面每一关是不是真会用。
