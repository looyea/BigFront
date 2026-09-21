# 测试：把"能跑"变成"改不坏"

## 1. 一个 Nuxt 应用的测试金字塔

| 层 | 测什么 | 工具 | 快慢/数量 |
|---|---|---|---|
| 单元 | 纯函数、utils、composable 逻辑 | Vitest | 最快，最多 |
| 组件 | SFC 渲染 + 交互 | Vitest + `@vue/test-utils` / `@nuxt/test-utils` `mount` | 中 |
| 集成 | server route、Nitro 行为、useFetch 契约 | `@nuxt/test-utils`（起真实 Nitro）+ `$fetch` | 中少 |
| 端到端 | 关键用户流程、SSR/水合真身 | Playwright（`@nuxt/test-utils/e2e`） | 最慢，最少 |

原则沿用 04-vue/03-node 的结论：**底层多、顶层精，中间够用**。别把一切塞进 E2E（慢且脆），也别只用单测覆盖逻辑却测不到"SSR 到底出了什么 HTML"。

## 2. 骨架搭建

```bash
i -D @nuxt/test-utils vitest happy-dom @playwright/test
```

```ts
// vitest.config.ts（或 package.json 的 test 脚本）
import { defineVitestConfig } from '@nuxt/test-utils/config';
export default defineVitestConfig({
  test: { environment: 'nuxt' },   // 关键：'nuxt' 环境会装配 #imports/上下文
});
```

`package.json`：`"test": "vitest run"`，e2e 用 `"test:e2e": "playwright test"`。**CI 里在测试前先 `nuxt prepare`** 生成类型与 `.nuxt`（否则 `#imports` 解析失败，呼应 nuxt-modules 第 7 节）。

`environment: 'nuxt'` 是这套方案的价值核心：它让被自动导入的 `useRuntimeConfig`/`useState`/`useFetch`（呼应 nuxt-auto-imports）在测试里真的可调用，而不必手动 import 一切。

## 3. 单元：测一个 composable

```ts
// test/composables/useCart.spec.ts
import { describe, it, expect } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import UseCart from '../fixtures/UseCart.vue';   // 包一层宿主组件跑 setup

describe('useCart', () => {
  it('计算总价与数量', async () => {
    const wrapper = await mountSuspended(UseCart);
    expect(wrapper.find('[data-test=total]').text()).toBe('¥60');
    expect(wrapper.find('[data-test=count]').text()).toBe('2');
  });
});
```

纯逻辑（不碰 Vue/Nuxt 上下文的 utils）直接 `import` 测函数最省事（呼应 node-testing 的 vitest 基座）。一旦依赖 auto-import/注入/生命周期，就用 `mountSuspended`——它会 await 掉 setup 里的顶层 await（对应 vue-async-suspense 的异步 setup）。

## 4. Mock：auto-import、$fetch、config 三件套

```ts
import { mockNuxtImport } from '@nuxt/test-utils/runtime';

// ① 替掉自动导入的 composable
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { apiBase: 'http://test' } }));

// ② 替掉组件/接口数据（不想起真后端时）
mockNuxtImport('useFetch', () => (url: string) => ({
  data: ref({ id: 1, title: '假数据' }), status: ref('success'), error: ref(null),
  refresh: vi.fn(),
}));
```

组件替换用 `mockComponent('#components/Foo', stub 工厂)`。原则：**单元/组件层 mock 掉 IO；IO 的真实契约交给集成层测**——否则 mock 与真实行为脱节，测试全绿线上照崩。

## 5. 集成：测 server route（这是全栈框架的必测项）

`@nuxt/test-utils` 的 e2e/运行时能起一个真实的 Nuxt/Nitro 实例，然后用 `$fetch` 打自己的接口，**测的是真实 HTTP 语义（状态码、payload、缓存头）**：

```ts
// test/server/articles.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from '@nuxt/test-utils/e2e';

describe('articles api', async () => {
  await setup({ server: true });          // 启动构建后的服务端

  beforeAll(() => seedFixtures());        // 准备测试数据/隔离库
  afterAll(() => cleanFixtures());

  it('存在的文章返回 200 与正文', async () => {
    const a = await $fetch('/api/articles/1');
    expect(a.title).toBeTruthy();
  });
  it('不存在返回 404（而非 500）', async () => {
    await expect($fetch('/api/articles/999')).rejects.toMatchObject({ status: 404 });
  });
});
```

把 nuxt-error-debug 的错误契约（404/401 用 createError）、nuxt-server-routes 的方法后缀、鉴权中间件的放行清单，都做成这种断言——比在页面里点要可靠得多（呼应 exp-testing 用 supertest 测 API 的思路）。

## 6. 端到端：Playwright 验 SSR 与关键流程

```ts
// e2e/smoke.spec.ts
import { test, expect } from '@nuxt/test-utils/playwright';

test('首页 SSR 直出标题与首屏文案', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('NoteDeck-N');

  // 关键：断言"源码"里就有内容，证明没靠水合补（SEO 回归，呼应 nuxt-seo-meta 第 10 题）
  const html = await page.content();
  expect(html).toContain('首屏服务端文本');
});

test('未登录访问 /app 被引导到登录页', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});
```

e2e 只覆盖**转化关键路径 + "SSR/水合/鉴权/SEO"这类只有真浏览器真服务端才能证明的行为**（呼应 next-testing、vue-testing）。数量控制在"重要流程各一条"，否则跑不动也维护不了。

## 7. 测 SSR / 水合 / 环境这几个 Nuxt 专属点

- **payload 正确性**：e2e 里 `page.evaluate(() => window.__NUXT__)` 断言水合数据形状（呼应 nuxt-hydration）；
- **两侧一致**：断言"首屏 class/文本"与"水合后"一致，防 hydration mismatch 回归（呼应 nuxt-error-debug 第 10 题）；
- **runtimeConfig 覆盖**：用 `setup({ nuxtConfig: { runtimeConfig: {...} } })` 或设环境变量测多环境分支（呼应 nuxt-runtime-config）；
- **route rules 缓存头**：集成测试断言公开页 `cache-control`、私有页 `no-store`（呼应 nuxt-perf 第 9 题、nuxt-render-modes 安全线）；
- **模块产物**：对自研模块断言自动导入生效、注入的 server route 可达（呼应 nuxt-modules）。

## 8. 自检清单

- [ ] CI 里 `nuxt prepare` 在测试前跑了吗？
- [ ] 纯逻辑用最快层测，别为简单函数起整个 app？
- [ ] mock 是否只挡住 IO、而 IO 契约另有一层真实测试？
- [ ] server route 是否测了状态码/错误契约/缓存头，而不只是 200？
- [ ] 至少一条 e2e 断言"view-source 里有首屏内容"（SSR/SEO 回归）？
- [ ] 关键鉴权/付费/下单路径有无 e2e？
- [ ] 覆盖率有目标但**不迷信**（用例证明行为，不刷行数）？
- [ ] flaky 用例隔离治理（尤其依赖时间/随机/网络的，呼应 node-config）？

## 9. 🚀 部署预告

08-nuxt 的工程三件套（性能/错误/测试）齐了，进入收官阶段 L8 **nuxt-deploy**：Nitro 的 preset 家族与 `.output` 结构、Node/静态/Serverless/Edge 的取舍、Docker 与 Nginx 反代、环境变量注入——把这套同构应用真正跑在生产上（呼应 next-deploy、vite-deploy、node-deploy-perf）。
