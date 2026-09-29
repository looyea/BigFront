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
// 目的：条件配置—用一个函数根据 command/mode 返回不同配置（dev 与 build 各取所需）
export default defineConfig(({ command, mode, isSsrBuild }) => {
  if (command === 'serve') {
    return { define: { __DEV__: true } };       // ✅ dev：__DEV__ 为 true，开发分支代码保留
  } else {
    return { define: { __DEV__: false }, base: '/my-app/' };  // ✅ build：__DEV__ false 使开发代码被 Tree Shake + 子目录部署
  }
});
// ❌ base 只在 build 分支设 → dev 下资源路径与生产不一致，迁子目录后本地能跑、上线 404
```

---

## 二、核心配置项

### 2.1 项目路径

```ts
// 目的：项目路径三要素—root 定位根、base 定子目录、publicDir 直属拷贝
export default defineConfig({
  root: '.',              // ✅ 项目根（index.html 所在）
  base: '/my-app/',       // ✅ 公共基础路径（部署子目录），所有资源引用前加 /my-app/
  publicDir: 'public',    // ✅ 静态资源目录（不做hash、直接复制到 dist 根）
});
// ❌ 子目录部署忘设 base → 产物写 /assets/… 绝对路径，放到 /my-app/ 下加载全部 404 白屏
```

`base` 影响：HTML 里所有资源引用变成 `/my-app/assets/index.3a2f.js`。

### 2.2 resolve

```ts
// 目的：resolve—用绝对路径建 '@' 别名、允许无后缀导入多扩展名
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),   // ✅ 用 import.meta.url 解析绝对路（ESM 无 __dirname）
    'vue': 'vue/dist/vue.esm-bundler.js',   // ✅ 换运行时编译版（支持模板字符串编译）
  },
  extensions: ['.mjs', '.js', '.ts', '.vue', '.json'],   // ✅ import 时可省这些后缀
}
// ❌ 别名直接用字符串 '/src' → 基于 server 根而非真实目录，Windows/monorepo 下解析错位
```

### 2.3 server（开发专属）

```ts
// 目的：server 开发专属配置—固定端口 + 代理解决跨域 + WebSocket 转发
server: {
  port: 3000,
  strictPort: true,          // ✅ 端口被占直接退出（不尝试下一个，保证 CI/团队端口一致）
  open: true,                // ✅ 启动后自动开浏览器
  cors: true,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,                    // ✅ 把 Host 改为 target，过后端域名校验
      rewrite: path => path.replace(/^\/api/, ''),   // ✅ 去掉 /api 前缀再转发
    },
    '/ws': { target: 'ws://localhost:8080', ws: true },   // ✅ 代理 WebSocket 升级
  },
  https: { key: ..., cert: ... },  // ✅ 或用 @vitejs/plugin-basic-ssl
}
// ❌ 只写 target 不写 changeOrigin → 后端按 Host 头路由/校验 Referer 时拒绝，代理返回 404
```

### 2.4 build

```ts
// 目的：build 产物配置—兼容目标/压缩器/拆 CSS + 产物命名带 hash（长效缓存的根基）
build: {
  target: 'es2015',         // ✅ 兼容目标（语法降级到此版本）
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: true,          // ✅ true | 'inline' | 'hidden'
  minify: 'esbuild',       // ✅ 'esbuild'(快) | 'terser'(压得更小) | false
  cssMinify: true,
  cssCodeSplit: true,       // ✅ 每个 chunk 单独 CSS（按需加载）
  rollupOptions: {
    output: {
      entryFileNames: 'js/[name].[hash].js',        // ✅ 入口带 contenthash
      chunkFileNames: 'js/[name].[hash].js',        // ✅ 动态 chunk 带 hash
      assetFileNames: '[ext]/[name].[hash][extname]', // ✅ 静态资源按类型归档+hash
    }
  },
  reportCompressedSize: true,  // ⚠️ gzip 大小报告（大项目可关掉加速构建）
}
// ❌ 产物名不带 [hash] → 发版后浏览器命中旧缓存，用户看不到更新（应始终用 hash）
```

### 2.5 define（全局常量替换）

```ts
// 目的：define—构建时文本替换的全局常量（非运行时变量，因此能让 Tree Shake 删死代码）
define: {
  __APP_VERSION__: JSON.stringify('1.2.0'),   // ✅ 字符串必须 JSON.stringify（否则被当变量名替换）
  __DEV__: false,                             // ✅ 代码里 if(__DEV__){...} 整块被删
}
// ❌ __APP_VERSION__: '1.2.0'（不 stringify）→ 代码中替换成裸 1.2.0 被当成数字表达式、语法错乱
```

构建时**文本替换**（不是运行时变量）→ Tree Shake 生效（`if (__DEV__)` 整块被删）。

### 2.6 css

```ts
// 目的：css 配置—预处理器自动注变量 + CSS Modules 命名转换
css: {
  preprocessorOptions: {
    scss: { additionalData: `@use "@/styles/vars" as *;` },   // ✅ 每个 scss 自动开头引入变量，免手写 @use
  },
  modules: {
    localsConvention: 'camelCase',   // ✅ .class-name → styles.className（JS 用驼峰取）
  },
  devSourcemap: true,                // ✅ 开发也出 CSS sourcemap，定位到源 scss 行
}
// ❌ 不开 localsConvention，模板里 styles['card-title'] 才能取到，写成 styles.cardTitle 得到 undefined
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
# 目的：.env 定义环境变量—只有 VITE_ 前缀才注入客户端
# .env
VITE_API_URL=https://api.example.com   # ✅ 前端可用（import.meta.env.VITE_API_URL）
DATABASE_URL=postgres://...            # ✅ 仅 vite.config.ts 内可读（不进打包产物）
# ❌ 把密钥写成 VITE_DB_PASS → 会被编译进前端 bundle，任何人 F12 就能拿到
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
// 目的：给 import.meta.env 补类型—引入 vite/client 后 VITE_* 变量才有自动补全
/// <reference types="vite/client" />   // ✅ 提供 import.meta.env 与资源模块（*.svg 等）的类型
interface ImportMetaEnv {
  readonly VITE_API_URL: string;         // ✅ 声明后 import.meta.env.VITE_API_URL 是 string 而非 any
}
// ❌ 不声明就直接用 import.meta.env.VITE_TOKEN → TS 报 Property does not exist（或静默为 undefined）
```

---

## 四、多页应用（MPA）

```ts
// 目的：多页应用 MPA—把多个 HTML 登记为独立入口，Vite 自动提取共享 chunks
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),        // ✅ 主页入口
      about: resolve(__dirname, 'about.html'),       // ✅ 第二页
      admin: resolve(__dirname, 'admin/index.html'), // ✅ 子目录页
    }
  }
}
// ❌ 新 HTML 不登记到 input → vite build 不编译它，访问 /about.html 拿到未经处理的原始文件
```

每个 HTML 是独立入口——Vite 自动提取共享 chunks。

---

## 五、Library 模式

```ts
// 目的：Library 模式—把自己打包成对外发布的库（多格式 + 外部化 peer 依赖）
build: {
  lib: {
    entry: resolve(__dirname, 'src/index.ts'),   // ✅ 库入口
    name: 'MyLib',                                // ✅ UMD 全局变量名
    formats: ['es', 'cjs', 'umd'],                // ✅ 三种格式都出
    fileName: (format) => `my-lib.${format}.js`,   // ✅ 按格式命名产物
  },
  rollupOptions: {
    external: ['vue'],                           // ✅ vue 不打进去（宿主提供），避免重复实例
    output: { globals: { vue: 'Vue' } }           // ✅ UMD 下外部 vue 映射到全局 Vue
  }
}
// ❌ 忘了 external:['vue'] → 把 vue 一并打包，消费方用自己的 vue 时造成双实例/体积爆炸
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
