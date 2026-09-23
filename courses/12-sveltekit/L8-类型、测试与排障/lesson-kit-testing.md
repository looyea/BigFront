# 测试矩阵：Vitest 单测与 Playwright e2e

> 目标：搭出 SvelteKit 的三层测试金字塔——利用 load/action/handle"以 event 为入参、以返回值为输出"的纯函数红利做单测、用 Vitest（+`mount`/jsdom/`@testing-library/svelte`）测组件、用 Playwright e2e 从用户视角覆盖 SSR+水合全链路；讲清 mock `$app/*` 运行期模块的手法、`$env/dynamic` 比 `$env/static` 易测的原因、以及服务端钩子/`$lib/server` 的隔离测试（呼应 svelte-testing、vite-vitest）

## 一、Kit 给的可测性红利：load / action / handle 近乎纯函数

SvelteKit 把最核心的逻辑都收敛成**"吃一个类 event 对象、吐一个返回值"的导出函数**：

- `load(event)` → 返回数据对象（或抛 `error`/`redirect`）；
- `actions.default(event)` → 返回 `{ ... }` 或 `fail(...)`；
- `handle({ event, resolve })` → 返回 `Response`。

它们不依赖组件实例、不依赖浏览器 DOM，**单测里直接 `import` 进来、手工构造一个 event 桩调用即可**：

```js
// src/lib/server.test.js
import { expect, test } from 'vitest';
import { load } from '../routes/blog/[slug]/+page.server.js';

test('load 把 slug 透传给仓储', async () => {
  const calls = [];
  const data = await load({
    params: { slug: 'hello' },
    fetch: async () => ({ json: async () => ({}) }),
    depends: () => {},
    // 按需在桩里补齐用到的字段
  });
  expect(data).toHaveProperty('post');
});
```

这就是"纯函数化的可测性红利"：把取数、校验、鉴权判断写在这些导出函数里，而不是塞进组件的 `$effect`，测试成本骤降。官方也建议组件测试前先想清楚"到底是测组件还是测组件里的逻辑"，能抽成纯函数就抽出去单测、省掉渲染开销。

## 二、搭环境：Vitest 跑单测/组件测，`sv` 一键接入

用 Vite（含 SvelteKit）时官方推荐 **Vitest**。接入三选一：`npx sv add vitest`（项目创建时或之后）、手动 `npm i -D vitest` 再配 `vite.config`。要点：

- 纯逻辑单测：Node 环境即可，无需 DOM。
- **组件测试**要模拟 DOM：装 `jsdom`，Vitest 配置里 `test.environment = 'jsdom'`，并用 `resolve.conditions: ['browser']` 让 Vitest 在 Node 里走包的 browser 入口。
- 用 `mount`/`unmount`（Svelte 5）渲染组件到 `document.body`，或用 `@testing-library/svelte` 的 `render` + `screen`。
- **测试文件里想用 runes**（`$state`/`$derived`）：文件名必须含 `.svelte`（如 `x.svelte.test.ts`），否则编译不到 runes。

```js
// 组件测试骨架
import { mount, flushSync } from 'svelte';
import { expect, test } from 'vitest';
import Counter from './Counter.svelte';

test('点击自增', () => {
  mount(Counter, { target: document.body, props: { initial: 0 } });
  const btn = document.body.querySelector('button');
  btn.click();
  flushSync();
  expect(btn.textContent).toBe('1');
});
```

## 三、mock `$app/*`：运行期模块在测试里不存在

`$app/environment`、`$app/server`、`$app/stores`、`$app/navigation` 是 **Kit 运行时注入的虚拟模块**，裸 Vitest（非 `@sveltejs/vite-plugin-svelte` + kit 的 vite 配置下）解析不到、或其行为依赖真实导航上下文。用 `vi.mock` 顶掉：

```js
import { vi } from 'vitest';

// 想让代码走"浏览器分支"
vi.mock('$app/environment', () => ({ browser: true, dev: false, producing: false, building: false }));

// cookies / platform 由 $app/server 提供，单测里自造
vi.mock('$app/server', () => ({ cookies: { get: vi.fn(() => 'token'), set: vi.fn(), delete: vi.fn(), serialize: vi.fn() } }));
```

经验法则：**能被测函数通过参数（event）拿到的东西，优先传桩、不要 mock 模块**（更符合"纯函数红利"）；只有那些"直接 `import` 了 `$app/*`"的既有代码才用 `vi.mock` 兜。若项目里大量要 mock `$app`，考虑改用 Vitest + `@sveltejs/vite-plugin-svelte` 让 Kit 的 vite 插件参与解析，能少写不少桩。

