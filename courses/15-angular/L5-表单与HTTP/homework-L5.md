# L5 阶段作业：表单与 HTTP

> 覆盖：ng-forms / ng-signal-forms / ng-http
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（formControlName 与 Signal Forms 混用）
在 v22 新工程的 Signal Forms 模板里写了 `formControlName="email"`——ng build 报 unknown property。为什么 Signal Forms 里不用这个？

**Bug 2**（Reactive Forms zoneless 不更新）
zoneless 工程里 `this.form.patchValue({name:'x'})` 后模板 `{{ form.get('name')?.value }}` 不更新。给出两行修法。

**Bug 3**（异步校验无 debounce）
```ts
asyncValidator: (c) => this.http.get(`/check?v=${c.value}`)
```
用户每输入一字符就发一个请求。给两行修法（异步 validator 内加操作符）。

**Bug 4**（拦截器忘 return）
```ts
export const authI: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  req = req.clone({ setHeaders: { Auth: token } });  // 只赋值无返回
};
```
请求没带 token。指出拦截器必须 return 什么。

**Bug 5**（setValue 部分缺失）
```ts
this.form.setValue({ name: 'test' });  // 表单有 name/email/password 三字段
```
抛错 form group errors。区分 setValue/patchValue 行为并修法。

**Bug 6**（FormArray track index）
```html
@for (ctrl of items.controls; let i = $index; track i) {
```
动态表单行删除中间一行后其他行输入框值错位。给修法。

**Bug 7**（signal form validator 里 inject）
```ts
validators: { unique: (field) => {
  const http = inject(HttpClient);  // 在 validator 里 inject
  ...
}}
```
报 NG0203。为什么 validator 函数里不能 inject？

**Bug 8**（HttpClient 没注册）
v22 standalone 工程 `constructor(private http = inject(HttpClient))` 报 No provider for HttpClient。修 app.config。

**Bug 9**（HttpHeaders 误 mutation）
```ts
req.headers.set('X-Token', token);  // 然后 next(req)
```
后端没收到 header。HttpHeaders 是 immutable 的 .set 做了什么？

**Bug 10**（form.valid 在 zoneless 模板里不响应）
@if (form.invalid()) 但 Signal Forms 字段被用户改后这个 @if 不刷新。缺了什么？

## 二、手写题（5 题）

**手写 1**：用 FormBuilder 写一个含 3 字段的类型化表单（name/email/phone）+ 一个跨字段校验（phone 和 email 至少填一个）。

**手写 2**：把上题用 Signal Forms 重写（model signal + form() 配置）。

**手写 3**：写一个函数式拦截器：给所有 /api/ 前缀请求加 `X-Requested-With: XMLHttpRequest` header。

**手写 4**：写一个异步校验器：检查用户名唯一性（500ms debounce + switchMap + catchError 降级为 null）。

**手写 5**：用 http.get<User[]> 类型化 + toSignal + @for 渲染用户列表完整模板（≤10 行）。

## 三、场景题（1 题，20 分）

你要实现一个『订单表单』：客户信息(name/phone) → 商品行列表(FormArray, 可增删改) → 优惠码(异步校验有效性) → 总计(computed 派生)。给出：① Reactive Forms 方案（group+array+async validator）核心代码骨架；② 标注哪些在 zoneless 下需要 markForCheck 或改 signal；③ 若换成 Signal Forms 方案怎么写；④ HttpClient POST 提交 + 带全局 loading 拦截器（spinner 显示/隐藏）。

## 四、简答题（3 题）

**简答 1**：为什么 Signal Forms 在 zoneless 下不需要 AsyncPipe 但 Reactive Forms 需要？给出因果链。

**简答 2**：函数式拦截器与 class 拦截器的三条架构差异（DI / tree-shake / 链式模型）。

**简答 3**：form.value 和 form.getRawValue() 的区别与各自适用场景。

## 五、挑战题 🏆（+10 分）

设计一个『表单引擎』：后端返回 JSON schema（字段名/类型/校验规则/依赖关系），前端自动生成表单。要求：① 用 Signal Forms 为渲染基座（schema→model signal→form()）；② 支持字段依赖（选了『公司』才显示『公司名称』字段）；③ 支持动态数组（订单行增删）；④ 校验规则从 schema 自动映射（required/minLength/email/async-unique）。输出：核心适配器 `schemaToForm(schema): {model, form}` 伪代码 + 模板渲染逻辑 + 处理依赖字段显隐的信号链设计。
