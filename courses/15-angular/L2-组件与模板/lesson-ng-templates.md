# ng-templates：模板与绑定——插值、属性、事件、双向与新控制流

> 目标：把 Angular 模板从『HTML 加了几个星号』的旧印象升级为『类型安全的声明式视图 DSL』——四种绑定 + 四种新控制流 + 模板引用变量 + @let + content projection 一次建完骨架；与 Vue 模板/React JSX/Svelte 标签三家做横向辨认（呼应 vue-template-syntax、react-jsx、svelte-template）

## 一、四种绑定：一张表看懂方向与语法

Angular 模板的**所有**数据流动都通过四种绑定符号完成——方向与记号一一对应，没有例外：

| 类型 | 语法 | 方向 | 典型场景 | 等价概念（跨框架） |
|------|------|------|----------|-------------------|
| 插值 | `{{ expr }}` | 组件→DOM（文本） | `<p>{{ title }}</p>` | Vue `{{ }}`、JSX `{}`|
| 属性绑定 | `[prop]="expr"` | 组件→DOM（属性） | `<img [src]="url">` | Vue `:src`、JSX `src={}` |
| 事件绑定 | `(event)="handler"` | DOM→组件 | `<button (click)="save()">` | Vue `@click`、JSX `onClick={}` |
| 双向绑定 | `[(ngModel)]="val"` 或 `[(val)]` | 双向 | `<input [(ngModel)]="name">` | Vue `v-model`、React 手写 |

记忆口诀：**方括号进、圆括号出、香蕉在中间（双向）**。`[()]` 看起来像香蕉——Angular 社区管双向绑定叫 "banana in a box"。

注意：v17.2+ 的 `model()` 函数式 API 让双向变成 `[(val)]` 而不必导入 FormsModule——旧写法 `[(ngModel)]` 在 zoneless 新代码里逐渐减少，但表单关（L5）仍会遇到。

## 二、@if/@for/@switch/@defer：新控制流四件套

v17 引入的**内建控制流**（built-in control flow）不再是指令（directive），而是**编译器保留语法**——和 if/for 在 JS 里的地位一样。好处：不需要导入 CommonModule、编译器可以专门优化、模板可读性提升。

### @if/@else if/@else

```html
@if (user()) {
  <p>欢迎, {{ user().name }}</p>
} @else if (isLoading()) {
  <app-spinner />
} @else {
  <a routerLink="/login">请先登录</a>
}
```

旧写法对照（v17 前）：
```html
<p *ngIf="user; else loading">...</p>
<ng-template #loading>...</ng-template>
```
新写法零 ng-template、可读性碾压——迁移命令 `ng generate @angular/core:control-flow` 一键全自动。

### @for/@empty

```html
@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>暂无数据</li>
}
```

**track 是必填**——它告诉 Angular 如何识别同一项（类似 React key、Vue :key）；不写 track 编译器直接报错。track 表达式应返回稳定唯一值（item.id 或 item 本身若是 primitive）。@empty 替代了旧的 `*ngFor ... else emptyTpl` 样板。

### @switch/@case/@default

```html
@switch (connectionStatus()) {
  @case ('online')  { <span class="green">Online</span> }
  @case ('poor')    { <span class="yellow">Poor</span> }
  @default          { <span class="red">Offline</span> }
}
```

等价 Vue v-if/v-else-if 链或 Svelte `{#if}`；旧 Angular 用 ngSwitch/ngSwitchCase 指令——语法糖级改进。

### @defer：延迟加载块（v17 新、v20+ 扩展触发器）

```html
@defer (on viewport; prefetch on idle) {
  <app-heavy-chart />
} @loading (after 100ms; minimum 1s) {
  <app-skeleton />
} @error {
  <p>加载失败</p>
} @placeholder {
  <div style="height:400px"></div>
}
```

