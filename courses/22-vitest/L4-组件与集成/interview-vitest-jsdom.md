# 面试题：DOM 环境（vitest-jsdom）

### 1. (对比类) jsdom 和 happy-dom 怎么选型？
**来源**：https://vitest.dev/config/environment.html

happy-dom 更轻快、覆盖常见 DOM API，够多数组件测试；jsdom 兼容度/完整度更高但稍慢。先试 happy-dom 提速，遇到它缺的 API 再回 jsdom。二者都需 npm i。

### 2. (实战类) 怎么给某个测试文件单独启用 jsdom？
**来源**：https://vitest.dev/guide/environment.html

文件顶部写 // @vitest-environment jsdom 注解，无需改全局。这样纯逻辑仍跑在快的 node、只有需要 DOM 的文件付 jsdom 成本，是兼顾速度与正确的最佳实践。

### 3. (原理类) 为什么默认 node 环境测不了组件？
**来源**：https://vitest.dev/config/environment.html

node 里没有 document/window 等浏览器全局，组件挂载要操作 DOM 直接 ReferenceError。jsdom/happy-dom 提供这些模拟，才谈得上渲染与查询 DOM。

### 4. (实战类) environmentOptions 能配什么？
**来源**：https://vitest.dev/config/environmentoptions.html

如 jsdom 的 url（改 location.href）、userAgent 等。测依赖当前地址、UA 判断分支的代码时用得上，happy-dom 也有对应选项。

### 5. (坑类) 组件里调 matchMedia 报错怎么办？
**来源**：https://vitest.dev/guide/environment.html

jsdom/happy-dom 未实现该 API。标准解法是在 setupFiles 里 polyfill/stub（global.matchMedia = vi.fn().mockImplementation(...)），一次性填平所有用例都缺的浏览器 API。

### 6. (实战类) 这些缺失 API 的 polyfill 应该放哪？
**来源**：https://vitest.dev/config/setupfiles.html

放 setupFiles——它每个测试文件执行前注入，避免每文件重复。ResizeObserver/IntersectionObserver/getComputedStyle 等常在组件库中被用到的，集中在这里补。

### 7. (原理类) jsdom 是真实浏览器吗？
**来源**：https://vitest.dev/guide/browser.html

不是。它是 JS 里对 DOM/规范的模拟，没有真实布局引擎与渲染管线。能查结构/属性/事件，但涉及真实尺寸计算、CSS 层叠细节、私有 API 时会与浏览器有出入——真要那层保真得用 browser mode 或 E2E。

### 8. (实战类) 组件测完为什么要 cleanup？
**来源**：https://vitest.dev/guide/browser/component-testing.html

挂载的组件往 document.body 追加节点，不清理会残留、导致下一条用例查到上一条的按钮/文本。RTL 现代版本自动 cleanup，否则显式 afterEach(cleanup)；Vue 用 wrapper.unmount()。

### 9. (对比类) 需要真实浏览器行为时怎么办？
**来源**：https://vitest.dev/guide/browser/why.html

jsdom 模拟不够真（布局、动画、真事件）时，上 Vitest 的 browser mode（真浏览器里跑）或 Playwright E2E。本包以 jsdom 主干为主，browser mode 属「知道去哪查」。

### 10. (坑类) 测依赖 location.href 的逻辑拿不到 url？
**来源**：https://vitest.dev/config/environmentoptions.html

jsdom 默认 url 固定，用 environmentOptions.jsdom.url 设成你要的地址；或happy-dom 对应选项。别在测试里手改 window.location（只读），配 url 才是正道。

### 11. (实战类) localStorage 在 jsdom 里能用吗？
**来源**：https://vitest.dev/guide/environment.html

能，jsdom/happy-dom 提供 localStorage/sessionStorage。但它是文件级环境的一部分——注意别跨用例残留脏值，必要时 beforeEach 里 clear()。

### 12. (原理类) environment 选择对性能有影响吗？
**来源**：https://vitest.dev/guide/improving-performance.html

有。node 启动/重建最快，jsdom 建 DOM 环境、happy-dom 更轻但都慢于 node。把不需要 DOM 的测试留在 node、只给组件测试上 jsdom，是保持整体快的关键。

### 13. (坑类) 同样的组件在 jsdom 红、浏览器里却正常？
**来源**：https://vitest.dev/guide/common-errors.html

多半是 jsdom 与真实 DOM 规范实现有差异（某 API 行为/缺失、CSS 计算不同）。先补 polyfill 或改语义断言；确需真环境行为就用 browser mode 复核，别硬按 jsdom 的怪癖写断言。

### 14. (实战类) DOM 断言为什么推荐 jest-dom 而不是查字符串？
**来源**：https://vitest.dev/api/expect.html

toBeInTheDocument/toBeVisible/toHaveClass 等按语义断言，比 innerHTML 字符串比较可读、失败信息友好、且不受无关结构变化干扰。装 @testing-library/jest-dom/vitest 即在 setupFiles 挂上。

### 15. (对比类) 纯函数和组件的测试环境该一样吗？
**来源**：https://vitest.dev/config/environment.html

不该。纯函数跑 node 最快最干净，没必要背 jsdom 成本；组件要 DOM 才上 jsdom/happy-dom。用 per-file 注解或 projects 把两类分开，兼顾速度与保真是常见工程姿势。
