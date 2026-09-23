# ts-frameworks 面试题精选

> 共 15 题，覆盖 **React 类型 / Vue3 编译器类型 / NestJS 装饰器与 DI / 端到端类型 / 框架类型坑** 五类。

---

## 一、React 类型

### 1. 为什么现在主流不推荐用 `React.FC`（`FunctionComponent`）给函数组件标注类型？

三个原因：① 它**隐式给 props 加了 `children`**（React 18 前），使"其实不接受 children 的组件"也允许被塞 children，掩盖错误；② 写**泛型组件**（`<T,>(props: Props<T>)`）时 `React.FC` 无法优雅传递类型参数，反而要 workaround；③ 它不提供任何额外收益——组件本质是函数，直接给**参数和返回值**标类型即可，还更好和 `satisfies`/工具类型协作。现代写法：`function Button(props: ButtonProps) {}` 或 `const Button = (props: ButtonProps) => {}`（呼应 ts-functions、ts-generic）。

**来源**：Total TypeScript — "Why not use React.FC"; React Types Cheatsheet (Martijn Feddersen)

### 2. 一个组件要求"要么传 `href`（渲染成 `<a>`）、要么传 `onClick`（渲染成 `<button>`），二者互斥"，用什么类型精确表达并在实现里安全收窄？

用**可辨识联合（discriminated union）**：

```ts
type Props =
  | { as: "a"; href: string; onClick?: never }
  | { as: "button"; onClick: () => void; href?: never };
function Link(p: Props) {
  if (p.as === "a") return <a href={p.href} />;      // 此处 p.href 是 string、无 onClick
  return <button onClick={p.onClick} />;             // 反之（呼应 ts-narrowing）
}
```

比"全标 optional"强的地方：非法组合（同时给 href 和 onClick、或 as:"a" 却不给 href）在**编译期**就被拒。`onClick?: never` 是"这个分支禁止出现该键"的惯用表达（呼应 ts-union、ts-conditional-infer）。

**来源**：Total TypeScript — "Discriminated unions in props"; React Types Cheatsheet

### 3. `useState<User | null>(null)` 和 `useState<User>(null as any)` 差别在哪？为什么后者是反模式？

前者把"还没有用户（未加载/未登录）"这个**真实状态编码进类型**，于是所有读 `user` 的地方都被强制处理 `null` 分支（`user?.name`、`if (user)`），把"未加载时崩在 `user.id`"这类 bug 提前到编译期（呼应 ts-strict 第 1 题 strictNullChecks）。后者用 `as any` 骗过编译器声称"一定是 User"，运行时初始其实是 `null`——是彻头彻尾的谎言，等于把类型安全整个作废（呼应 ts-any-unknown）。泛型参数写全 `useState<User|null>` 是 React 高频考点。

**来源**：Total TypeScript — "React hooks types / useState"; Effective TS — Item 6

---

## 二、Vue 3 编译器类型

### 4. `defineProps<Props>()` 为什么必须把类型写成泛型实参、而且不能是复杂/导入的类型表达式？

因为 `defineProps` 是**编译期宏**，不是真函数：Vue 的 SFC 编译器要**静态解析**泛型实参里的类型字面量，把它翻译成运行时的 `props: { title: { type: String, required: true } }` 选项。运行时根本没有"泛型"这回事（类型早被擦除，呼应 ts-intro），所以编译器只能在**编译那一刻**读懂写在调用点的类型。太复杂/动态的类型（条件类型、`Omit<...>` 跨文件推断不全时）编译器可能无法解析成运行时校验器——这时要么用可静态解析的写法，要么退回运行时对象声明 props（呼应 ts-generic）。

**来源**：Vue 3 — "SFC Type-Only Props / defineProps"; Vue docs — "Macro notes"

### 5. 为什么 `.vue` 文件要用 `vue-tsc` 而不是 `tsc --noEmit` 来做类型检查？`npm run build` 绿了能代表类型没问题吗？

裸 `tsc` 把 `.vue` 当不透明资源，无法把 `<template>` 里的绑定、`<script setup>` 顶层变量、宏生成的 props/emits 关联起来。`vue-tsc`（Volar 语言服务的 CLI）会**为每个 SFC 生成一个虚拟 `.ts`**（含模板渲染函数类型），让 tsc 在完整类型视图下检查（含模板表达式、组件 props 匹配）。`vite build` 用 esbuild **只删类型不检查**（呼应 ts-tooling 第 1 题），所以**构建成功不代表类型正确**——Vue 官方把脚本写成 `"build": "vue-tsc -b && vite build"`，正是为了类型不过就构建失败。

**来源**：Vue — "vue-tsc / Type Check with Build"; Volar — "Virtual code in SFC"

