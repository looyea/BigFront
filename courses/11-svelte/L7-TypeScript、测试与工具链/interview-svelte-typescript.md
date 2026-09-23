# svelte-typescript 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区高频主题的转述。

---

### 1. (A) `.svelte` 文件不是 TS，类型检查是怎么跑起来的？

**来源**：Svelte 文档 — TypeScript 章节转述

svelte2tsx 把组件翻译成类型等价的 tsx：模板变 JSX、`$props()` 解构带默认值的声明、runes 原语映射到 `svelte/types` 的全局声明。语言服务（编辑器）与 svelte-check（CI）在 tsx 上跑标准 TS 检查，再把诊断位置映射回 `.svelte` 行号。所以：纯 `tsc` 单独跑查不到组件类型错；报错位置偶尔串位是映射损耗。Vue 的 vue-tsc 是同构方案——面试答出"翻译层"三个字就赢一半。

### 2. (B) `let { count = 0 }: Props = $props()` 里 Props 写了 `count?: number`，count 的类型是什么？为什么？

**来源**：TypeScript/Svelte 组合面试细节题

是 `number`。解构默认值在类型层把 `undefined` 从联合里剔除（TS 标准行为：`{k?: T}` + `k = v` 解构后为 `T`）。反向坑：若接口 `count: number | undefined` 而调用方**显式传 `count={undefined}`**，默认值同样兜住——Svelte 的 props 默认值语义就是"undefined 时生效"。给必传属性手滑加 `?` 又没默认值，就会在模板里吃 `possibly undefined`——两种写法各管各的场景。

### 3. (B) 事件处理器 `(e) => …` 在 TS 里报错"隐式 any"，三种修法是？

**来源**：Svelte Discord — typing event handlers 高频答疑

① 就地标注：`onclick={(e: MouseEvent<HTMLElement>) => …}`（`svelte/elements` 提供元素级事件类型泛型）；② script 里先写好具名函数再 `{handleSubmit}` 引用；③ 交给推导——`onclick={handleSubmit}` 时编译器知道 `handleSubmit` 的签名，模板常无需标注。深层考点：Svelte 模板表达式在翻译后就是 JSX props，事件类型走 `HTMLAttributes` 的 `onxxx?: EventHandler<…>` 声明，`strict + noImplicitAny` 下漏标才报。

### 4. (A) `$state` 与 class 联用时类型上有什么讲究？

**来源**：Svelte 5 组件模式讨论帖汇编

`$state(SomeClass)` 的返回类型仍是 `SomeClass`，但**运行时是代理**：公开字段可读写可响应，私有 `#field` 不在代理面（类型系统不区分公私代理性——**编译期绿、运行期不响应**是这类代码的签名症状）。纪律：class 只当数据形状用、方法保持纯；或干脆工厂函数 + 对象字面量（L4 全局态关的 counter 例子）。答出"类型骗你、代理不骗你"这层张力即到位。

### 5. (C) Vue 3 用 `defineProps<{…}>()` 编译器宏给 props 类型，Svelte 用接口 + `$props()`。两种设计的哲学差异？

**来源**：跨框架类型系统对比 — 前端周刊专栏

Vue 的宏是"模板编译器专属 DSL"：调用会被编译期移除、受限于 setup 上下文、需要额外语言工具识别；换来的是单一入口、运行时 props 校验可一并生成。Svelte 把 `$props()` 设计成**真函数语义的符文**+普通 TS 类型标注：无专用宏体系、类型即普通接口（可 export、可复用、可组合 `HTMLAttributes`），代价是运行时校验要手写（或接 zod，呼应 svelte-forms）。一句话：Vue 类型走编译器特权通道，Svelte 类型走标准 TS 通道。

### 6. (D) 封装一个类型安全的 `<DataTable items row:Snippet<[T]> onsort>` 泛型组件，接口怎么落？

**来源**：组件库面经 — 泛型表格组件设计题

`<script lang="ts" generics="T extends Record<string, unknown>">` + `interface Props { items: T[]; columns: (keyof T)[]; row: Snippet<[T]>; onsort?: (col: keyof T, dir: 'asc'|'desc') => void }`。要点：① `keyof T` 让列名与数据字段同源，改名即报错；② `Snippet<[T]>` 让父组件 `#snippet row(item)` 的 item 自动成 `T`；③ 回调参数也走泛型，`onsort` 的 col 推为字段名字面量联合。泛型约束别贪心写 `object`，`keyof` 能力要 `Record<string, unknown>` 级别约束才不丢推导。

