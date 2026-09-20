# Vite 插件 API 与 Rollup 兼容

> 目标：**看懂并会用好 Vite 插件体系**——Vite 插件本质是 Rollup 插件的超集；掌握 Vite 从 Rollup 继承的钩子与 Vite 独有的钩子（`config`/`configResolved`/`configureServer`/`configurePreviewServer`/`transformIndexHtml`/`handleHotUpdate`）；理解 enforce/apply、dev 与 build 的差异、钩子调用时机。

---

## 一、Vite 插件 = Rollup 插件 + 扩展钩子

Vite 构建用 Rollup，因此**绝大多数 Rollup 插件能直接在 Vite 里用**。Vite 在此基础上：

1. 替换/新增若干**自定义钩子**处理 Rollup 覆盖不到的事（dev server、HTML、HMR）；
2. 对部分 Rollup 钩子在 **dev（serve）模式**下做了适配（`resolveId`/`load`/`transform` 在 dev 里也会跑，用于按需处理请求到的模块）。

一个插件就是一个返回**对象**的函数：

```js
// myPlugin.js
export default function myPlugin(options = {}) {
  return {
    name: 'my-plugin',          // 必填，用于报错/调试
    apply: 'build',             // 'build' | 'serve' | 函数，控制只在构建或只在开发生效
    enforce: 'pre',             // 'pre' | 'post' | 不写=normal，插件间执行顺序
    // ... 钩子
  };
}
```

在配置里用：`plugins: [myPlugin({ ... })]`。

---

## 二、通用钩子（继承自 Rollup）

Vite 支持 Rollup 的大多数钩子。核心几个：

| 钩子 | 时机 | 用途 |
|------|------|------|
| `options(opts)` | 构建开始 | 改构建选项（input/treeshake） |
| `buildStart()` | 每次（重新）构建开始 | 初始化、计时 |
| `resolveId(source, importer)` | 解析模块 id | 把 import 路径映射到自定义 id（虚拟模块入口） |
| `load(id)` | 某 id 加载源码 | 为已知 id **生成**源码（还没内容时） |
| `transform(code, id)` | 每个模块转换后 | 改写源码（注入/编译/替换）——**最常用的强钩子** |
| `buildEnd` / `closeBundle` | 构建结束 | 收尾、报错、清理 |
| `renderChunk` / `generateBundle` | 产出 chunk/写文件前 | 改产物、注入额外文件 |

> 记忆口诀：**resolveId 定身份、load 给初稿、transform 改正文**。三者是插件改代码的主战场。

```js
transform(code, id) {
  if (!id.includes('node_modules') && id.endsWith('.js')) {
    // 例：给每个自有模块顶部注入一行标记
    return { code: `/* built by vite */\n${code}`, map: null };
  }
}
```

返回 `{ code, map }` 时**尽量带 sourcemap**（用 `magic-string` 生成），别粗暴返回字符串丢映射。

---

## 三、Vite 独有钩子（Rollup 没有）

### 3.1 `config` / `configResolved`

```js
config(userConfig, env) {
  // 在解析配置阶段，返回要 merge 的额外配置片段
  // env: { command: 'build'|'serve', mode }
  return { define: { __APP_VERSION__: '1.2.3' } };
},
configResolved(config) {
  // 拿到最终解析好的只读配置，读取但不改
},
```

`config` 用来**插件自带默认配置**（如自动加 optimizeDeps 项）；`configResolved` 用来感知最终配置（判断是 dev 还是 build、mode 等）。

### 3.2 `configureServer` / `configurePreviewServer`（dev server 专属）

```js
configureServer(server) {
  // 拿到 ViteDevServer 实例：注册中间件、读模块图、监听文件
  server.middlewares.use((req, res, next) => {
    if (req.url === '/__hello') { res.end('hi from plugin'); return; }
    next();
  });
  server.watcher.on('change', (file) => { /* ... */ });
},
```

往 dev server 塞**自定义中间件**、访问 `server.moduleGraph`、操作 HMR。`configurePreviewServer` 是预览服务器的对应版本。注意：想让你中间件跑在 Vite 内部中间件**之前/之后**，用返回函数或 `server.middlewares.use` 的时机控制。

### 3.3 `transformIndexHtml`

```js
transformIndexHtml(html) {
  // 改 index.html：注入 tag/script/link
  return {
    html,
    tags: [{ tag: 'script', attrs: { src: '/tracking.js' }, injectTo: 'body' }],
  };
},
```

框架的"往 HTML 注入 `<meta>`/脚本"、埋点、CDN 替换都靠它。`order`/`enforce` 控制相对 Vite 内建处理的先后。

### 3.4 `handleHotUpdate`（HMR 定制）

```js
handleHotUpdate({ file, server, modules }) {
  if (file.endsWith('.md')) {
    // 自定义：改了 .md 时，精确失效哪些模块、或触发 full-reload
    return modules;   // 返回要发送 HMR 更新的模块列表
  }
},
```

