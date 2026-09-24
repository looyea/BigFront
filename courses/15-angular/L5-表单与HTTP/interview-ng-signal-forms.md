# ng-signal-forms 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Signal Forms 架构设计、与 Reactive Forms 对比选型、zoneless 对齐与 API 演进风险的题组。

### 1. (A) 为什么 Reactive Forms 在 zoneless 下会出现『值变了但视图不动』？Signal Forms 怎么解决？

**来源**：转述自本关 §二核心差异与 ng-forms §五 valueChanges 在 zoneless 下的限制

Reactive Forms 的 FormControl 用 BehaviorSubject 管值——zoneless 不认识 BehaviorSubject 的变化（不是 signal）→值变→视图绑定不知道→不更新。Signal Forms 把 value/errors/dirty 全做成 signal→模板里 `form.name().value()` 的 `()` 调用本身就是订阅→signal.set 触发订阅者→视图自动更新。本质：**表单响应式通知通道从 RxJS Subject 换成了 zoneless 原生 signal 通道**。

### 2. (A) Signal Forms 的 `form(model, config)` 里 model 参数是什么？表单值与 model 的关系？

**来源**：转述自本关 §二最小表单代码与 §三 reset 段

model 是一个 signal（通常是 `signal({name:'',email:''})`）——**表单是 model 的校验视图**：form.value 实时反映 model 的值、用户输入通过双向绑定写回 model、form 的 validators 对 model 的字段做校验。关系：model 是唯一数据源（single source of truth）、form 是派生层（加了 errors/valid/touched 等校验元数据）。reset 表单 = 重置 model signal（form 自动同步）。

### 3. (B) 同事从 Reactive Forms 项目直接复制 `formControlName="email"` 到用了 Signal Forms 的组件——ng build 报 unknown property。给修法。

**来源**：转述自本关 §三样板对比表

Signal Forms 不需要 ReactiveFormsModule 也不需要 formControlName 指令——它是纯绑定式：`[value]="loginForm.email().value()" (input)="loginForm.email().value.set($event.target.value)"`。修法：① 删 `formControlName`；② 改成 value/input 手动双向绑定（或封装一个 `[formField]` 指令简化）；③ 确认组件 imports 里没有 FormsModule/ReactiveFormsModule（Signal Forms 不依赖这些）。

### 4. (C) Signal Forms 与 TanStack Form（React 生态的 signal-like 表单库）对比：设计哲学有什么相似与不同？

**来源**：转述自本关 §二与 React 生态表单方案对比（呼应 react-forms）

相似：① 都是 signal/store 原生（TanStack Form 用原子化 store 管字段状态——与 Signal Forms 的 model signal 同思路）；② 都支持字段级 errors/validity/dirty 独立追踪（不全表单一起重渲染）。不同：① TanStack Form 是外部库跨框架（有 React/Solid/Vue adapter）、Signal Forms 是框架内置仅 Angular；② 模板集成：TanStack 需要手动 `useStore` 订阅、Signal Forms 的 signal 在 Angular 模板里**天然绑定**（zoneless 自动追踪）；③ 校验系统：TanStack 接 Zod/自定义 schema、Signal Forms 目前用内置 validators + 自定义函数（schema 桥在演进中）。

### 5. (D) 面试官问『你怎么决定新模块用 Signal Forms 还是 Reactive Forms』——给三条判据。

**来源**：转述自本关 §六迁移判断段

① **版本基线**：工程 v22+ 且新模块从零→Signal Forms（zoneless 原生、样板少）；② **生态依赖**：模块要用 ngx-formly 等配置式动态表单且该库未适配 Signal→留 Reactive Forms（等适配）；③ **团队经验**：团队重度 Reactive Forms 经验（异步校验/跨字段联动/valueChanges 管道链）且迁移成本>收益→共存（两套在同一工程不冲突）。一句话：**无存量包袱选新、有生态约束留旧、混用合法不强迁**。

### 6. (A) Signal Forms 里 form.invalid() 与 Reactive Forms 里 form.valid 在**响应式通知**上有什么本质不同？

**来源**：转述自本关 §二模板绑定与 ng-signals computed 机制

`form.invalid()` 是一个 **computed signal**——它追踪所有子字段的 validity signal，任何一个变→invalid 自动重算→读了 invalid 的模板绑定自动更新。Reactive Forms 的 `form.valid` 是**普通 boolean getter**——它只在 CD 周期被读取时检查；zoneless 下没有 CD 触发它就不重算（需要 statusChanges.subscribe+markForCheck）。一句话：Signal Forms 的 valid 状态是**响应式派生值**、Reactive Forms 的是**命令式查询**。

### 7. (B) Signal Forms 做动态表单（运行时根据后端 schema 生成字段列表）——目前推荐什么模式？

**来源**：转述自本关 §六演进期风险与 §三 FormArray 替代

Signal Forms 对动态字段数组的支持在 v22 仍在完善中——官方推荐模式：`model = signal<Record<string,any>>({})` + 动态生成 form + `@for (field of fields(); track field.name)` 渲染。若字段数/类型完全动态且复杂——短期仍用 Reactive Forms 的 FormArray（它更成熟）或用第三方（ngx-formly + 自定义 template）。长期：等 Signal Forms 的 `formList()` / `nestedField()` API 稳定。

### 8. (C) 对比 Signal Forms / Reactive Forms / 模板驱动 ngModel 三种方案的**样板代码量**：给一个三字段登录表单各写多少行。

**来源**：转述自本关 §三样板对比表的量化应用

