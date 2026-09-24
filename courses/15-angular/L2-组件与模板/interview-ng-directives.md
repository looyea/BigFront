# ng-directives 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕自定义指令（属性指令与结构指令）、@for track 机制与指令 vs 组件决策的题组。

### 1. (A) @Component extends @Directive 在运行时 DI 层面有什么具体含义？指令能否注入 ElementRef 而组件不能？

**来源**：转述自本关 §一指令定位表与 §二 ElementRef 注入段

含义：Component 继承 Directive 意味着**组件拥有指令的全部能力**——@HostBinding/@HostListener/input()/output()/inject(ElementRef) 在组件 class 里同样合法。指令**能**注入 ElementRef（因为它附着在宿主 DOM 元素上）；组件**同样能**注入 ElementRef（指向组件自己的宿主标签，而不是内部模板）——说『组件不能』是错的。两者区别是：指令**没有自己的视图**所以 ElementRef 指向的宿主是唯一 DOM 锚点；组件 ElementRef 指向 `<app-xxx>` 这个外层标签、内部模板要通过 viewChild 或 Renderer2 操作。加分：@HostBinding 在组件里控制的是宿主标签的 class/attr，不是模板内部的 DOM。

### 2. (A) 结构指令 createEmbeddedView(tpl, context) 的 context 参数怎么在模板侧接收？写一个完整的 context 传递与 let- 解构示例。

**来源**：转述自本关 §三结构指令进阶的 context 段

指令端：
```ts
const view = this.container.createEmbeddedView(this.tpl, {
  $implicit: this.data(),    // 默认值
  rowIndex: 3,               // 具名
});
```
模板端（使用方写）：
```html
<ng-template [appMyDir]="items()" let-item let:idx="rowIndex">
  <p>{{ idx }}: {{ item.name }}</p>
</ng-template>
```
`let-item`（无等号）取 `$implicit`；`let:idx="rowIndex"` 取 context 的具名 key。与 @for 的 `$index` / $even / $odd 内置 context 同族。加分：view.context 可后续赋值——`view.context.$implicit = newData` 触发模板局部重渲染。

### 3. (B) 两个结构指令挂在同一个 ng-template 上：`<ng-template [dirA] [dirB]>`，Angular 报编译错——为什么？给修法。

**来源**：转述自本关 §四指令组合与 §三 ViewContainerRef 的排他性

原因：多个**结构型指令**竞争同一个 TemplateRef 与 ViewContainerRef——两者都想控制这个容器的视图创建/销毁，编译器无法决定谁优先。修法：① 拆成两层：`<ng-template [dirA]><div *dirB>...</div></ng-template>`（把 B 下移到内层元素）；② 把其中某个改为属性指令（不创建视图、只做逻辑判断）；③ 如果是自定义指令组合需求，把两件事合并成一个指令或提供一个组合指令。原则：**同一元素只能有一个结构指令**（v17 前星号语法也只允许一个）。

### 4. (C) Angular 属性指令 vs Svelte action vs Vue directive：三者在『生命周期对齐宿主元素』这个需求上各用什么钩子？zoneless 下谁的通知链最短？

**来源**：转述自本关 §七横向对比表与 §五 composition 段

Svelte action：函数返回 `{update(params), destroy()}`——update 在 params 变化时调用、destroy 在元素移除时；无 DI 无 signal 通知链。Vue directive：`{created, mounted, beforeUpdate, updated, beforeUnmount, unmounted}` 六个钩子——在 vdom patch 阶段被调用。Angular 指令：`ngOnInit → ngDoCheck → ... → ngOnDestroy`（组件生命周期接口）或 v22 新 `DestroyRef.onDestroy()` + `effect()`——zoneless 下通知链最短的是 **Angular**：signal 写→effect 重跑→指令逻辑执行——不经过脏检查也不经过 vdom diff，直达。Svelte action 的 update 由编译器在参数变化处直接调用（也很快但无 signal 语义）。