改默认 HMR 传播：过滤/扩展受影响模块、发自定义事件、或直接 `server.ws.send({ type: 'full-reload' })`。

---

## 四、enforce 与 apply：顺序与作用域

- **`enforce: 'pre' | (normal) | 'post'`**：决定插件间执行顺序。`pre` 最先、`post` 最后、其余按数组顺序。内建插件有自己位置，若要在 Vite 核心转换（如 esbuild 处理）**前/后**跑，就设 `enforce`。例：要在框架编译前处理原始源码用 `'pre'`。
- **`apply`**：`'build'` / `'serve'` / 函数 `(cfg) => boolean`。只在构建时跑的分析插件、只在 dev 跑的 server 注入插件，用它隔离——避免 dev 下误用 build-only 钩子。

```js
apply: 'serve',                 // 只在 dev 生效
// 或
apply: (config, { mode }) => config.command === 'build' && mode === 'production',
```

---

## 五、dev 与 build：钩子行为差异（关键心智）

Vite 双模型（呼应 L1/L3）导致插件钩子在两种模式下表现不同：

- **dev（serve）**：没有真正的打包，模块按需经中间件处理。`resolveId`/`load`/`transform` 会针对**浏览器实际请求到的每个模块**调用；`options`/`renderChunk`/`generateBundle`/`writeFile` 这类**产物级钩子不会触发**。
- **build**：走完整 Rollup 管线，所有钩子正常触发。

所以写插件时要清楚你的钩子**在 dev 生不生效**——需要两边都工作就得分别处理（`configureServer` 管 dev、`transform`/`generateBundle` 管两边/构建）。这也是很多"dev 正常、build 坏"或反之 bug 的根源。

---

## 六、虚拟模块（Virtual Modules）

插件常需"凭空造一个模块"给业务 import（如把配置、图标集、markdown 变成一个可 import 的模块）。约定：用**自定义前缀 id** + `\0`（null 字节，rollup 惯例，防其它插件争抢）在 resolveId/load 三件套里配对：

```js
const virtualId = 'virtual:my-config';
const resolvedVirtualId = '\0' + virtualId;

return {
  name: 'virtual-config',
  resolveId(id) {
    if (id === virtualId) return resolvedVirtualId;
  },
  load(id) {
    if (id === resolvedVirtualId) {
      return `export const version = "1.0"; export default { ok: true };`;
    }
  },
};
```

用户即可 `import cfg from 'virtual:my-config'`。`resolveId` 认领、`load` 供货，一一对应即可。

---

## 七、返回值与钩子"签名类型"

Rollup/Vite 钩子有几种调用形式，按需选：

- **同步**：直接 `return value`；
- **异步**：`return Promise`；
- **`this` 上下文**：钩子里可用 Rollup 插件 API —— `this.resolve()`、`this.load()`、`this.emitFile()`（产出一个文件/chunk）、`this.warn()/error()`（带定位的告警）、`this.getModuleInfo()`。
- **handler 对象形式**：`transform: { order: 'pre', handler(code, id) {} }` —— 精确控制单钩子顺序。

用 `this.emitFile({ type: 'asset', fileName, source })` 可从插件里吐出额外产物（如 sourcemap、生成文件）。

---

## 八、写插件的心智清单

- 只做一件事、命名清晰、options 有默认值与校验；
- `name` 必填（报错定位靠它）；
- 想清楚作用域：`apply` 限定 dev/build，避免无谓开销与"钩子在该模式不跑"的坑；
- `transform`/`load` **只对关心的 id 生效**（后缀/路径过滤），别对每个模块空跑（dev 下每个请求都过插件，性能敏感）；
- 尽量保留/生成 sourcemap（magic-string）；
- 与 Vite 内建插件顺序冲突时再动 `enforce`；
- 复用社区插件优先（`vite-plugin-*`、大量 Rollup 插件直接可用），别什么都自己造。

---

## 九、自检清单

- [ ] Vite 插件和 Rollup 插件是什么关系？
- [ ] `resolveId`/`load`/`transform` 分别负责什么？
- [ ] 哪些钩子只在 build 触发、dev 不跑？
- [ ] `enforce` 和 `apply` 各控制什么？
- [ ] 虚拟模块靠哪两个钩子配对实现？`\0` 前缀干嘛用？
- [ ] `configureServer` 能做什么、`transformIndexHtml` 能做什么？

---

## 🚀 部署预告

- **插件即生态**：Vite 的能力扩展几乎都走插件（框架支持、legacy、PWA、图标、Markdown……），读懂钩子 = 能用好也能改一切；
- **下一关手写**：把本篇 API 落地成三个真插件——虚拟模块、transform 注入、dev middleware；
- **可发布复用**：好插件应打包成 `vite-plugin-xxx` npm 包，供团队/社区 `plugins: [xxx()]` 直接接入。

下一关 **vite-plugin-write**——亲手把虚拟模块、代码注入、dev 中间件三类插件各写一遍。
