# 多语言路由：[[lang]] 模式与语言协商

> 目标：搭一套不靠重型插件、纯用 Kit 原语就能落地的 i18n——`[[lang]]` 可选段让 `/` 与 `/en/...` 同页、param matcher 挡掉非法语言码、`reroute` 静默重写与 `handle`+`redirect` 规范化两条路的取舍、`load` 注入文案 + `setContext` 分发 `$t`、以及 hreflang/canonical 的 SEO 闭环（呼应 nuxt-i18n-content-layers、next-i18n 的 locale 前缀路由）

## 一、为什么是 `[[lang]]` 而不是 `[lang]`

多语言站点最常见的诉求是：**默认语言不带前缀，其余语言带前缀**。即 `/about` 与 `/en/about` 都要能开、`/zh/about` 也开。

- 用必填段 `[lang]/about` → `/about` 匹配不到，默认语言被迫也带前缀或额外做重定向。
- 用**可选段** `[[lang]]/about` → `lang` 参数可有可无，`/about`（`lang` 为 `undefined`）与 `/en/about` 命中**同一个页面组件**。

官方对可选参数的原话就是"让 `home` 和 `en/home` 指向同一个页面"。两条硬约束记牢：

1. **可选段不能跟在 rest 段后面**（`[...rest]/[[optional]]` 非法）——因为参数按"贪婪"匹配，尾部可选段永远取不到值。
2. 排序时 `[[optional]]`（和 `[...rest]`）**除非位于路由最后一段，否则被忽略**：`x/[[y]]/z` 在优先级计算里等价于 `x/z`。所以把 `[[lang]]` 放**最前**且整站结构清晰时，它主要靠 matcher 保证正确性，而非靠排序压过别的动态段。

路由目录长这样（`(site)` 是布局组，不影响 URL）：

```
src/routes/
└ [[lang=lang]]/
  ├ (site)/
  │ ├ about/+page.svelte
  │ ├ blog/[slug]/+page.svelte
  │ └ +layout.svelte
  └ +layout.server.js
```

## 二、matcher：把 `[[lang]]` 收紧成"只认合法语言码"

裸 `[[lang]]` 会连 `/hello/about` 都当成 `lang=hello` 去匹配。给它挂个 **param matcher**，只放行你支持的语言码：

```js
// src/params/lang.js
const valid = new Set(['en', 'zh', 'fr']);

/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
  return valid.has(param);
}
```

路由里写 `[[lang=lang]]`（`[名=matcher名]`）。要点：

- **matcher 在服务端和浏览器都会跑**——所以客户端导航的非法前缀同样被拒。
- 带 matcher 的段优先级**高于**不带 matcher 的段；不匹配时 Kit 会去试其它路由，最终都不中才 404。
- `src/params` 下每个模块即一个 matcher，`*.test.js`/`*.spec.js` 除外（可用来单测 matcher）。
- matcher 里的语言码集合应与一个共享配置（如 `$lib/i18n/config.js` 导出 `locales`、`defaultLocale`）保持同源，别在多处硬编码。

## 三、两条协商路线：reroute 静默重写 vs handle+redirect 规范化

用户带着 cookie（上次选的语言）或直接敲 `/about` 时，如何决定渲染哪个语言？两条正统路：

**路线 A —— `reroute` 静默重写（URL 不变）。** `reroute` 在 URL 与路由匹配**之前**运行，返回一个新路径即可"偷梁换柱"，用户地址栏仍是 `/about`：

```js
// src/hooks.js（两端都跑）或 hooks.server.js
export function reroute({ url }) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (!locales.includes(segments[0])) {
    const lang = negotiate(url) || defaultLocale; // cookie / Accept-Language
    return `/${lang}${url.pathname}`;
  }
}
```

**路线 B —— `handle` + `redirect`（URL 变，302/307）。** 在 `handle` 里协商出语言，若不是规范形式就 `redirect(307, '/' + lang + path)`，把用户**显式**送到带前缀的 URL。

取舍：