### 5. (B) 你写了一个 [appAutofocus] 指令，在 ngOnChanges 里判断 focusIf 条件为 true 时调 elementRef.nativeElement.focus()——发现页面首次加载时不生效（元素还没渲染）。怎么修？

**来源**：转述自本关 §二 HostBinding 与 §三 effect 时机（结构指令视图创建时序）

原因：ngOnChanges 在变更检测阶段执行——此时组件模板**可能尚未插入 DOM**（首次渲染时 view 还没 attach 到 DOM 树上，focus 不生效）。修法：① 用 `afterNextRender(() => { el.focus(); }, { injector })`（v17+ 新 API，保证在渲染到 DOM 后执行）；② 或在 setTimeout(() => el.focus(), 0) 里推入宏任务（旧土办法，但 zoneless 下 setTimeout 不触发变更检测了需要 effect 包）；③ 推荐：用 viewChild signal + effect 组合——effect 在 signal 值变为非 null 后执行（viewChild 在渲染后才有值）。核心：DOM 操作要等 view attach。

### 6. (D) 设计一个 @VirtualScroll 结构指令：只渲染视口内的行（10000 行列表只渲染 30 行 DOM），给出指令骨架代码与需要注入的三件套。

**来源**：转述自本关 §三结构指令机制的规模化应用

注入三件套：TemplateRef（行模板）、ViewContainerRef（视图容器）、ElementRef（宿主滚动容器）。
```ts
@Directive({ selector: '[appVirtualScroll]' })
export class VirtualScrollDir {
  items = input.required<any[]>();
  itemHeight = input(40);
  tpl = inject(TemplateRef);
  container = inject(ViewContainerRef);
  host = inject(ElementRef).nativeElement as HTMLElement;

  visibleRange = signal({ start: 0, end: 30 });

  @HostListener('scroll')
  onScroll() {
    const scrollTop = this.host.scrollTop;
    const start = Math.floor(scrollTop / this.itemHeight());
    this.visibleRange.set({ start, end: start + 30 });
    this.renderWindow();
  }

  renderWindow() {
    this.container.clear();
    const { start, end } = this.visibleRange();
    for (let i = start; i < Math.min(end, this.items().length); i++) {
      this.container.createEmbeddedView(this.tpl, { $implicit: this.items()[i], index: i });
    }
  }
}
```
加分：提及 CDK @angular/cdk/scrolling 的 CdkVirtualScrollViewport 已做这件事（组件方案而非指令方案——因为它有完整模板 UI），生产项目直接用 CDK。

### 7. (A) @for 编译后底层是否还走 ViewContainerRef？@if 呢？它们与自定义结构指令用的是同一套视图容器 API 吗？

**来源**：转述自本关 §三旧结构指令机制与新控制流的对比

是的。@for 与 @if 虽然不再是「用户可写的指令」，但编译产物底层**仍调用 ViewContainerRef 的 createEmbeddedView/detach/move 做 DOM 视图操作**——只是调用方从『指令 class 的 ngOnChanges』变成了『编译器生成的模板函数』。自定义结构指令的 `container.createEmbeddedView(tpl)` 与 @if 编译出的 `_t1.anchor.create()` 本质是同一个 ViewContainerRef API——区别在于：@if 不需要运行时创建 NgIf 类实例（无 DI 开销）、编译器直接操作 internal view container。所以用户结构指令与 @if 性能差距 = 一次 DI 实例化 + 一次 ngOnChanges 调用。

### 8. (C) React 社区用自定义 hooks（useClickOutside/useIntersection）做『无 UI 行为复用』，Angular 用 Directive 做——两种抽象在组合性/类型安全/可发现性三个维度各有什么优劣？

**来源**：转述自本关 §一指令定位与 React hooks 的对比

