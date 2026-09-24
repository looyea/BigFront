# ng-templates 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Angular 模板四种绑定、新控制流、模板变量与 content projection 的题组。

### 1. (A) @if 新控制流与旧 *ngIf 在**编译产物**层面有什么本质区别？为什么这个区别能带来性能收益？

**来源**：转述自本关 §二控制流四件套与迁移理由段

旧 *ngIf 是一条**结构型指令**（Structural Directive）——编译产物是 NgIf 类的实例化 + ViewContainerRef.createEmbeddedView(ng-template)：运行时每次条件变化都要走指令的 ngOnChanges→判断→创建/销毁嵌入视图。新 @if 是**编译器保留语法**——Angular 编译器直接把它编译成模板函数里的 if/else 分支代码（类似手写的 `_t1.if(cond, tplA, tplB)`），不经过指令实例化、没有 ngOnChanges 开销、没有额外注入上下文。收益：少一次 DI 解析、少一层抽象调用、模板类型检查更精确（编译器知道两个分支的局部变量类型）。一句话定性：旧控制流跑在框架指令层、新控制流跑在编译器 IR 层——把框架开销下沉给编译器吃。

### 2. (A) @for 的 track 表达式为什么是**必填**而不是可选？如果 track 写错（如用数组 index）会引发什么问题？

**来源**：转述自本关 §二 @for/@empty 代码注释（track 是性能命门）

必填原因：Angular 的 @for diff 算法用 track 返回值识别「同一项」以复用 DOM 节点——没有 track 就没有稳定身份、diff 退化为「全删重建」，列表越长性能越炸。index 做 track 的经典问题：列表中间插入/删除项时 index 全部错位→diff 认为所有项都变了→全量重建 DOM→动画丢失+输入框焦点丢失+性能断崖。正确做法：`track item.id`（唯一稳定业务标识）；若列表项是 primitive 且无 id 用 `track $index`（仅限列表永不重排）。对比 React 的 key 可省略（dev warning 但不阻断）——Angular 直接在编译器层面强制，不给「忘了写」的机会——强约定又一例。

### 3. (B) 模板里写 `<div [hidden]="!showPanel">` 与 `@if (showPanel) { <div>...</div> }`——两种做法有什么行为差异？什么时候该选哪种？

**来源**：转述自本关 §一属性绑定与 §二 @if 的决策对比

差异：[hidden] 设 CSS display:none——**DOM 节点始终存在**、组件实例已创建、生命周期钩子已执行、事件监听仍在；@if 条件为 false 时**整个节点不渲染**——组件不实例化、ngOnInit 不触发、内存不占。选择判据：① 内容含重型子组件（图表/表格）且大部分时间不显示 → @if（省创建开销）；② 内容轻量且频繁切换 → [hidden]（避免反复创建销毁的开销与动画不连续）；③ 需要保持组件内部状态（如表单填写到一半） → [hidden]。加分延伸：@defer 提供第三种选择「懒但不销毁」——首次进入视口后保留 DOM。

### 4. (C) Angular 的 @defer 与 React.lazy + Suspense 的异同是什么？为什么 @defer 不需要手动包 ErrorBoundary？

**来源**：转述自本关 §二 @defer 四个伴生块与 §六横向辨认表（呼应 react-lazy、next-dynamic）

相同：两者都是**组件级 code splitting + 异步加载**——构建时切 chunk、运行时按需加载、加载期间显示 fallback。不同：① @defer 是模板内联声明（编译期确定切块边界）、React.lazy 是 JS 层 API（动态 import() 在运行时解析）；② @defer 自带四个伴生块（@loading/@error/@placeholder）——错误处理是语法内建的，不需要外部 ErrorBoundary 包裹；React 的 ErrorBoundary 是类组件+手动实现、函数式 React 19 才有 use hook + Suspense 内建 error。③ @defer 触发器丰富（on viewport/idle/timer/interaction/prefetch 可组合）、React.lazy 只有「渲染到时才加载」一种。

### 5. (A) ng-content 的 select 属性匹配的是什么？它与 Web Components 的 slot name 有什么根本区别？

**来源**：转述自本关 §四 content projection 段与 slot 心智对比

ng-content select 匹配**CSS 选择器**（标签名、类、属性）——`select=".header"` 投影 class="header" 的节点、`select="app-toolbar[title]"` 投影带 title 属性的 app-toolbar 元素。Web Components 的 `<slot name="header">` 匹配**子节点的 slot="header" 属性**——只能精确匹配单个属性值、不支持 CSS 选择器语法。根本区别：ng-content 的 select 在**编译时**由 Angular 模板编译器静态分析（不是运行时 DOM 查询）——所以 select 可以写复杂选择器且性能恒定；Web Components 的 slot 是 Shadow DOM 规范定义的运行时分发——只支持 name 精确匹配是刻意的性能取舍。

### 6. (B) 使用 ng-content 做投影时，子节点的生命周期由谁管？父组件（宿主）被销毁时投影内容会发生什么？

**来源**：转述自本关 §四 content projection 的生命周期隐含问题

