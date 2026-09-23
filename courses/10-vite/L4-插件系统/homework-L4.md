# L4 作业：插件系统

> 覆盖：vite-plugin-api / vite-plugin-write

---

## 一、读代码（10 题）

### 1. 这个插件对象缺了哪个必填字段？会带来什么后果？

```js
export default function p() {
  return {
    transform(code) { return '/*x*/' + code; },
  };
}
```

### 2. 阅读代码，`apply: 'build'` 的插件里写了 `configureServer`，dev 时会发生什么？

```js
export default () => ({
  name: 'weird',
  apply: 'build',
  configureServer(server) { server.middlewares.use('/x', (q, r) => r.end('x')); },
});
```

### 3. 这段 resolveId/load 写的虚拟模块有什么 bug？

```js
resolveId(id) { if (id === 'virtual:cfg') return 'virtual:cfg'; },
load(id) { if (id === '\0virtual:cfg') return 'export default 1'; },
```

### 4. 阅读 transform，为什么对 `id.includes('node_modules')` 直接 return 很重要？

```js
transform(code, id) {
  if (id.includes('node_modules')) return;
  return code.replace(/foo/g, 'bar');
}
```

### 5. 这个插件想"每个模块都注入 banner"，但在 dev 下让冷启动变慢，为什么？如何优化？

```js
transform(code, id) {
  const s = new MagicString(code);
  s.prepend('/* banner */');
  return { code: s.toString(), map: s.generateMap() };   // 对所有模块都 new 一次
}
```

### 6. 阅读代码，`enforce: 'pre'` 在这里解决什么问题？

```js
{ name: 'raw-md', enforce: 'pre', transform(code, id) { if (id.endsWith('.md')) return `export default ${JSON.stringify(code)}`; } }
```

### 7. configureServer 里两个中间件顺序如何？谁先响应？

```js
configureServer(server) {
  server.middlewares.use('/a', h1);
  return () => { server.middlewares.use('/b', h2); };   // 返回后置函数
}
```

### 8. 这段 generateBundle 守卫为什么在 dev 下完全不工作？

```js
generateBundle(_, bundle) {
  for (const c of Object.values(bundle)) if (c.code?.includes('SECRET')) this.error('leak');
}
```

### 9. 阅读代码，`this.emitFile` 相比 `fs.writeFileSync('dist/x.txt', ...)` 好在哪？

```js
closeBundle() { fs.writeFileSync('dist/report.json', JSON.stringify(data)); }
```

### 10. `config` 钩子返回的对象和用户在 vite.config.js 写的配置是什么关系？

```js
config() { return { define: { __DEV__: 'true' }, resolve: { alias: { '@': '/src' } } }; }
```

---

## 二、手写（5 题）

### 1. 写一个虚拟模块插件 `virtual:greeting`，`import { hi } from 'virtual:greeting'` 得到 `hi = 'hello <pkgname>'`（包名从 package.json 读）。给出 resolveId/load 与 `\0` 前缀。

### 2. 写一个 transform 插件 `injectVersion`：把源码里的 `__APP_VERSION__` 替换成从 package.json 读到的版本号，且用 magic-string 保留 sourcemap。

### 3. 写一个 dev-only 插件：`configureServer` 暴露 `GET /__health` 返回 `{ uptime, memory }`，生产不挂载（用 apply）。

### 4. 写一个"构建守卫"插件：`generateBundle` 遍历产物，若任一 chunk 体积超过 500KB 则 `this.warn`，若包含字符串 `'TODO-DO-NOT-SHIP'` 则 `this.error` 让构建失败。

### 5. 把第 2 题插件改造成可发布形态：导出带 TS 类型（`Plugin`）的工厂函数、options 支持自定义版本号来源、附最小 README 用法。

---

## 三、场景题（1 题）

### 1. 团队要做一个"路由自动生成"插件：扫描 `src/pages/**/*.vue`，生成一个虚拟模块 `virtual:routes` 导出路由表；开发时新增/删除页面文件要能热更新路由（不整页刷新）。请设计这个插件用到哪些钩子（resolveId/load/configureServer 的 watcher/server.ws.send/handleHotUpdate），并说明 dev 与 build 下分别如何保证路由表是最新的。

---

## 四、简答题（3 题）

### 1. 简述 resolveId / load / transform 三个钩子各自的职责与调用顺序。

### 2. 为什么"dev 正常、build 出问题"经常和插件钩子的模式差异有关？举一个 build-only 钩子的例子。

### 3. enforce 与 apply 分别控制什么？给一个必须用 enforce:'pre' 的场景。

---

## 五、挑战题（1 题）

### 🏆 做一个可发布的小型插件包 `vite-plugin-git-info`

要求：
- 注入虚拟模块 `virtual:git`，导出 `{ branch, commit, time }`（用 `child_process` 跑 `git`，无 git 时优雅降级）
- 用 `config` 钩子自动把 `virtual:git` 加入 `optimizeDeps.exclude`，无需用户手配
- 提供 TS 类型与 `declare module 'virtual:git'` 声明文件
- 用 `transform` 支持把源码里的 `__GIT_COMMIT__` 替换为真实 commit（magic-string 保 map）
- `apply` 正确区分：dev 下用 `configureServer`+watcher 在 HEAD 变化时 `server.ws.send` 推 custom 事件
- package.json exports/sideEffects/types、README（安装 + 三个用法示例）、一个最小 demo 项目
- 说明它 dev 与 build 双模式各验证了什么
