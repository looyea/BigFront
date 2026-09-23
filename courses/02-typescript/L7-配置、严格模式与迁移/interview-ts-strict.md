# ts-strict 面试题精选

> 共 15 题，覆盖 **strictNullChecks / noImplicitAny 与 unknown / this 与函数变型 / 属性初始化 / strict 之外的开关 / 开启策略** 六类。

---

## 一、strictNullChecks

### 1. `strictNullChecks` 关闭时 `null`/`undefined` 能赋给任何类型，为什么这被认为是最危险的默认？开启后如何正确处理"可能为空"？

关闭时 `null`/`undefined` 是"子类型 of everything"，`let s: string = null` 合法，于是 `s.length` 编译期一片绿、运行时期期崩（`Cannot read properties of null`）——这正是 Tony Hoare 所称"十亿美元错误"的静态放大版。开启后 `null|undefined` 是独立类型，"可能为空"必须写进类型：`string | null`、`T | undefined`、可选 `a?: T`。消费端被强制用：`if (x)` 收窄、`x?.y` 可选链、`x ?? 默认`、显式 `x!` 断言（自担风险）。核心是"可空性变成类型的一部分、可检查"（呼应 ts-narrowing、ts-basics）。

**来源**：TypeScript Handbook — "strictNullChecks"; Effective TS — Item 5

### 2. 为什么很多人抱怨"开了 strictNullChecks 后到处是 possibly undefined"？`!` 是解药吗？

因为大量代码本就用"约定不为空"在跑（对象一定先初始化、数组长度一定够），strictNullChecks 把这些**隐含约定显式化**，于是要你逐个证明"这里确实非空"。`!`（非空断言）**不是解药而是止痛药**——它只是对编译器"闭嘴，我保证"，并不加运行时检查，若保证错了照样崩。正道：① 用守卫/`if`/`?.`/`??` 真正处理空分支；② 若"空"在设计上不可能，用更精确的类型（收窄到非空、用 `NonNullable`、用 `noUncheckedIndexedAccess` 时配合长度断言）表达不变量；③ `!` 只留给"编译器无法证明但你能证明"的少数点并加注释（呼应 ts-any-unknown、ts-guards）。

**来源**：TypeScript — "non-null assertion operator / !"; Effective TS — Item 6

---

## 二、noImplicitAny 与 unknown

### 3. `noImplicitAny` 和"显式写 any"区别在哪？为什么它配合 `useUnknownInCatchVariables` 把"放弃类型"变成显式决定？

`noImplicitAny` 禁止**隐式**落 any：参数/变量推不出类型时报错，而不是悄悄当 any。你仍可**显式** `: any`，但那是一次"我知道我在放弃检查"的签名决定。`useUnknownInCatchVariables`（4.4+，strict 族一员）把 `catch (e)` 的 `e` 定为 `unknown` 而非 `any`——因为"你捕获的可能是任何东西（字符串、null、自定义对象）"，`unknown` 逼你先 `if (e instanceof Error)` 收窄再用 `e.message`（呼应 ts-any-unknown、ts-guards）。两者共同哲学：**默认安全、放弃要显式**，防止 any 从某个缝隙渗入后污染整条类型链。

**来源**：TS 4.4 — "useUnknownInCatchVariables"; Effective TS — Item 8

---

## 三、this 与函数变型

### 4. `strictFunctionTypes` 检查什么？为什么它偏偏**不**对"方法"生效？

它对**函数类型位置**（属性、变量、参数里的 `(x:T)=>void` 形式）施加**参数逆变**：给需要 `(Animal)=>void` 的地方传 `(Cat)=>void` 是**不安全**的（后者只处理 Cat，可能被喂 Dog），strictFunctionTypes 会拒绝。但**方法简写** `{ eat(f: Apple): void }` 仍按历史的**双变（bivariant）**放行——因为大量既有 DOM/库类型用方法声明、若也逆变会制造海量破坏性报错（务实妥协）。启示：想要严格逆变检查，用函数属性写法 `eat: (f: Apple) => void` 而非方法 `eat(f: Apple)`（呼应 ts-functions）。

**来源**：TypeScript 2.6 — "strictFunctionTypes"; Effective TS — Item 17

### 5. `noImplicitThis` 抓的是什么真实 bug？给出一个典型场景与两种修法。

它抓"普通函数/回调里 `this` 类型是隐式 any、运行时会指向意外对象或 undefined"的情况。典型：把对象方法解构成回调丢失绑定：
```ts
const btn = { label: "x", click() { console.log(this.label); } };
const handler = btn.click;
handler();   // 脱离 btn，this 变 undefined/window → noImplicitThis 报错
```
修法：① 箭头函数字段 `click = () => this.label`（词法 this，呼应 ts-classes 第 10 题）；② `btn.click.bind(btn)` 或包一层 `() => btn.click()`；③ 若函数本就设计成不依赖 this，标 `this: void`。`noImplicitThis` 让这类"绑定丢失"从运行时崩提前到编译期。

