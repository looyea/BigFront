# ng-comp-signals：组件 API 的 signals 时代——input()/output()/model()/viewChild()

> 目标：把组件对外接口从『装饰器标注』升级到『信号函数声明』——input()/output()/model() 的类型收益、viewChild()/contentChild() 把 DOM 查询变成 signal、OnPush 在 zoneless 下的剩余职责、生命周期钩子与 DestroyRef 的正确退出姿势（呼应 ng-signals、ng-templates、za-core）

## 一、旧 API 的痛：@Input/@Output 装饰器的四宗罪

```ts
// 目的：旧装饰器 API 的四宗罪（反面案例—v18+ 信号函数 API 逐条治它们）
@Input() name: string = '';           // ① 类型与默认值分两处写
@Input() age!: number;                // ② required 靠 ! 断言——编译器不检查使用方是否传了
@Output() change = new EventEmitter<User>();  // ③ 泛型在 EventEmitter<> 里、emit 不受约束
@ViewChild('panel') panel!: ElementRef;       // ④ 感叹号非空断言——ngOnInit 时可能 undefined
// ❌ 以上四行就是待治理的旧写法：类型/required/emit 约束/非空断言全靠人肉纪律而非编译器
```

四宗罪总结：**类型表达靠人肉纪律而非编译器强制**。v18+ 的信号函数 API 逐条治它们。

## 二、input()：信号式输入声明

```ts
// 目的：input() 信号式输入声明——类型自动推断、required 模板级强制
import { input } from '@angular/core';

// 有默认值 → 类型自动推断为 string
name = input('默认名');                    // 返回 ReadonlySignal<string>，用 name() 读

// required → 使用方不传时模板编译直接报错
age = input.required<number>();            // 无默认值、必须传，否则 strictTemplates 报错

// 带 transform 函数（旧 @Input setter 的替代）
priority = input(0, { transform: (v: string | number) => Number(v) });  // 传入时自动 Number 转换

// 别名（selector 里属性名与类字段名不同时）
userName = input('', { alias: 'userName' });  // 模板上写的属性名用 alias
// ✅ required input 使用方不传→编译报错，把运行时校验前移到编译期
// ❌ 对 input() 返回值调用 .set()→input 对外只读是设计约束→编译期直接报错
```

**类型收益**：
- `name()` 的返回类型是 ReadonlySignal<string>——模板里只读、class 里也不能 `.set()`（input 对外只读是设计约束）；
- required 让使用方模板 `<app-user>` 不传 age 时 strictTemplates 报错——不需要运行时验证；
- 不再有 `!` 非空断言的「骗编译器」行为。

**与 Vue props / React props 对比**：Vue `defineProps<{age: number}>()` 也有类型推断但没有「required 不传编译报错」的模板级强制；React props 类型靠 TS interface 约束但无编译期模板检查。Angular 把类型检查边界扩到了模板。

## 三、output() 与 model()：信号式事件与双向

```ts
// 目的：output() 单向事件 + model() 双向绑定（v18.1+）
import { output, model } from '@angular/core';

// 单向输出（取代 @Output + EventEmitter）
change = output<User>();        // $event 类型自动是 User，emit 受泛型约束

// 使用方：(change)="onChange($event)"——$event 类型自动是 User

// 双向绑定（v18.1+）
searchTerm = model('');  // 等价于一个 input + 一个同名 output 的组合
// ✅ output<User>() 把事件载荷类型钉死，忘了传参/传错型编译期报
// ❌ 父侧传普通值而非 signal 给 model→子写 model 无法回写→双向断链
```

使用方：
```html
<!-- 目的：model() 双向使用方——香蕉括号 [( )] 一个符号把 input+output 合一 -->
<app-search [(searchTerm)]="mySearchSignal()" />   <!-- 父侧必须传 signal，子改才能回写 -->
<!-- ✅ [( )] 双向：mySearchSignal 为 signal 时，子组件写 searchTerm 自动回写父 signal -->
<!-- ❌ 写成 [searchTerm]（只方括号）→只单向传入，子组件的改动传不回父 -->
```

**model() 的便利**：旧写法要 `@Input() val: string` + `@Output() valChange = new EventEmitter<string>()`，使用方手写 `[val]="x" (valChange)="x=$event"`；model() 一处声明、双向自动同步，且 **父传子时如果父用的是 signal，子写 model 会自动回写父 signal**——zoneless 下这就是唯一的双向路径。

