# ng-forms 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Reactive Forms 建模、校验器体系、valueChanges 与 FormArray 的题组。

### 1. (A) Reactive Forms 的 FormControl 内部状态机有哪几个维度？statusChanges 和 valueChanges 各追踪什么？

**来源**：转述自本关 §四表单状态属性段

状态机四维度：① **value**（当前值）→ valueChanges 追踪；② **status**（VALID/INVALID/PENDING/DISABLED）→ statusChanges 追踪；③ **touched/untouched** → markAsTouched/markAsUntouched 切换；④ **dirty/pristine** → 值与初始值不同则 dirty。valueChanges 在值变时发新值（含 patchValue/setValue/用户输入）；statusChanges 在校验结果变时发新状态（如异步校验 PENDING→VALID）。加分：zoneless 下表单控件值变不依赖 signal——它是内部 BehaviorSubject 驱动——因此表单区域仍是 RxJS 的保留区。

### 2. (B) 同事的异步校验器每次 valueChanges 都发一个 HTTP 请求导致 10 次输入发 10 个请求——给两行修法并解释为什么需要。

**来源**：转述自本关 §三异步 validator 与 §五 valueChanges 联动

异步 validator 内部用 `debounceTime(300)` + `switchMap`（取消前请求）：
```ts
control.valueChanges.pipe(
  debounceTime(300),
  switchMap(v => this.http.get(`/check?v=${v}`)),
  map(r => r.valid ? null : { unique: true }),
)
```
原因：Angular 异步校验器每次 control 值变都重新订阅返回的 Observable——如果不 debounce+switchMap 就会每字符一请求且前一个未回来就被覆盖。Angular 内置 `AsyncValidator` 返回的 Observable 被订阅后若旧请求未完会保留旧结果——switchMap 的取消语义在这里至关重要。

### 3. (C) 对比 Angular Reactive Forms、React Hook Form + Zod、Vue vee-validate + Yup 三家的表单建模方式：核心抽象分别是什么？

**来源**：转述自本关 §一选型对比与跨框架表单知识（呼应 react-forms、kit-form-validation、vue-forms-validation）

核心抽象：① **Angular**：FormControl 树（FormGroup/FormArray）——每个控件持有 value+status+validators 三合一；表单是一棵**有状态对象树**。② **React Hook Form**：ref-based uncontrolled + 外挂 Zod schema——值在 DOM 里（不是 React state）、校验在 schema 里——表单是**DOM + schema 代理**。③ **Vue vee-validate**：useField/useForm composable + Yup 校验——值是 ref（响应式）、校验是 schema——表单是**响应式 refs + 校验函数**。一句话：Angular 重对象、React 轻状态（uncontrolled）、Vue 居中（controlled refs）。

### 4. (D) 设计一个三步向导表单：Step1 用户信息 → Step2 地址（可跳过）→ Step3 确认提交。用 Reactive Forms 给出整体架构（ FormGroup 嵌套 / 跨步骤校验 / 草稿保存）。

**来源**：转述自本关 §二 FormBuilder 嵌套与 §六 FormArray 的综合应用

架构：`wizardForm = fb.group({ step1: fb.group({name, email, phone}), step2: fb.group({city, street, zip}) , step3: fb.group({confirm: [false, Validators.requiredTrue]}) })`。跨步骤：`step1Valid = computed(() => this.wizardForm.get('step1')?.valid)` 驱动『下一步』disabled。Step2 可跳过：不校验或条件 validator。草稿：每步 valueChanges 存 localStorage。提交：`this.wizardForm.valid` + `this.wizardForm.getRawValue()`（含 disabled 字段）。加分：说清 FormGroup.disable() 可排除 step2 的校验。

### 5. (A) form.disable() 后控件的 value 在 form.value 里还存在吗？getRawValue() 与 value 的区别？

**来源**：转述自本关 §四表单状态维度与 §七 patchValue 段

`form.value` **不包含** disabled 控件的值（返回 null 或跳过该 key）——设计意图：提交时排除用户不可编辑的字段。`getRawValue()` 返回所有字段值（含 disabled）——用于草稿保存/回显。场景：编辑页 admin 锁定了 username 字段（disable）→ 表单提交 value 里没有 username（后端不改）→ 但前端 patchValue 回显要拿完整对象（getRawValue）。

