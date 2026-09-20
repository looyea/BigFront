# L8 作业：生产部署 / 性能调优

> 覆盖：exp-deploy / exp-perf

---

## 一、读代码（10 题）

### 1. 这个 Dockerfile 有哪些生产隐患？至少指出 3 条。

```dockerfile
FROM node:22
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

### 2. 阅读 PM2 配置，`instances` 和 `exec_mode` 有什么要求？裸机和 K8s 分别该怎么选？

```js
{ apps: [{ name: 'api', script: 'server.js', instances: 'max', exec_mode: 'cluster' }] }
```

### 3. 反代后接口偶发 502，看下面 Nginx 与 server 配置，问题出在哪？

```nginx
# nginx: proxy_read_timeout / upstream keepalive 空闲 60s
```
```js
server.keepAliveTimeout = 5000;   // Node 5s 就关连接
```

### 4. 这段健康检查为什么可能引发"重启雪崩"？怎么改？

```js
app.get('/healthz', async (req, res) => {
  await db.ping(); await redis.ping(); await fx.check();   // 很重
  res.sendStatus(200);
});   // 同时被配成 liveness 和 readiness
```

### 5. 阅读优雅关闭，缺了哪一步会让 K8s 滚动更新时仍有请求 500？

```js
process.on('SIGTERM', () => { db.disconnect(); process.exit(0); });
```

### 6. 这段代码有什么性能问题？（提示：事件循环）

```js
app.get('/report', (req, res) => {
  const raw = fs.readFileSync('/data/big.json');   // 同步
  const data = JSON.parse(raw);
  res.send(processRows(data));                     // CPU 密集循环
});
```

### 7. 数据库慢，看这段查询代码，除了加索引还有什么问题？

```js
for (const id of ids) {
  const u = await pool.query(`SELECT * FROM users WHERE id = ${id}`);   // 逐条 + 拼接
}
```

### 8. 阅读缓存代码，它防住了雪崩吗？防住击穿/穿透了吗？

```js
const hit = await redis.get(key);
if (hit) return JSON.parse(hit);
const row = await db.find(id);
await redis.set(key, JSON.stringify(row), 'EX', 60);   // 所有 key 固定 60s
```

### 9. 这段监控/日志配置在容器里有什么问题？

```js
logger: pino.destination('/var/log/app.log')   // 写本地文件
```

### 10. 为什么镜像用 `FROM app:latest` 部署会让回滚失效？

---

## 二、手写（5 题）

### 1. 为一个 Express 5 应用写多阶段 `Dockerfile`（`npm ci --omit=dev`、非 root、`.dockerignore`）+ `PM2 ecosystem` 或 K8s 单进程清单。

### 2. 写一段完整的优雅关闭代码：SIGTERM → readiness 转 503 → `server.close()` → 关 DB/Redis → 10s 超时兜底 `exit`，并处理 `uncaughtException`。

### 3. 实现 Nginx 反代配置（TLS + HSTS + `X-Forwarded-*` + `keepalive` upstream）并给出配套的 Express `trust proxy` 设置。

### 4. 写一个 cache-aside 帮助函数 `withCache(key, ttl, loader)`：命中返回、miss 回填，并加 TTL 随机抖动防雪崩 + 空值缓存防穿透。

### 5. 用 autocannon 或 k6 写一段压测脚本，对一个混合场景（读接口 + 写接口）加压，输出 RPS 与 P99，并说明如何据此定限流阈值。

---

## 三、场景题（1 题）

### 1. 上线后每到流量高峰，接口 P99 从 80ms 飙到 3s、Pod 频繁 OOMKilled 重启、DB 连接报 "too many connections"。请给出系统性排查与优化路线（分别定位：事件循环阻塞？连接池配置？内存泄漏？缓存缺失？实例数/limits？），并说明每步的度量依据。

---

## 四、简答题（3 题）

### 1. 为什么"先测量再优化"？只看平均延迟为什么会骗人？

### 2. liveness 与 readiness 探针为什么要分离？把重依赖检查放 liveness 会怎样？

### 3. 缓存穿透、击穿、雪崩分别是什么，各给一个对策。

---

## 五、挑战题（1 题）

### 🏆 把 L6 的 user 模块"送上生产"

产出一套可上线资产：
- 多阶段 `Dockerfile` + `.dockerignore` + `PM2 ecosystem` 与等价的 K8s Deployment（单进程 + probes）
- Nginx 反代（TLS/HSTS/`X-Forwarded-*`/keepalive）+ `trust proxy`
- `/healthz`(liveness) 与 `/readyz`(readiness) 分离实现
- 优雅关闭（摘流量 → close → 关依赖 → 超时兜底）
- 热点读 cache-aside（含抖动/空值/互斥锁三防）
- 连接池（DB + 出网 agent）参数与归还保障
- 压测脚本 + 一页性能基线报告（RPS/P50/P99/错误率/资源）
- 发布策略说明（滚动 or 金丝雀）+ 回滚步骤（不可变镜像 tag）
- README：从 `git push` 到线上的 CI/CD 流水线概览
