# 为什么要 TS：类型擦除与编译模型

> 目标：**建立 TypeScript 的正确心智模型**——TS 是 JavaScript 的超集、类型只存在于编译期（类型擦除）、`tsc` 干两件事（类型检查 + 转译）、以及 Node/浏览器**到底怎么真正跑起 TS**。这是后续所有类型语法的地基。

---

## 一、TS 到底是什么

一句话：**TypeScript = JavaScript + 静态类型系统**。它是 JS 的**超集**——任何合法的 JS 也是合法的 TS。你在 JS 之上加"类型标注"，换来三样东西：

1. **编译期抓错**：拼错的属性名、传错参数、漏处理分支，在跑之前就红线标出，而不是运行时 `undefined is not a function`；
2. **极强的编辑器智能**：自动补全、跳转定义、重构改名、签名提示——因为 IDE 知道每个值的形状；
3. **类型即文档**：函数签名 `getUser(id: string): Promise<User | null>` 比注释可靠且永不撒谎（注释会过时，类型不对就报错）。

> 关键：**TS 不改变运行时行为**。它不给你 JS 没有的能力，只在"写代码/编译"这一层做检查。跑起来的还是普通 JS。

---

## 二、类型擦除（Type Erasure）——最重要的心智

TS 的类型**在编译成 JS 后被完全删除**，产物里一个类型标注都不剩。这叫"类型擦除"。

```ts
// 你写的 .ts
function greet(name: string): string {
  return "Hello, " + name;
}
```

```js
// tsc 产出的 .js（类型没了）
function greet(name) {
  return "Hello, " + name;
}
```

推论（务必刻进脑子）：

- **运行时没有任何类型信息**。`if (x is number)` 这种判断不存在——类型是给人和编译器看的，不是给引擎看的；
- **想"在运行时校验类型"，得靠别的机制**：`typeof`/`instanceof`、或 zod 这类 schema 校验库（呼应 Express L5 校验）。TS 类型挡不住外部数据（`JSON.parse`、接口响应）——见下文 `unknown`；
- **泛型也被擦除**（呼应后面 ts-generic）：`Array<T>` 运行时就是普通数组，拿不到 `T`。这与 Java 泛型不同。

```ts
function identity<T>(x: T): T { return x; }
// 运行时：function identity(x) { return x; }   // T 消失，无法 if (T === string)
```

---

## 三、`tsc` 的两个职责

TypeScript 编译器 `tsc` 做两件事，可分开：

1. **类型检查（type checking）**：只读源码、报告错误、**不产出任何文件**（`tsc --noEmit`）。这是"抓 bug"的模式，CI 里常用（呼应 Express L7 门禁）。
2. **转译（transpile / emit）**：把 `.ts` 变成 `.js`（删类型 + 按 `target` 降级语法 + 生成 sourcemap）。

现代工具链常把两者**拆开**：用极快的 **esbuild/SWC** 只做转译（秒级、跳过类型检查），把类型检查单独交给 `tsc --noEmit`（详见 ts-tooling、呼应 10-vite 的 esbuild 不讲类型）。

```bash
npm i -D typescript
npx tsc --init        # 生成 tsconfig.json
npx tsc               # 检查 + 编译
npx tsc --noEmit      # 只检查（CI 门禁常用）
npx tsc --watch       # 增量监听
```

---

## 四、第一个 tsconfig.json

`tsc --init` 生成的配置（关键项，详解见 ts-project）：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",          // 输出的 JS 语法版本（降到多老）
    "lib": ["ES2022", "DOM"],    // 可用的全局类型（浏览器/Node 决定）
    "module": "ESNext",          // 模块语法（import/export vs commonjs）
    "moduleResolution": "bundler",
    "strict": true,              // 严格模式总开关（强烈建议开，见 ts-strict）
    "outDir": "dist",            // 产物目录
    "rootDir": "src",            // 源码根
    "esModuleInterop": true,
    "skipLibCheck": true         // 跳过对 .d.ts 内部再检查，提速
  },
  "include": ["src"]
}
```

心智：`target` 管"语法多新能降级到哪跑"，`lib` 管"有哪些全局 API 的类型可用"（写浏览器代码要 `DOM`，写 Node 要 `@types/node`——呼应 03-nodejs）。

---

## 五、浏览器/Node 根本不认识 TS

TS 不是运行时——浏览器和 Node **只执行 JS**。那 `.ts` 怎么跑起来？四条路：

| 场景 | 怎么跑 | 说明 |
|------|--------|------|
| 上线应用 | 构建工具先 `tsc`/esbuild 转成 JS 再打包 | Vite/Webpack 里 TS 是" loader 一环"（呼应 10-vite） |
| 本地脚本 | `tsx script.ts` / `ts-node` | 内存里即时转译再执行，开发便利 |
| Node 原生 | Node 22.6+ `--experimental-strip-types`、23+ 默认可跑 | Node 直接"擦除类型"执行 .ts，不校验 |
| 仅类型检查 | `tsc --noEmit` | 不产出，交给上面的转译/运行 |

```bash
# 开发期直接跑 TS（转译，不校验类型）
npx tsx watch src/server.ts