**组合性**：React hook 组合灵活（`useAsync(useDebounce(value))`）但多个 hook 操作同一 DOM ref 时有竞态；Angular 指令天然共宿主互不干扰（每个指令独立 DI 实例）但跨指令通信要借 service 中转。**类型安全**：React hook 全靠 TS 函数签名（useRef<HTMLElement>(null)）与模板无编译检查；Angular 指令的 selector 写错模板里 `appHighlght` 拼错→strictTemplates 报编译错（指令没被 import 同样报错）。**可发现性**：React hooks 是 npm 包、无全局目录（搜 GitHub）；Angular CDK/官方指令集有 schema 自动补全（VS Code Angular Extension 识别 exports 列出可用指令）。一句话：hooks 轻而自由、Directive 重而安全——与 React vs Angular 的整体哲学一致。

### 9. (D) 面试官让你 5 分钟内用 Directive + inject(TemplateRef) 实现一个 [appCollapse] 指令：默认折叠内容、点击 toggle 按钮时展开/收起，带 CSS transition。给出核心代码。

**来源**：转述自本关 §二属性指令与 §三结构指令的组合

```ts
@Directive({
  selector: '[appCollapse]',
  host: { '[class.collapsed]': 'collapsed()' },
})
export class CollapseDir {
  collapsed = signal(true);
  private el = inject(ElementRef);

  toggle() { this.collapsed.update(v => !v); }

  constructor() {
    effect(() => {
      this.el.nativeElement.style.maxHeight =
        this.collapsed() ? '0px' : this.el.nativeElement.scrollHeight + 'px';
    });
  }
}
```
使用方 `<div appCollapse #c="appCollapse"><button (click)="c.toggle()">展开</button>...</div>`。加分：exportAs 让 `#c="appCollapse"` 合法——在 @Directive 里加 `exportAs: 'appCollapse'`，模板中取指令实例。

### 10. (B) 你写了 @HostListener('document:click') 监听全局点击做 click-outside——发现组件销毁后监听没清理、内存泄漏。zoneless + DestroyRef 时代怎么确保全局事件清理？

**来源**：转述自本关 §五 HostBinding/Listener 组合与 ng-comp-signals DestroyRef（呼应 ng-comp-signals §六）

@HostListener('document:click') 在指令/组件销毁时 Angular **自动**清理事件监听——这是 HostListener 的基本保证。如果仍有泄漏，大概率不是 @HostListener 的问题而是**手动 addEventListener(document, 'click', fn)** 忘了 remove。zoneless + DestroyRef 正确姿势：
```ts
constructor(private destroyRef: DestroyRef) {
  const handler = (e: MouseEvent) => { ... };
  document.addEventListener('click', handler);
  this.destroyRef.onDestroy(() => document.removeEventListener('click', handler));
}
```
最佳实践：**优先用 @HostListener('document:click')**——Angular 管清理；只有需要动态开关监听时才走手动 addEventListener + DestroyRef 模式。

### 11. (A) 指令的 standalone 化意味着什么？旧时代指令通过 NgModule exports 暴露给使用方，standalone 后怎么走？

**来源**：转述自本关 §五 standalone 指令的导出段

standalone 指令 = 指令不再需要 NgModule 做 declarations/exports——它本身就是一个**可导入单元**。使用方：`@Component({ imports: [HighlightDirective, TooltipDirective] })` 里列出来。导出链：组件 imports 了指令→指令可用的选择器在该组件模板里合法。跨库复用：`export { HighlightDirective } from './directives/highlight'`——纯 ES module 导出。旧时代：指令 declarations 在 NgModule 里 → exports 暴露 → 使用方 imports 那个 NgModule → 整模块的导出全部可用（包含不需要的）。standalone 后按需精确引入——bundle tree-shaking 更友好（没用到的指令不会被打包）。

### 12. (C) Angular 指令与 CSS :has() / container query 的关系：有些旧时代需要指令做的外观响应（hover 时子元素变色），现在纯 CSS 能做——指令的『领地』在缩小吗？

