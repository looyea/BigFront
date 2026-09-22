# 端到端类型：generated types 与 params 收窄

> 目标：把 SvelteKit 的"类型从路由结构里长出来"讲透——`RequestHandler`/`Load` 手动写 `Params` 泛型为什么笨拙、Kit 为每个路由生成 `.svelte-kit/types/.../$types.d.ts` 的产物、`./$types` 靠 `rootDirs` 当兄弟模块导入、`params` 如何按 `[foo]` 目录收窄、load 返回类型经 `PageData`/`LayoutData`/`ActionData` 流转、`PageProps`/`LayoutProps`（2.16+）与 `app.d.ts` 的 `App` 命名空间（呼应 svelte-typescript、11-svelte L7）

## 一、手写 Params 泛型之痛

`RequestHandler` 和 `Load` 类型都接受一个 `Params` 泛型来标注 `params`。裸写是这样：

```js
// src/routes/[foo]/[bar]/[baz]/+server.js
/** @type {import('@sveltejs/kit').RequestHandler<{ foo: string; bar: string; baz: string }>} */
export async function GET({ params }) { /* ... */ }
```

两个致命缺点，官方原话点破：**写起来繁琐**（每个动态段都要手抄进类型），且**不便携**——把 `[foo]` 目录改名成 `[qux]`，类型就与现实脱节了，TS 还一脸无辜。路由结构是"真相源"，手写泛型是"抄一份副本"，副本必然漂移。

## 二、generated types：类型从路由树里长出来

SvelteKit 的解法是**为每个端点/页面生成 `.d.ts`**。构建/`vite dev` 期，在 `.svelte-kit/types/src/routes/[foo]/[bar]/[baz]/$types.d.ts` 产出：

```ts
type RouteParams = { foo: string; bar: string; baz: string };
export type RequestHandler = Kit.RequestHandler<RouteParams>;
export type PageLoad = Kit.Load<RouteParams>;
// 还有 PageData / LayoutData / ActionData / PageProps / ...
```

于是源码里只需 `import` 同级的 `./$types`，`params` 自动带上收窄：

```js
/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
  params.foo; // string，且编译器知道只有 foo/bar/baz
}
```

目录改名？重新生成即可，类型永远跟着路由结构走——这就是"端到端类型"的核心红利：**路由即类型源**。`.svelte-kit` 目录是构建产物、`outDir`，不要手改也不该进版本库。

## 三、`./$types` 为什么能"当兄弟模块 import"

`./$types` 并不真实存在于 `src/routes/.../` 目录里——它映射到 `.svelte-kit/types/src/routes/.../$types.d.ts`。这靠的是生成的 tsconfig 里两行：

```jsonc
"compilerOptions": {
  "paths": { "$lib": ["../src/lib"], "$lib/*": ["../src/lib/*"] },
  "rootDirs": ["..", "./types"]   // 关键
}
```

`rootDirs` 让 TS 把 `src/routes/...` 与 `.svelte-kit/types/src/routes/...` **视作同一虚拟目录**，于是 `import('./$types')` 命中生成的那份。前提：**你自己的 `tsconfig.json`/`jsconfig.json` 必须 `extends` 生成的 `./.svelte-kit/tsconfig.json`**。不继承，`rootDirs`/`paths` 缺失，`./$types` 就红一片。

生成 tsconfig 里还有一组**别乱动**的选项：`verbatimModuleSyntax`（强制 `import type`，否则 Svelte/Vite 编译异常）、`isolatedModules`（Vite 逐模块编译）、`noEmit`（TS 只做类型检查不产码）、`moduleResolution: "bundler"`。要扩展改这些，用 `svelte.config.js` 里的 `kit.typescript.config`。

## 四、load 返回值 → PageData / LayoutData / ActionData 的类型流转

类型闭环的另一半是**数据形状自动生成**。load 的返回类型经 `./$types` 暴露：