登录表单三字段（email/password/remember）：模板驱动约 8 行 HTML + 0 行 TS（ngModel 直接绑）；Reactive Forms 约 12 行 HTML（formGroup + 3 个 formControlName + @if errors）+ 10 行 TS（fb.group + Validators）；Signal Forms 约 15 行 HTML（手动 [value]+(input) 双向 + @if invalid）+ 8 行 TS（model signal + form() 配置）。目前 Signal Forms 模板行数略多（缺语法糖），但 TS 更少且无 valueChanges/subscribe 管理。

### 9. (D) 设计一个『表单草稿自动保存』：每 3 秒检查表单 dirty 则存 localStorage。分别用 Reactive Forms 和 Signal Forms 实现核心逻辑。

**来源**：转述自本关 §三-五与 ng-signals effect 知识的综合

Reactive Forms：`this.form.valueChanges.pipe(debounceTime(3000), filter(() => this.form.dirty)).subscribe(v => localStorage.setItem('draft', JSON.stringify(v)))`。Signal Forms：`effect(() => { const val = this.loginForm.value(); localStorage.setItem('draft', JSON.stringify(val)); })`——但需要 debounce（Signal Forms 无内建 debounce）→ 用 `toObservable(this.loginForm.value).pipe(debounceTime(3000))` 桥回 RxJS。加分：讨论 zoneless 下 signal 版为什么不需要手动管 unsubscribe。

### 10. (A) Signal Forms 的 asyncValidator 返回 Promise——框架怎么管 PENDING 状态与竞态？

**来源**：转述自本关 §四异步校验代码

框架内部：字段值变→调用 asyncValidator 得到 Promise→标 field.status signal 为 PENDING→Promise resolve 时设 valid/invalid。竞态：新值进来时旧 Promise 未 resolve——框架用 `latestValue` 守卫：回调里检查 `field.value() === capturedValue`，不匹配则丢弃旧 Promise 结果（等价于 switchMap 语义）。用户不需要手动 debounce——但加 debounce 仍推荐（减少 HTTP 请求数）。

### 11. (C) 有人说『Signal Forms 就是 Vue 的 vee-validate + useField 的 Angular 版』——指出两处相似与一处关键不同。

**来源**：转述自本关 §二与 vue-forms-validation 对比（呼应 vue-forms-validation）

相似：① 字段级状态独立响应式（vee-validate 的 useField 返回 value/errors/meta refs ≈ Signal Forms 的 field().value()/.errors()）；② 跨字段校验通过访问 group 级 value。关键不同：vee-validate 是**外部库**（需 import + 不与框架 CD 联动，靠 Vue 自身响应式通知视图）；Signal Forms 是**框架内置**（与 zoneless 变更检测同一套 signal 通知机制——不需要额外订阅/联动代码）。一句话：集成深度不同。

### 12. (B) v22 的 Signal Forms 里 `field().errors()` 返回 null 但模板不显示错误信息——可能遗漏了什么信号？

**来源**：转述自本关 §二模板绑定的 touched 条件

错误信息显示通常要配 `touched()` 条件——`@if (field().invalid() && field().touched()) { ... }`。`field().touched()` 是独立 signal：用户未聚焦过字段时 touched=false→即便 errors 存在也不显示（防初始渲染满屏红）。若 errors() 确实非 null 但不显示→漏了 touched 触发（模板 input 缺 `(blur)="field().markAsTouched()"` 或 Signal Forms 未自动跟踪 focus）。

### 13. (D) 面试官让你用 Signal Forms 实现一个『注册表单』：username（异步唯一性校验）+ email + password + confirmPassword + 跨字段密码一致。写核心 TS 配置。

**来源**：转述自本关 §四校验器与 §五跨字段验证的组合

```ts
model = signal({ username:'', email:'', password:'', confirmPassword:'' });
form = form(this.model, {
  username: { asyncValidators: { unique: async (f) => {
    const res = await firstValueFrom(this.http.get(`/check?u=${f()}`));
    return !res.exists;
  } } },
  email: { validators: { required: required(), email: email() } },
  password: { validators: { minLength: minLength(8) } },
  confirmPassword: { validators: {
    match: (f) => f() === this.model().password,  // 跨字段
  } } },
});
```
加分：讨论 confirmPassword validator 闭包捕获 this.model 的时效性——Signal Forms 里用 field sibling 访问更规范。

### 14. (A) Signal Forms 为什么选择『从 model signal 派生表单』而非『表单自己持有状态』？这与 Reactive Forms 的根本设计差异是什么？

**来源**：转述自本关 §二 form(model) 设计

从 model 派生 = **单向数据流**：model 是唯一真相源、form 是校验视图。改 model → form 自动同步 → 模板更新。Reactive Forms 自己持有状态 = **双向耦合**：表单是数据的容器——你通过 form.get().setValue 改值、form.value 读值——数据在表单里不在外部。Signal Forms 的设计让表单可**无状态重建**（reset 只需重置 model）、且 model 可以脱离表单独立存在（如 SSR 预填）。

### 15. (D) 你的团队决定在新工程全面用 Signal Forms——设计一个渐进落地方案：哪些先迁、哪些先不碰、如何共存。

**来源**：转述自本关 §六迁移判断的工程化展开

方案：① 新组件全用 Signal Forms——CONTRIBUTING 写清；② 旧 Reactive Forms **不主动迁**——只在做 feature 迭代时顺手改；③ 动态表单/ngx-formly 依赖的模块暂不动；④ 共用校验器抽成独立函数（同步/异步）——让两套表单复用；⑤ CI 里加 lint 规则禁止在已用 Signal Forms 的模块里 import ReactiveFormsModule（防混用）。共存合法：Angular 不冲突——但**同一 form 不能两套混**。节奏：新模块先试点（3 个表单）→稳定后全推。