投影内容的生命周期由**内容持有者（父/宿主组件的模板所有者）**管，不由投影槽所在的子组件管。具体：`<app-card><p>hello</p></app-card>` 里的 `<p>` 属于 app-card 的**使用方**——它在使用方的组件树里被创建、使用方被销毁时它也被销毁，哪怕此时 app-card 的 ng-content 槽还在 DOM 里（反例：app-card 被 @if 条件销毁但使用方没销毁——投影内容不消失只是暂时脱离 DOM，再投影回时恢复）。这是初学者常混淆的点：投影 ≠ 移动所有权。加分：ViewContainerRef 手动创建的 view 才是子组件自己管生命周期。

### 7. (D) 面试官给一段 *ngIf + ng-template + ngSwitch 的旧模板代码，要求 5 分钟内用新语法重写并口述三处性能/可读性收益。写出来。

**来源**：转述自本关 §二新控制流与迁移命令的实际操作版

旧代码示例：
```html
<div *ngIf="role">
  <div [ngSwitch]="role">
    <span *ngSwitchCase="'admin'">管理员</span>
    <span *ngSwitchCase="'editor'">编辑</span>
    <span *ngSwitchDefault>普通用户</span>
  </div>
</div>
<ng-template #elseTpl><p>加载中...</p></ng-template>
```
新语法重写：
```html
@if (role()) {
  @switch (role()) {
    @case ('admin')  { <span>管理员</span> }
    @case ('editor') { <span>编辑</span> }
    @default         { <span>普通用户</span> }
  }
} @else {
  <p>加载中...</p>
}
```
三处收益：① 少 2 个 ng-template 样板（可读性+编译器能推断 else 分支类型）；② 无 NgIf/NgSwitch 指令实例化（性能：少 DI 解析+少 ngOnChanges）；③ @if 块内局部变量 `role()` 可直接调用（strictTemplates 检查它存在）而非上下文隐式变量。

### 8. (C) Angular 的 pipe（`{{ x | date }}`）与 Vue 已废弃的 filter、Svelte 的格式化函数三者对比：为什么 Vue 废弃了 filter 但 Angular 的 pipe 活得很好？

**来源**：转述自本关 §五 pipes 段与 §六横向对比表（呼应 vue-template-syntax、svelte-template）

Vue filter 被废弃是因为：① 纯文本转换不需要模板语法级支持（computed/方法调用一样写）；② filter 不支持异步、链式有性能问题；③ Vue 3 推 Composition API 统一为函数。Angular pipe 活得好的原因：① pipe 是**编译期可分析的一等公民**——strictTemplates 检查 pipe 参数类型、编译器知道 async pipe 返回 Observable 可以自动 subscribe；② async pipe 做**订阅+自动清理**（组件销毁时 unsubscribe）——这不是「格式化」而是「响应式桥」，computed 替代不了；③ 链式组合 `| currency | uppercase` 在模板里比嵌套函数调用 `upper(cur(val))` 可读性更高。核心差异：Vue filter 只是纯格式化糖（可被替代）、Angular pipe 尤其是 async pipe 是响应式模型的一环（不可替代）。

### 9. (A) @defer 的 prefetch on idle 和 on idle 触发有什么区别？@loading 的 after 和 minimum 参数各解决什么问题？

**来源**：转述自本关 §二 @defer 代码段与伴生块参数说明

on idle = 触发**加载+实例化**（浏览器空闲时才下载并渲染 defer 块）；prefetch on idle = 仅**预取资源**（空闲时下载 chunk 但不实例化渲染），后续触发器满足时秒渲染——两者组合：prefetch on idle + on viewport = 空闲时偷偷下好、滚到视口才显示。@loading after 100ms：加载中状态**延迟 100ms 才显示**——解决闪烁（如果加载够快 100ms 内完成则用户看不到 loading）；@loading minimum 1s：一旦显示 loading 则**至少显示 1s**——解决闪退（加载完得太快 loading 一闪而过比不显示更丑）。两个参数合起来是 UX 设计里的「延迟出现+最短驻留」模式。

### 10. (B) 模板里写了 @for 嵌套 @for（外层分类、内层商品），编译器报 "Tracked expressions must be unique"——什么原因？怎么修？

**来源**：转述自本关 §二 @for track 的嵌套使用场景

原因：Angular 编译器要求嵌套 @for 的 track 表达式在全局上下文里可唯一标识一个元素——两层都写 `track item.id` 且 item 变量名冲突（或编译器无法确定作用域）。修法：① 变量名区分：`@for (cat of categories(); track cat.id) { @for (prod of cat.products(); track prod.id) { ... } }`——两层用不同变量名且各自 track 自己那层的唯一 id；② 若 id 可能重复（跨类别）用组合 track：`track cat.id + prod.id`（内层）保证全局唯一。核心原则：track 返回的字符串在**同一渲染帧内**对所有 DOM 节点必须唯一。

### 11. (D) 面试官让你用 Angular 模板实现一个 Tab 组件：有 header slot 区（放标签按钮）和 content slot 区（放当前面板内容）——用 ng-content 多槽设计。写出模板与使用方代码。

