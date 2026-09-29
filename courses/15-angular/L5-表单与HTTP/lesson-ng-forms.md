# ng-forms：Reactive Forms——存量项目的正统

> 目标：FormBuilder 类型化表单、同步/异步校验器、valueChanges 流、patch 与脏检查状态；FormArray 动态行；模板驱动表单（ngModel）何时才用；存量表单代码的读法——v22 之前它仍是企业默认（呼应 react-forms 对照、kit-form-validation、ng-signal-forms）

## 一、Reactive Forms vs 模板驱动：什么时候选哪个

| | Reactive Forms | 模板驱动（ngModel） |
|---|---|---|
| 表单建模 | class 里 FormBuilder.group() | 模板里 `[(ngModel)]` + 校验指令 |
| 校验 | 同步/异步 validator 函数集中管理 | 模板属性（required/minlength） |
| 动态行 | FormArray.push/remove 代码控制 | 难以动态 |
| 适用 | 复杂表单（多步/跨字段校验/动态） | 简单搜索框/注册三字段 |

**企业默认**：绝大多数 B 端表单用 Reactive Forms——模板驱动只适合**一次性搜索框**（2026 仍然如此，Signal Forms 是 L5 第二课主题）。

## 二、FormBuilder 类型化表单（v14+ 强类型）

```ts
// 目的：FormBuilder 类型化表单——每个 control 是 [默认值, 同步校验, 异步校验] 三元组
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

registerForm: FormGroup;

constructor(private fb: FormBuilder) {
  this.registerForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],                // 必填 + 最短 3
    email: ['', [Validators.required, Validators.email], [asyncEmailValidator]],   // 第二组异步校验
    password: ['', [Validators.required, Validators.pattern(/(?=.*[A-Z])(?=.*\d)/)]],  // 必含大写+数字
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });  // group 级：跨字段校验
}
// ✅ 强类型后 registerForm.get('username') 返回 AbstractControl<string>，值类型自动推断
// ❌ 组件没 imports ReactiveFormsModule→formGroup/formControlName 指令不识别→模板报错
```

每个 control 是 `[defaultValue, syncValidators?, asyncValidators?]` 三元组。强类型后 `this.registerForm.get('username')` 返回 `AbstractControl<string>`——值类型推断。

## 三、校验器：同步 / 异步 / 跨字段

**同步 validator**（纯函数返回错误或 null）：
```ts
// 目的：同步 validator——纯函数，违规返回错误对象、合法返回 null
function forbiddenName(control: AbstractControl): ValidationErrors | null {
  return control.value === 'admin' ? { forbiddenName: true } : null;   // 命中关键词→置错
}
// ✅ 返回 {key: true} 会被挂到 control.errors，模板用 hasError('forbiddenName') 读
// ❌ 合法时返 false/undefined 而非 null→Angular 只认 null 为无错，类型不符、状态判定乱
```

**异步 validator**（返回 Observable<ValidationErrors | null>）：
```ts
// 目的：异步 validator——返回 Observable<ValidationErrors | null>，适合查接口
function asyncEmailValidator(control: AbstractControl): Observable<ValidationErrors | null> {
  return this.http.get(`/api/email-exists?e=${control.value}`).pipe(
    map(exists => exists ? { emailTaken: true } : null),   // 已占用→置错，否则 null
    debounceTime(500),                                     // 防每键一个请求
    catchError(() => of(null)),                            // 接口挂了当无错，不阻断表单
  );
}
// ✅ debounceTime 延迟发查、catchError 兜异常，异步校验期间 control.status='PENDING'
// ❌ 不加 debounceTime→用户每敲一键就请求一次接口→请求风暴
```

**跨字段 validator**（挂在 group 上）：
```ts
// 目的：跨字段 validator——挂在 group 上比对两个 control
function passwordMatch(g: FormGroup): ValidationErrors | null {
  return g.get('password')?.value === g.get('confirmPassword')?.value
    ? null : { mismatch: true };   // 两次不一致→group 级置 mismatch 错
}
// ✅ 密码确认这类要读两个字段的校验必须挂 group（{ validators: ... }）
// ❌ 把 passwordMatch 当单字段 validator 传给某个 control→它拿不到兄弟 control，g.get 失效
```

## 四、表单状态与模板绑定