### 6. (B) 同事写了 `this.registerForm.get('username').setErrors({custom: true})`，用户继续输入后 errors 消失了。这符合预期吗？为什么？

**来源**：转述自本关 §三校验器与 §四 touched/dirty 状态

符合预期。setErrors 是手动设一次性错误——**用户输入触发 valueChanges → 同步校验器重新跑 → 如果通过就清 errors**。这是设计行为：手动设的错是临时标记（如后端返回的『用户名已存在』），用户修改值后应清除让重新校验。若要持久错误（如密码规则不满足直到改对），应该用 validator 函数而非 setErrors。面试考点：区分『声明式校验（validator）』与『命令式设错（setErrors）』的触发时机。

### 7. (C) v17+ 的 typed Reactive Forms 解决了旧版的什么痛点？给一行代码对比 typed 前后。

**来源**：转述自本关 §二类型化表单段（v14 opt-in v17 默认）

旧痛点：`this.form.get('user.name')` 返回 `any`——拼错路径或类型全靠自觉。typed 后：
```ts
// v16-（untyped）
const form = new FormGroup({ name: new FormControl('') });
form.get('nam')  // 返回 AbstractControl | null，无报错

// v17+（typed）
const form = new FormGroup({ name: new FormControl('', {nonNullable: true}) });
form.controls.name.value  // 类型是 string，拼错编译报错
```
收益：form.value 类型推断为 `{name: string}`；patchValue 检查部分类型；嵌套 group 路径正确性编译器保证。v17 起新工程默认 typed（旧 untyped 需显式 opt-out）。

### 8. (D) 面试官问『你怎么把 Reactive Forms 表单与后端 schema 做自动化校验对齐』——给出 Zod/JSON Schema + Angular validator 的桥接方案。

**来源**：转述自本关 §三校验器体系与跨框架 schema 校验实践（呼应 kit-form-validation）

方案：① 后端维护一份 Zod schema（或 OpenAPI 导出的 JSON Schema）；② 前端共享该 schema（monorepo 直接 import / 或 codegen 生成）；③ 写通用适配：`fromZodToAngular(schema)` 遍历 ZodObject shape → 为每个字段生成 FormControl + Validators.required/type；④ 异步/跨字段校验用 `zodResolver` 风格的自定义 validator：`asyncValidator: (c) => schema.safeParseAsync(c.value).then(r => r.success ? null : {zod: r.error})`。收益：改后端 schema→前端表单自动同步；加分：讨论 schema 版本漂移时的 fallback 策略与 UI 渲染顺序（schema 定义顺序 vs 业务优先级）。

### 9. (A) FormArray 的 track 策略与 @for 的 track 有什么关系？动态表单行用 index track 会导致什么？

**来源**：转述自本关 §六 FormArray 与 ng-templates @for track 知识的联动

模板渲染 FormArray 用 `@for (ctrl of items.controls; let i = $index; track i)`——track by index。问题与 @for 列表一样：中间删一行→后续行 index 全变→DOM 复用错位→用户焦点/动画/value 绑定错乱。正确做法：track by 行内 unique id（`track ctrl.get('id')?.value`）——给每个动态行一个 hidden id control 做稳定标识。FormArray.removeAt(i) 内部也需更新对应 value——track 保证 DOM 与数据对齐。

### 10. (B) 提交时 form.valid 为 true 但后端报 422 字段校验失败——给三种可能的原因与排查方法。

**来源**：转述自本关 §三校验器与 §七 patchValue 的实战排坑

① **前端校验规则与后端不一致**（前端 minLength=3、后端 minLength=5）——排查：对比两端 schema；修法：共享 validator（见 q8）；② **异步校验还没回来就提交了**——form.valid=true 但 pending 字段有未验证项：排查：`form.status === 'PENDING'`；修法：提交按钮加 `[disabled]="form.pending"`；③ **patchValue 改了值没触发重校验**（`updateOn: 'blur'` 模式下未 blur）——排查：`control.dirty` 判断；修法：提交前 `form.markAllAsTouched()` + `form.updateValueAndValidity()`。