### 7. (B) `.svelte.js` 模块里的 runes 在 VS Code 里满屏"Cannot find name '$state'"，原因与修法？

**来源**：GitHub svelte issues — runes in .svelte.js 环境配置高频帖

原因：runes 的全局类型声明随 `svelte` 包发布，需要 ① svelte-check/语言服务以 `parser: svelte-ts`（svelte.config.js 配了 `vitePreprocess` 即生效）处理该文件；② tsconfig `include` 覆盖 `**/*.svelte.js/ts`；③ 老版 svelte 语言服务对 `module` 检测要求文件确为 ESM。修配置而不是改用 `import {$state}` ——**runes 不是可 import 的导出**，它是编译器原语，任何"import $state 成功"的写法都是幻觉/垫片。

### 8. (A) 为什么组件 props 接口推荐写 `interface Props` 而不是 type 别名？有区别吗？

**来源**：TS 风格指南讨论 — interface vs type 在框架场景的取舍

功能上此场景近乎等价；选 interface 的三个工程理由：可声明合并（同文件多次补字段，大型组件分块组织）、报错信息短（`Props` 而非匿名对象字面量展开）、与 `svelte/elements` 的 `HTMLAttributes` 用 `&` 交叉更顺。深层考点是团队规范一致性：props 一律 `interface Props`、函数签名一律 `type`，评审时无脑套模板。

### 9. (C) `svelte-check` 和 `tsc --noEmit` 的分工是什么？CI 里只留一个行不行？

**来源**：SvelteKit 项目 CI 配置解析帖

`svelte-check` 内部**会跑 tsc 管线**检查纯 `.ts/.svelte.js`，再叠加 .svelte 的 tsx 翻译检查——理论上留它一个就够覆盖类型面。但两者报错格式、退出码、增量能力不同：大仓里常见 `tsc --noEmit`（快、只看 ts）+ `svelte-check`（全量、模板级）分 job 并行，配合 `--threshold warning` 控严重级。只留一个的答案：小项目留 svelte-check 即可；"行不行"要报工作流语境。

### 10. (D) 给 rest 透传组件写类型：`$$restProps` 在 TS 里如何获得声明？

**来源**：组件库 issue — spread props typing 讨论

`$$restProps` 是模板内编译器魔法、类型即"剩余 props 的记录"；要在 script 里拿到带类型的 rest，用解构 rest 元素：`let { class: cls, ...attrs }: Props & HTMLAttributes<'div'> = $props()`——`attrs` 推为去掉了已声明键的交叉剩余。动态元素场景（`<svelte:element this=…>`）rest 类型要放宽为 `Record<string, unknown>` 或元素类型联合，泛型 `HTMLAttributes` 帮不上忙——这题的隐藏考点是"类型系统对动态性让路"的边界感。

### 11. (B) `expect(screen.getByRole('button')).to.have` 在 `.test.ts` 里报 jest-dom 断言类型不存在，链条上缺了什么？

**来源**：Testing Library 文档 — TypeScript 集成章节

两环：① `@testing-library/jest-dom` 的类型要注入——vitest 配 `setupFiles` 引入 `jest-dom/vitest`（自带 `vi.matchers` 类型扩展）；② tsconfig `types` 或 `import` 让其 `.d.ts` 被 include。运行时挂了、类型没挂是此类报错的特征（红波浪线但测试绿）。延伸考点：vitest 全局 API（`test/expect` 不带 import）需 `globals: true` + `"types": ["vitest/globals"]`——同一"运行时/类型两条腿"原理。

### 12. (C) Svelte 5 的 `$bindable()` 在类型层和普通 prop 有何区别？父组件绑定时怎么获得校验？

**来源**：Svelte RFC + 迁移博客双向绑定类型讨论

类型上 `$bindable` 包出的 prop 仍是 `T | undefined`（可选），差异在**语义标记**：编译器据此允许父用 `bind:x`，父端绑定表达式的类型要与子端声明一致——语言服务双向检查（父绑 `string` 变量而子声明 `number` 会红）。坑点：`$bindable()` 无默认值时子内类型带 `undefined`，strict 下模板里要判空；对照 Vue defineModel 把双向一等公民化，Svelte 走"普通 prop + 编译器开关"路线，类型系统更薄、约定更重。

