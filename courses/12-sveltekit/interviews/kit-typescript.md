# kit-typescript 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SvelteKit 的 "generated types" 解决什么问题？产物在哪？
**来源**：端到端类型开场题的转述。

替代手写 `RequestHandler<{ params }>` 泛型——那玩意繁琐且路由改名即失效。Kit 在 `vite dev`/`build`/`prepare` 期为每个端点/页面生成 `.d.ts`（落在 `.svelte-kit/types/src/routes/**/$types.d.ts`），把 `RouteParams` 从目录结构算出来，再导出 `RequestHandler`/`PageLoad`/`PageData`/`ActionData` 等别名。源码 import `./$types` 即用，类型永远跟路由结构同步。

### 2. (A) `import('./$types')` 明明目录里没这文件，为什么能用？
**来源**：模块解析机制题的转述。

靠生成的 `.svelte-kit/tsconfig.json` 里 `rootDirs: ["..", "./types"]`——TS 把 `src/routes/...` 与 `.svelte-kit/types/src/routes/...` 视作同一虚拟目录，`./$types` 遂命中生成的那份。前提是**你的 tsconfig 先 `extends` 了 `.svelte-kit/tsconfig.json`**；不继承就解析不到、一片红。

### 3. (A) 生成 tsconfig 里 `verbatimModuleSyntax`、`isolatedModules`、`noEmit` 各为何必须？
**来源**：TS 配置项原理题的转述。

`verbatimModuleSyntax` 强制类型用 `import type` 引入，否则 Svelte/Vite 无法正确编译组件；`isolatedModules` 因 Vite 逐模块转译（非整图编译）；`noEmit` 表明 TS 只做类型检查、产物由 Vite 出。三者都被注释标为"别乱动"，要扩展走 `kit.typescript.config`。

### 4. (C) PageData、ActionData、PageProps 三者区别？
**来源**：数据类型辨析高频题的转述。

`PageData`=页面（含继承的 layout）load 返回的数据形状；`ActionData`=该路由所有 actions 返回值的联合（表单回显用）；`PageProps`（2.16+）=组件整体 props，含 `data: PageData` 且有 actions 时含 `form: ActionData`。一句话：PageProps 是"组件入参"，PageData/ActionData 是"数据子形状"。

### 5. (B) 从 2.16 前升级到用 PageProps，老代码怎么写、新怎么写？
**来源**：迁移写法题的转述。

老写法：`let { data, form }: { data: import('./$types').PageData, form: import('./$types').ActionData } = $props();`（Svelte 4 则 `export let data: PageData`）。新写法：`import type { PageProps } from './$types'; let { data, form }: PageProps = $props();`。`LayoutProps` 还额外带 `children: Snippet`。

### 6. (A) app.d.ts 的 App 命名空间有哪几个接口、各约束什么？
**来源**：ambient 类型题的转述。

`App.Error`（expected/unexpected 错误共同形状，message 内置）、`App.Locals`（event.locals，鉴权挂 user 在此定型）、`App.PageData`（跨所有页共享 data）、`App.PageState`（goto/pushState 的 state）、`App.Platform`（adapter 注入的 event.platform）。填了它们，相关 API 才有类型。

### 7. (B) app.d.ts 末尾的 `export {}` 能删吗？为何？
**来源**：细节坑题的转述。

不能删。没有它该文件被当作 ambient 模块，会禁止你写 `import` 声明。需要加真正的 `declare module` 时，另开 `src/ambient.d.ts`，别塞进 app.d.ts。

### 8. (A) App.Locals 和 L5 鉴权怎么配合？给一段典型声明与使用。
**来源**：类型×鉴权结合题的转述。

声明 `interface Locals { user: { id: string; name: string } | null }`；`handle` 里 `event.locals.user = await getUserFromCookie(cookies)`；此后任意 server load/`+server.js`/`handleError` 里 `event.locals.user` 都带类型（可能为 null 需判空），全站一致、无 any。

### 9. (B) `[...rest]` 和 `[[optional]]` 在生成的 RouteParams 里分别是什么类型？
**来源**：动态段类型题的转述。

`[...rest]` → `string`（把匹配到的多段拼成一个含斜杠的字符串，不是 `string[]`）；`[[optional]]` → `string | undefined`（可缺省）。别把 rest 当数组遍历、也别假设可选段一定有值。

### 10. (B) 挂了 matcher 的 `[id=numeric]`，params.id 会自动变 number 吗？
**来源**：matcher 与类型关系题的转述。

不会。matcher 只在运行时决定该段是否匹配（不中则尝试别的路由/404），不影响类型收窄——`params.id` 仍是 `string`，要数字自己 `Number(params.id)`。类型层对动态段一视同仁是 string。

### 11. (D) 设计"全站页眉都要当前用户 + 语言"的类型方案。
**来源**：跨路由数据定型题的转述。

两者放共享 layout：`+layout.server.js` 里 `load` return `{ user, lang }`。把 `App.PageData` 声明为 `{ user: ... | null; lang: Locale }`（用可选属性表达"仅某些页出现"的，别用 `[key:string]:any` 索引签名以免击穿收窄），这样任意页 `data.user`/`data.lang` 与 `$page.data` 都带类型；`lang` 由上一关 i18n 的 `[[lang]]` load 注入。

### 12. (C) `.svelte-kit` 该不该进版本库、能不能手改？要定制生成的 tsconfig 怎么办？
**来源**：工程实践题的转述。

不进库、不手改：它是每次构建/prepare 重新生成的产物（outDir）。要增删 `include`/改 `compilerOptions`，走 `svelte.config.js` 的 `kit.typescript.config`（如设 `generatedTsconfig` 相关项）扩展生成结果，而不是直接编辑 `.svelte-kit/tsconfig.json`。`types/**/$types.d.ts` 同理，改路由结构再重新生成即可。

🚀 **下一组**：kit-testing 面试题——三层测试金字塔、mock `$app/*`、e2e 覆盖水合的高频考法。
