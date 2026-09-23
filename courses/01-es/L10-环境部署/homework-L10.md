# L10 作业：DevTools / 构建 / 发布

> 本关覆盖：Chrome DevTools 面板实操 / 构建管线配置 / npm 发布全流程。

---

## 一、读代码（10 题）

### 1. 阅读以下 Vite 配置，指出 `manualChunks` 分包后有几个 chunk？哪些第三方库会进 vendor？

```js
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          charts: ['echarts'],
        }
      }
    }
  }
}
```

### 2. 以下 Performance 火焰图描述中，Long Task 大约持续多久？瓶颈是什么阶段？

```
Main thread track:
[Task: 2ms] [黄色 Scripting: 180ms] [紫色 Rendering: 15ms] [Task: 1ms]
                        ↑ 红三角标记
```

### 3. 阅读 package.json exports 字段，说明 `import { x } from 'my-pkg'` 会解析到哪个文件？`require('my-pkg')` 呢？

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs",
    "default": "./dist/index.cjs"
  }
}
```

### 4. 以下代码执行后 Memory Heap Snapshot 里会检测到什么泄漏？

```js
const cache = new Map();
function handleClick(e) {
  cache.set(e.target, { data: Array(10000).fill('x') });
}
document.addEventListener('click', handleClick);
// 500 个按钮被创建又被 innerHTML = '' 销毁
```

### 5. 阅读 tsup 配置，输出文件有哪些？

```js
// tsup.config.ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts', 'src/utils.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
});
```

### 6. Network 面板中一个请求状态 200 (from disk cache)，TTFB = 0ms。这说明什么？

### 7. 阅读以下 CI 脚本片段，`npm ci` 和 `npm install` 有何不同？为什么 CI 推荐 ci？

```yaml
- run: npm ci
- run: npm run build
- run: npx size-limit
```

### 8. 以下 browserslist 配置匹配到的最低 Chrome 版本是多少？esbuild target 应该设什么？

```json
"browserslist": ["last 2 Chrome versions", "> 1%"]
```

### 9. DevTools Console 执行以下代码，$0 代表什么？

```js
// 在 Elements 面板选中一个 <div id="app">，然后切到 Console
console.log($0);
```

### 10. 阅读这段 Source Map 配置，线上用户看到的 JS 会包含 `//# sourceMappingURL=` 注释吗？

```js
// vite.config.js
export default {
  build: { sourcemap: 'hidden' }
}
```

---

## 二、手写（5 题）

### 1. 用 Chrome DevTools 完成以下操作并截图描述步骤：
对一个 SPA 应用设置条件断点，只在 `user.id === 42` 时暂停 `fetchUser` 函数。

### 2. 配置一个 Vite 项目使其：
- 使用 `rollup-plugin-visualizer` 分析产物；
- 路由懒加载分割；
- vendor 单独打包 vue + pinia；
- 输出 contenthash 文件名。

### 3. 手写一个最小 npm 包的 package.json：
包名 `@test/math-utils`，ESM+CJS 双格式，types 指向 `./dist/index.d.ts`，只发布 dist/ 和 README.md，sideEffects false，peerDependencies vue ^3.3。

### 4. 用 changesets 为一个包含 packages/core 和 packages/cli 的 monorepo 初始化自动发布配置（写出 pnpm-workspace.yaml 和 release.yml workflow）。

### 5. 在 Performance 面板中发现一段 600ms 的 Long Task（JS 执行），请写出优化思路（伪代码展示拆分方案）。

---

## 三、场景题（1 题）

### 1. 线上排查场景

你的 SPA 上线后部分用户报告"白屏"，但开发者本机正常。请写出完整排查步骤（从 DevTools 到 CI 日志），列出至少 5 个排查手段和对应工具面板。

---

## 四、简答题（3 题）

### 1. 解释 contenthash 如何实现"改一行代码 → 用户无需清缓存 → 但立刻拿到新版本"。涉及哪些 HTTP 头和响应码？

### 2. Tree Shaking 的前提条件有哪些？为什么 CJS 不能摇树？举一个因 sideEffects 导致摇树失败的实例。

### 3. npm Provenance 解决了什么安全问题？它和 Automation Token 的区别？

---

## 五、挑战题（1 题）

### 🏆 从零发布一个 npm 包

1. 创建一个 TypeScript 库 `@yourname/js-toolkit`，包含至少 3 个工具函数；
2. 使用 tsup 构建 ESM + CJS + DTS 三种产物；
3. 配置 `exports` 条件入口 + `files` 白名单；
4. 编写 GitHub Actions 自动发布流程（用 changesets + provenance）；
5. 在 npm 上发布 `--tag next` 的 beta 版本；
6. 新开一个项目 `npm install @yourname/js-toolkit@next` 验证 import 正常、Tree Shaking 生效。

把发布地址和 GitHub repo 链接贴在作业里。
