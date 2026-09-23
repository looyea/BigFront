# Vite 项目配置与环境变量

> 目标：**精通 vite.config.js 核心配置项**——root / base / public / alias / server(proxy/https) / build(target/outDir/minify) / css / define；掌握 `.env` 环境变量体系和 `import.meta.env`。

---

## 一、配置基础

### 1.1 文件位置与格式

```
project/
├── index.html            ← Vite 入口（不是 main.js！）
├── vite.config.ts        ← 配置文件（支持 TS/ESM/CJS）
├── .env                  ← 环境变量（所有环境）
├── .env.local            ← 本地覆盖（gitignore）
├── .env.production       ← 生产构建
├── .env.production.local ← 生产本地覆盖
└── src/
    └── main.ts
```

`vite.config.ts` 被 Vite 用 esbuild 编译后执行——支持顶层 await、import 插件。

### 1.2 条件配置（按 mode/command）

```ts
export default defineConfig(({ command, mode, isSsrBuild }) => {
  if (command === 'serve') {
    return { define: { __DEV__: true } };       // dev 专属
  } else {
    return { define: { __DEV__: false }, base: '/my-app/' };  // build 专属
  }
});
```

---

## 二、核心配置项

### 2.1 项目路径

```ts
export default defineConfig({
  root: '.',              // 项目根（index.html 所在）
  base: '/my-app/',       // 公共基础路径（部署子目录）
  publicDir: 'public',    // 静态资源目录（直接复制到 dist 根）
});
```

`base` 影响：HTML 里所有资源引用变成 `/my-app/assets/index.3a2f.js`。

### 2.2 resolve

```ts
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    'vue': 'vue/dist/vue.esm-bundler.js',   // 运行时编译版
  },
  extensions: ['.mjs', '.js', '.ts', '.vue', '.json'],
}
```

### 2.3 server（开发专属）

```ts
server: {
  port: 3000,
  strictPort: true,          // 端口被占直接退出（不尝试下一个）
  open: true,                // 启动后自动开浏览器
  cors: true,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api/, ''),
    },
    '/ws': { target: 'ws://localhost:8080', ws: true },
  },
  https: { key: ..., cert: ... },  // 或用 @vitejs/plugin-basic-ssl
}
```

### 2.4 build

```ts
build: {
  target: 'es2015',         // 兼容目标
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: true,          // true | 'inline' | 'hidden'
  minify: 'esbuild',       // 'esbuild' | 'terser' | false
  cssMinify: true,
  cssCodeSplit: true,       // 每个 chunk 单独 CSS
  rollupOptions: {
    output: {
      entryFileNames: 'js/[name].[hash].js',
      chunkFileNames: 'js/[name].[hash].js',
      assetFileNames: '[ext]/[name].[hash][extname]',
    }
  },
  reportCompressedSize: true,  // gzip 大小报告（可关掉加速）
}
```

### 2.5 define（全局常量替换）

```ts
define: {
  __APP_VERSION__: JSON.stringify('1.2.0'),
  __DEV__: false,
}
```

构建时**文本替换**（不是运行时变量）→ Tree Shake 生效（`if (__DEV__)` 整块被删）。

### 2.6 css

```ts
css: {
  preprocessorOptions: {
    scss: { additionalData: `@use "@/styles/vars" as *;` },
  },
  modules: {
    localsConvention: 'camelCase',   // class-name → className
  },
  devSourcemap: true,
}
```

---

## 三、环境变量体系

### 3.1 .env 文件加载优先级

```
.env.local               → 最高（本地专用，gitignore）
.env.production.local    → 按 mode + local
.env.production          → 按 mode
.env                     → 基础
```

mode 由 `--mode` 指定（`vite build --mode staging` 加载 `.env.staging`）。

### 3.2 VITE_ 前缀

**只有 `VITE_` 开头的变量**才会暴露给客户端代码（`import.meta.env.VITE_API_URL`）——其余仅 Node.js 配置内可读。

```bash
# .env
VITE_API_URL=https://api.example.com   ← 前端可用
DATABASE_URL=postgres://...            ← 仅 vite.config.ts 内可读
```

### 3.3 import.meta.env 内置变量

| 变量 | 值 |
| --- | --- |
| `VITE_*` | .env 里定义的 |
| `MODE` | 'development' / 'production' / 自定义 |
| `DEV` | boolean（是否在 dev server） |
| `PROD` | boolean（是否 build） |
| `BASE_URL` | 配置的 base |

### 3.4 TypeScript 类型补全

```ts
// vite-env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
```

---

## 四、多页应用（MPA）

```ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      about: resolve(__dirname, 'about.html'),
      admin: resolve(__dirname, 'admin/index.html'),
    }
  }
}
```

每个 HTML 是独立入口——Vite 自动提取共享 chunks。

---

## 五、Library 模式

```ts
build: {
  lib: {
    entry: resolve(__dirname, 'src/index.ts'),
    name: 'MyLib',
    formats: ['es', 'cjs', 'umd'],
    fileName: (format) => `my-lib.${format}.js`,
  },
  rollupOptions: {
    external: ['vue'],
    output: { globals: { vue: 'Vue' } }
  }
}
```

---

## 六、自检清单

- [ ] Vite 入口为什么是 index.html 而不是 main.js？
- [ ] `base` 配置影响什么？子目录部署怎么设？
- [ ] proxy 配置解决什么问题？
- [ ] define vs env 的区别？
- [ ] 只有什么前缀的环境变量前端能拿到？
- [ ] Library 模式如何 externals 不打入 peer deps？

---

## 🚀 部署预告

- **CDN base**：`base: 'https://cdn.example.com/my-app/'` → 产物里所有资源引用指向 CDN；
- **多环境构建**：`vite build --mode staging` → 读 `.env.staging` → 不同 API URL；
- **Docker 构建优化**：先 `COPY package*.json` → `npm ci` → `COPY .` → `npm run build`（层缓存）。

下一关 `vite-hmr` 深入热模块替换原理与自定义 HMR。
