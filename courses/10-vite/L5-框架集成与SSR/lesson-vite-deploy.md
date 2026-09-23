# 部署与 Monorepo

> 目标：**把 Vite 产物安全送上生产并管好多包工程**——静态托管与 `base`、CDN/Nginx、SPA fallback、Docker；**Monorepo workspace** 与包间源码链接；**library mode**（把组件库/工具库打成 npm 包）；**多页面 MPA**；预渲染（SSG）与边缘部署。

---

## 一、静态部署：`vite build` 之后

SPA 构建产物是 `dist/`（HTML + contenthash 的 JS/CSS + assets）。三种最常见托管：

- **对象存储 + CDN**（S3/OSS + CloudFront/云 CDN）：最省钱、最快（就近边缘），适合纯前端；
- **静态托管平台**（Netlify/Vercel/Cloudflare Pages/GitHub Pages）：`vite build` → 上传 `dist`，自带 CI/预览/HTTPS；
- **自托管 Nginx**（呼应 Express L8）：`root dist;` + 缓存头 + SPA fallback。

```bash
vite build          # 产物在 dist/
vite preview        # 本地预览构建结果（不是 dev server！用于上线前自检）
```

> `preview` 用**真实构建产物**起服务，验证 base/缓存/路由是否正常，是发布前最后一道自检。

---

## 二、`base`：部署路径的根

资源引用前缀由 `base` 决定。默认 `/`。不同场景要改：

```js
export default {
  base: '/',               // 域名根部署
  // base: '/my-app/',     // 部署在子路径
  // base: './',          // 相对路径（双击打开/不确定部署路径）
  // base: 'https://cdn.example.com/v1/',  // 资源走 CDN
};
```

**"白屏/资源 404" 的头号原因就是 base 不对**：部署在子路径却用默认 `/`，`index.html` 里 `<script src="/assets/...">` 指向根而 404。相对 `./` 能扛大部分路径不确定性，但不利于 SPA 深层路由的相对解析——子路径 + history 路由最好显式写 `/my-app/`。可在代码里用 `import.meta.env.BASE_URL` 读当前 base 拼路径。

---

## 三、SPA 路由 fallback 与缓存头

history 模式下 `/about` 刷新会打到服务器——静态服务器要知道"未知路径都返回 index.html"：

```nginx
server {
  root /usr/share/nginx/html;
  location / {
    try_files $uri $uri/ /index.html;   # SPA fallback
  }
  # 带 contenthash 的构建资源：永久强缓存（呼应 L4 缓存 / Express L4）
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  # 入口 HTML 绝不强缓存，保证发版能拿到新引用
  location = /index.html {
    add_header Cache-Control "no-cache";
  }
}
```

要点：**`index.html` 用 `no-cache`（协商），hashed 资源用 `immutable` 长缓存**——发版只换 HTML，资源命中缓存或按新 hash 拉取。Netlify/Vercel 用 `_redirects`/配置实现 SPA fallback。

---

## 四、Docker 化静态站点

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build                 # 产出 dist/

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

多阶段：Node 只在构建阶段用，运行阶段是纯 Nginx（呼应 Express L8 反代/静态）。SSR 站点则运行阶段用 `node` 跑 server 产物（见 vite-ssr）。

---

## 五、Monorepo 与 workspace

**Monorepo**：多包放一个仓库（app + ui 库 + utils + 配置）。用包管理器 workspace 链接本地包：

```jsonc
// pnpm-workspace.yaml
packages: ['packages/*', 'apps/*']
```

典型结构：
```
/ apps/web        (Vite 应用，依赖 @acme/ui, @acme/utils)
  packages/ui     (组件库)
  packages/utils  (纯函数库)
```

**关键：包间怎么被 Vite 消费？** 两种方式：

- **源码直用（推荐内部包）**：让 `@acme/ui` 的 `exports`/`main` 指向 `src/index.ts`，Vite 直接把 workspace 依赖当源码编译 → **改组件库源码即时 HMR、无需先 build**。要配 `optimizeDeps.exclude` / `preserveSymlinks` 相关，让 Vite 追踪到真实路径：

```js
export default {
  resolve: { preserveSymlinks: false },     // Vite 默认解析真实路径
  optimizeDeps: { exclude: ['@acme/ui'] },  // 不预打包，按需编译源码
};
```