@defer 让块内组件**延迟实例化**直到触发条件满足（视口进入/空闲/定时器/交互）——这是 Angular 的原生 code splitting 方案，与路由级懒加载互补：路由切大块、@defer 切页内小块。四个伴生块（@loading/@error/@placeholder）各有独立触发器参数——旧世界没有等价物（最接近的是 React.lazy + Suspense）。

## 三、#模板引用变量与 @let：模板里的『局部作用域』

**# 引用变量**：给 DOM 元素或指令实例起个别名，后续绑定直接用：

```html
<input #emailRef type="email" />
<button (click)="send(emailRef.value)">发送</button>
```

emailRef 在模板上下文里等价于 `HTMLElement`（若绑到组件上则是组件实例）。旧 ng-template 的 #tpl 也属于这一族——@if 之后 ng-template 使用大幅减少。

**@let 模板变量**（v18.1+）：在模板里声明局部派生值：

```html
@let total = price() * quantity();
<span>{{ total | currency }}</span>
```

@let 是纯模板作用域——不进组件 class、不需要 signal；每次条件/循环迭代重新求值。等价：Vue v-slot 的参数解构、JSX 的 const 内联。

## 四、Content Projection：Angular 的 slot

组件模板里用 `<ng-content select=".header">` 声明一个投影口；使用方写：

```html
<app-card>
  <div class="header">标题</div>
  <p>正文</p>
</app-card>
```

header 进入 select 匹配的槽、其余进入默认 `<ng-content>`。心智与 Web Components 的 `<slot>` 一致——区别只在 Angular 的 ng-content 支持 select（属性/标签/类选择器匹配）和 multiple 属性（允许同 select 多实例）。

进阶：`<ng-content>` 外面包 @if 可以**条件投影**（v17+ 合法）；多槽投影（multi-slot）在复杂布局组件里常见。对照：React 的 children 是单入口（要分槽得 props 拆三字段）；Vue 的 slot 最接近 Angular。

## 五、pipes：模板里的纯函数格式化管道

```html
{{ birthday | date:'yyyy-MM-dd' }}
{{ price | currency:'CNY':'symbol':'1.2-2' }}
{{ list | json }}
```

pipe 等价 Vue 的 filters（已废弃→computed）或 React 的函数调用 `formatDate(birthday)`——但 Angular pipe 在模板语法里是**一等公民**：可传参（`:` 后）、可链式（`| a | b`）、strictTemplates 检查其类型。自定义 pipe 的创建是 `@Pipe({name:'exponential'})` + implements PipeTransform——L3 DI 关会讲到 pipe 如何注入服务。

## 六、与三家的横向辨认速查

| 需求 | Angular | Vue | React | Svelte 5 |
|------|---------|-----|-------|----------|
| 条件 | `@if (expr)` | `v-if` | `expr && <>` / 三元 | `{#if expr}` |
| 列表 | `@for (x of xs(); track x.id)` | `v-for="x in xs" :key` | `xs.map(...)` + key | `{#each xs as x (x.id)}` |
| 双向 | `[(ngModel)]` / `[(val)]` | `v-model` | 手写 value+onChange | `bind:prop` |
| 插槽 | `<ng-content>` | `<slot>`/`<slot name>` | `props.children`/`props.header` | `<svelte:fragment>` |
| 格式化 | `| date` pipe | 自定义 directive / computed | 函数调用 | 函数调用 或 `{@render}` |

共同趋势：四家都在**收敛到声明式控制流 + 编译期优化**——Angular @if 与 Svelte {#if} 几乎同形态（2024-2025 的趋同现象），React 靠编译器（React Compiler）补 memo 化，Vue 靠模板编译器优化 patchFlag——14 包『合流趋势』在模板层的新证据。

> 🚀 下一关：组件 API 的 signals 时代——`input()`/`output()`/`model()`/`viewChild()` 取代装饰器的完整写法与类型收益。把本关的 `@for` track 与下关的 signal 自动订阅连起来看，就是 Angular 响应式模板的全貌。