# 单独校验类型
npx tsc --noEmit
```

> 记住这个分工：**"能跑" 靠转译（esbuild/tsx/Node），"有没有类型错误" 靠 `tsc`**。二者独立。很多新手以为"能跑起来=类型没问题"——错，转译工具根本不检查类型（呼应 ts-tooling、vite-framework 的 esbuild 只删类型）。

---

## 六、TS 从哪来、谁在用

- 2012 年微软 Anders Hejlsberg（Delphi/C# 之父）主导设计，2013 开源；
- 如今是**最大规模的静态类型 JS 生态**：Angular 默认 TS；Vue3、React 官方源码与生态对 TS 一等支持（呼应 ts-frameworks）；大量库（Express、Vite、Prisma…）提供 TS 类型（呼应 09-express、10-vite）；
- 语言演进：每年随 ECMAScript 提案跟进，还有 TS 自身的改进（5.x 的装饰器标准化、性能、`satisfies` 等）。

---

## 七、一个最小可跑例子

```ts
// src/index.ts
interface User { id: number; name: string; }

function format(user: User): string {
  return `#${user.id} ${user.name}`;
}

const u: User = { id: 1, name: "Ada" };
console.log(format(u));

// format({ id: 1 });           // ✗ 编译期：缺 name
// format({ id: 1, name: 2 });  // ✗ 编译期：name 应为 string
```

`tsc` 会立刻在**没运行**时标出后两行的错误——这就是 TS 的核心价值：**把一类运行时 bug 提前到编辑期**。

---

## 八、常见误区

- **"TS 让程序变快"**：不。擦除后跑的是同样的 JS，性能取决于 JS。TS 提升的是**开发体验与正确性**，不是运行速度。
- **"TS 能保证运行时不出错"**：不。`any`、外部 JSON、`as` 断言、旧 JS 库都能绕过类型系统。类型是**静态近似**，运行时校验仍需 `typeof`/zod（呼应 ts-any-unknown、Express L5）。
- **"必须一次性全改 TS"**：不。可渐进迁移、`.js` 与 `.ts` 共存（呼应 ts-migration）。
- **"IDE 有红线 = tsc 也报错"**：多数一致，但配置（`tsconfig`、project service）差异会导致出入，最终以 `tsc --noEmit` 为准。

---

## 九、自检清单

- [ ] 什么叫"类型擦除"？它对泛型、对运行时判断意味着什么？
- [ ] `tsc` 的两个职责分别是什么？`--noEmit` 干嘛用？
- [ ] 浏览器/Node 能直接执行 `.ts` 吗？有哪几种让它跑起来的方式？
- [ ] "能跑起来"为什么不代表"类型没问题"？
- [ ] `target` 和 `lib` 分别控制什么？
- [ ] TS 能防住运行时错误吗？外部数据要怎么处理？

---

## 🚀 部署预告

- **构建链**：真实项目里 TS 转译几乎总是交给 Vite/Webpack/esbuild（10-vite 已见），`tsc` 退到"只做类型检查 + 生成 .d.ts"；
- **CI 门禁**：把 `tsc --noEmit` 放进流水线，类型不过不让合（呼应 Express L7 测试门禁）；
- **发布**：库要同时产出 JS + `.d.ts` 声明（ts-declarations、ts-publish）。

下一关 **ts-basics**——具体到每一种基础类型怎么写、类型推断何时生效、什么时候该写注解、什么时候别写。
