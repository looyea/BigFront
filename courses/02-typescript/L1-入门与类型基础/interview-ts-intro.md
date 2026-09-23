# ts-intro 面试题精选

> 共 15 题，覆盖 **TS 定位 / 类型擦除 / 编译与转译 / tsconfig / 运行方式 / 类型局限** 六类。

---

## 一、TS 定位与价值

### 1. 为什么要用 TypeScript？它解决了 JavaScript 的什么痛点？

JS 动态弱类型，错误（拼错属性、传错参、漏判 null）常拖到运行时才暴露，且大项目里靠"约定"维护接口形状极脆弱。TS 加静态类型，把这类错误提前到**编辑/编译期**；同时提供补全、跳转、安全重构等 IDE 能力，并让类型本身成为**不会过时的文档**（签名与代码同步，错就报错）。本质是用编译期成本换大规模项目的可维护性与信心。

**来源**：TypeScript — "Why TypeScript"; Microsoft — "TypeScript handbook"; Hejlsberg — "State of the Union"

### 2. "TS 是 JS 的超集"意味着什么？对上手有什么影响？

任何合法 `.js` 也是合法 `.ts`——可以**渐进**采用：先放进项目、逐步加类型、`.js/.ts` 共存。你不会因为引入 TS 就被迫重写。也意味着 TS 学习曲线主要是"类型语法 + 类型系统心智"，JS 语义不变。反过来说，TS 不引入新的运行时能力，只是编译期的一层检查。

**来源**：TypeScript — "Superset"; "TypeScript for JavaScript Programmers"; ts-migrate / adoption guide

---

## 二、类型擦除

### 3. 什么是类型擦除？它带来哪些"反直觉"的后果？

编译成 JS 时所有类型标注、泛型参数、`interface`/`type` 全被删除，产物是无类型的 JS。后果：① **运行时拿不到类型**，无法 `if (x is string)`（要 `typeof`/`instanceof`）；② **泛型被擦除**，不能按 `T` 分支或 `new T()`（区别于 Java/C# 的 reified 泛型）；③ 依赖运行时类型的库（如某些 DI/序列化）要用**装饰器/emitDecoratorMetadata** 或 schema（zod）等**额外机制**补回类型信息；④ 类型只是"给人和编译器的注解"，对性能、对线上行为零影响。

**来源**：TypeScript — "Type erasure / How TS works"; StackOverflow — "typescript runtime types"; Angular — "emitDecoratorMetadata"

### 4. 既然类型运行时无效，那 TS 能防住运行时错误吗？

不能全防。类型是**静态近似**，多个口子能让"标错但无红线"的数据流到运行时：`any`（隐式或显式）、`as` 类型断言（你说了算）、外部输入（`JSON.parse`、HTTP body、env）默认无校验、`@ts-ignore`/`@ts-expect-error`、以及纯 JS 第三方库。结论：对**边界进来的数据**要用运行时校验（zod/io-ts/valibot）建立信任，再交给 TS 类型系统内部流转（呼应 Express L5 校验）。

**来源**：colinhacks — "Zod / parse don't cast"; TypeScript FAQ — "limits of type system"; "The难 of runtime validation"

---

## 三、编译 vs 转译

### 5. `tsc` 的"类型检查"和"转译"有何区别？为什么现代工具链要把它们分开？

类型检查：分析源码、推断并验证类型、报告错误，可不产出文件（`--noEmit`）。转译(emit)：删除类型、按 `target` 降级语法、输出 JS + sourcemap。二者关注点不同、耗时不同——完整类型检查需要跨文件解析，慢；转译是局部操作，可并行极快。esbuild/SWC 只做转译（跳过类型检查）以秒级冷启动，把类型正确性交回独立跑的 `tsc --noEmit`（放编辑器/CI）。这样兼顾**开发速度**与**类型安全**，不必为快而放弃检查。

**来源**：TypeScript — "tsc / noEmit"; esbuild — "transform vs typechecking"; SWC — "why transpile only"

### 6. `tsc`、`ts-node`、`tsx`、`esbuild`、`swc`、Vite 在 TS 流程里各扮演什么角色？

- `tsc`：官方编译器，类型检查 + 发射 JS + 生成 `.d.ts`。
- `ts-node`：Node 里即时编译并运行 TS（较慢，基于 tsc API）。
- `tsx`：基于 esbuild 的即时运行器，快，开发首选，不做类型检查。
- `esbuild`/`swc`：极快的转译/打包器，只删类型（swc 可附带部分类型无关转换）。
- Vite：dev 用 esbuild 转译 TS、build 用 Rollup +（可选）`tsc`，类型检查交给 `vue-tsc`/`tsc --noEmit`（呼应 10-vite）。
共同点：**"能跑" ≠ "类型没问题"**，只有 tsc/vue-tsc 才检查类型。

**来源**：Vite — "esbuild in Vite"; tsx / ts-node — README; SWC/esbuild docs

---

## 四、tsconfig 与工程

### 7. `target`、`lib`、`module`、`moduleResolution`、`strict` 分别管什么？

- `target`：输出 JS 的 ES 版本（决定语法降级，如 `??` 是否被转）。
- `lib`：注入哪些**全局环境类型声明**（`DOM`/`ES2022`/`WebWorker`…），与运行环境匹配。
- `module`：生成哪种**模块格式**（`ESNext`/`CommonJS`…）。
- `moduleResolution`：**如何找模块**（`node`/`bundler`/`node16`），影响包导入解析。
- `strict`：一组严格检查的总开关（`noImplicitAny`/`strictNullChecks`…，见 ts-strict），新项目强烈建议开。

**来源**：TypeScript — "tsconfig options / compilerOptions"; TS docs — "module resolution"

