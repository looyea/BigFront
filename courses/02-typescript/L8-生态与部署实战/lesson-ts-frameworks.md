# TypeScript × 框架：Vue / React / NestJS 实战

> 目标：把前 7 关的语言功夫，落到三大主流框架里。核心矛盾只有一个——**框架的魔法（JSX / 模板 / 装饰器 DI）发生在编译期之外，你要用类型系统把这套"约定"重新编码成可检查的类型**。会写泛型不等于能让 `defineProps<T>()` / `<Comp ref={}/>` / `@Injectable()` 给你端到端类型（呼应 ts-generic、ts-decorators、ts-modules、ts-tooling）。

---

## 一、React：JSX 是普通函数调用，所以类型全靠泛型透传

JSX 最终变成 `createElement(Comp, props)`，React 组件本质是**函数**，所以 TS 能推得非常好——你要做的是把 props/事件/ref 的类型标对。

```tsx
// 1) Props：优先 interface / type 都行；用可辨识联合表达互斥 props（呼应 ts-union）
type ButtonProps =
  | { variant: "primary"; onClick: () => void }
  | { variant: "ghost"; href: string };           // ghost 必有 href、primary 才有 onClick
export function Button({ variant, ...rest }: ButtonProps) { /* 靠 variant 收窄 rest */ }

// 2) 别再用 React.FC —— 它隐式塞 children、泛型难写、丢掉 this 无关的返回约束
//    直接给函数标参数/返回类型即可（呼应 ts-functions）

// 3) 泛型组件：让 props 类型随传入数据流动（呼应 ts-generic、ts-conditional-infer）
function List<T>({ items, render }: { items: T[]; render: (item: T) => JSX.Element }) {
  return <>{items.map((x, i) => <div key={i}>{render(x)}</div>)}</>;
}
<List items={[1, 2, 3]} render={(n) => <b>{n.toFixed()}</b>} />   // n 自动是 number

// 4) 事件与 state：useState<User | null>(null) 逼你处理 null；
//    onChange 用 React.ChangeEvent<HTMLInputElement>，别手写 any
```

**ref / forwardRef** 是类型重灾区：`useRef<HTMLInputElement>(null)` 得到 `RefObject`，泛型组件配 `forwardRef` 时类型要显式补齐。**全局增强**（给库加 props/方法）用 `declare module`（呼应 ts-declarations、ts-modules 第八节）。

---

## 二、Vue 3 `<script setup>`：编译器帮你把类型"接"进模板

Vue 的类型魔法发生在**编译器**：宏（`defineProps` 等）不是普通函数，是**编译期语法**，所以要把类型当**泛型实参**传，编译器会把它编译成运行时 props 声明。

```vue
<script setup lang="ts">
// 1) 基于类型的 props —— 传泛型实参（编译期展开，运行时无此调用）
interface Props { title: string; count?: number }
const props = withDefaults(defineProps<Props>(), { count: 0 });   // 可选/默认值靠类型 + withDefaults

// 2) 基于类型的 emits —— 元组签名描述载荷（呼应 ts-functions 参数元组）
const emit = defineEmits<{
  change: [value: string];          // TS5.0 风格：用命名元组标注载荷
  reset: [];
}>();
emit("change", "ok");               // 写错载荷类型直接报错

// 3) 泛型组件 —— 用 generic 属性声明（呼应 ts-generic）
// <script setup lang="ts" generic="T extends Record<string, unknown>">

// 4) 模板里 Ref 会自动解包：script 里是 count.value，模板里直接 count（编译器负责 unwrap 类型）
// 5) 模板 ref：const el = ref<HTMLInputElement | null>(null)  —— DOM 类型
</script>
```

**关键点**：`.vue` 文件的类型检查**不能靠裸 `tsc`**（它看不懂 SFC 的 `<template>`/`<script setup>` 关联），必须用 **`vue-tsc`**（Volar 的命令行）——它把 SFC 虚拟出一个 `.ts` 让 tsc 检查（呼应 ts-tooling 第 2 题、10-vite）。`npm run build` 成功 ≠ 类型过，CI 里务必 `vue-tsc --noEmit`。

---

## 三、NestJS：装饰器 + DI 的类型边界

Nest 重度依赖**老式装饰器 + `emitDecoratorMetadata`**（呼应 ts-decorators）。它的类型体验有甜有坑：

