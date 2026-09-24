# ng-signal-forms：Signal Forms——v22 转正的新官配

> 目标：signalInput()/form() API 的表单建模：字段级错误/脏/禁用状态直接是 signal；与 Reactive Forms 的样板对比（无 valueChanges 订阅、无 formGroup 树操作）；迁移判断：新表单用不用、存量要不要搬；仍处快速演进期的 API 风险标注（官方文档为唯一事实底）（呼应 ng-forms、sig-mutability、ng-signals）

## 一、定位：Signal Forms 是什么、不是什么

**是**：Angular 官方在 v21 预览、v22 转正的**signal-native 表单方案**——表单的每个状态（value/errors/dirty/disabled/touched）本身就是 signal，模板绑定直接读取、变更检测自动通知。它补的是 Reactive Forms 在 zoneless 时代的响应式断层。

**不是**：不是 Reactive Forms 的替代（两者长期共存），不是外部库（@angular/forms/signals 是官方包），不是『只能写简单表单』（支持嵌套/数组/自定义校验）。

## 二、最小表单：form() + signalInput()

```ts
import { Component, signal } from '@angular/core';
import { form, field } from '@angular/forms/signals';

@Component({
  selector: 'app-login',
  imports: [],
  template: `
    <form (submit)="onSubmit()">
      <input [value]="loginForm.email().value()"
             (input)="loginForm.email().value(set($event.target.value))" />
      @if (loginForm.email().invalid() && loginForm.email().touched()) {
        <span>请输入邮箱</span>
      }

      <input type="password" [value]="loginForm.password().value()" />
      @if (loginForm.password().hasError('required')) {
        <span>密码不能为空</span>
      }

      <button [disabled]="loginForm.invalid()">登录</button>
    </form>
  `,
})
export class Login {
  email = signal('');
  password = signal('');

  loginForm = form(this.email, {
    email: { validators: { required: required() } },
    password: { validators: { required: required(), minlength: minlength(6) } },
  });

  onSubmit() {
    if (this.loginForm.valid()) { /* ... */ }
  }
}
```

核心观察：**没有 FormGroup、没有 formControlName、没有 valueChanges**——表单是一棵 signal 树，字段状态是 readonly signal。

## 三、与 Reactive Forms 的样板对比

| 需求 | Reactive Forms | Signal Forms |
|------|---------------|--------------|
| 声明字段 | `fb.group({name: ['', Validators.required]})` | `form(model, { name: { validators: { required } } })` |
| 模板绑定 | `formControlName="name"` | `[value]="form.name().value()"` |
| 读值 | `form.get('name').value` | `form.name().value()` |
| 读错误 | `form.get('name')?.hasError('required')` | `form.name().hasError('required')` |
| 监听变化 | `form.get('name').valueChanges.pipe(...)` | `effect(() => { ...form.name().value()... })` |
| 动态数组 | `new FormArray([...])` + push/removeAt | signal 数组 + form 自动派生 |
| 重置 | `form.reset({...})` | `model.set({...})`——重置数据源即可 |

Signal Forms 的优势：**与 zoneless 变更检测天然对齐**——表单值是 signal 所以模板绑定自动追踪、不需要 AsyncPipe/markForCheck。

## 四、校验器：声明式与自定义

```ts
import { required, minLength, email, pattern } from '@angular/forms/signals';

const loginForm = form(model, {
  email: { validators: { email: email(), required: required() } },
  password: { validators: { minLength: minLength(8) } },
  age: { validators: { custom: (field) => {
    return field() > 0 && field() < 150;  // true=有效
  } } },
});
```

异步校验：
```ts
username: {
  asyncValidators: {
    unique: async (field) => {
      const exists = await firstValueFrom(
        http.get(`/api/user-exists?n=${field()}`)
      );
      return !exists;
    },
  },
}
```

与 Reactive Forms 的 validator 函数对比：Signal Forms 接收 `Signal<T>`（当前字段值的 signal）而非 AbstractControl——更纯粹（只读值不读状态）。

## 五、表单复用与跨字段

```ts
// 跨字段（密码匹配）：validator 访问兄弟字段
passwordGroup: {
  validators: {
    match: (field) => {
      return field().password === field().confirm;
    },
  },
}
```

`field()` 返回整个 group 的值对象——可以比较多个子字段。

## 六、迁移判断：新表单用不用、存量要不要搬

**新项目**：v22+ 全新表单直接用 Signal Forms——zoneless 原生、样板更少。

**存量 Reactive Forms 项目**：短期不强制迁移——两套共存合法（Signal Forms 不删 Reactive Forms）。迁移时机：① 工程已 v21+ zoneless；② 表单区域频繁出现 markForCheck 问题——说明 Reactive Forms 的 BehaviorSubject 与 zoneless 对齐成本高；③ 重写组件时顺手换。

**API 稳定性风险**：Signal Forms 是 v21 预览 v22 stable——但 Angular 团队声明此包仍在『快速演进期』（类似早期 Signals v17 实验→v18 stable 的过程）。**生产使用前查 angular.dev 最新 CHANGELOG 确认 API 无 breaking**——本关所有代码以 v22 GA 为准，若 API 名/行为微调以官方文档为唯一事实底。

## 七、与第三方表单库（ng-zorro / ngx-formly）的关系

ngx-formly（配置式表单生成）已宣布支持 Signal Forms 后端——配置 JSON→Signal Forms 自动渲染。ng-zorro-antd 的表单组件暂基于 Reactive Forms——待适配。2026 现状：Signal Forms 是**官方引擎**、第三方库是**渲染层**——引擎换代需要适配期。

> 🚀 下一关：HttpClient 实战——函数式拦截器、类型化请求与 fetch 化趋势。
