# Next.js 部署：Vercel、standalone、Docker 与 Nginx

测试给质量上了保险（呼应 next-testing），这一关把船开出去。Next 部署的核心矛盾：它不是纯静态站（有服务端运行时），也不是普通 Node 服务（多出 Edge 运行时、缓存层、Image Optimizer 等定制组件）——不同部署目标能开启哪些能力，差异巨大（部署通用知识先呼应 node-deploy-perf、vue-deploy、vite-deploy、exp-deploy 四关）。

## 1. 先分家：三种部署目标的能力矩阵

| 能力 | Vercel | 自托管 Node | 静态导出 export |
|------|--------|------------|----------------|
| SSR / ISR / PPR | ✅ 全功能 | ✅ 全功能 | ❌ 仅 SSG |
| Server Actions | ✅ | ✅ | ❌ |
| Route Handlers | ✅ node+edge | ✅ node | ❌ |
| middleware | ✅ | ✅（node 模拟） | ❌ |
| Image Optimizer | ✅ 零配置 | ⚠️ 需 sharp | ❌ |
| Full Route Cache 跨实例共享 | ✅ 平台内置 | ⚠️ 需自建 KV | — |

最后一行是自托管最大的坑：多实例部署时，实例 A 处理过 `revalidateTag` 不知道要通知实例 B，Vercel 用平台缓存层打通，自建则要配 `cacheHandler`（实验）或干脆单写失效广播（呼应 next-revalidate 第 6 节 tag 机制的分布式难题）。纯 SSG 站（博客/文档）用 `next export`（v14+ 写 `output: 'export'`）回归纯静态，CDN 一把梭最省心——先确认没有用到任何动态能力（next-render-modes 里 ○ 和 ● 能上线、ƒ 全军覆没）。

## 2. Vercel：零配置的默认答案

```bash
vercel link && vercel --prod   # CLI 直发；或推 git 自动部署
```

Git 集成下每个 PR 自动出 Preview 部署（带独立域名，评审直接点着看）——这是"部署链接当测试报告用"的工作流红利。环境变量在 Dashboard 配，区分 Production/Preview/Development 三桶；`NEXT_PUBLIC_` 前缀的会被内联进浏览器 bundle，**任何塞进 NEXT_PUBLIC_ 的密钥都是公开密钥**（呼应 next-middleware-auth 第 1 节"cookie 与会话"的安全线、vite-env 同款陷阱）。多区域部署、分析（Analytics/Speed Insights）都是平台付费增值项。

## 3. standalone：自托管的正确产物形态

默认 `.next` 目录跑服务还得带着完整 node_modules（上千个包、镜像巨大）。开启：

```js
// next.config.js
module.exports = { output: 'standalone' };
```

`next build` 后生成 `.next/standalone/`：基于依赖图裁剪出**最小 server.js + 所需 node_modules**，通常从几百 MB 缩到几十 MB。注意它默认不含静态资源，要手动补：

```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

多阶段构建再压一层：deps 与 builder 阶段装全量依赖，runner 只拷 standalone 产物（Docker 分层缓存思路同 vue-deploy 第 4 节）。跑起来后用 `pm2` 或 systemd 守护，进程级调优（集群、内存上限）回到 node-cluster/node-deploy-perf 的老手艺。

## 4. 运行时与环境细节

- **NODE_OPTIONS 与内存**：容器内存限额下 V8 默认堆可能超量被 OOM kill，`node --max-old-space-size` 显式设；构建期 OOM 是 CI 常客；
- **环境变量时机**：`NEXT_PUBLIC_` 构建期内联（改了必须重新 build），服务端变量运行时读（改了重启即可）——同一份镜像想跑多环境，只能用非 public 变量（呼应 node-config 第 2 节十二要素）；
- **端口与 HOSTNAME**：standalone server.js 读 `PORT`/`HOSTNAME`，容器里记得 `HOSTNAME=0.0.0.0` 否则只听 127.0.0.1，外部探不到；
- **Edge 运行时**：middleware 与 `export const runtime='edge'` 的路由在自建环境由 Node 模拟执行（能力子集有差异），上了量要回归测试 geo/api 等 Edge API（呼应 next-route-handlers 第 6 节 edge vs node）。

## 5. Nginx / CDN 前置：把合适的流量挡在应用外

```nginx
location /_next/static/ {
  proxy_cache static_cache;      # 内容哈希命名，可缓存一年
  add_header Cache-Control "public, max-age=31536000, immutable";
  proxy_pass http://next_app;
}
location / {
  proxy_pass http://next_app;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header Host $host;
}
```

要点：① 静态资源直接给 immutable（呼应 next-perf 第 4 节）；② ISR 页面想让 CDN 顶住回源，透传 `stale-while-revalidate` 或在 CDN 层配置；③ `X-Forwarded-*` 系列决定 `req.ip` 与协议识别，配错会导致重定向跳 http 死循环；④ HTTPS 终结在 Nginx 则 Node 侧只需 http（TLS 全链路与证书自动化回到 node-https-tls 的领地）；⑤ 若用 next/image 且源站不在 image 优化白名单，检查 `images.remotePatterns`（呼应 next-fonts-images 第 4 节）。

## 6. 发布策略与回滚

- **蓝绿/滚动**：多实例 + Nginx upstream 摘挂流量，standalone 镜像带 git sha 标签，回滚=切 tag 重启，秒级；
- **预热**：滚动发布后新实例缓存全冷，第一批 SSR 请求特别慢——先发几个内部请求暖 Router/Full Route Cache 再放流量；
- **发布验证**：探活打的不该只是 `/`（首页可能 200 但 API 全挂），准备一个 /api/health Route Handler 聚合 DB/缓存检查（呼应 next-route-handlers 第 3 节正当用途）；
- **监控闭环**：instrumentation 上报的 digest 在发布窗口突增即自动回滚信号（呼应 next-error-loading 第 4 节）。

## 7. 自检清单

- [ ] 项目里有没有 ƒ 动态路由被误上到静态导出方案？
- [ ] 镜像是不是 standalone + 多阶段构建？体积多少？
- [ ] NEXT_PUBLIC_ 里有没有不小心塞了密钥？
- [ ] Nginx 是否给 /_next/static 配了 immutable？X-Forwarded-Host/Proto 对不对？
- [ ] 多实例下 revalidateTag 能否穿透所有实例？（cacheHandler 或广播失效）
- [ ] 回滚路径演练过吗？health check 覆盖 DB 了吗？

## 8. 小结

Next 部署三选一：要全功能零运维选 Vercel；要自主可控选 standalone 容器 + Nginx；纯静态用 output:'export' 回归 CDN 极简。选完目标，剩下的全是前面课程的手艺：镜像瘦身、环境变量纪律、缓存头、进程守护、蓝绿回滚——框架课到此，你已经能把一个 React 全栈应用从白板送到生产。

🚀 部署预告：会部署只是零件齐全，下一关 next-fullstack-project 也是本包倒数第二关：把 L1~L8 的所有知识串成一个完整的上线项目，走一遍全流程。
