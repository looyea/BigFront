# 生产部署全链路

> 目标：**把一个 Express 应用安全地送上生产并稳定运行**——多进程 cluster/PM2、Docker 镜像、Nginx 反向代理、HTTPS 证书、健康检查、日志收集、优雅关闭、发布策略。

---

## 一、上线前的心理模型：进程 ≠ 应用

Node 是**单线程单进程**（呼应 L1 事件循环）。一个进程 = 一个 CPU 核都用不满。生产要点：

- **多核利用** → cluster / 多实例；
- **崩溃自愈** → 守护进程自动重启；
- **无状态** → 任意实例可服务任意请求（会话外置 Redis，呼应 L5）；
- **配置注入** → 环境变量/Secret（12-Factor，呼应 L6）。

---

## 二、多进程：cluster 与 PM2

### 2.1 原生 cluster

```js
import cluster from 'node:cluster';
import os from 'node:os';

if (cluster.isPrimary) {
  for (let i = 0; i < os.cpus().length; i++) cluster.fork();
  cluster.on('exit', (w) => { console.error(`worker ${w.pid} died`); cluster.fork(); });
} else {
  import('./server.js');   // 每个 worker 各自 listen 同一端口（内核分发连接）
}
```

primary 进程共享监听句柄，把 accept 到的连接分发给 worker → 打满多核。

### 2.2 PM2（进程管理器）

生产更常用 PM2/systemd，负责 fork、重启、日志、reload：

```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 status / pm2 logs / pm2 reload api   # 零停机重载
```

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'api',
    script: 'server.js',
    instances: 'max',        // 每核一个
    exec_mode: 'cluster',
    max_memory_restart: '512M',   // 内存超阈值自动重启（兜泄漏）
    env: { NODE_ENV: 'production' },
    merge_logs: true,
  }],
};
```

> 容器编排（K8s）里通常**不再用 PM2 cluster**——由平台横向扩多 Pod、每 Pod 单进程，重启/调度交给 K8s。两种方式别叠用。

---

## 三、Docker 化

```dockerfile
# ---- 构建阶段 ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # 锁定版本、可复现
COPY . .
RUN npm run build || true     # 如需 TS 编译/资源构建

# ---- 运行阶段（瘦身）----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node                     # 非 root 运行
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

要点：
- **多阶段构建**：devDeps/源码不进运行镜像 → 体积小、攻击面小；
- **`npm ci`** 而非 `npm install`：严格按 lockfile，可复现；
- **非 root**（`USER node`）：容器逃逸时降权；
- **`.dockerignore`** 排除 `node_modules`/`.env`/`.git`；
- 只跑**单进程**，横向扩展交给编排层。

---

## 四、Nginx 反向代理

Node 直接暴露公网不理想。**反代**（Nginx/Caddy/云 LB）负责：TLS 终结、静态资源、限流、gzip、缓冲、多实例负载均衡、隐藏后端。

```nginx
upstream api {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;   # 多 worker
    keepalive 64;            # 复用到后端的连接（见 L8 性能）
}
server {
    listen 443 ssl http2;
    server_name example.com;
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # 让 app 知道原始是 http/https
    }
}
```

> ⚠️ 反代后 `req.ip` 全是代理 IP。**必须** `app.set('trust proxy', 1)`（呼应 L3），否则限流/日志/IP 判断全错。`X-Forwarded-Proto` 决定 `req.secure`。

---

## 五、HTTPS 与证书

- **在哪终结**：优先在 LB/Nginx 终结 TLS（性能好、集中管理），到后端走内网 http；端到端加密场景才在 Node 起 https。
- **证书**：Let's Encrypt（certbot 自动续期）/ 云证书。**全站强制 HTTPS**：`helmet.hsts()`（呼应 L6）+ HTTP→HTTPS 301。
- **不要在代码里硬编码证书路径判断环境**——从配置注入。

---

## 六、健康检查（探活）

编排/监控系统需要知道"这个实例能不能接流量"。提供两类端点：

```js
import { Router } from 'express';
const health = Router();

// liveness：进程还活着吗？（卡死/死锁则应被重启）
health.get('/healthz', (req, res) => res.sendStatus(200));

// readiness：能干活吗？检查关键依赖（不检查也可返回 200 表示就绪）
health.get('/readyz', async (req, res) => {
  try {
    await db.ping({ $top: 1 });         // DB 可达？
    await redis.ping();                  // 缓存可达？
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });   // 摘出负载均衡轮询
  }
});
export default health;
```

K8s：`livenessProbe` 失败→重启；`readinessProbe` 失败→暂停转发但不重启。**别把 readiness 和 liveness 配成同一个重检查**（DB 抖动会引发全量重启雪崩）。

