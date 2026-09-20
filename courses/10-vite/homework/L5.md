# L5 作业：框架集成与 SSR / 部署

> 覆盖：vite-framework / vite-ssr / vite-deploy

---

## 一、读代码（10 题）

### 1. 这个 Vue 项目构建后白屏（部署在 `https://x/console/`），最可能是哪一行配错了？

```js
export default { base: '/', plugins: [vue()] };
```

### 2. 阅读配置，为什么 `.vue` 文件能编译？少了哪个插件会怎样？

```js
import react from '@vitejs/plugin-react';
export default { plugins: [react()] };   // 项目里同时有 .vue 组件
```

### 3. 这段 Nginx 部署 SPA 缺少什么会导致刷新 `/user/1` 报 404？

```nginx
location / { root /var/www/dist; index index.html; }
```

### 4. 阅读缓存头配置，哪个文件的策略是错的？会带来什么后果？

```nginx
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location = /index.html { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

### 5. 阅读 SSR server 代码，`ssrLoadModule` 用在这里对不对？生产该怎么做？

```js
const { render } = await vite.ssrLoadModule('/entry-server.js');   // 生产 Node 服务里
```

### 6. 这段 SSR 有什么安全隐患？

```js
html.replace('__STATE__', `<script>window.S=${JSON.stringify(req.user)}</script>`);
```

### 7. 阅读 monorepo 配置，为什么改 `@acme/ui` 源码应用没热更、还要手动 build？

```js
// apps/vite.config.js
export default { optimizeDeps: { include: ['@acme/ui'] } };   // 库入口指向 dist
```

### 8. 这段库模式配置有什么会导致消费方出现"两份 Vue 实例"？

```js
build: { lib: { entry: 'src/index.ts', formats: ['es'] } }   // 没配 external
```

### 9. 阅读代码，为什么这里会出现 hydration mismatch？

```js
// entry-server 与 entry-client 都会执行
const time = Date.now();
return <p>渲染于 {new Date(time).toLocaleTimeString()}</p>;
```

### 10. 这个 Vite 6 自定义插件用了 `apply`。若想它在 client 与 ssr 两个环境用不同 transform，更 Vite6 的写法是什么？

```js
export default { name: 'p', apply: 'build', transform(c){ /* ... */ } };
```

---

## 二、手写（5 题）

### 1. 为一个"部署在子路径 `/dashboard/` + history 路由"的 Vite SPA，给出正确的 `base` 配置与 Nginx（SPA fallback + hashed 资源 immutable + index.html no-cache）。

### 2. 用 Vite SSR API（`createServer` + `middlewareMode` + `transformIndexHtml` + `ssrLoadModule`）写一个最小 Node 服务端，把 Vue/React App 渲染成 HTML 返回。

### 3. 写 SSR 的 state 序列化与注水：服务端把数据序列化进 `__INITIAL_STATE__`（含 XSS 转义），客户端 hydration 时复用不重复请求。

### 4. 用 library mode 配置一个组件库：ESM + CJS 双格式、`external` 掉 vue、生成 `.d.ts`，并写出 `package.json` 的 `exports`/`types`/`sideEffects`。

### 5. 搭一个最小 pnpm workspace Monorepo（apps/web + packages/ui），让 web 源码直用 ui（改 ui 组件即时 HMR），给出关键配置（workspace、exports 指 src、optimizeDeps.exclude、preserveSymlinks）。

---

## 三、场景题（1 题）

### 1. 一个营销官网（内容基本固定、重 SEO 与首屏）+ 一个后台管理系统（登录后可见、重交互）共存于同一 Monorepo。请为两者分别选择渲染策略（CSR/SSG/SSR）并说明理由，给出构建产物形态、部署方式（CDN/静态 vs 常驻服务）、base 与路由 fallback、以及 Monorepo 如何用 turbo 组织构建与 CI 门禁。

---

## 四、简答题（3 题）

### 1. SSR、SSG、CSR 分别适合什么场景？为什么"要 SEO 不一定要上 SSR"？

### 2. 为什么 hashed 资源可以 immutable 而 index.html 必须 no-cache？

### 3. Vite 6 的 Environment API 相比旧 `isSSR` 标志解决了什么问题？

---

## 五、挑战题（1 题）

### 🏆 端到端交付：把一个 Monorepo 送上生产

给定一个含 `apps/web`（Vite + Vue/React）、`packages/ui`（组件库）、`packages/utils`（纯函数）的仓库，产出一套完整交付方案：

- **框架集成**：正确的插件（vue/react + `tsc --noEmit` 类型门禁）、JSX/TS 配置
- **SSR 或 SSG 选型与实现**（二选一并说明取舍）：如选 SSR，给双产物构建 + Node 服务 + state 注水 + 防 hydration mismatch
- **库发布**：`packages/ui` 用 library mode 产出 ESM+CJS+类型、external peer、`sideEffects:false`
- **Monorepo 编排**：workspace 链接、源码直用、turbo 任务图（build/test/lint 依赖顺序 + 缓存）
- **部署**：静态托管或容器的 Dockerfile、base、SPA fallback、缓存头、CDN/压缩
- **CI/CD**：`npm ci → lint → typecheck → test → build → 产物扫描（无密钥）→ preview 冒烟 → 部署`，不可变版本 tag + 回滚
- **README**：一张"从 git push 到线上"的流水线图 + 新增一个包/页面的步骤
