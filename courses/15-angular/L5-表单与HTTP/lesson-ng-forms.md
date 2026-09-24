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
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

registerForm: FormGroup;

constructor(private fb: FormBuilder) {
  this.registerForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email], [asyncEmailValidator]],
    password: ['', [Validators.required, Validators.pattern(/(?=.*[A-Z])(?=.*\d)/)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });  // 跨字段校验
}
```

每个 control 是 `[defaultValue, syncValidators?, asyncValidators?]` 三元组。强类型后 `this.registerForm.get('username')` 返回 `AbstractControl<string>`——值类型推断。

## 三、校验器：同步 / 异步 / 跨字段

**同步 validator**（纯函数返回错误或 null）：
```ts
function forbiddenName(control: AbstractControl): ValidationErrors | null {
  return control.value === 'admin' ? { forbiddenName: true } : null;
}
```

**异步 validator**（返回 Observable<ValidationErrors | null>）：
```ts
function asyncEmailValidator(control: AbstractControl): Observable<ValidationErrors | null> {
  return this.http.get(`/api/email-exists?e=${control.value}`).pipe(
    map(exists => exists ? { emailTaken: true } : null),
    debounceTime(500),
    catchError(() => of(null)),
  );
}
```

**跨字段 validator**（挂在 group 上）：
```ts
function passwordMatch(g: FormGroup): ValidationErrors | null {
  return g.get('password')?.value === g.get('confirmPassword')?.value
    ? null : { mismatch: true };
}
```

## 四、表单状态与模板绑定

```html
<form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
  <input formControlName="username" />
  @if (registerForm.get('username')?.hasError('required') && registerForm.get('username')?.touched) {
    <span class="error">用户名不能为空</span>
  }
  @if (registerForm.get('username')?.hasError('minlength')) {
    <span class="error">至少 {{ registerForm.get('username')?.errors?.['minlength'].requiredLength }} 个字符</span>
  }
  <button [disabled]="registerForm.invalid">提交</button>
</form>
```

状态属性：`valid/invalid/dirty/pristine/touched/untouched/pending`（异步校验中）。

## 五、valueChanges：表单值流与 RxJS 联动

```ts
this.registerForm.get('username')?.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(name => this.http.get(`/api/check-user?n=${name}`)),
).subscribe(available => { ... });
```

form.valueChanges 是 `Observable<Partial<T>>`——**这是 Reactive Forms 里 RxJS 的保留主场**：跨字段联动、异步建议、级联下拉等复杂时序逻辑用管道写。

zoneless 下 valueChanges 仍可用——它是 FormControl 内建的 Subject，不依赖 zone。

## 六、FormArray：动态行（地址列表/订单行）

```ts
items = this.fb.array([]);

addItem() { this.items.push(this.fb.group({ name: '', qty: [1, Validators.min(1)] })); }
removeItem(i: number) { this.items.removeAt(i); }

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
```

## 七、patchValue 与 setValue

```ts
// setValue：精确——部分字段缺失报错
this.registerForm.setValue({ username: '', email: '', password: '', confirmPassword: '' });

// patchValue：宽松——只更新传入的字段
this.registerForm.patchValue({ email: 'new@x.com' });
```

编辑表单回显：从后端拿数据 → `patchValue` 填表。

## 八、读旧代码：模板驱动 ngModel 的识别

```html
<input [(ngModel)]="searchTerm" name="search" />
```

模板驱动需要 FormsModule；每个 ngModel 控件要有 name 属性（注册到父 NgForm）。在新项目里**搜索框也推荐 signal**（`searchTerm = model('')` 双向或直接 `[value]` + `(input)`）——ngModel 仍合法但不再是首选。

> 🚀 下一关：Signal Forms——v22 转正的新官方表单方案，与 Reactive Forms 的正面对比与选型判据。