```html
<!-- 目的：表单模板绑定——[formGroup] 绑整体、formControlName 绑字段、touched 才显错 -->
<form [formGroup]="registerForm" (ngSubmit)="onSubmit()">    <!-- (ngSubmit) 回车/提交按钮触发 -->
  <input formControlName="username" />                       <!-- 双向同步到 registerForm.username -->
  @if (registerForm.get('username')?.hasError('required') && registerForm.get('username')?.touched) {
    <span class="error">用户名不能为空</span>                 <!-- 既错又已动过才提示 -->
  }
  @if (registerForm.get('username')?.hasError('minlength')) {
    <span class="error">至少 {{ registerForm.get('username')?.errors?.['minlength'].requiredLength }} 个字符</span>
  }
  <button [disabled]="registerForm.invalid">提交</button>      <!-- 整表非法→锁提交 -->
</form>
<!-- ✅ 用 touched 门控错误→避免用户还没输就满屏红 -->
<!-- ❌ 不等 touched 就显 required 错→光标刚进去就报「不能为空」，体验差 -->
```

状态属性：`valid/invalid/dirty/pristine/touched/untouched/pending`（异步校验中）。

## 五、valueChanges：表单值流与 RxJS 联动

```ts
// 目的：valueChanges——表单值流，Reactive Forms 里 RxJS 的保留主场
this.registerForm.get('username')?.valueChanges.pipe(
  debounceTime(300),              // 等用户停下
  distinctUntilChanged(),         // 同值不重发
  switchMap(name => this.http.get(`/api/check-user?n=${name}`)),   // 新值来就取消旧请求
).subscribe(available => { ... });
// ✅ FormControl 内建 Subject，不依赖 zone，复杂时序（联动/异步建议/级联下拉）首选
// ❌ 裸 subscribe 不收口→组件销毁后订阅仍在→内存泄漏；用 takeUntilDestroyed 或 toSignal
```

form.valueChanges 是 `Observable<Partial<T>>`——**这是 Reactive Forms 里 RxJS 的保留主场**：跨字段联动、异步建议、级联下拉等复杂时序逻辑用管道写。

zoneless 下 valueChanges 仍可用——它是 FormControl 内建的 Subject，不依赖 zone。

## 六、FormArray：动态行（地址列表/订单行）

```ts
// 目的：FormArray——动态行（地址列表/订单行），push/removeAt 代码控制
items = this.fb.array([]);       // 空数组表单

addItem() { this.items.push(this.fb.group({ name: '', qty: [1, Validators.min(1)] })); }   // 新增一行 group
removeItem(i: number) { this.items.removeAt(i); }   // 按索引删除一行

// 模板：
// <div formArrayName="items">
//   @for (item of items.controls; let i = $index; track i) {
//     <div [formGroupName]="i">
//       <input formControlName="name" />
//       <button (click)="removeItem(i)">删除</button>
//     </div>
//   }
//   <button type="button" (click)="addItem()">+ 添加</button>
// </div>
// ✅ formArrayName/formGroupName 按索引定位行，增删行由代码统一管
// ❌ 模板 @for track 用 $index→删中间行时索引全变→输入内容错位到别的行（应 track 稳定 id）
```

## 七、patchValue 与 setValue

```ts
// 目的：setValue vs patchValue——前者要求给全字段，后者只更传入的
// setValue：精确——部分字段缺失报错
this.registerForm.setValue({ username: '', email: '', password: '', confirmPassword: '' });   // 必须给齐所有 control

// patchValue：宽松——只更新传入的字段
this.registerForm.patchValue({ email: 'new@x.com' });   // 其余不动，回显首选
// ✅ 从后端拿部分数据回显表单用 patchValue，不必凑齐所有 control
// ❌ 用 setValue 只传一个字段→缺其余 control→直接抛错
```

编辑表单回显：从后端拿数据 → `patchValue` 填表。

## 八、读旧代码：模板驱动 ngModel 的识别

```html
<!-- 目的：模板驱动 ngModel——存量项目识别用，需 FormsModule 且控件要 name -->
<input [(ngModel)]="searchTerm" name="search" />   <!-- [(ngModel)] 香蕉双向，name 用于注册到父 NgForm -->
<!-- ✅ 一次性搜索框用 ngModel 仍可（简单、少样板） -->
<!-- ❌ 新项目拿 ngModel 做复杂表单→难动态、校验分散；简单搜索也推荐 signal model() 或 [value]+(input) -->
```

模板驱动需要 FormsModule；每个 ngModel 控件要有 name 属性（注册到父 NgForm）。在新项目里**搜索框也推荐 signal**（`searchTerm = model('')` 双向或直接 `[value]` + `(input)`）——ngModel 仍合法但不再是首选。

> 🚀 下一关：Signal Forms——v22 转正的新官方表单方案，与 Reactive Forms 的正面对比与选型判据。
