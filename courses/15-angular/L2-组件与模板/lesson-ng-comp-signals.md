# ng-comp-signals：组件 API 的 signals 时代——input()/output()/model()/viewChild()

> 目标：把组件对外接口从『装饰器标注』升级到『信号函数声明』——input()/output()/model() 的类型收益、viewChild()/contentChild() 把 DOM 查询变成 signal、OnPush 在 zoneless 下的剩余职责、生命周期钩子与 DestroyRef 的正确退出姿势（呼应 ng-signals、ng-templates、za-core）

## 一、旧 API 的痛：@Input/@Output 装饰器的四宗罪

```ts
@Input() name: string = '';           // ① 类型与默认值分两处写
@Input() age!: number;                // ② required 靠 ! 断言——编译器不检查使用方是否传了
@Output() change = new EventEmitter<User>();  // ③ 泛型在 EventEmitter<> 里、emit 不受约束
@ViewChild('panel') panel!: ElementRef;       // ④ 感叹号非空断言——ngOnInit 时可能 undefined
```

四宗罪总结：**类型表达靠人肉纪律而非编译器强制**。v18+ 的信号函数 API 逐条治它们。

## 二、input()：信号式输入声明

```ts
import { input } from '@angular/core';

// 有默认值 → 类型自动推断为 string
name = input('默认名');

// required → 使用方不传时模板编译直接报错
age = input.required<number>();

// 带 transform 函数（旧 @Input setter 的替代）
priority = input(0, { transform: (v: string | number) => Number(v) });

// 别名（selector 里属性名与类字段名不同时）
userName = input('', { alias: 'userName' });
```

**类型收益**：
- `name()` 的返回类型是 ReadonlySignal<string>——模板里只读、class 里也不能 `.set()`（input 对外只读是设计约束）；
- required 让使用方模板 `<app-user>` 不传 age 时 strictTemplates 报错——不需要运行时验证；
- 不再有 `!` 非空断言的「骗编译器」行为。

**与 Vue props / React props 对比**：Vue `defineProps<{age: number}>()` 也有类型推断但没有「required 不传编译报错」的模板级强制；React props 类型靠 TS interface 约束但无编译期模板检查。Angular 把类型检查边界扩到了模板。

## 三、output() 与 model()：信号式事件与双向

```ts
import { output, model } from '@angular/core';

// 单向输出（取代 @Output + EventEmitter）
change = output<User>();

// 使用方：(change)="onChange($event)"——$event 类型自动是 User

// 双向绑定（v18.1+）
searchTerm = model('');  // 等价于一个 input + 一个同名 output 的组合
```

使用方：
```html
<app-search [(searchTerm)]="mySearchSignal()" />
```

**model() 的便利**：旧写法要 `@Input() val: string` + `@Output() valChange = new EventEmitter<string>()`，使用方手写 `[val]="x" (valChange)="x=$event"`；model() 一处声明、双向自动同步，且 **父传子时如果父用的是 signal，子写 model 会自动回写父 signal**——zoneless 下这就是唯一的双向路径。

旧 EventEmitter 没删但仍可用——迁移策略与新项目首选 output()/model() 并行。

## 四、viewChild()/contentChild()：DOM 查询变成信号

```ts
import { viewChild, contentChild, signal } from '@angular/core';

// 查询视图里的子组件/DOM 元素——返回 Signal<ElementRef|null>
panel = viewChild<ElementRef>('panel');        // 模板里 #panel
chart = viewChild.afterRender(ChartComponent); // 渲染后安全获取

// 查询投影进来的内容
headerEl = contentChild('[header]');

// 取多个
items = viewChild.required(ItemComponent);     // required → 非 null 类型
```

模板写法：
```html
<div #panel class="my-panel">内容</div>
```

**为什么这是革命**：旧 @ViewChild 在 ngAfterViewInit 才有值（之前是 undefined），且变化后不会自动更新；新 viewChild() 是 **signal**——子组件出现/消失时信号值自动变、computed 能响应式追踪。配合 @if 条件渲染不再需要手动重取引用。