**来源**：TypeScript — "noImplicitThis / This types"; Effective TS — Item 40

---

## 四、属性初始化

### 6. `strictPropertyInitialization` 在防什么？`!`、`?`、`declare`、构造器赋值分别对应什么意图？

它防"字段类型声称是 `T`，但因某条路径没赋值运行时其实是 `undefined`"的类型谎言（尤其 `!` 泛滥时）。应对要按真实意图选：① **构造器里赋值**——最正规，编译器能看到所有路径都赋值即满足；② **`field!: T`**（definite assignment）——你保证会被赋值（框架在 new 后注入、或 `Object.assign(this, ...)`），但**无运行时保证**；③ **`field?: T`**——承认它可能没有，消费处强制判空（更诚实）；④ **`declare field: T`**——字段由基类/别处提供、本类不生成初始化代码（配合 `useDefineForClassFields`，呼应 ts-classes 第 3 题）。选错=用断言掩盖了本该处理的 undefined（呼应 ts-strict 第四节）。

**来源**：TypeScript 2.7 — "strict property initialization"; TS — "definite assignment assertions"

---

## 五、strict 之外的开关

### 7. `noUncheckedIndexedAccess` 解决了什么运行时真相？代价是什么、如何优雅消化？

它让所有索引访问（`arr[i]`、`obj[key]`、Record 取值）结果附加 `| undefined`，承认"你无法在编译期证明下标一定存在/没越界"——堵住 `const [a,b] = pair; map.get 之外的 obj[k].foo` 这类越界/缺键崩溃。代价：噪音大，很多"逻辑上一定存在"的索引也被要求判空。优雅消化：① 用 `for...of`/`forEach`（元素非 undefined）替代下标循环；② `if (v !== undefined)` 或 `?? 默认`；③ 用解构 + 长度守卫；④ 确信的用 `NonNullable<...>` 或 `as` 局部收窄并注释。它是"更严格但更贴运行时"的开关，新项目建议开（呼应 ts-project 第三节、ts-utility）。

**来源**：TypeScript 4.1 — "noUncheckedIndexedAccess"; Total TypeScript

### 8. `exactOptionalPropertyTypes` 想解决 `a?: T` 的什么歧义？为什么很多人没开？

默认下 `a?: T` 等价 `a?: T | undefined`，于是 `{ a: undefined }` 合法——把"键不存在"和"键存在但值是 undefined"混为一谈，`in` 判断与解构默认值都可能踩坑。开启后 `a?: T` 表示"可以没有 a，但若提供就不能是 undefined"，`{ a: undefined }` 报错，要显式 `a?: T | undefined` 才允许。没普及的原因：① 与生态/React props 默认模式冲突，报错量级大；② 与 `??`、`||` 的交互微妙；③ 心智负担（要把"缺省"与"显式 undefined"分开建模）。属于"更高保真但更挑代码"的可选开关（呼应 ts-strict 第五节）。

**来源**：TypeScript 4.4 — "exactOptionalPropertyTypes"; GitHub issue — "explaining exactOptionalPropertyTypes"

---

## 六、开启策略与报错处置

### 9. `@ts-ignore`、`@ts-expect-error`、`@ts-nocheck` 有什么区别？清债/迁移时该用哪个？

`@ts-ignore` 抑制下一行错误、**不报"其实没错了"**——债还清后它会失效却残留，误导后人。`@ts-expect-error` 抑制下一行，但**若下一行其实没错误，它反向报错**"unused '@ts-expect-error' directive"，天然适合"我暂时知道这里有错、将来修好就该删掉"的清债场景（能随迁移自动暴露进度）。`@ts-nocheck`（文件首行）关闭**整文件**检查（老文件迁移初期临时用，等价于旧的 `@ts-nocheck`/`nocheck`）。策略：迁移期用 `@ts-expect-error` + 注释说明原因，配 CI 计数其数量单调下降；绝不长期留 `@ts-ignore`（呼应 ts-migration、ts-project 第 12 题）。

**来源**：TypeScript 3.9 — "ts-expect-error"; TS Handbook — "@ts-nocheck"

### 10. 面对一个从没开过 strict 的老仓库，你如何"逐步开启 strict 而不让 PR 爆炸"？

