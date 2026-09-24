# L2 阶段作业：组件与模板

> 覆盖：ng-templates / ng-comp-signals / ng-directives
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（@for 缺 track）
```html
@for (item of items()) {
  <li>{{ item.name }}</li>
}
```
ng build 报错，提示某个必填项缺失。指出是什么必填项、为什么 Angular 把它做成强制而非可选。

**Bug 2**（input 未调用）
```ts
name = input('世界');
```
```html
<h1>Hello {{ name }}</h1>
```
渲染结果是 `[object Object]`。原因与修法。

**Bug 3**（constructor 读 input）
```ts
constructor() {
  console.log(this.userId());  // input.required<number>()
}
```
日志打印出 undefined 而非父组件传入的值。指出时序问题与两个正确读取点。

**Bug 4**（@Input 与 input() 混用）
```ts
@Input() title: string = '';
subtitle = input('');
```
同一个组件里混用旧装饰器与新函数式 API。strictTemplates 是否允许？有无风险？

**Bug 5**（结构指令共宿主）
```html
<ng-template *ngIf="show" [appUnless]="hide">
  <p>内容</p>
</ng-template>
```
编译报错。指出冲突原因并给修法。

**Bug 6**（ng-content 生命周期误判）
同事说："子组件 app-card 被 @if 销毁了，投影进它的 <p> 也就被销毁了。" 判断对错并说明投影内容的生命周期归谁。

**Bug 7**（HostListener document 清理误解）
```ts
@HostListener('document:click', ['$event'])
onClick(e: MouseEvent) { ... }
```
同事担心组件销毁后这个全局监听不清理导致内存泄漏。判断对错并说明 @HostListener 的清理保证。

**Bug 8**（双向绑定方向反了）
```html
<input [(ngModel)]="parentSignal()">
```
ng build 不报错但运行时双向不生效。指出括号使用问题与修法。

**Bug 9**（viewChild 非 afterRender 时序）
```ts
panel = viewChild<ElementRef>('panel');
constructor() { this.panel().nativeElement.style.color = 'red'; }
```
constructor 崩了。两个独立错误（constructor 时序 + 可能 null）分别指出并给修法。

**Bug 10**（pipe 非纯函数）
```ts
@Pipe({ name: 'sum' })
export class SumPipe implements PipeTransform {
  private cache = 0;
  transform(arr: number[]): number {
    this.cache += arr.reduce((a,b)=>a+b,0);
    return this.cache;
  }
}
```
指出违反了 pipe 的哪条铁律与 zoneless 下的后果。

## 二、手写题（5 题）

**手写 1**：不查资料写一个完整的 @if/@for/@empty 模板片段：显示用户列表，列表为空时展示『暂无数据』占位，单个用户名为 admin 时额外标一个 <span class="badge">管理员</span>。

**手写 2**：用 input()/output()/model() 写一个 Toggle 组件：接收 label（必传）、checked（双向）；点击时切换并 emit change 事件。

**手写 3**：写一个 [appClickOutside] 属性指令：点击宿主元素外部时触发输出事件 `(outsideClick)`。要求用 @HostListener + inject(ElementRef)。

**手写 4**：用结构指令 [appDelay]（接收毫秒数参数）实现：内容在指令激活后延时 N 毫秒才渲染到视图。需要 TemplateRef、ViewContainerRef、DestroyRef。

**手写 5**：写一个完整的组件分页器使用方模板（5 行以内）：调用 L2 §七的 Pagination 组件、传 total/current、绑定 pageChange 到 loadPage 方法。

## 三、场景题（1 题，20 分）

公司要求你设计一套『表单字段组件库』给内部 20+ 业务线使用。需求：① 字段外观统一（label + input + error 行三段），但字段内容（input/select/datepicker）可切换；② 支持 disabled/required/readonly 三态；③ 支持双向绑定值；④ 有动画展开/收起高级选项区。给出：组件/指令划分方案（至少 2 组件 + 1 指令）、input()/model()/output() 的接口设计、content projection 用在哪里（高级选项区）、@if vs [hidden] 的决策依据、以及这个库的 standalone exports 怎么写给业务线用。

## 四、简答题（3 题）

**简答 1**：为什么说 @for 的 track 是『性能命门』？用一个 100 项列表中间删一行的例子对比 track by id vs track by index 的 DOM 操作次数。

**简答 2**：model() 双向绑定在 zoneless 下为什么不再需要 FormsModule？给出一行使用方代码并拆解编译器展开后的两行代码。

**简答 3**：『指令的领地在缩小』——给一条 CSS 新特性能替代的场景与一条不能替代的场景，说明 Angular 指令在 2026 的不可替代价值。

## 五、挑战题 🏆（+10 分）

用本包 L2 三关知识独立实现一个 **@defer 增强的瀑布流加载指令** `[appInfiniteScroll]`（纯 TS+模板，不用第三方库）：要求 ① 监听宿主容器滚动到底部 100px 时 emit `loadMore` 输出；② 加载中时显示底部 spinner（用 @if + 内部 signal）；③ 使用 @defer 让 spinner 组件延迟加载（减少首屏 JS 体积）；④ 组件销毁时确保 scroll 监听被清理（DestroyRef）。输出：完整指令代码 + 使用方 3 行模板 + 说明为什么 spinner 用 @defer 而不用 @if 条件渲染。
