# 浏览器环境与 DOM 测试

## 一、为什么需要 jsdom / happy-dom

前面纯逻辑跑在 `node` 环境——没有 `document`。要测**依赖 DOM 的代码或组件**，就得给一个模拟浏览器环境：`environment: 'jsdom'`（需 `npm i -D jsdom`）或更轻快的 `happy-dom`。二者都提供 `document/window/localStorage` 等常见 API。

## 二、选型与开关

追求速度、API 覆盖够多数组件 → `happy-dom`；遇到它没实现的偏门 API → 回 `jsdom`（完整度更高但稍慢）。全局设一个、单文件用注解覆盖：

```ts
// @vitest-environment jsdom
```

`environmentOptions` 可配 `jsdom.url`、`userAgent` 等，测依赖 `location.href` 的逻辑时用得上。

## 三、jsdom 缺的浏览器 API

jsdom/happy-dom **不是真浏览器**，`matchMedia`、`ResizeObserver`、`IntersectionObserver`、`getComputedStyle` 细节等常缺。它们在组件里被调用会直接报 undefined。**标准做法**：在 `setupFiles` 里补 polyfill / stub（如 `global.ResizeObserver = vi.fn()...`），一次性填平。

## 四、cleanup：别让 DOM 泄漏

RTL/test-utils 挂载的组件会往 `document.body` 塞节点。用例间不清理就会互相干扰（查到上一个用例残留的按钮）。RTL 配 `globals`/现代版本会**自动 cleanup**；否则显式 `afterEach(() => cleanup())`。Vue 用 `wrapper.unmount()`。

## 五、DOM 断言心法

别拿 `innerHTML` 字符串比一切（脆且难读）。装 `@testing-library/jest-dom/vitest` 用 `toBeInTheDocument/toBeVisible/toHaveValue/toHaveClass` 等**语义化断言**，失败信息友好、意图清晰。jsdom 只保证「有 DOM 结构可查」，复杂渲染/布局真相要 browser mode 或 E2E（见收官关）。

## 小结
测 DOM/组件必须切 jsdom 或 happy-dom（默认 node 无 document）；happy-dom 快、jsdom 全，@vitest-environment 按文件覆盖、environmentOptions 配 url/UA；matchMedia/ResizeObserver 等缺失 API 在 setupFiles 里 polyfill；组件挂载要 cleanup/unmount 防互串；断言用 jest-dom 语义化 matcher、别比 innerHTML 字符串。

## 部署预告
把某文件设 `// @vitest-environment jsdom`，写 `document.body.innerHTML = '<h1 id=x>hi</h1>'` 后用 `document.getElementById('x')` 与 jest-dom 的 `toBeInTheDocument` 断言；再故意调 `window.matchMedia` 看它报错，去 setupFiles 补个 stub 修好。
