# ts-guards 面试题精选

> 共 12 题，覆盖 **类型谓词 / 断言函数 / 穷尽检查 / assertNever / as const / 守卫设计** 六类。

---

## 一、类型谓词

### 1. 什么是用户定义类型守卫（user-defined type guard）？为什么它比 `as` 安全？

形如 `function isX(v: T): v is X` 的函数，返回类型 `v is X` 是**类型谓词**：它把"运行时判断结果为真"与"v 属于子类型 X"绑定，让调用点 `if (isX(v))` 里 v 被自动收窄到 X。它比 `as` 安全，因为 `is` 谓词要求函数体**真的做了运行时判断**（`typeof`/`in`/字段比较等），收窄有证据；`as` 则无任何运行时校验，纯靠你保证。用守卫能把"验证 + 收窄"封装成可复用、跨函数传播的单元。

**来源**：TypeScript Handbook — "Type Guards / user-defined type guard functions"; Effective TS

### 2. 类型谓词 `x is T` 里的 T 必须满足什么条件？

T 必须是参数 x 声明类型的**子类型**（或与之有重叠的可赋关系）。例如参数是 `unknown`，T 可以是任何类型；参数是 `Cat | Dog`，T 可以是 `Cat`。你不能在一个 `number` 参数上写 `n is string`（毫无重叠）。若判断逻辑与谓词声明不符（明明可能返回 true 却不是 T），TS 不会替你兜底——谓词是你**承诺**的契约，运行时仍要靠函数体实现保证，所以实现要严谨（否则等于把 `as` 的风险藏进了守卫）。

**来源**：TypeScript — "type predicate subtype requirement"; StackOverflow — "a type predicate's type must be assignable"

---

## 二、断言函数

### 3. `asserts x is T` 断言函数适合什么场景？和 `x is T` 守卫怎么取舍？

断言函数**不返回布尔**，而是"检查不通过就抛错、通过则调用后 x 视为 T"。适合**前置条件/不变式校验**：进来先 `assertValid(req)`，之后整段代码都当它是合法类型，无需层层 `if` 嵌套。与 `x is T` 守卫的取舍：需要**分支处理**（真/假各走不同逻辑）用守卫；需要"不合法就别往下走、直接失败"用断言。断言函数在使用前必须已被调用、且被断言的变量是显式声明的参数/const（TS 才能应用收窄）。

**来源**：TypeScript 3.7 — "assertion functions"; Total TypeScript — "asserts functions"

### 4. 为什么断言函数必须"先声明后使用"、且不能是某个对象的属性方法（有历史限制）？

TS 要求被 `asserts` 影响的变量是**带显式类型的声明**（参数或 `const`），且断言调用发生在**使用之前**，否则控制流无法应用收窄。历史上对"作为对象方法的 asserts 函数"支持有限（因 this 与调用形式复杂），后续版本逐步放开。写 invariant 工具时，推荐顶层函数 `function assert(cond: boolean, msg: string): asserts cond`，调用点直接 `assert(x !== null, 'x required')`，简单可靠。

**来源**：TypeScript — "assertion function call resolution"; GitHub issues — "asserts method not narrowing"; "invariant" helper 惯用法

---

## 三、穷尽检查

### 5. 详解 `default: const _: never = value` 的穷尽检查原理。为什么新加一个 union 成员就会报错？

对可辨识联合 `switch(tag)` 处理完所有已知变体后，`default` 里的 `value` 类型是"尚未被处理的成员"的联合。若全部处理完，剩余类型为空 → `never`，`const _: never = value` 合法。一旦给联合新增了成员却没写对应 case，`default` 处 `value` 就不再是 `never`，把它赋给 `never` 类型变量编译报错。于是"分支是否齐全"被编码成**类型等式**，编译器强制你补全（呼应 ts-narrowing 第 12 题）。

**来源**：TypeScript — "exhaustiveness checking with never"; Redux/functional docs — "exhaustive switch"

### 6. `assertNever` 工具函数的价值是什么？为什么参数类型是 never？

```ts
function assertNever(x: never): never {
  throw new Error("Unexpected value: " + x);
}
// switch 的 default: return assertNever(s);
```
价值有二：① **编译期**——参数声明为 `never`，若传入的 `s` 还不是 never（说明漏了分支），调用点直接报错，穷尽检查生效；② **运行期**——万一有预料外值（如来自不可信边界的脏数据）真到了这里，抛明确错误而非静默走错路。返回类型 `never` 表示"这行之后不可达"，让函数返回值类型闭合、无需再写 return。

**来源**：TypeScript handbook — "never in exhaustive check"; Effect/functional — "absurd / assertNever"

---

## 四、as const 与建模

### 7. `as const` 和 `Object.freeze` 是一回事吗？各自作用层面？