### 8. 浏览器和 Node 都不认识 TS，那一个 .ts 文件在生产是怎么"跑起来"的？

先**转译**成 JS 再执行：应用经构建（Vite/webpack/esbuild/tsc）产出 JS 给浏览器/Node；脚本用 `tsx`/`ts-node` 在内存即时转译运行；新版 Node（22.6+ 的 `--experimental-strip-types`、23+）能直接**擦除类型**跑 `.ts`（但仍不做类型检查）。生产环境跑的一律是 JS。类型检查作为**构建/CI 步骤**独立发生，不是运行时。

**来源**：Node.js — "TypeScript / type stripping"; TC39 — "type stripping"; tsx — README

---

## 五、历史与生态

### 9. TypeScript 的来历与它流行起来的原因？

微软 2012 由 Anders Hejlsberg 团队设计，2013 开源。流行原因：JS 在大型应用/长期项目里暴露出可维护性瓶颈；TS 以**渐进、兼容、无运行时成本**的方式补类型；工具链（VS Code 同厂）体验极佳；Angular 率先官方采用，随后 Vue3/React 生态全面拥抱，主流库纷纷带类型——形成网络效应。

**来源**：Wikipedia — "TypeScript"; Hejlsberg — "Creating TypeScript (访谈)"; Stack Overflow Survey — "most admired / usage"

### 10. Vue3、React 社区对 TS 的支持程度如何？为什么说"生态已经是 TS-first"？

Vue3 源码本身用 TS 写，组合式 API 对类型推导友好（`defineProps<T>()` 泛型宏）；React 官方类型 `@types/react` 成熟、Hooks 类型完备，新建项目 `create-vite --template react-ts` 默认 TS。几乎所有主流库发布都自带 `.d.ts`（或 DefinitelyTyped 有 `@types/*`），CI 常把 `tsc --noEmit` 当门禁（呼应 ts-frameworks、ts-publish）。所以现代前端"默认用 TS"已成共识。

**来源**：Vue — "TypeScript Support"; React — "TypeScript"; create-vite templates; DefinitelyTyped — "@types"

---

## 六、思辨题

### 11. 有人说"TS 只是给 JS 加的可选注释，运行时啥也不是"，你怎么评价？

前半句误导、后半句对。"运行时啥也不是"完全正确（类型擦除）。但说它"只是注释"低估了它：注释不参与验证、会过时、IDE 不据此补全；而类型是**被编译器强制检查、可跨文件推断、能自动补全/重构**的机器可验证契约。所以它是"编译期的形式化规范"，价值恰恰在运行之前。真正的边界是：它管不了运行时——那需要运行时校验。

**来源**：Type Weekly / blog — "types are not comments"; "Gradual typing"; TypeScript — "gradual type system"

### 12. TS 的类型系统是"图灵完备"的，这既是优点也是坑，你怎么理解？

TS 的条件类型/映射类型/递归类型足以在类型层面做计算（图灵完备），能表达极强约束、把错误消灭在编译期。代价：① 复杂类型可能编译极慢甚至栈溢出（类型实例化过深）；② 可读性崩坏、团队看不懂；③ 过度"类型体操"反而增加维护成本。务实原则：**够用就好、清晰优先**，把炫技留给真正的通用库，业务代码保持可维护（贯穿后续 ts-advanced）。

**来源**：TypeScript — "Turing complete type system"; "Total TypeScript / Matt Pocock"; issue — "Type instantiation is excessively deep"

---

## 补充（新专题 13-15）

### 13. TypeScript 是谁、为什么做出来的？设计哲学是什么？

微软 2012 年发布，主导者 Anders Hejlsberg（Delphi/C#/C++ 编译器之父）：面向**超大规模 JS 工程**的静态类型——渐进（JS 合法即 TS 合法）、推断优先少标注、类型即结构（duck typing 形式化）、任何缺口可用 any 逃生。这解释了它所有「反直觉」：非 sound（对象更新别名）、结构化兼容、擦除运行时无痕。商业动机：Office/Web 大型前端代码库的维护成本 + 与 VS Code 的 IDE 协同是其杀手级传播。

**来源**：Microsoft 2012《Introducing TypeScript》官方博客；Anders Hejlsberg 历次访谈（TeaTime with Anders / 系统设计访谈）。

### 14. 历史上和 TS 竞争的方案有哪些？为什么 TS 赢了？

CoffeeScript（语法先行，随 ES6 吞掉特性而亡）、Flow（FB 出品，类型标注写在注释里与 JSDoc 撞车、推广绑定 React）、TypeScript 取胜三件套：① **语言服务协议**（LSP 前身之一）让编辑器体验碾压；② **DefinitelyTyped**（@types 众包声明库）让存量 JS 生态一夜「有类型」；③ 微软自证（Angular 2 强制背书 + VS Code 全站用 TS）。结论：类型系统之争本质是生态与工具链之争。

**来源**：DefinitelyTyped GitHub 仓库首页说明；2016 年 Flow 官方《The evolution of Flow at Meta》转向公告。

### 15. TS 的「渐进类型」逃生口（any/as/ignore）被批评破坏类型安全，你怎么看？

逃生口是**特性不是 bug**：没有 any 就没有 JS 存量迁移（Flow 的严格性恰是落地阻力）。治理靠分层纪律：边界层（API/env/DOM）集中断言并包成函数，业务层零 any；工具链兜底——noImplicitAny/explicit-module-boundary-types 编译期禁、ESLint no-explicit-any 审查期禁、`@ts-expect-error` 替代 ignore 防腐蚀。目标不是零逃生口，而是**逃生口可见、可数、可审计**。

**来源**：TS Handbook《Type Escapes / Practical Functions》；Effective TypeScript Item 40ish「限制 any 的团队策略」讨论。
