# 手写 Vite 插件

> 目标：**把上一篇的 API 变成手感**——亲手写三类最常用插件：① 虚拟模块插件；② `transform` 代码注入插件；③ dev server 中间件插件。每个都跑通 dev 与 build，理解钩子如何在实战里配合。

---

## 一、准备：插件就是一个函数

```js
// plugins/hello.js
export default function helloPlugin(opts = {}) {
  return {
    name: 'hello',
  };
}
```

```js
// vite.config.js
import helloPlugin from './plugins/hello.js';
export default { plugins: [helloPlugin({ /* options */ })] };
```

Vite 加载时会依次调用对象上存在的钩子。下面三个例子由浅入深。

---

## 二、插件①：虚拟模块 —— 把数据变成可 import 的模块

**需求**：不写文件，让业务能 `import pkg from 'virtual:package-info'` 拿到 `package.json` 里的 name/version。

```js
// plugins/virtual-package.js
import { readFileSync } from 'node:fs';

const VirtualId = 'virtual:package-info';
const ResolvedId = '\0' + VirtualId;   // \0 前缀：标记非真实文件、防被其它插件当文件读

export default function virtualPackage() {
  return {
    name: 'virtual-package',
    resolveId(id) {
      if (id === VirtualId) return ResolvedId;   // 认领说明符
    },
    load(id) {
      if (id === ResolvedId) {
        const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
        return `export default ${JSON.stringify({ name, version })};`;   // 生成源码
      }
    },
  };
}
```

业务侧：

```js
import pkg from 'virtual:package-info';
console.log(pkg.name, pkg.version);   // 无需真实存在这个文件
```

要点：`resolveId` 认领、`load` 供货，一一对应；`\0` 前缀是 Rollup 生态惯例。TS 项目再补一个类型声明 `declare module 'virtual:package-info'`。

> 通用版思路：`virtual:${name}` 用正则 `^virtual:(.*)$` 捕获 name，在 load 里按 name 分发生成——这就是 `vite-plugin-virtual`、图标、Markdown 转模块等插件的骨架。

---

## 三、插件②：transform 注入 —— 给每个模块"改写正文"

**需求 A（简单）**：给所有自有 `.js` 顶部注入一行构建标记。

```js
export default function banner() {
  return {
    name: 'banner',
    enforce: 'pre',           // 在其它转换之前，注入的是"原始"源码层
    transform(code, id) {
      if (id.includes('node_modules')) return;      // 过滤：只处理自己的代码
      if (!/\.[jt]sx?$/.test(id)) return;           // 过滤：只处理 js/ts
      return `/* injected by banner plugin */\n${code}`;
    },
  };
}
```

**需求 B（实用）**：把源码里的 `__FEATURE_X__` 编译期开关，根据环境变量替换掉未启用的分支（类似 dead-code 消除）。

```js
export default function featureFlags(flags = {}) {
  return {
    name: 'feature-flags',
    transform(code, id) {
      if (id.includes('node_modules')) return;
      if (!code.includes('__FEATURE_')) return;     // 快速跳过无关模块
      let changed = code;
      for (const [k, on] of Object.entries(flags)) {
        changed = changed.replaceAll(`__FEATURE_${k}__`, on ? 'true' : 'false');
      }
      return changed === code ? null : changed;     // 没变就返回 null（别制造空 transform）
    },
  };
}
```

替换成 `true/false` 后，配合 Rollup tree-shaking，`if (false) {...}` 分支会被剔除。`define` 也能做常量替换，但 `transform` 让你能对**任意模式**动手（AST 级用 `magic-string`/`es-module-lexer` 保 sourcemap）。

> transform 心法：**先过滤再动手**（dev 下每个请求模块都会过 transform，别对无关模块空跑）；能不改返回 `null`；要精确改并保留 map 就用 `magic-string`。

---

## 四、插件③：dev server 中间件 —— 只在开发时干活的接口