**来源**：转述自本关 §四 content projection 的复合应用

Tab 组件模板（tabs.component.html）：
```html
<div class="tab-bar">
  <ng-content select="[tab-header]" />
</div>
<div class="tab-panel">
  <ng-content select="[tab-body]" />
</div>
```
使用方：
```html
<app-tabs>
  <div tab-header>
    <button (click)="activeTab.set(0)">首页</button>
    <button (click)="activeTab.set(1)">设置</button>
  </div>
  <div tab-body>
    @if (activeTab() === 0) { <app-home /> }
    @if (activeTab() === 1) { <app-settings /> }
  </div>
</app-tabs>
```
加分：说明这套属性选择器投影的局限——Tab 数量动态时需要 @for + ng-template 的 TemplateRef 出口（升级为 NG_CONTENT 注入的 QueryList），或者直接用 CDK Tab 组件。

### 12. (C) Angular 的 #template 引用变量与 Vue 的 ref="name" / React 的 useRef 有什么对应关系？三者在模板系统里的定位差异是什么？

**来源**：转述自本关 §三 #引用变量与跨框架 ref 对比（呼应 vue-composition-api、react-refs）

对应：`#emailRef`（Angular）≈ `ref="emailRef"` + getCurrentInstance().refs（Vue Options）或 `const emailRef = ref()` 绑定到模板（Vue Composition）≈ `const emailRef = useRef(null)` + `<input ref={emailRef}>`（React）。定位差异：① Angular # 变量是**模板作用域的隐式声明**——不需要在 class 里写任何东西，编译器自动把 HTMLElement/组件实例绑到该名字；Vue/React 都需要在 script 部分**显式声明一个 ref 变量**再绑到模板。② Angular 里绑到指令（如 NgForm）则 # 变量是**指令实例**而非 DOM——`#f="ngForm"` 拿到的是 NgForm 对象；Vue/React 的 ref 始终指向组件实例或 DOM 元素。③ strictTemplates 会检查 # 变量名是否在当前模板存在——React 的 useRef 拼错只是运行时 undefined。

### 13. (B) @let 声明了一个模板变量，在 @for 循环里每次迭代重新求值——同事误以为它是 signal、在循环里 @let 后又想 .set()，报编译错。解释 @let 的本质与它的更新方式。

**来源**：转述自本关 §三 @let 模板变量段与其定位（不是 signal）

@let 不是 signal，是**编译期展开的模板局部表达式别名**——每次渲染帧经过 @let 语句时，按当前作用域内的值重新计算并赋值给这个别名。你不能对它 .set() 也不能对它赋值——它没有 setter、不是可写变量。如果要每次迭代用不同值，正常：`@for (item of items(); track item.id) { @let fullName = item.first + ' ' + item.last; <span>{{ fullName }}</span> }`——fullName 在每轮迭代自动重算。如果确实需要可写状态（用户编辑），那应该用组件 signal 或 @let 配合 model() 双向绑定。一句话定性：@let 是模板里的 const、不是 state。

### 14. (A) 双向绑定 `[(ngModel)]` 拆开来到底是哪两半？v17+ 的 `model()` API 如何让双向不再需要 FormsModule？

**来源**：转述自本关 §一双向绑定行与 v17.2 model() 的预告（呼应 ng-comp-signals）

拆开：`[(ngModel)]="name"` = `[ngModel]="name" (ngModelChange)="name = $event"`——方括号输入当前值、圆括号监听变化事件回写组件。它依赖 FormsModule 的 NgModel 指令做桥。model() 的新路径：组件里 `val = model('default')` 声明双向信号；使用方写 `[(val)="parentSignal()"` 即可——编译器自动展开为 `[val]` + `(valChange)` 且 valChange 回写 parentSignal（signal 本身可写）。FormsModule 不需要了——因为双向的逻辑内置在信号模型里而非外加的指令里。

### 15. (D) 面试官让你设计一个「可配置数据表格」组件的模板：列数/列头由外部传入、每行内容自定义渲染——用 content projection + TemplateRef + ngTemplateOutlet 组合实现。给出设计思路。

**来源**：转述自本关 §四 content projection 的高阶扩展（TemplateRef/ViewContainer 是 L3 指令关内容，此处考设计思路）

思路：① 父组件传入列定义 `columns: {key, header, cellTpl?: TemplateRef}[]`；② 表格组件模板：`@for (col of columns; track col.key) { <th>{{ col.header }}</th> }`；③ 行渲染：`@for (row of rows; track row.id) { <tr> @for (col of columns; track col.key) { <td> @if (col.cellTpl) { <ng-container [ngTemplateOutlet]="col.cellTpl" [ngTemplateOutletContext]="{row, value: row[col.key]}" /> } @else { {{ row[col.key] }} } </td> } } </tr>`；④ 使用方通过 `<ng-template #customCell let-row="row" let-value="value">` 定义自定义渲染、通过 ViewChildren(TemplateRef) 或直接 input 传入。加分：说清 ngTemplateOutlet 里的 embedded view 生命周期归表格组件管——与 ng-content 的生命周期归使用方不同——两种投影模式的分工。
