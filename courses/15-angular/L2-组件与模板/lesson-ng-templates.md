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
<!-- 目的：@if/@else if/@else 新控制流——按 signal 值分支渲染，编译器保留语法，无需导入 CommonModule -->
@if (user()) {                        <!-- user() 读 signal：有登录用户走欢迎分支 -->
  <p>欢迎, {{ user().name }}</p>       <!-- {{ }} 插值：组件→DOM 文本 -->
} @else if (isLoading()) {
  <app-spinner />                     <!-- 加载中：渲染骨架组件 -->
} @else {
  <a routerLink="/login">请先登录</a>  <!-- 兜底分支：都没命中 -->
}
<!-- ✅ user=signal(...)，模板里 user() 一调用即自动订阅，signal 变→仅该块局部重渲染 -->
<!-- ❌ 写成 user（漏掉括号）拿到的是 signal 对象本身，恒为真值→@else 分支永远进不去 -->
```

旧写法对照（v17 前）：
```html
<p *ngIf="user; else loading">...</p>
<ng-template #loading>...</ng-template>
<!-- ❌ 旧年代产物：见到 *ngIf/ng-template 就是 v17 前教程，概念可学但新工程别照抄（要装 CommonModule、可读性差） -->
```
新写法零 ng-template、可读性碾压——迁移命令 `ng generate @angular/core:control-flow` 一键全自动。

### @for/@empty

```html
<!-- 目的：@for/@empty 列表渲染——track 必填，用来标识每一项的同源更新 -->
@for (item of items(); track item.id) {  <!-- items() 读 signal 数组；track item.id 稳定唯一 -->
  <li>{{ item.name }}</li>               <!-- item 是当前项局部变量，直接插值 -->
} @empty {
  <li>暂无数据</li>                        <!-- 数组为空时渲染这一支，替代旧 else emptyTpl -->
}
<!-- ✅ track 返回每个元素稳定唯一 id→增删改只 patch 变动的节点 -->
<!-- ❌ 漏写 track 子句→编译器直接报错；track 写成 index→插入/删除时整列表错位重排 -->
```

**track 是必填**——它告诉 Angular 如何识别同一项（类似 React key、Vue :key）；不写 track 编译器直接报错。track 表达式应返回稳定唯一值（item.id 或 item 本身若是 primitive）。@empty 替代了旧的 `*ngFor ... else emptyTpl` 样板。

### @switch/@case/@default

```html
<!-- 目的：@switch/@case/@default 多值分支——比 @if 链更紧凑，命中即止 -->
@switch (connectionStatus()) {
  @case ('online')  { <span class="green">Online</span> }  <!-- 精确匹配 'online' -->
  @case ('poor')    { <span class="yellow">Poor</span> }   <!-- 匹配 'poor' -->
  @default          { <span class="red">Offline</span> }    <!-- 兜底：其余状态 -->
}
<!-- ✅ 适合有限枚举值（连接状态/订单态），一目了然 -->
<!-- ❌ 拿 @switch 做区间判断（如 score>90）——@switch 只支持等值匹配，区间该用 @if -->
```

等价 Vue v-if/v-else-if 链或 Svelte `{#if}`；旧 Angular 用 ngSwitch/ngSwitchCase 指令——语法糖级改进。

### @defer：延迟加载块（v17 新、v20+ 扩展触发器）

```html
<!-- 目的：@defer 延迟加载块——触发条件满足前，块内组件不实例化，Angular 原生 code splitting -->
@defer (on viewport; prefetch on idle) {  <!-- 进入视口才渲染；空闲时预取，兼顾首屏与体验 -->
  <app-heavy-chart />                      <!-- 重组件：延迟到真正要用时才加载 -->
} @loading (after 100ms; minimum 1s) {     <!-- 加载态：超 100ms 才显、至少显 1s 防闪烁 -->
  <app-skeleton />
} @error {
  <p>加载失败</p>                            <!-- 加载出错兜底 -->
} @placeholder {
  <div style="height:400px"></div>          <!-- 占位块：预留高度防布局抖动 CLS -->
}
<!-- ✅ 页内重块（图表/富文本）用 @defer 切小，与路由级懒加载互补 -->
<!-- ❌ 对首屏关键内容也 @defer→白屏等触发→反而拖慢 LCP，核心视图别延迟 -->
```

@defer 让块内组件**延迟实例化**直到触发条件满足（视口进入/空闲/定时器/交互）——这是 Angular 的原生 code splitting 方案，与路由级懒加载互补：路由切大块、@defer 切页内小块。四个伴生块（@loading/@error/@placeholder）各有独立触发器参数——旧世界没有等价物（最接近的是 React.lazy + Suspense）。

## 三、#模板引用变量与 @let：模板里的『局部作用域』

**# 引用变量**：给 DOM 元素或指令实例起个别名，后续绑定直接用：

```html
<!-- 目的：# 引用变量——给 DOM 元素/指令实例起别名，后续绑定直接取用，不经组件 class -->
<input #emailRef type="email" />                        <!-- #emailRef 指向这个 input 元素 -->
<button (click)="send(emailRef.value)">发送</button>      <!-- (click) DOM→组件；emailRef.value 直接读输入框当前值 -->
<!-- ✅ 模板内取 DOM 值无需 @ViewChild 声明，轻量直接 -->
<!-- ❌ 把 emailRef 当字符串写 send('emailRef.value')→传的是字面量而非元素，取不到值 -->
```

emailRef 在模板上下文里等价于 `HTMLElement`（若绑到组件上则是组件实例）。旧 ng-template 的 #tpl 也属于这一族——@if 之后 ng-template 使用大幅减少。

**@let 模板变量**（v18.1+）：在模板里声明局部派生值：

```html
<!-- 目的：@let 模板局部派生值（v18.1+）——纯模板作用域，不进组件 class、不需 signal -->
@let total = price() * quantity();   <!-- 每次渲染/迭代就地重算，price/quantity 为组件 signal -->
<span>{{ total | currency }}</span>  <!-- | currency 管道格式化，见 §五 -->
<!-- ✅ 模板里一次算多次用的派生值，用 @let 避免重复表达式 -->
<!-- ❌ @let 声明后想用同名变量在组件 TS 里访问→模板作用域隔离，class 里根本看不到 -->
```

@let 是纯模板作用域——不进组件 class、不需要 signal；每次条件/循环迭代重新求值。等价：Vue v-slot 的参数解构、JSX 的 const 内联。

## 四、Content Projection：Angular 的 slot

组件模板里用 `<ng-content select=".header">` 声明一个投影口；使用方写：

```html
<!-- 目的：content projection——使用方把内容塞进组件 <ng-content select> 声明的投影口 -->
<app-card>
  <div class="header">标题</div>  <!-- 匹配组件里 <ng-content select=".header"> 那个槽 -->
  <p>正文</p>                     <!-- 无 select 匹配→落进默认 <ng-content> -->
</app-card>
<!-- ✅ 多槽投影用 select 按类/标签/属性分流，心智同 Web Components 的 <slot> -->
<!-- ❌ 组件没写 <ng-content> 却往里塞内容→Angular 直接丢弃，页面上看不到 -->
```

header 进入 select 匹配的槽、其余进入默认 `<ng-content>`。心智与 Web Components 的 `<slot>` 一致——区别只在 Angular 的 ng-content 支持 select（属性/标签/类选择器匹配）和 multiple 属性（允许同 select 多实例）。

进阶：`<ng-content>` 外面包 @if 可以**条件投影**（v17+ 合法）；多槽投影（multi-slot）在复杂布局组件里常见。对照：React 的 children 是单入口（要分槽得 props 拆三字段）；Vue 的 slot 最接近 Angular。

## 五、pipes：模板里的纯函数格式化管道

```html
<!-- 目的：pipes——模板里的纯函数格式化，一等公民：可传参(:)、可链式(| a | b) -->
{{ birthday | date:'yyyy-MM-dd' }}                      <!-- date 管道，: 后传格式参 -->
{{ price | currency:'CNY':'symbol':'1.2-2' }}           <!-- currency 三段参：币种/显示/小数位 -->
{{ list | json }}                                       <!-- json 管道：对象序列化便于调试 -->
<!-- ✅ 管道必须纯函数：输入同则输出同，变更检测才能安全复用缓存结果 -->
<!-- ❌ 在 pipe 里改数据或发请求→非纯副作用→每次 CD 都重跑，引发性能与竞态问题 -->
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