`.afterRender` 变体（v18.1+）解决「模板渲染后才真正有值」的时序问题，替代了旧 ngAfterViewInit 的手工调度。

## 五、OnPush 在 zoneless 下还剩什么职责

旧时代（zone.js）：
- Default 策略：任何异步事件→zone 通知→整棵子树脏检查；
- OnPush：只有① @Input 引用变化 ② 内部事件 ③ markForCheck 冒泡时才检查——手动优化。

zoneless 时代（v21+ 默认）：
- 变更检测**完全由 signal 写驱动**——signal 变→订阅者（模板绑定）精确重算；
- OnPush 的「限制检查范围」职责被 signal 的天然精确性取代——**不写 OnPush，zoneless 默认行为就是只重算受影响的绑定**。

剩余职责：
- **存量 zone.js 工程**（v20 及以前）仍需 OnPush 做性能优化；
- **非 signal 的普通属性修改**仍可能不触发更新——如果你用 `this.data = [...]` 而非 `this.data.set([...])`，zoneless 不知道数据变了——此时 OnPush+markForCheck 或改用 signal 是唯一修法；
- **显式控制渲染边界**的团队规范——即使技术上不需要，保留 OnPush 作为「这个组件只通过 input/signal 驱动」的文档性约束。

一句话：**zoneless 让 OnPush 从『性能必需品』降级为『可选纪律』**。

## 六、生命周期钩子与 DestroyRef

Angular 组件生命周期（v22 主流顺序）：

```
ngOnInit → ngDoCheck → AfterContentInit → AfterContentChecked → AfterViewInit → AfterViewChecked → ngOnDestroy
```

信号时代的**替代姿势**：

| 旧钩子 | 新选择 | 场景 |
|--------|--------|------|
| ngOnInit 里订阅数据 | `effect()` 自动追踪 signal 依赖 | 数据驱动副作用 |
| ngOnDestroy 取消订阅 | **DestroyRef.onDestroy()** 或 signal 自动退订 | 资源清理 |
| ngOnChanges 响应输入变化 | `effect(() => { watch(this.myInput()) })` | 派生副作用 |

DestroyRef 用法（取代手写 unsubscribe）：
```ts
import { DestroyRef, inject } from '@angular/core';

export class MyComp {
  private destroyRef = inject(DestroyRef);

  constructor() {
    const interval = setInterval(() => tick(), 1000);
    this.destroyRef.onDestroy(() => clearInterval(interval));
    // 组件销毁时自动清——不依赖 ngOnDestroy 手动写
  }
}
```

为什么用 DestroyRef 而非 ngOnDestroy：① **service 也能用**（service 没有 ngOnDestroy 接口但可注入 DestroyRef——跟随 provider 作用域销毁）；② 在 constructor 或 effect 里就近注册清理逻辑（代码不散落）；③ zoneless 下 RxJS 手动 subscribe 的场景减少但仍有（HttpClient 返回 Observable），DestroyRef 是统一退出口。

## 七、组件 API 完整示例：一个可复用的分页器

```ts
import { Component, input, output, computed, signal } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `
    <nav>
      @for (page of pages(); track page) {
        <button [class.active]="page === current()"
                (click)="goTo(page)">{{ page }}</button>
      }
    </nav>
  `,
})
export class Pagination {
  total = input.required<number>();     // 总条数
  perPage = input(10);                  // 每页条数，默认 10
  current = input(1);                   // 当前页

  pageChange = output<number>();        // 翻页事件

  pages = computed(() =>
    Array.from({ length: Math.ceil(this.total() / this.perPage()) },
      (_, i) => i + 1));

  goTo(p: number) {
    this.current.set(p);                // 注意：input 不可 set——这里只是示意
    this.pageChange.emit(p);            // 正确：通过 output 通知父组件
  }
}
```
使用方：`<app-pagination [total]="users.length()" [(current)]="page" (pageChange)="loadPage($event)" />`

> 🚀 下一关：自定义指令——当复用逻辑不引入新 UI 时，用 @Directive 附着到宿主元素。@for 的 track 与结构型指令的关系、注入 TemplateRef/ViewContainerRef 的机制，都在下一课。