---

## 三、NestJS 装饰器与 DI

### 6. NestJS 需要开启哪两个编译器选项？为什么标准 TS5.0 装饰器不能直接替代？

Nest/Angular/TypeORM 依赖 **`experimentalDecorators` + `emitDecoratorMetadata`**（老式装饰器 + 元数据发射）。原因是它们的 DI 靠 `design:paramtypes` 等**反射元数据**——构造器参数的类型被编译器写进 `Reflect.metadata`，容器运行时据此按类型注入（呼应 ts-decorators）。TS 5.0 的**标准装饰器**（Stage 3）模型不同（`value, context` 签名、无内建 `emitDecoratorMetadata`、且**没有参数装饰器**），无法产出 Nest 需要的元数据。所以 Nest 项目必须显式开这两个老选项，不能盲目"升级到标准装饰器"（呼应 ts-decorators 第五节）。

**来源**：NestJS — "Requirements / tsconfig experimentalDecorators"; TS 5.0 — "Decorators (Stage 3)"

### 7. Nest 里 `@Body() dto: CreateUserDto`，这个类型能"保证"运行时收到的 JSON 就是那个形状吗？怎么补上真正的保证？

不能。类型编译期擦除，`dto` 上的 `CreateUserDto` 只是给编辑器的形状假设；如果客户端少传/乱传字段，运行时 `dto` 就是残缺对象，类型"看着对"实则崩（呼应 ts-intro 泛型擦除、ts-strict 第 11 题）。真正保证要**运行时校验**：给 DTO 加 `class-validator` 装饰器（`@IsEmail()`、`@IsInt()`）+ 全局 `ValidationPipe({ whitelist: true })`，让 Nest 在进入 handler 前**校验并剥离非法字段**（呼应 Express L5、ts-migration 第 7 题边界策略）。原则同前端：边界处校验先于信任类型。

**来源**：NestJS — "Validation / class-validator"; Express 校验范式（呼应本仓库 09-express L5）

---

## 四、端到端类型

### 8. tRPC 为什么能做到"服务端改返回类型，前端调用处立刻标红"？它的类型来自哪里？

因为 tRPC 的**服务端 router 定义本身就是类型来源**：前端 `createTRPCClient<AppRouter>` 把服务端 router 的类型当**泛型参数**引进来，`.users.list.useQuery()` 的输入/输出类型是通过 `typeof router` 上的路径做**索引访问类型 + 条件类型**推导出来的（呼应 ts-conditional-infer、ts-mapped）。前后端**共享同一份 TS 类型**（通常同仓或引用生成的类型包），所以服务端签名一变，前端推导结果同步变，不匹配即编译报错——"类型不手写第二遍"（呼应 ts-frameworks 第四节）。代价：强绑定前后端同语言同仓。

**来源**：tRPC — "End-to-end typesafety / how inference works"; tRPC docs — "Server setup / AppRouter type"

### 9. zod 说"运行时 schema 即类型来源"，`z.infer` 是怎么把运行时校验和静态类型统一起来的？

zod 的 schema（`z.object({ name: z.string(), age: z.number() })`）既是**运行时对象**（能 `.parse()` 做真实校验、抛错、转换），它的**泛型类型参数**又携带了对应的 TS 类型。`z.infer<typeof schema>` 用**索引/条件类型**从那个运行时值里"反推"出静态类型（呼应 ts-conditional-infer、`typeof` 值→类型）。于是"校验逻辑"和"类型"来自**同一份定义**，永不漂移：`.parse` 在边界挡住脏数据，`.infer` 的类型在编译期描述干净数据（呼应 ts-migration 边界 unknown+守卫、ts-declarations codegen 思想）。这是"边界用运行时校验喂给类型系统"的最佳实践。

**来源**：zod — "Inferring types / z.infer"; colinhacks/zod README

---

## 五、框架类型坑与综合

### 10. `useRef` / 模板 ref 的"当前值可能为 null"在类型上怎么体现？为什么框架偏爱把可空性写进类型？

React：`useRef<HTMLInputElement>(null)` 得到 `RefObject<HTMLInputElement>`（`.current` 可能为 `null`，挂载前是 null），用时要 `ref.current?.focus()`。Vue：`const el = ref<HTMLDivElement | null>(null)`，模板里同名字符串 ref 也需判空。框架**主动把"可能还没有 DOM/值"编码成 `| null`**，逼你在访问前处理未挂载态——这本质就是 strictNullChecks 的哲学在框架 API 设计里的落地：宁可让你在编译期判空，也别在运行时期 `Cannot read 'focus' of null`（呼应 ts-strict 第 1 题、ts-narrowing）。