```ts
@Injectable()                                   // 装饰器需要 experimentalDecorators/emitDecoratorMetadata
class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,   // DI 靠元数据，类型只帮编辑器补全
  ) {}
  findAll(): Promise<User[]> { return this.repo.find(); }      // 返回类型要自己标对
}

// 控制器：DTO + 管道做运行时校验（呼应 Express L5、ts-migration 第 7 题）
@Post()
create(@Body() dto: CreateUserDto) { /* dto 是编译期形状，运行时校验靠 class-validator */ }
```

坑：`@Body()`/`@Query()` 拿到的数据，**编译期类型是"你标的 DTO 形状"，运行时是否真是那样取决于校验管道**——不装 `class-validator`/`ValidationPipe` 就是谎言（呼应 ts-strict 第 11 题"开了 strict≠安全"）。DI 容器按 token 注入，TS 类型**不能**替你保证"注册过这个 provider"，那是运行时的事。

---

## 四、端到端类型安全：让类型跨越网络边界

单文件类型再好，接口一调全塌。现代方案把类型**生成/贯通**到全栈（呼应 ts-declarations 第 12 题 codegen 思想）：

- **tRPC**：前后端同仓，router 的类型自动流到 client，`trpc.users.list.query()` 的返回类型 = 服务端真实返回，改签名前端立刻红；
- **GraphQL Code Generator / openapi-typescript**：从 schema/契约**生成** `.ts` 类型，别让手写类型和后端漂移；
- **zod**：运行时 schema 即类型来源，`z.infer<typeof schema>` 让"校验"和"类型"同一份真相（呼应 ts-migration 边界策略）。

共同哲学：**类型不要手写第二遍**——要么共享、要么生成，杜绝"前端一套后端一套各自漂移"。

---

## 五、测试与类型断言

框架项目里给"类型本身"写测试，防止重构悄悄退化公共类型：

```ts
import { expectTypeOf } from "expect";                 // 或 vitest 的 expectTypeOf / tsd
expectTypeOf(Button).parameter(0).toMatchTypeOf<ButtonProps>();
// @ts-expect-error —— 断言"这里就应该报错"（呼应 ts-strict 第 9 题）
<List items={[1]} render={(s: string) => <i />} />
```

Vitest/Jest 配 `@types/node` 与全局 API（`describe`/`it`）时记得 tsconfig `types` 加 `"vitest/globals"`（呼应 ts-project 的 `types`/`typeRoots`）。

---

## 六、当类型和框架"打架"时的正确心态

- 别为了"消灭所有红"退回 `any`——那等于把框架的类型收益清零（呼应 ts-any-unknown）；
- 模板/JSX 里的报错优先想"是我的 props/ref/事件类型标错，还是泛型没透传"；
- 装饰器、DI、宏这些"编译期魔法"出问题时，先确认对应的**编译器选项/工具**到位（`experimentalDecorators`、`vue-tsc`、`jsx: react-jsx`，呼应 ts-project）；
- 实在无解再 `@ts-expect-error` + 注释，并记入债务棘轮（呼应 ts-migration 第 10 题）。

---

## 七、自检清单

- [ ] React 为什么不再推荐 `React.FC`？互斥 props 用什么类型表达？
- [ ] `defineProps<T>()` 为什么必须传泛型实参而不是运行时对象？`.vue` 为什么得用 `vue-tsc`？
- [ ] Nest 的 `@Body()` DTO 类型和运行时真相之间靠什么兜底？
- [ ] tRPC / zod / codegen 解决的共同问题是什么？
- [ ] 如何给"组件的类型签名"本身写测试？
- [ ] 框架里遇到类型报错，排查顺序是什么？

---

## 🚀 部署预告

- 框架里享受了类型红利，下一步就要**把成果发出去**：下一关 **ts-publish** 讲如何把带 `.d.ts` 的库打包、配 `exports` 双格式、发到 npm 并让用户开箱即用（tsup 正是主力，呼应 ts-tooling 第二节）；
- 端到端类型（tRPC/zod）与 `.d.ts` 生成贯穿 ts-declarations、ts-migration；
- 装饰器/DI 的坑与 ts-decorators、Express L5 校验互为印证。

下一关进入 **ts-publish**：把 TypeScript 库发上 npm 的完整工程。