| 维度 | reroute 静默重写 | handle + redirect |
|---|---|---|
| 地址栏 | 保持 `/about` | 变 `/zh/about` |
| SEO | 同内容多 URL 风险，需靠 canonical 收敛 | URL 唯一、利于规范化 |
| 体验 | 无额外往返 | 一次重定向往返 |
| 适用 | 默认语言无前缀、想省跳转 | 要严格"每语言一 URL" |

实务常**混用**：reroute 处理"进得来"、配合 redirect 只在需要改前缀时才跳。注意别和 Kit 内置的 `trailingSlash`/前缀规则打架导致重定向环。

## 四、文案注入：load 取 lang + context 分发 `$t`

语言一旦定，就把"当前语言 + 文案表"注入组件树。标准两步：

**① `+layout.server.js` 从 `params.lang` 决定语言并 return：**

```js
// src/routes/[[lang=lang]]/+layout.server.js
export function load({ params }) {
  const lang = locales.includes(params.lang) ? params.lang : defaultLocale;
  return { lang };
}
```

**② `+layout.svelte` 用 `setContext` 把翻译函数往下发**（context 是"往下传、SSR 安全"的正道，见 L3/本包状态关）：

```svelte
<script>
  import { setContext } from 'svelte';
  import { getMessages, t } from '$lib/i18n/runtime';
  let { data, children } = $props();
  const messages = getMessages(data.lang);
  // 传"函数/对象"而非快照，保持跨边界响应式
  setContext('i18n', { lang: data.lang, t: (key, vars) => t(messages, key, vars) });
</script>
{@render children()}
```

子组件 `const { t } = getContext('i18n')` 即可 `{$t('nav.home')}`。文案字典按需 `import`（`$lib/i18n/en.json` 等）或用轻量运行时；切换语言就是导航到带新前缀的 URL，让 load 重跑换 `lang`——**不要**在服务端模块顶层存"当前语言"这种共享状态（L5 状态纪律：服务端跨请求共享变量会串用户）。

> 想少写样板可上社区方案（如 paraglide、sveltekit-i18n），但面试与排障要能徒手讲清上面这条原语链。

## 五、SEO 闭环：hreflang + canonical

多语言的 SEO 三件套，写在 `+layout.svelte` 的 `<svelte:head>` 里：

```svelte
<svelte:head>
  <!-- 当前页的规范地址（避免重写的重复内容） -->
  <link rel="canonical" href={new URL(page.url.pathname, origin)} />
  <!-- 每个语言一条 alternate，含无前缀的默认语言 x-default 惯例 -->
  {#each locales as loc}
    <link rel="alternate" hreflang={loc} href={urlFor(loc)} />
  {/each}
  <link rel="alternate" hreflang="x-default" href={urlFor(defaultLocale)} />
</svelte:head>
```

要点：`hreflang` 的值要与实际可达 URL 一一对应（含 `[[lang]]` 无前缀那条要能被 `urlFor` 正确生成，否则搜索引擎收录到 404）；canonical 用来把"route 无前缀 + 带前缀都能开"的潜在重复内容收敛到一个规范 URL；`x-default` 指向语言选择页或默认语言。URL 里带上语言，`sitemap.xml`（可做成一个 `+server.js` 端点，见上一关）也要每个语言各列一条。

## 六、自检清单

1. 解释 `[lang]` 与 `[[lang]]` 的差异，以及"可选段不能跟在 rest 段之后"的原因。
2. 写出 `src/params/lang.js` 的 matcher 并在路由里引用；说明 matcher 在 server 与 browser 是否都跑。
3. 对比 `reroute` 静默重写与 `handle`+`redirect` 两条协商路线（地址栏/SEO/往返三维），各给一个适用场景。
4. 画出"params.lang → load return → setContext → getContext `$t`"的注入链，并说明为何不在服务端顶层存当前语言。
5. 列出 hreflang/canonical/x-default 各自解决什么，`urlFor(defaultLocale)` 为什么要能生成无前缀 URL。

🚀 **下一关**：kit-navigation-state——`$app/stores`→`$app/state` 的信号化迁移、`page/navigating/updated` 订阅纪律、导航竞态与 `beforeNavigate`/`willUnload`、滚动恢复控制。