**来源**：React Types Cheatsheet — "Refs"; Vue — "Template refs / typing"

### 11. 给一个第三方库（如 Express 的 `Request`、Vue 组件实例）"加字段/加方法"时，TS 层面正确姿势是什么？

用**模块增强（module augmentation）**`declare module "包名" { interface Request { user?: User } }`——在**同一个接口名**上声明合并，编译器把两处 `interface` 成员并起来（呼应 ts-modules 第八节、ts-declarations、interface 合并）。要点：增强文件必须是**模块**（有 import/export）、包名要与实际 import 路径一致、接口名精确匹配。反面是直接 `as any` 取属性或用全局 `declare`（污染、不随包升级）。运行时字段则要靠中间件/插件真的挂上去，类型只是"告诉编译器你挂了"（呼应 ts-strict 第 11 题）。

**来源**：TS Handbook — "Declaration Merging / module augmentation"; Express+TS 社区范式

### 12. 你在框架项目里被一个类型报错卡住，团队有人建议"直接 `as any` 或 `@ts-ignore` 让它闭嘴"。你的处理流程应该是怎样的？

先**定位根因**而非消音：① 判断是"我的类型标错/泛型没透传"（多数情况，补对 props/ref/事件类型即可，呼应 ts-frameworks 第六节）；② 还是"编译期魔法的选项没到位"（`experimentalDecorators`、`jsx`、`vue-tsc`、`types` 配置，呼应 ts-project）；③ 还是"库类型本身有 bug/缺失"（走模块增强或补 `.d.ts`，第 11 题、ts-declarations）。确属无解的临时豁免用 **`@ts-expect-error` + 原因注释**（会在使用消失时反向报错，天然可回收，呼应 ts-strict 第 9 题、ts-migration 第 11 题），并纳入债务棘轮统计。**绝不首选 `as any`/`@ts-ignore`**——它们把框架辛苦带来的类型收益当场清零。

**来源**：Total TypeScript — "Escape hatches considered harmful"; Effective TS — Item 8/44

---

## 补充（新专题 13-15）

### 13. React 组件 props 的类型建模从 FC 到判别联合、多态组件，演进逻辑是什么？

FC 时代（隐式 children/返回 ReactElement）被弃因：不泛型友好、children 魔法、返回值过宽。建模升级链：① plain function + 显式 PropsWithChildren 按需；② **互斥变体**=判别联合（`{href:string}|{onClick:fn}` 包住 variant）而非一堆可选；③ 多态 `as`：`<C extends ElementType, P={}> props: ComponentPropsWithRef<C> & P & {as:C}`——GenericComponentType 模式表达「渲染什么就吃什么 props」；④ 反思：多态组件泛型推断脆弱、文档差——Radix 系已收敛为 **Slot 组合**（render prop 换组合 prop）换简单性。答题框架：能讲清「as 多态的实现 + 为什么该少用」即满分。

**来源**：@types/react 19 迁移指南（FC 弃用）；Radix UI《The Policy of Composable Components》。

### 14. 端到端类型安全：tRPC / schema-first（openapi/GraphQL）/ 全手写，三条路线怎么选？

tRPC：零 codegen 类型同源，代价=单仓强耦合（TS 后端）、运行时校验另配（superstruct/zod）、跨团队复用弱；schema-first：openapi/graphql 契约中立（前后端不同语言可协作），但 codegen 流水线+契约漂移要 CI 管（oasdiff/bundle 检查）；手写：小项目快，规模化后双倍维护+同步事故。决策轴：团队边界（同栈否）、契约是否对外、网关/文档需求、类型粒度（REST DTO 简单、GraphQL 选择集强）。混合策略：内部服务 tRPC、对外 API openapi 生成 SDK——别为纯度洁癖放弃组织现实。

**来源**：tRPC 文档《Why tRPC / Alternatives》；openapi-typescript 与 orval 对比实践。

### 15. 框架类型卡住时的自救手册（至少三招），以及什么时候不该自救？

招式：① **module augmentation**（declare module 给 Request/Express/Vue ComponentCustomProperties 扩型——框架留的门）；② satisfies/显式泛型注（推断不出就喂上下文而非事后 as）；③ 类型级测试（expectType）先确认「是 bug 还是 feature」再动手；④ 组件/props 的**提取收窄**（把复杂内联拆成中间 const + as const 帮推断）；不该自救：运行时语义与类型打架（框架 bug 报 issue 等修）、为过 lint 写 `as unknown as`——那是给事故埋雷。纪律：每处类型 workaround 带 `// why:` 注释，季度清理。

**来源**：Vue《Augmenting component types》/ Express 类型扩文档；expect-type README。