### 11. (C) Reactive Forms 在 zoneless 下有什么已知限制？signal-based 表单（L5 第二关）为什么出现？

**来源**：转述自本关 §五 valueChanges 在 zoneless 下的行为与 ng-signal-forms 预告

限制：zoneless 不拦截 form.valueChanges 的发射——表单控件是 BehaviorSubject 驱动、不是 signal——因此 **表单值变化不会自动触发组件视图更新**（除非用 AsyncPipe 或手动 markForCheck）。Signal Forms 出现的原因：让表单值本身是 signal（form 是 signal 容器）→ zoneless 下自动通知模板 → 去掉 valueChanges 订阅样板 → 字段 errors/dirty/touched 也 signal 化 → 模板 @if (field.error()) 直接读不需要 get() 链。一句话：Reactive Forms 是 RxJS 时代的产物，Signal Forms 是 zoneless 时代的原生方案。

### 12. (D) 给一段 v14 的 untyped FormBuilder 代码，要求升级到 v17 typed + standalone 组件。指出需要改什么。

**来源**：转述自本关 §二 + ng-comp-signals 的 standalone 知识组合

改动清单：① 组件加 `imports: [ReactiveFormsModule]`（standalone 需自行导入）；② fb.group 写法升级：`this.fb.group({ name: this.fb.nonNullable.control('', Validators.required) })`（typed 推荐）或直接 `name: ['', {nonNullable: true}]`；③ 表单变量类型 `FormGroup` → 具体类型 `FormGroup<{name: FormControl<string>, ...}>`；④ 模板里 `form.get('name')?.errors` 改为 `form.controls.name.errors`（typed 访问链更短更安全）；⑤ 去掉旧 NgModule 导入的 ReactiveFormsModule（模块里删、组件里加）。

### 13. (B) 同事用 `this.form.reset({ name: 'default' })` 重置表单后发现 email 字段仍有旧值——为什么？reset 与 patchValue({}) 的区别？

**来源**：转述自本关 §七 patchValue/setValue 与表单重置行为

`form.reset(config?)` 把所有字段重置为 config 里给的值——**未给值的字段被置为 null 并清除 errors/dirty/touched**（完全重置状态）。同事 email 有旧值可能是因为 `reset({name:'default'})` 把 email 置 null 但 `updateOn: 'submit'` 模式下模板仍显示旧 DOM value。reset vs patchValue({})：patchValue({}) **什么都不改**（空对象=零字段更新）；reset() 全部清为 null 且重置 touched/dirty 状态。正确写法：`this.form.reset(this.editData ?? undefined)`。

### 14. (A) 自定义 Validator 函数里为什么不能注入服务？怎么绕？

**来源**：转述自本关 §三异步 validator 实现与 ng-inject 注入上下文限制

同步 validator 是纯函数（`control => errors|null`），在表单引擎内部调用——不在注入上下文中，不能 inject()。异步 validator 返回 Observable 可以闭包捕获外部 this（若在组件 field 里声明 validator）——但独立函数同样无上下文。**绕法**：① 用闭包：`emailExistsValidator(http: HttpClient) { return (c) => http.get(...).pipe(...) }`——工厂函数捕获注入好的 http；② Angular Material 等库的 `composeAsyncValidators` + 组件里传 service 实例；③ 新 Signal Forms 可能内解此问题。

### 15. (D) 面试官让你用 Reactive Forms + toSignal 实现『级联下拉（省→市→区）』：选省时市清空并重载——写出核心代码。

**来源**：转述自本关 §五 valueChanges 与 ng-rx-bridge toSignal 的综合应用

```ts
const form = fb.group({ province: '', city: '', district: '' });
cities = toSignal(
  form.controls.province.valueChanges.pipe(
    switchMap(p => p ? this.http.get<City[]>(`/api/cities?p=${p}`) : of([])),
  ), { initialValue: [] }
);
ngOnInit() {
  form.controls.province.valueChanges.subscribe(() => {
    form.controls.city.reset(''); form.controls.district.reset('');
  });
}
```
加分：district 同理嵌套；说明为什么用 switchMap（旧省请求被新省取消）；toSignal 自动跟随组件销毁退订。