---

## 七、优雅关闭（Graceful Shutdown）

发版/缩容时收到 `SIGTERM`，**不能掐断在途请求**（否则用户 500、数据写一半）。流程：

```js
// server.js
import app from './app.js';
import config from './config/index.js';
import { logger } from './common/logger.js';

const server = app.listen(config.port);
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown start');
  app.set('shuttingDown', true);          // 让 /readyz 返回 503，先摘流量

  const force = setTimeout(() => {
    logger.error('forced exit after timeout');
    process.exit(1);
  }, 10_000);                              // 兜底：超时未清空强退
  force.unref();

  server.close(async () => {               // 停止 accept 新连接，等在途请求完成
    try {
      await db.disconnect();
      await redis.quit();
      await logger.flush?.();
      logger.info('shutdown complete');
      clearTimeout(force);
      process.exit(0);
    } catch (e) {
      logger.error(e, 'error during shutdown');
      process.exit(1);
    }
  });
}

['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (r) => { logger.error({ reason: r }, 'unhandledRejection'); });
process.on('uncaughtException', (e) => { logger.error(e, 'uncaughtException'); shutdown('uncaught'); });
```

关键点：
- `server.close()` 停止接收新连接并等待现有连接结束（Node 18.2+ 会自动销毁空闲 keep-alive 连接）；
- **先摘流量再关**：K8s 里配 `preStopHook`（`sleep 5`）+ readiness 503，等 kube-proxy 更新转发规则，避免"已终止但仍有新请求打来"的竞态；
- 超时兜底 `process.exit(1)`，防 hang 住永不退出；
- 处理 `SIGTERM/SIGINT/uncaughtException/unhandledRejection`。

---

## 八、配置、密钥与日志收集

- **配置**：全部经环境变量注入（`PORT`/`DATABASE_URL`/`REDIS_URL`/`NODE_ENV`/`LOG_LEVEL`）；启动即校验（呼应 L6 fail-fast）。
- **密钥**：K8s Secret / 云 Secret Manager / Vault，**绝不进镜像层、不进 git**。
- **日志**：进程只把结构化 JSON（pino，呼应 L6）**写到 stdout/stderr**，由平台（Docker driver、Fluent Bit、Filebeat）收集进 Loki/ELK；不在应用里写本地文件轮转。
- **时区/区域**：容器里显式设 `TZ`，别依赖宿主。

---

## 九、发布策略

| 策略 | 做法 | 回滚 |
|------|------|------|
| 滚动发布 | 逐实例替换，readiness 通过才下一个 | 快，留旧版本实例 |
| 蓝绿 | 两套环境，流量原子切换 | 秒级切回 |
| 金丝雀 | 先放 5% 流量观察指标再放量 | 关小流量即可 |
| 停机 | 直接停旧起新 | 有中断，慎用 |

无论哪种，**优雅关闭 + 健康检查**是无停机的地基。镜像 tag 用不可变版本号（别用 `latest`），保证可回滚可追溯。

---

## 十、上线检查清单

- [ ] `NODE_ENV=production`、关掉 `x-powered-by`、开 `view cache`（呼应 L4）
- [ ] 多实例无共享内存态（会话/限流计数进 Redis）
- [ ] Docker 多阶段 + `npm ci --omit=dev` + 非 root + `.dockerignore`
- [ ] Nginx 反代 + `trust proxy` + TLS + HSTS + 全站 HTTPS
- [ ] `/healthz`(liveness) 与 `/readyz`(readiness) 分离
- [ ] 优雅关闭（SIGTERM → 摘流量 → close → 关依赖 → 超时兜底）
- [ ] 日志 JSON→stdout 由平台采集；密钥外部注入；启动 fail-fast
- [ ] 不可变镜像 tag + 可回滚 + 监控告警（错误率/延迟/Pod 重启数）

---

## 🚀 部署预告

- **CI/CD**：Git push → 构建镜像 → 推 Registry（带 git sha tag）→ 部署到 K8s/云 → 冒烟测试；lint+test+coverage 门禁前置（呼应 L7）。
- **可观测性三支柱**：logs（本次）+ metrics（Prometheus/`prom-client` 暴露 `/metrics`）+ traces（OpenTelemetry），下一关性能调优会用到。
- **自动扩缩 HPA**：按 CPU/自定义指标增减副本，配合无状态才有效。

下一关 **exp-perf 性能调优**——keep-alive/连接池/压缩/缓存/内存泄漏检测/benchmark，把"能跑"变成"跑得又快又稳"。
