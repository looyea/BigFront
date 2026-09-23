# L3 作业：生产构建 / 代码分割 / 兼容性

> 覆盖：vite-build / vite-splitting / vite-target

---

## 一、读代码（10 题）

### 1. 以下配置在 production 模式下会生成 sourcemap 吗？用户能拿到吗？

```js
export default defineConfig(({ mode }) => ({
  build: { sourcemap: mode === 'production' ? 'hidden' : true },
}));
```

### 2. 这个构建配置有几处会拖慢 `vite build`？指出并说明原因。

```js
build: {
  minify: 'terser',
  sourcemap: true,
  reportCompressedSize: true,
  rollupOptions: { output: { manualChunks: () => 'everything' } },
}
```

### 3. 阅读构建产物日志，index 首屏是否需要下载 heavy.js？

```
dist/assets/index-f3x2.js        45 kB │ gzip: 16 kB
dist/assets/vendor-a1b2.js      120 kB │ gzip: 40 kB
dist/assets/heavy-c3d4.js       300 kB │ gzip: 95 kB   ← 由 import('./charts') 产生
```

### 4. 以下 manualChunks 会把哪些包合并？返回 false 的模块去哪？

```js
manualChunks(id) {
  if (id.includes('node_modules/react')) return 'react';
  if (id.includes('node_modules/echarts')) return 'charts';
}
```

### 5. 为什么这段代码的 lodash 没有被 tree-shake？如何改？

```js
import _ from 'lodash';
const x = _.debounce(fn, 300);
```

### 6. 阅读 HTML 片段，哪个浏览器会执行 nomodule 脚本？

```html
<script type="module" src="/assets/index-modern.js"></script>
<script nomodule src="/assets/index-legacy.js"></script>
```

### 7. 设了 `build.target: 'es2015'`，代码用了 `structuredClone(obj)`，在仅支持 ES2015 语法的旧浏览器运行会怎样？为什么？

### 8. 以下 base 配置，部署到 `https://cdn.com/myapp/` 后资源路径对不对？

```js
export default defineConfig({ base: '/app/' });
```

### 9. 这个分包函数存在什么隐患（提示：id 匹配过宽）？

```js
manualChunks(id) {
  if (id.includes('node_modules')) return 'vendor';
}
```

### 10. 关闭 `cssCodeSplit` 后，配合路由懒加载会发生什么变化？

---

## 二、手写（5 题）

### 1. 编写一份 `vite.config.js` 的 build 段：生产用 hidden sourcemap + esbuild 压缩（移除 console/debugger 但保留 warn/error），产物按 js/css/img 分目录带 hash 命名。

### 2. 实现函数式 `manualChunks`：react 生态一个 chunk、antd 一个、echarts 一个、其余 node_modules 兜底进 vendor。

### 3. 用 `rollup-plugin-visualizer` 配置产物分析，并写出你从 treemap 中发现体积大头后的三条优化动作。

### 4. 为一个需要支持到 iOS 12 / Android 7 的项目配置 `@vitejs/plugin-legacy`，要求现代产物也注入 `modernPolyfills`。

### 5. 编写一段路由 hover 预取代码：鼠标移入 `<a>` 时提前 `import()` 目标页组件，点击秒开。

---

## 三、场景题（1 题）

### 1. 你的 Vite SPA 上线后收到反馈："老安卓手机白屏报 `SyntaxError: Unexpected token '?'`，部分现代浏览器偶发 `xxx is not a function`"。请分别定位这两类错误属于语法还是 API 问题，并给出完整的构建配置修复方案。

---

## 四、简答题（3 题）

### 1. 转译和 polyfill 的区别是什么？各举两个例子。

### 2. 为什么"把所有依赖塞进单个 vendor chunk"通常不是最优？从缓存和加载两方面说明。

### 3. preload、prefetch、modulepreload 分别适用什么场景？

---

## 五、挑战题（1 题）

### 🏆 构建"性能体检报告"

对一个真实 Vite 项目做完整构建优化，产出一份报告，要求：
- 配置 `manualChunks` 合理分包，附优化前后 `stats.html` treemap 对比
- 首屏 JS 传输体积下降 ≥30%（列数据）
- 正确设置 `build.target` + 决定是否启用 legacy（附 UA 数据依据）
- 生产 `sourcemap: 'hidden'` + Sentry 上传脚本（CI 片段）
- Nginx/CDN 缓存头配置（hash 资源 immutable + html no-cache）
- 用 Lighthouse 跑优化前后 Performance 分数对比