- 页面 load 返回类型 → `PageData`；布局 load → `LayoutData`。
- 所有 actions 的返回联合 → `ActionData`。

组件侧消费：`+page.svelte` 的 `data`、`form` prop 直接对上这些类型，**load 改了返回结构，组件立刻报错**——端到端。

**2.16.0 起**给了更省事的两件套：`PageProps`（= `{ data: PageData; form?: ActionData }`）、`LayoutProps`（= `{ data: LayoutData; children: Snippet }`）：

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>
```

2.16 之前的老写法要自己拼 `{ data: PageData, form: ActionData }`；Svelte 4 则是 `export let data: PageData`。面试常问"PageProps 和 PageData 区别"——前者是**组件 props 的整体形状**（含 form/children），后者只是 **load 返回的数据**。

## 五、跨路由的公共形状：app.d.ts 的 App 命名空间

`./$types` 管的是"单路由局部"，跨全站共享的类型放 `src/app.d.ts` 的 `App` 命名空间（ambient，无需 import）：

```ts
declare global {
  namespace App {
    interface Error {}      // 错误体形状（L4：+error.svelte / handleError）
    interface Locals {}     // event.locals（L5 鉴权：塞 user 在此定型）
    interface PageData {}   // 跨所有页共享的 data（如全局 me/lang）
    interface PageState {}  // goto/pushState 传的 page.state
    interface Platform {}   // adapter 注入的 event.platform（如 Cloudflare env）
  }
}
export {};
```

- 填了这些接口，`event.locals.user`、`event.platform.env` 等才**有类型**——L5 鉴权把 `locals.user` 写进 `App.Locals`，全站 load/handle 就能 `event.locals.user` 带类型取用。
- `App.Error` 定 expected/unexpected 错误共同形状（`message` 内置）。
- 文件末尾 `export {}` 是必须的：否则该文件被当 ambient 模块、无法再写 `import`。真要 `declare module` 请另开 `src/ambient.d.ts`。
- `App.PageData` 用**可选属性**表达"只在某些页出现的共享 data"，**不要加索引签名 `[key: string]: any`**（会击穿收窄）。

## 六、params 收窄的边界与 `matcher` 联动

`params` 的类型来自路由段的**名字**，值永远先是 `string`（动态段没有"数字 id"这种类型）。两条实战：

1. **`[...rest]` → `string`**（不是 `string[]`），**`[[optional]]` → `string | undefined`**——生成的 `RouteParams` 会据此标注，别假设可选段一定有值。
2. **matcher 不影响类型、只影响匹配**：`[id=numeric]` 生成的 `params.id` 仍是 `string`。要数字得自己 `Number(params.id)`。matcher 的价值在运行时挡非法段（L7 i18n 用过），不在类型收窄。

想验证产物：跑一次 `vite prepare`（或 `npm run dev`）后翻 `.svelte-kit/types/src/routes/**/$types.d.ts`，是最快看清"某路由到底导出了哪些类型别名"的办法。

## 七、自检清单

1. 说出裸写 `RequestHandler<{...}>` 泛型的两个缺点，以及 generated types 如何根治。
2. 解释 `import('./$types')` 能命中 `.svelte-kit/types/.../$types.d.ts` 依赖 tsconfig 的哪一项、以及你的 tsconfig 必须先做什么。
3. 区分 `PageData` / `LayoutData` / `ActionData`，并说 `PageProps`（2.16+）比它们多带什么。
4. 列出 `app.d.ts` 里 `App` 命名空间的五个接口各自约束什么，`App.Locals` 与 L5 鉴权怎么配合。
5. 回答 `[...rest]`、`[[optional]]` 在生成的 `RouteParams` 里分别是什么类型，以及挂了 matcher 的段类型会不会变成非 string。

🚀 **下一关**：kit-testing——load/action 纯函数化的可测性红利、Vitest 单测与 `mount`、Playwright e2e 覆盖 SSR+水合、mock `$app/*` 与服务端钩子隔离。