不是。`as const` 是**纯编译期类型操作**：把字面量深冻结进**类型**（值变字面量类型、数组变 readonly 元组、属性变 readonly），不产生任何运行时代码、不改变运行时对象。`Object.freeze` 是**运行时行为**：真正冻结对象使写入失效，但不改 TS 推断的字面量类型。要"类型 + 运行时"双重不可变需两者配合。面试常考这个区分（呼应 ts-object-types 的 readonly vs freeze）。

**来源**：TypeScript — "const assertions"; MDN — "Object.freeze"; StackOverflow — "as const vs Object.freeze"

### 8. 为什么很多团队"禁止裸 boolean 状态、改用字面量联合/可辨识联合"？

因为布尔只能表达二态，多态状态用 `is-loading / is-error / isSuccess` 多个布尔会产生 `loading && error` 这类**逻辑上互斥却类型上可共存**的非法组合。改用一个判别字段 `status: 'idle'|'loading'|'success'|'error'`（字面量联合）后，任意时刻只能是其一，配合可辨识联合让"每种状态下能访问哪些数据"精确绑定——把非法状态变不可表示（呼应 ts-union 建模哲学、第 12 题 Result）。

**来源**："Make illegal states unrepresentable"; Total TypeScript — "boolean vs union state"; domain modeling articles

---

## 五、守卫设计与实战

### 9. 为一个开放联合（可能有未知成员）写健壮的处理函数，你会怎么兼顾编译期穷尽与运行时兜底？

组合三招：① 用可辨识联合 + `switch` 覆盖**已知**全部变体，`default` 用 `assertNever` 做编译期穷尽检查；② 但 `assertNever` 的运行时抛错前提是"数据真符合类型"，对**外部来的脏数据**（可能带未知 tag），不能只信类型——应在校验边界（zod/守卫）先把数据规整成合法联合，处理函数内部才敢用 never 兜底；③ 若确实要容忍未知输入，default 不要 `never`（否则脏数据编译/运行两难），改为记录 + 降级。关键：**类型层穷尽建立在"边界已校验"之上**（呼应 ts-any-unknown、Express L5）。

**来源**：Effective TS — "handling unions defensively"; zod discriminatedUnion; "parse, don't validate"

### 10. 自定义守卫在泛型/复杂结构下有哪些限制？

① 类型谓词的 T 与参数需有可赋关系（第 2 题），无法对完全无关类型断言收窄；② 守卫只**收窄不校验**——它信任你的实现，写错谓词比 `as` 更隐蔽；③ 对**泛型返回**联合的守卫较难写精确（`is` 常需配合条件类型推断，见 ts-conditional-infer）；④ 不能收窄"属性链中间"的可变对象（跨调用属性可能变），要复制到局部 const；⑤ 联合里若成员仅靠**可选属性**区分，需小心 exactOptionalPropertyTypes 影响。复杂场景可优先 zod/valibot 用 schema 生成守卫，减少手写。

**来源**：typescript-eslint — "strict-boolean-expressions / narrowing"; "limitations of type predicates"; zod docs

---

## 六、思辨

### 11. "类型守卫是编译期的魔法，运行期什么都可能发生"，这句话对吗？

基本对但要点破风险：`is`/`asserts` 本身**不产生运行时检查代码**（谓词只是类型层面声明），真正的运行时判断是你在函数体里写的那个 `typeof`/`in`/字段比较。所以守卫的"安全性"完全取决于**函数体实现是否正确**。若你声明 `x is Cat` 但实现随便 `return true`，编译器会在调用点错误地信任收窄——垃圾进垃圾出。结论：守卫 = "运行时判断" + "类型收窄声明" 的**配对**，两者必须一致；否则它和 `as` 一样不安全，只是藏得更深。

**来源**：TypeScript — "type predicates are unchecked assertions of intent"; Effective TS — guard correctness

### 12. 在 React/Vue reducer 里，守卫与可辨识联合通常怎么配合提升安全性？

把每个 action 定义成带 `type` 字面量判别字段的联合（`Action = {type:'add';n:number} | {type:'clear'}`），reducer 里 `switch(action.type)` 自动把 `action` 收窄到对应分支、访问其专属 payload，非法 action 结构写不出来；配合 `default: assertNever` 做穷尽——**新增一种 action 忘了在 reducer 处理就编译报错**，杜绝"漏 case 导致状态不更新"的经典 bug（呼应 ts-frameworks、Vue Pinia/Redux）。同理，把组件的异步状态建模成 `Result<T>` 可辨识联合，用 `isSuccess` 守卫分支，避免"loading 时读 data、成功时读 error"的空值崩溃。

**来源**：Redux — "reducing with TypeScript / discriminated actions"; Vue — "typed events/pinia"; Total TypeScript reducer patterns
