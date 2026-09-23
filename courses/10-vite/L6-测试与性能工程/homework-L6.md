# L6 作业：测试与性能工程

> 覆盖：vite-vitest / vite-deps-perf / vite-ci-perf

---

## 一、读代码（10 题）

### 1. 这个 Vitest 配置跑起来报"describe is not defined"（TS 文件），缺了什么？

```ts
// vite.config.ts
export default { test: { globals: true } };
// 测试文件里没 import { describe } from 'vitest'
```

### 2. 阅读这段 mock，为什么运行时 `config` 是 undefined？给出两种修法。

```ts
import { vi } from 'vitest';
const mode = process.env.NODE_ENV;
vi.mock('./logger', () => ({ logger: { mode, info: vi.fn() } }));
```

### 3. 这个测试想保留真实模块、只替换其中一个函数，`importOriginal` 该怎么写？

```ts
vi.mock('./api', () => {
  // TODO: 用原实现 + 覆盖 fetchUsers
});
```

### 4. 阅读防抖测试，为什么断言失败（spy 一次都没被调用）？两种修法。

```ts
vi.useFakeTimers();
input.dispatchEvent(new Event('input'));
vi.advanceTimersByTime(300);
expect(spy).toHaveBeenCalled();
vi.useRealTimers();   // 被测回调里有一个 await fetch
```

### 5. 这段配置为什么导致 dev 启动慢、且改 `@acme/ui` 源码不生效？

```js
optimizeDeps: { include: ['@acme/ui', 'lodash-es', 'axios'] };
// @acme/ui 是 workspace 里 exports 指向 src 的 linked 包
```

### 6. 阅读现象与配置：为什么每次访问某个懒加载路由，浏览器就整页 reload 一次？

```js
// vite.config.js 没有任何 optimizeDeps 配置
// 症状：npm run dev 正常启动 → 点击"报表"路由 → [vite] optimized dependencies changed. reloading
```

### 7. 这段 CI 缓存配置的事故点在哪？

```yaml
- uses: actions/cache@v4
  with:
    path: node_modules
    key: deps-${{ github.ref }}    # 只按分支做 key
```

### 8. 阅读 turbo.json，为什么 `web#build` 可能读不到 `ui#build` 的最新产物？

```json
{ "tasks": { "build": { "dependsOn": [], "outputs": ["dist/**"] } } }
```

### 9. 这段 sourcemap 配置对公网生产环境有什么问题？给出更优取值并说明链路。

```js
build: { sourcemap: true }   // 产物 dist 整个上传公网 CDN
```

### 10. 阅读性能上报代码，为什么用户"点击链接跳走后那一条指标丢了"？

```js
onFCLS(metric => fetch('/vitals', { method: 'POST', body: JSON.stringify(metric) }));
```

---

## 二、手写（5 题）

### 1. 为一个 Vue 组件（内部调用 `userService.save` 并弹 toast）写 Vitest 组件测试：mock 模块层、断言渲染结构（getByRole）、用 userEvent 驱动表单提交、断言 toast 出现。

### 2. 用假定时器写一个 300ms 防抖函数的完整测试（含"期间多次调用只执行一次"与"取消定时器"两个用例），并保证不污染其他文件。

### 3. 为一个"dev 启动 60 秒"的项目写一份诊断脚本清单：`vite --debug` 看什么、如何数 `node_modules/.vite/deps` 的产物、给出 `entries`/`include`/`exclude`/`warmup` 四项各一条示例配置。

### 4. 写一段 GitHub Actions 片段：pnpm store 缓存（hashFiles 覆盖 lockfile）+ Turbo 任务缓存（本地 cache 目录）+ `vitest run --coverage`，并解释每层 key 的构成。

### 5. 用 size-limit 给两个资源写预算门禁：首屏 JS ≤ 120KB、路由块 ≤ 60KB，超限 CI 失败；再写 web-vitals 上报（sendBeacon 版）。

---

## 三、场景题（1 题）

### 1. 你要为团队 monorepo（apps/web + apps/admin + packages/ui + packages/utils）建立"测试与性能工程"基线：Vitest 配置组织（projects 还是逐包）、覆盖率门禁怎么定第一阶段数字、CI 三层缓存如何落 key、构建预算与线上 RUM 指标各选什么数字与分位数。给出完整方案与被否决项的理由。

---

## 四、简答题（3 题）

### 1. Vitest Browser Mode 与 Playwright e2e 的边界是什么？jsdom 的共同天花板列举三个。

### 2. 预构建缓存的失效条件有哪些？为什么 workspace 源码直出的包要 exclude、但它的 CJS 依赖要手动 include？

### 3. Lab 数据与 Field 数据各回答什么问题？为什么"分数没跌但用户骂声变多"两者都要看？

---

## 五、挑战题（1 题）

### 🏆 端到端工程化：给一个真实 Vite 项目装上"质量与性能的仪表盘"

任选你写过的 Vite 项目（或本课程示例），交付：

- **测试体系**：单测 + 组件测试（jsdom）+ 至少一个 Browser Mode 用例；`vitest related` 挂 pre-commit；覆盖率达到你自定的 thresholds
- **dev 提速**：实测启动耗时基线 → 按 vite-deps-perf 诊断路径调优 → 前后对比数字（entries/include/exclude/warmup 至少用两项）
- **CI 流水线**：三层缓存 + Turbo/Nx 任务图（或无 monorepo 时的等效步骤缓存）+ diff 覆盖率报告进 PR
- **预算与度量**：size-limit 门禁进 CI；`build.sourcemap: 'hidden'` + 错误监控上传链路说明；web-vitals sendBeacon 上报 + 一个最简看板（表格即可）
- **README**：一张"改动 → 本地 → CI → 上线 → 度量回流"的闭环图，标注每一环的数字门禁
