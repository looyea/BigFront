# Svelte 与 TypeScript：不折腾的类型系统

> 目标：掌握 `.svelte` 文件写 TS 的正确姿势——`<script lang="ts">` 与类型作用域、props/事件/runes 的推导规则、泛型组件、snippet 类型；搞清 `svelte-check`/`svelte2tsx` 这套"翻译器"工具链与 `.svelte.js` 模块的类型边界。对照 02-typescript 包与 vue-typescript 关（呼应 svelte-props、svelte-snippet-children）。

---

## 一、入口只有一个：`<script lang="ts">`

```svelte
<script lang="ts">
  interface Props { title: string; count?: number; ondone?: (n: number) => void }
  let { title, count = 0, ondone }: Props = $props();

  let value = $state(count);            // number,自动推
  let doubled = $derived(value * 2);    // number,自动推
</script>

<h1>{title}</h1>
<button onclick={() => ondone?.(value)}>+1</button>
```

三条地基规则：

1. **runes 的类型是推导出来的，不是标注出来的**——`$state(0)` 就是 `number`，`$props()` 挂上 `Props` 接口后解构项各有其型。不需要 Vue 的 `defineProps<…>()` 编译器宏（Svelte 没有宏体系，呼应 vue-typescript 的宏对比）。
2. **类型只存在于 `<script>` 里**：模板表达式能引用这些类型吗？不能——模板没有类型标注位，类型检查发生在编译后的 tsx 等价物上（第三节）。给事件处理器标注要写在 script：`const submit = (e: SubmitEvent) => { e.preventDefault(); … }`。
3. **`<script context="module">` 里同样可 `lang="ts"`**，存放导出的类型/常量，供别的文件 `import type`。

## 二、props、双向与事件的类型约定

| 场景 | 写法 | 注意点 |
|---|---|---|
| 默认 props | `let { count = 0 }: Props = $props()` | 可选属性 `?` 与默认值二选一即可给"必有值"型 |
| 双向绑定 | `let { page = $bindable(1) }: Props = $props()` | `$bindable` 有独立类型包装，父不绑也不报错 |
| 回调事件 | `onevent?: (e: MouseEvent) => void` | 事件 props 就是函数 props（呼应 svelte-events） |
| rest 透传 | `let { class: _, ...rest }: Props & HTMLAttributes<'div'> = $props()` | 类型层承认"还有别的属性"，配合 `$$restProps` 使用（呼应 svelte-spread-rest） |
| Snippet | `{ children?: Snippet; row?: Snippet<[Item]> }` | `Snippet<[T]>` 是函数类型的官方别名，`import type { Snippet } from 'svelte'` |

children/带参 snippet 的类型是 L3 组合模式的类型化收口：`Snippet<[Row]>` 意味着父传入时必须 `#snippet row(r)`，`r` 推为 `Row`。

## 三、幕后英雄：svelte2tsx 与 svelte-check

`.svelte` 不是 `.ts`，TS 语言服务凭什么懂它？——**翻译器**：

- `svelte2tsx` 把组件等价改写成一段 tsx（模板→JSX、`$props()` 解构→带默认值的变量声明、类型注解回填），语言服务在 tsx 上做检查，再把诊断**映射回**原文件行号。
- **svelte-check** = 命令行跑同一套翻译+检查，CI 里 `svelte-check --tsconfig ./tsconfig.json` 出错误清单；VS Code 的 Svelte 扩展内置同款引擎（svelte.language-server）。
- 代价认知：类型报错的行号/波浪线偶尔"串位"（映射损耗）；模板里的类型窄化能力弱于 script 内（`{#if x != null}` 的窄化可以跨块传播，但复杂链式判断会放弃）。
- 对照：Vue 靠 `vue-tsc` 对 SFC 做同样的 tsx 化——**两家的"模板 TS"本质是同一工程方案**（呼应 vue-typescript 的 vue-tsc 节）。

## 四、泛型组件与高级形态

```svelte
<!-- List.svelte -->
<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte';
  let { items, row }: { items: T[]; row: Snippet<[T]> } = $props();
</script>
{#each items as item (item.id)}{@render row(item)}{/each}
```

- `generics="…"` 属性（svelte5 起支持）让组件对 props 类型参数化；调用端从 `items` **反推** `T`。
- 没有它时的退化写法：`T` 用 `unknown` + 调用端断言，或把 item 类型整个塞进 snippet 参数（`Snippet<[Item]>` 固定版）。
- `$derived` 回调形态 `const x = $derived.by(() => {…})` 里可以写局部类型标注，等价于给复杂推导"划重点"。

## 五、`.svelte.js/.ts` 共享模块的类型边界

L4 全局态模块的 TS 形态（呼应 svelte-global-state）：

```ts
// counter.svelte.ts
export function createCounter(initial = 0) {
  let count = $state(initial);
  return {
    get count() { return count; },
    get double() { return count * 2; },
    inc() { count++; }
  };
}
export type Counter = ReturnType<typeof createCounter>;
```

- 编译器对 `.svelte.js/.ts` 开放 runes，TS 侧要保证 **tsconfig 的 include 覆盖它们**，并在 `svelte.config.js` 配 `preprocess: vitePreprocess()`（svelte-check 随之启用 `parser: "svelte-ts"`）才认得这些文件里的 `$state`。
- getter 暴露只读信号是**类型与封装双赢**：外部拿到的 `count` 是 `number` 而非可写引用，杜绝 `counter.count = 5` 的越权写。
- 纯逻辑（无 runes）请放 `.ts` 普通模块——别为用不上的扩展名支付编译管线成本。

## 六、tsconfig 与工程接线

- 脚手架（`npx sv create --types typescript`）已配好：`svelte-check` 脚本 + `@tsconfig/svelte` 基座。
- 手搭项目基座用 `"extends": "@tsconfig/svelte"`（module/moduleResolution/runes 全局声明一并配齐）；若要在纯 `.ts` 文件里用 runes，记得该文件需命名为 `.svelte.ts` 才能进编译器管线；`svelte/elements` 提供 `HTMLAttributes` 等元素 props 类型，给 rest 透传接口兼作基型。
- `svelte.config.js` 的 `compilerOptions.types` 可全局注入类型（如给自定义元素补 `$props` 基型），**能用则慎用**——隐式全局是最难查的类型污染源。
- 严格模式建议 `strict: true` + `"moduleDetection": "force"`：runes 的推导红利要在严格档才完整（`$state(undefined)` 推不出 `string | undefined` 之外的事）。

## 七、自检清单

- [ ] 能写出带默认值、`$bindable`、rest 透传、Snippet 的完整 Props 接口。
- [ ] 说得出 svelte2tsx/svelte-check 的"翻译-映射"原理与 vue-tsc 的对应关系。
- [ ] 会用 `generics=` 或固定 Snippet 泛型做列表组件。
- [ ] `.svelte.ts` 模块知道 getter 只读暴露与 tsconfig include。
- [ ] 知道模板无标注位、类型活写在 script 这条纪律。

---

🚀 **下一关**：`svelte-testing`——@testing-library/svelte 在 Svelte 5 下的 render/fireEvent/清理契约，Vitest 接线与 Playwright E2E 分层（呼应 node-testing、react-testing、vue-testing）。