- **产物消费（对外发布包）**：库先 `build` 出 dist，app 依赖其构建产物——隔离清晰但要"先建库再建 app"的构建顺序（用 task runner 如 turbo 编排）。

**task runner（turbo/nx）**：按依赖图增量构建/测试/缓存，`turbo build` 自动先建 `ui` 再建 `web`，命中缓存跳过未变更包。Monorepo 收益：统一依赖版本、原子化跨包改动、复用配置与 CI；成本：权限/构建图复杂度、需 workspace 与工具链支持。

---

## 六、Library Mode：把库打成 npm 包

Vite 专为"发布组件库/工具库"提供库模式：

```js
// vite.config.js
export default {
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AcmeUi',                 // UMD 全局名
      formats: ['es', 'cjs', 'umd'],  // 多格式产出
      fileName: (f) => `acme-ui.${f}.js`,
    },
    rollupOptions: {
      external: ['vue'],              // peerDep 不打进包
      output: { globals: { vue: 'Vue' } },
    },
  },
  plugins: [vue()],
};
```

要点：
- **external 化框架/peerDependencies**（别把 vue/react 打进你的库，会重复实例/体积爆炸）；
- 产出 **ESM + CJS**（现代 bundler + 老 Node），按需 + UMD；
- 库模式**默认 minify**（可用 `build.minify:false` 关）；
- **CSS**：库样式会汇总成一个 `style.css`，消费方需 import；
- 配 `package.json` 的 `exports`/`types`/`sideEffects:false`（利于 tree-shaking）+ 生成 `.d.ts`（`vite-plugin-dts`/`vue-tsc`）。

> 组件库还需处理"样式按需、SSR 兼容、类型完整"——库模式是底座，细节靠 `exports` 字段与 dts 插件。

---

## 七、多页面应用（MPA）

一个项目多个独立 HTML 入口（如 `/home.html`、`/admin.html` 各自 SPA 或传统多页）：

```js
export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
};
```

每个 HTML 是独立入口、各自加载自己的 JS。相对 SSR/单页更简单、页面间跳转是整页导航。适合营销多页 + 后台并存的站点。

---

## 八、预渲染（SSG）与边缘部署

- **预渲染**：构建期用无头浏览器/框架能力把每个路由跑一遍输出静态 HTML（`vite-plugin-ssg`/Vue `vite-ssg`/React 预渲染），首屏即内容、SEO 友好、可纯静态托管。适合内容不随请求变。
- **边缘部署**：SSR/渲染函数可跑在边缘运行时（Cloudflare Workers/Deno/Vercel Edge），靠近用户低延迟。Vite 6 **Environment API**（呼应 vite-ssr）正是让"面向边缘环境编译"更顺的路基。

---

## 九、部署自检清单

- [ ] `base` 是否匹配部署路径（子路径/CDN/GH Pages）？
- [ ] `vite preview` 本地验证过构建产物？
- [ ] SPA history 路由的 fallback（try_files/_redirects）配好了？
- [ ] 缓存头：hashed 资源 `immutable` + `index.html` `no-cache`？
- [ ] Monorepo：本地包是源码直用还是产物消费？构建顺序/缓存（turbo）对不对？
- [ ] 库模式：peer 依赖 external 了？ESM+CJS+类型 + `sideEffects:false` 齐全？
- [ ] `.env` 生产变量（`VITE_` 前缀）注入正确、密钥没进前端包（呼应 Express L6）？
- [ ] HTTPS/压缩/gzip 或 brotli 由平台或 CDN 开启？

---

## 🚀 收官

至此 **Vite 6 全链路**（初体验/HMR → 资源/CSS/Env → 构建/分包/target → 插件 API/手写 → 框架/SSR/部署）完成。回看 L1 的"双模型"初心——你现在能从 dev server 原理一路讲到构建产物、插件扩展、SSR 多环境与 Monorepo/库发布，把 Vite 真正用成"工程底座"而非"另一个 webpack"。

把三门课串起来看：**01-es** 给你语言地基，**09-express** 给你服务端与工程化视角，**10-vite** 给你构建与交付能力——一名现代前端工程师的完整闭环。