旧 EventEmitter 没删但仍可用——迁移策略与新项目首选 output()/model() 并行。

## 四、viewChild()/contentChild()：DOM 查询变成信号

```ts
// 目的：viewChild()/contentChild()——把 DOM 查询变成 signal，元素增删自动更新
import { viewChild, contentChild, signal } from '@angular/core';

// 查询视图里的子组件/DOM 元素——返回 Signal<ElementRef|null>
panel = viewChild<ElementRef>('panel');        // 模板里 #panel，名字不一致就永远查不到
chart = viewChild.afterRender(ChartComponent); // 渲染后安全获取，避开时序坑

// 查询投影进来的内容
headerEl = contentChild('[header]');           // contentChild 查 ng-content 投影进来的节点

// 取多个
items = viewChild.required(ItemComponent);     // required → 非 null 类型
// ✅ viewChild 是 signal——子元素出现/消失时值自动变，computed 能追踪
// ❌ viewChild.required 用于会被 @if 移除的元素→元素消失时该 signal 拿不到非 null→运行时报错
```

模板写法：
```html
<!-- 目的：#panel 模板引用变量——供 viewChild('panel') 按名查取 -->
<div #panel class="my-panel">内容</div>   <!-- #panel 名字与组件里 viewChild('panel') 必须一致 -->
<!-- ✅ 名字对得上→panel() signal 拿到这个 div 的 ElementRef -->
<!-- ❌ viewChild 里写的字符串与模板 #panel 名不一致→查不到，signal 恒为 null -->
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
// 目的：DestroyRef——取代手写 unsubscribe，组件/服务销毁时自动清资源
import { DestroyRef, inject } from '@angular/core';

export class MyComp {
  private destroyRef = inject(DestroyRef);      // 注入销毁作用域句柄

  constructor() {
    const interval = setInterval(() => tick(), 1000);   // 开了个定时器（外部资源）
    this.destroyRef.onDestroy(() => clearInterval(interval));  // 就近注册清理→销毁时自动 clearInterval
    // 组件销毁时自动清——不依赖 ngOnDestroy 手动写
  }
}
// ✅ onDestroy 回调跟资源同处注册，service 也能用（跟 provider 作用域销毁）
// ❌ 不注册 onDestroy 就走→组件销毁后 setInterval 仍在跑→内存泄漏与向已销毁视图写数据
```

为什么用 DestroyRef 而非 ngOnDestroy：① **service 也能用**（service 没有 ngOnDestroy 接口但可注入 DestroyRef——跟随 provider 作用域销毁）；② 在 constructor 或 effect 里就近注册清理逻辑（代码不散落）；③ zoneless 下 RxJS 手动 subscribe 的场景减少但仍有（HttpClient 返回 Observable），DestroyRef 是统一退出口。

## 七、组件 API 完整示例：一个可复用的分页器

```ts
// 目的：组件 API 完整示例——input/computed/output 齐活的纯信号分页器
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
  total = input.required<number>();     // 总条数（必传）
  perPage = input(10);                  // 每页条数，默认 10
  current = input(1);                   // 当前页

  pageChange = output<number>();        // 翻页事件（向父报告）

  pages = computed(() =>                // 派生页码数组：随 total/perPage 自动重算
    Array.from({ length: Math.ceil(this.total() / this.perPage()) },
      (_, i) => i + 1));

  goTo(p: number) {
    this.current.set(p);                // 注意：input 不可 set——这里只是示意错误写法
    this.pageChange.emit(p);            // 正确：通过 output 通知父组件去改 current
  }
}
// ✅ pages() 是 computed，依赖 total()/perPage()，任一变化自动重算页数并刷新 @for
// ❌ goTo 里 this.current.set(p) 想直写 input→input 只读会报错；正解是 pageChange.emit(p) 让父改 current
```
使用方：`<app-pagination [total]="users.length()" [(current)]="page" (pageChange)="loadPage($event)" />`

> 🚀 下一关：自定义指令——当复用逻辑不引入新 UI 时，用 @Directive 附着到宿主元素。@for 的 track 与结构型指令的关系、注入 TemplateRef/ViewContainerRef 的机制，都在下一课。