---

## 补充（新专题 13-15）

### 13.  .svelte 文件里的 TS 是怎么被检查的？为什么单跑 tsc --noEmit 不够、必须有 svelte-check？

检查链路：svelte-check / 语言服务先把 .svelte 拆成虚拟 TS（script 内容）+ 虚拟 DOM 映射（模板表达式转成带类型的 TS 片段，模板里对组件 props/事件/插槽的使用转成对相应类型的访问），再喂给 TS 编译器诊断，并把错误映射回 .svelte 的行列。为什么 tsc 不够：① tsc 无法解析 .svelte 扩展名（不是它认得的模块）；② 模板部分（<div on:click>、<Comp prop={x}/>）根本不在 TS 里，只有 Svelte 的映射器能把"组件属性使用是否合法/事件类型是否对"变成可检查的 TS——这是 tsc 的盲区（对应既有 svelte-check 与 tsc --noEmit 关系题）。工程配置：tsconfig 仍要正确（paths/strict），svelte-check 复用之；.svelte.d.ts / $lib 类型别名同步配。加分句：理解".svelte 是被『编译成 TS 再查』而不是『原生 TS』"，就明白为什么有些复杂泛型组件模板里的推断会失准（映射的边界），也明白为什么编辑器红线和 CI 结果偶有不一致（语言服务与 CLI 版本要对齐）——这是 Svelte+TS 排障的底层认知。

**来源**：svelte-check 文档；Svelte Language Server 架构；既有".svelte 不是 TS 怎么查"深化

### 14.  用 TypeScript 时组件 props 类型怎么给？interface 与 type、以及 $bindable/$props 的类型注意点。

标准写法：定义 interface Props { a: string; b?: number }，组件里 let { a, b = 0 }: Props = $props()（可加 svelte:options preserveLocale 等）。为什么倾向 interface：可声明合并（组件库扩展）、对 props 形状更语义化、错误信息友好（既有"推荐 interface"题）。$bindable 类型：let { value = $bindable(0) }: { value?: number } = $props() —— 双向 prop 在类型上就是普通可选属性，$bindable 是运行时/编译器标记 + 默认值。children/snippet 类型：children?: Snippet、带参插槽 Snippet<[(row: T)]>（对应 props 关 Snippet 类型题）。泛型组件：List<T> 泛型 props 在 .svelte 里用 <script generics="T"> 或对应版本语法支持（对应既有泛型列表题）。加分句：TS+Svelte 的最大痛点不是"能不能标类型"而是"模板里的类型推断质量取决于 svelte-check 版本与写法"——把 props 定义成显式 interface 而非就地内联，除了可读更让"类型错误报在 props 定义处而非模板深处"，定位成本骤降（呼应 typescript 关 DataTable 泛型封装题的工程动机）。

**来源**：Svelte TS props 模式；Snippet/组件类型；既有"props 类型怎么给""interface 推荐"深化

### 15.  封装一个类型安全的透传组件（rest props 转发），TS 下怎么处理 rest 类型与事件类型？

难点：$$restProps 在 TS 下类型宽（不知具体形状）。做法：① 用 svelte/elements 提供的 HTMLAttributes<HTMLButtonElement> 之类工具类型标注"我要透传给 button 的属性集合"，props 类型 = 自己的显式 props & 该元素属性，父传错属性有类型提示（对应既有 rest props 类型处理题）。② 事件类型：onclick 等原生事件 prop 用 JSX 风格类型或 HTMLAttributes 里的事件签名标注，自定义回调用 (e: MouseEvent)=>void 显式签（避免模板里 e 隐式 any，对应既有"事件处理器报错"题）。③ 泛型组件透传 item 类型（DataTable<T> 的 columns/row 类型联动，对应 typescript 关 DataTable 封装题）。加分句：类型安全透传的关键是"别把 rest 当 any 黑洞"——用官方 HTMLAttributes 工具类型把"透传给哪种元素"编码进类型，既让调用方获得该元素原生属性补全/校验、又让自己不必手写几十个属性；这一步做了，封装组件就从"运行时能跑"升到"编辑期就防呆"（呼应 spread-rest 关"属性完整性/可访问性透传"的类型层落地）。

**来源**：Svelte rest props TS 类型；HTMLAttributes 类型工具；既有"rest 透传类型"深化