**来源**：转述自本关 §二属性指令的 HostBinding class 场景与 CSS 新能力对比

部分缩小但不全。CSS :has() 可以做「父元素含某子元素时变样式」（如 `:has(:focus)` = focus 时变色）、container query 可以做「容器宽度小于 X 时切换布局」——这些以前要写指令监听+HostBinding 现在纯 CSS 搞定。但指令的**不可替代场景**：① 需要 JS 逻辑判断（如 click-outside 要比对 event.target 与宿主元素 DOM 关系）；② 需要创建/销毁视图（结构指令/虚拟滚动）；③ 需要与 signal/DI/服务协作（如注入 HttpClient 做懒加载）。结论：**纯外观触发→CSS 新特性优先、逻辑触发/视图操作→指令**——领地确实在缩小但核心场景不变。

### 13. (D) 给一个 Angular 项目的『指令库』目录设计：core 指令（click-outside/auto-focus/collapse）与 feature 指令（form-field-tooltip/table-virtual-scroll），如何组织 barrel 导出与 tree-shaking 策略？

**来源**：转述自本关 §六-七指令组织与 standalone 导出的工程化应用

```
src/lib/directives/
├─ core/
│  ├─ click-outside.directive.ts
│  ├─ auto-focus.directive.ts
│  ├─ collapse.directive.ts
│  └─ index.ts    // 只 export 本目录
├─ form/
│  ├─ field-tooltip.directive.ts
│  └─ index.ts
├─ table/
│  ├─ virtual-scroll.directive.ts
│  └─ index.ts
└─ public-api.ts  // 唯一对外入口：export * from './core'; ...
```
tree-shaking 策略：standalone 指令天然可摇——只有 imports 数组里出现的指令被打包；**禁止 barrel 里用 `export *`**（会把整个 lib 变成 side-effect 入口影响摇树）——public-api.ts 显式列出每一个导出符号。L7 ng-arch 关会展开 barrel 禁令的完整 lint 规则。

### 14. (A) input.required<boolean>() 在指令里等价于什么？它和旧的 @Input('appUnless') 的别名机制怎么对应？

**来源**：转述自本关 §二 input 与 §三 Unless 指令示例的装饰器对照

旧写法：`@Input('appUnless') condition: boolean`——@Input 参数是模板里绑定的属性名（别名），class 字段名是内部名。新写法：`condition = input.required<boolean>({ alias: 'appUnless' })`——alias 选项指定模板里绑定的名字，class 内用 condition() 读取。required 比旧写法多一个约束：使用方不写 `[appUnless]="expr"` 时 strictTemplates 报错。模板里 `[appUnless]="isLoggedIn()"` 被编译器映射到 alias='appUnless' 的 input.required → 不传就报错。功能等价但类型更强。

### 15. (D) 面试官让你给一个已有的大量使用 *ngIf/*ngFor 的老工程（v15 NgModule 时代）引入自定义结构指令 [appIfVisible] 做过渡动画包装——设计共存策略：新指令与旧 *ngIf 如何混用不冲突？

**来源**：转述自本关 §三结构指令共存冲突的解决（呼应 ng-version-map 过渡期）

策略：① **不拆旧 *ngIf**——在 *ngIf 内部元素上加 [appIfVisible]（属性指令形态做动画，不是结构指令——因为结构指令与 *ngIf 竞争同一 ViewContainerRef）；② 若要新建结构指令 [appIf]，确保它和 *ngIf **不在同一元素**（分两层 `<div *ngIf="cond"><div *appIf="cond2">...</div></div>`）；③ 长期方向：跑 `ng generate @angular/core:control-flow` 把 *ngIf 转 @if（v17+ 工程），@if 不是指令、不与结构指令竞争 ViewContainerRef——[appIfVisible] 可以 @if 块内的任何元素上使用。关键纪律：一个元素最多一个结构指令——混用前先看模板里是否已有星号。