**需求**：dev 下暴露 `GET /__api/now` 返回服务器时间（给调试面板用），生产不打包进去。

```js
export default function devTimeApi() {
  return {
    name: 'dev-time-api',
    apply: 'serve',            // 关键：只在 dev 生效，build 时完全不挂载
    configureServer(server) {
      // 返回一个函数 => 在 Vite 内部中间件"之后"插入（这里用不到转换后的模块，直接同步响应）
      server.middlewares.use('/__api/now', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ now: Date.now() }));
      });
    },
  };
}
```

- `apply: 'serve'` 保证生产构建零成本、不把调试端点带上线；
- `server.middlewares` 是 Connect 风格，`use(path, fn)` 按路径前缀匹配；
- 想在 Vite 处理模块**之后**再插中间件，`configureServer` 里 `return (server) => { ... }`。

**进阶：主动推 HMR。** 比如监听某个非源码文件变化后通知前端刷新：

```js
configureServer(server) {
  server.watcher.on('change', (file) => {
    if (file.endsWith('.env.local')) {
      server.ws.send({ type: 'full-reload' });   // 通过 WebSocket 推 HMR
    }
  });
}
```

---

## 五、组合与调试技巧

- **多钩子协作**：一个插件常同时用 `config`（注入默认配置）+ `transform`（改代码）+ `closeBundle`（收尾）。例如把虚拟模块列表也自动加进 `optimizeDeps.exclude`。
- **打印顺序排查**：钩子里 `console.log(name, hookName, id)` 看真实调用顺序与 id 形态（dev 与 build 的 id 可能不同）。
- **用 `this` 上下文**：`this.resolve()` 问别的插件某 id 解析结果；`this.warn()`/`this.error()` 输出带文件定位的告警/异常；`this.emitFile()` 产出资产。
- **构建产物校验**：在 `generateBundle(_, chunks)` 里遍历产物断言（如"确保没有把 __SECRET 打进包"），做守卫型插件。

```js
generateBundle(_, bundle) {
  for (const [file, chunk] of Object.entries(bundle)) {
    if (chunk.type === 'chunk' && chunk.code.includes('process.env.SUPER_SECRET')) {
      this.error(`疑似秘密泄露进产物 ${file}`);   // 直接让构建失败
    }
  }
},
```

---

## 六、发布成 npm 包（可选）

把插件抽成 `vite-plugin-xxx`：入口导出默认函数、带 TS 类型（`import type { Plugin } from 'vite'`）、`sideEffects:false`、README 写用法。团队里 `plugins: [xxx({ ... })]` 一行接入——插件就是 Vite 生态复用能力的最小单元。

```js
/** @returns {import('vite').Plugin} */
export default function myPlugin(options = {}) { /* ... */ }
```

---

## 七、自检清单

- [ ] 虚拟模块用哪两个钩子？`\0` 前缀为何重要？
- [ ] transform 为什么"先过滤再动手"？没改时该返回什么？
- [ ] 只想在 dev 生效怎么写？（`apply` + `configureServer`）
- [ ] 中间件想插到 Vite 内部处理之后怎么办？
- [ ] 怎么用插件做"构建守卫"（产物扫描失败）？
- [ ] 保留 sourcemap 应借助什么库？

---

## 🚀 部署预告

- **框架集成即插件**：`@vitejs/plugin-vue`/`-react` 本质就是本篇钩子的高级应用（`transformMain`/`transformRequest`/HMR 边界）——下一篇拆解（vite-framework）；
- **SSR 也靠钩子**：`transformIndexHtml` + `ssrLoadModule` + `configureServer` 中间件是手写极简 SSR 的三块拼图（vite-ssr）；
- **部署插件**：压缩、可视化、注入版本、PWA 等都是构建期 `closeBundle`/`generateBundle`/`transformIndexHtml` 的应用（vite-deploy）。

下一关 **vite-framework**——看 Vue/React/Svelte 官方插件如何把这些钩子用成框架级 HMR 与编译。