① **新代码从严、老代码从宽**：用不同 tsconfig 分目录（src/legacy 先维持旧选项，src/** 新目录开全 strict），或反向——先全开、给 legacy 目录单独放宽；② **逐个开关点亮**：`noImplicitAny` → `strictNullChecks` → `strictFunctionTypes`… 每开一项单独 PR、配 codemod 批量补注解；③ 用 `@ts-expect-error` 兜住暂时改不动处并记 backlog；④ 把 `tsc --noEmit` 接进 CI，**只对新引入错误**报警（`--incremental`/diff 检查），防存量继续恶化；⑤ 每改一个模块顺手收紧该模块类型（呼应 ts-migration、Express L7 CI 门禁）。关键是"棘轮"：只准更严、不准回退。

**来源**：Effective TS — Item 44; 社区 — "gradually enabling strict"; typescript --strict migration guides

---

## 七、综合判断题

### 11. 有人说"我全开了 strict，所以我的 TS 是类型安全的"。这个说法哪里不严谨？

开了 strict 只是**关闭了编译器主动放行的一批常见漏洞**，远非"类型安全"的全部保证，因为仍有多处"信任边界"：① 运行时外部数据（`JSON.parse`、HTTP、DOM）是 `any`/`unknown` 入口，不校验就是谎言（呼应 ts-guards、Express L5）；② `as`/`!`/`any` 仍是"手动关检查"的后门；③ 结构化类型让语义不同但形状相同的值可互换（需品牌类型，呼应 ts-advanced）；④ 函数参数逆变被方法豁免（第 4 题）；⑤ 泛型擦除下"类型没了"（呼应 ts-intro）。所以 strict 是"必要不充分"：它 + 边界运行时校验 + 少用断言，才逼近真正安全。

**来源**：Effective TS — Item 1/2/3; Total TypeScript — "the lies of TypeScript"

### 12. `useUnknownInCatchVariables` 把 `catch (e)` 的 e 设成 `unknown`，有人嫌麻烦直接 `(e as Error).message`。正确的处理姿势是什么？为什么？

先**收窄**再用，而不是盲目 `as Error`：抛出的可能是任何值（`throw "boom"`、`throw undefined` 在 JS 合法），`as Error` 是"假设"，若实际抛的是字符串，`.message` 得 `undefined`、又埋一个 bug。正解：
```ts
catch (e) {
  const msg = e instanceof Error ? e.message : String(e);   // 运行时收窄（呼应 ts-guards）
  report(msg);
}
```
或用 `if (e instanceof Error) ...` 分支。这正是 `unknown` 的设计意图——逼你在**使用未知值前**建立类型证据，而不是用断言跳过（呼应 ts-any-unknown 的"unknown + 守卫 > any"）。`as Error` 应留给"你能从上下文 100% 保证只可能抛 Error"的罕见情况并注释。

**来源**：TS 4.4 — "useUnknownInCatchVariables"; Effective TS — Item 8

---

## 补充（新专题 13-15）

### 13. strict: true 全家桶清单里，哪些开关是「独立困难户」？给一个渐进开启顺序。

严格包含：noImplicitAny / strictNullChecks / strictFunctionTypes / strictBindCallApply / strictPropertyInitialization / noImplicitThis / alwaysStrict / useUnknownInCatchVariables / exactOptionalPropertyTypes（不在包内！）。难度梯度：noImplicitAny 与 useUnknownInCatch 改造面小先上；strictNullChecks 是**原子级重构**（要么全开要么不开，半途=双重成本）通常第二波；exactOptionalPropertyTypes/noUncheckedIndexedAccess/noPropertyAccessFromIndexSignature 三个包外选项最后逐个评估。老仓路线：ts-strict-plugin/按目录排除白名单收缩（ratchet），目标「strict 全开 + 例外清单归零」。

**来源**：TS Handbook《strict 家族逐条》；ts-strict-plugin（dev-savings）README 渐进策略。

### 14. 开了 strictNullChecks 后满屏 ! 和 ?. 是解法吗？空安全的正确建模是什么？

不是——`!` 批量补齐等于把问题塞回地毯下（TS 团队原话「turn off strictNullChecks or use non-null assertions 都是下策」）。建模三招：① **可空即状态**：判别联合（`{status:"empty"} | {status:"loaded", data}`）让「有没有」变成 switch 必答题；② 边界收敛：`noUncheckedIndexedAccess` 后 map.get / 数组下标在**入口一次**判空取窄，内部函数签名直接收非空参；③ React 侧 loading/empty 组件分支而非 `user!.name`。指标：`!` 与 `as` 的总数进 lint（@typescript-eslint/no-non-null-assertion warn）+ 每 sprint 递减——把断言当债务计量。

**来源**：TS 团队 Anders 在 strictNullChecks 设计讨论中关于 ! 的定位；ESLint no-non-null-assertion 规则文档。

### 15. 开了 strict 就等于类型安全吗？列四条已知的 unsoundness。

① 函数参数**双变**（方法声明语法不查逆变）；② 数组/对象协变：`Dog[]→Animal[]` 可赋 + push 污染；③ `as`/`!`/any 透传：strict 只治「隐式」不禁「显式」——一条 as any 局部塌方；④ 对象更新别名：`const {x}=obj; obj.x=5` 后窄化信息过期（TS 不做值追踪）；⑤ 枚举/数字比较等运行时语义类型不管。话术：strict 是**可赋性纪律**的最大化，soundness 从来不是 TS 目标（Anders：为可用性接受有限不健全）；工程上用 lint（no-unsafe-* 系列）+ 边界 schema 校验补运行时，用类型测试补推断回归——三层齐了才叫安全。

**来源**：TS FAQ《TypeScript unsoundness 设计权衡》；Effective TypeScript Item 关于 unsound 边缘案例。