## 四、`$env/dynamic` 比 `$env/static` 好测

上一关 L5/本关都会碰到环境变量。测试友好度上：

- `$env/static/*`：**构建期就被 Vite 静态替换成字面量**（可 DCE），值锁定为构建时的 `process.env`。测试里改 `process.env` 无效——它早被烤进代码了。
- `$env/dynamic/*`：**运行期读**，测试里可临时改 `process.env` 再 import（或 mock 该模块）来喂假值。

所以"可配置行为"若希望可单测，取数处用 `$env/dynamic/private` 或干脆把值经参数传入，比到处 `$env/static/private` 更利于测试。（安全红线回看 L8 排障关：`$env/*/private` **禁止被客户端代码 import**，构建即报错。）

## 五、服务端钩子与 `$lib/server` 的隔离测

`handle`/`handleError`/`init`、以及 `$lib/server/*`（如 db、鉴权）本就是**纯服务端**代码，用 Vitest 在 Node 环境直接测最顺——它们不在浏览器跑，也就不需要 jsdom。要点：

- 测 `handle`：传 `{ event: 桩event, resolve: vi.fn(() => new Response('ok')) }`，断言 `resolve` 被以带 `locals` 的 event 调用、或响应头被织入。
- 测 `handleError`：喂一个 `{ error, event }`，断言返回体形状符合 `App.Error`；用它区分"预期 `error()` vs 未预期异常"（L4）。
- 依赖真库/网络的，`vi.mock` 掉 db 驱动或注入假实现；把外部依赖做成构造函数参数（依赖注入）比 `import` 死耦合更好测。
- 记得 `$lib/server` 的 server-only 属性只在 Kit 构建期强制；单测里它就是个普通模块，正常 import 即可。

## 六、Playwright e2e：从用户视角覆盖 SSR+水合全链路

单测/组件测都看不到"服务端渲染 → 吐 HTML → 客户端水合 → 交互"这条完整链路，只有 **e2e** 能。社区推荐 **Playwright**（也可 Cypress/Nightwatch）。接入：`npx sv add playwright` 或 `npm init playwright`。关键是让 Playwright 跑在**真实的 build+preview**（而非 dev）上，才真正测到生产渲染路径：

```js
// playwright.config.js
export default {
  webServer: { command: 'npm run build && npm run preview', port: 4173 },
  testDir: 'tests',
  testMatch: /(.+\.)?(test|spec)\.[jt]s/,
};
```

```js
// tests/hello-world.spec.js
import { expect, test } from '@playwright/test';
test('首页有预期的 h1', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

e2e 对框架无感——你只是操作 DOM、写断言。它是唯一能抓出"SSR HTML 与水合后不一致（hydration mismatch）""客户端导航后状态错乱""action 提交后重渲染"这类**跨端问题**的层。典型覆盖：登录全流程（含 cookie/重定向）、表单校验回显、流式页面逐段出现、404/错误边界渲染。

## 七、三层怎么分工（别用 e2e 测单元逻辑）

- **单测（Vitest, Node）**：load/action/handle/纯 util 的分支与边界——快、便宜、覆盖逻辑组合。
- **组件测（Vitest + jsdom / 或 Playwright 组件模式 / Storybook test）**：props→DOM 的映射、交互反馈、可访问性角色。
- **e2e（Playwright, build+preview）**：关键用户旅程 + SSR/水合/导航/错误页的跨端正确性——慢、脆、只保留少数黄金路径。

反模式：拿 e2e 断言一个格式化函数（该单测）、或指望单测发现水合 mismatch（只有 e2e 能）。比例上金字塔下大上小：单测最多、e2e 精选。

## 八、自检清单

1. 说明 load/action/handle 为何"好测"，并写出给 `load` 传桩 event 的最小调用形态。
2. 组件测试需要装什么、Vitest 里 `resolve.conditions: ['browser']` 与 jsdom 各解决什么；测 runes 为何要求文件名含 `.svelte`。
3. `$app/environment`/`$app/server` 这类运行期模块在裸 Vitest 里为什么会挂、用什么顶替，"能传桩就不 mock"的判据。
4. 解释 `$env/static/*` 在测试里改不动、`$env/dynamic/*` 能喂假值的根本差异。
5. 为什么 Playwright 的 `webServer` 要 `build && preview` 而非 dev？举两类只有 e2e 才测得到的跨端问题。

🚀 **下一关**：kit-debug-playbook——500 白屏的 handle 读法、hydration mismatch 在 Kit 的呈现与拆法、load 死循环、`$lib/server` 越界导入、env 打进 bundle 的事故复盘。
