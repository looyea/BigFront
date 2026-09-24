# ng-comp-signals 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 input()/output()/model()/viewChild() 函数式组件 API、OnPush 在 zoneless 下的角色与 DestroyRef 的题组。

### 1. (A) input.required<string>() 与 input('默认值') 在类型系统层面有什么本质差异？为什么 required 能阻止模板编译错误？

**来源**：转述自本关 §二 input() 代码示例与类型收益段

差异：`input('默认值')` 返回 `InputSignal<string>`（值永远存在因为有兜底），模板使用方可选传——不传时组件内读到默认值；`input.required<string>()` 返回同样是 `InputSignal<string>` 但**类型层面把对应 prop 标记为必传**。strictTemplates 开启时编译器对组件选择器生成一个 TypeScript interface：required input 对应 interface 里的 `age: number`（非 optional）、普通 input 对应 `name?: string`——使用方模板漏传时 interface 不满足→编译报错。这与 React 的 `interface Props { age: number; name?: string }` 思路一样，区别在于 Angular 的类型检查延伸到**模板 HTML** 而非止于 .tsx。

### 2. (A) model() 双向绑定在 zoneless 下是如何实现『子改父 signal 自动更新』的？它和 AngularJS 的 $watch 脏检查双向绑定有什么本质不同？

**来源**：转述自本关 §三 model() 段与 §五 zoneless 的联动

model() 机制：`searchTerm = model('')` 内部同时创建一个 writable signal（子组件侧）+ 一个 output 通道；父组件用 `[(searchTerm)]="parentSignal()"` 绑定时编译器展开为 `[searchTerm]="parentSignal()"` + `(searchTermChange)="parentSignal.set($event)"`——子写 model 时触发 change 事件、事件的 handler 是父 signal 的 .set()。**精确写时通知**，无需脏检查。vs AngularJS $watch：AngularJS 的 ng-model 双向依赖 $digest 循环——每次任何地方改值，$digest 轮询比对所有 watch 表达式旧值与新值；model() 是**写即推、订阅者拉**——没有轮询、没有 $digest、只有 signal set→依赖者重算这一条路径。一句话：从「广播+轮询」到「精确点对点」。

### 3. (B) 同事在组件 constructor 里读了 this.myInput()，期望拿到使用方传进来的值——发现拿到的是默认值而非实际传入值。为什么？应该怎么正确读 input？

**来源**：转述自本关 §二 input 时序与 §六生命周期钩子

原因：input 的值在**模板绑定时**由父组件写入——constructor 执行时组件刚实例化、Angular 还没处理模板绑定（绑定发生在首次变更检测阶段）。所以 constructor 里读 input() 拿到的是初始值（有默认值=默认、required=可能 undefined）。正确做法：① 在 **effect** 里读：`effect(() => { console.log(this.myInput()); })` — 首次稳定后执行且后续变化自动重跑；② 在 **ngOnInit** 里读（此时已过了第一轮绑定）；③ 如果要做「input 变化时的副作用」，用 `toSignal(this.myInputChanges())` 或 effect 的自动依赖追踪。加分延伸：viewChild 同理——constructor 时子元素还不存在。

### 4. (C) Angular 的 viewChild() signal 与 React 的 useRef 在『渲染后才有值』这个时序问题上各自怎么处理？哪个的心智更简单？

**来源**：转述自本关 §四 viewChild() 与 React useRef 对比（呼应 react-refs）

React useRef：`const ref = useRef(null)` 初始是 null，首次 render 后 React 在 commit 阶段把 DOM 节点赋到 `ref.current`——useEffect(() => { /* 这里 ref.current 有值 */ }, []) 是最早的安全读取点。心智模型：ref 是可变容器、effect 里才能确保有值。Angular viewChild()：返回 `Signal<ElementRef|null>`——元素不存在时值自动变 null（配合 @if 条件渲染）；用 `.afterRender` 变体保证「首次渲染后才非 null」。心智更简单的判定：**Angular 的 viewChild signal 是响应式的**——元素出现/消失自动更新，computed 可追踪；React 的 ref 是逃逸盒——不参与渲染流、改了不触发重渲染。所以 Angular 在『元素条件存在』场景更自然：`@if (panel(); as p) { ... }` 模板里就能条件渲染。

### 5. (B) 组件 A 用 input() 接收一个对象 `{name, age}`，父组件改了对象内部属性 `this.user.name = 'new'` 但子组件模板不更新——为什么？给两种修法。

**来源**：转述自本关 §二 input 与 zoneless 变更检测的关系（呼应 ng-signals、sig-mutability）

原因：zoneless 下变更检测靠 signal 写驱动。input 是 ReadonlySignal——父组件需要**重新 set 整个 signal 值**才触发通知；`this.user.name = 'new'` 只改了对象内部属性、没调 signal.set()——子组件的 input signal 值引用没变、订阅者不重算。修法：① 父用 signal + **patch**：`this.user.update(u => ({...u, name: 'new'}))` 或 `this.user.patch({name:'new'})`（v20+ patch API）产生新引用触发通知；② 子用 `input.required<User>()` + 父每次赋值新对象（不可变模式）——配合 OnPush 或 zoneless 的引用比较。一句话教训：signal 通知基于引用变化判断（默认 ===），对象内部突变 invisible。

### 6. (A) DestroyRef 和旧的 ngOnDestroy + unsubscribe() 模式相比，它在 DI 树里的销毁时机是什么？为什么 service 比组件更需要它？

**来源**：转述自本关 §六 DestroyRef 用法段

DestroyRef 的销毁时机：绑在**当前注入器（injector）的销毁时刻**——组件级 provider 绑组件实例销毁、root provider 绑应用销毁。ngOnDestroy 只有组件/指令/管道有；service（@Injectable）没有生命周期钩子——但 service 可能开了 WebSocket/定时器。DestroyRef 让 service 也能注册清理：`inject(DestroyRef).onDestroy(() => ws.close())`。这解决了旧时代 service 订阅 RxJS Observable 后永远不清理（因为是 root 单例所以「永远活着」）的内存泄漏模式——组件销毁时该组件子树里 new 出来的非 root service 被销毁、其 DestroyRef 回调触发。

### 7. (D) 设计一个表单组件：接收 label、value（双向绑定）、error（可选）三个参数——用 model()/input()/input.required() 的 v22 最新 API 写完整代码。

**来源**：转述自本关 §二-三的 API 组合应用

```ts
import { Component, input, model, computed } from '@angular/core';

@Component({
  selector: 'app-field',
  template: `
    <label [for]="id()">{{ label() }}</label>
    <input [id]="id()" [(ngModel)]="value()" (blur)="touched.set(true)" />
    @if (error() && touched()) {
      <span class="error">{{ error() }}</span>
    }
  `,
  // 实际用 Signal Forms 时 ngModel 可省，此处简化示意
})
export class Field {
  label = input.required<string>();         // 必传
  id = input('field-' + Math.random().toString(36).slice(2, 8)); // 可选带默认
  value = model('');                         // 双向——父用 [(value)]
  error = input<string | undefined>(undefined); // 可选
  touched = signal(false);
}
```
使用方：`<app-field label="用户名" [(value)]="username()" [error]="usernameError()" />`
加分：说明 value 用 model() 而非 input()+output() 的原因——双向绑定更短、父 signal 自动同步。

### 8. (C) Vue 3 的 defineProps/defineEmits/defineModel 与 Angular 的 input()/output()/model() 在语法层面几乎一一对应——给一张对应表并说出一处关键机制差异。

**来源**：转述自本关 §二-三与 Vue Composition API 的对照（呼应 vue-composition-api、vue-props-emits）

| 需求 | Angular | Vue 3 |
|------|---------|-------|
| 只读输入 | `input()` | `defineProps<{x: string}>()` |
| 必传输入 | `input.required()` | required prop 或 type 非 optional |
| 输出事件 | `output()` | `defineEmits<{change: [User]}>()` |
| 双向绑定 | `model()` | `defineModel()` (v3.4+) |
| DOM 引用 | `viewChild()` signal | `useTemplateRef()` (v3.5+) |

关键机制差异：Vue 的 props 在运行时是 **shallowReactive**——对象内部突变在子组件能检测到（因为 proxy 拦截 getter）；Angular 的 input() 是 **signal with reference equality**——不突变不通知。所以 Vue 里改 prop 对象内部属性子组件模板能更新（虽然违反单向数据流原则），Angular 里改对象内部不触发——更严格但需要开发者显式产出新引用。

### 9. (B) 把旧组件 @Input() val: string 迁移为 val = input('')，同时模板里 `{{ val }}` 没改成 `{{ val() }}`——strictTemplates 会报什么？为什么不报错？

**来源**：转述自本关 §二 input 返回类型与模板访问方式

strictTemplates 不报错！因为 `{{ val }}` 是合法的——val 是一个 InputSignal<string> 对象、模板插值可以渲染任何 toString() 可调用对象。输出会是 `[object Object]` 或 signal 的内部字符串表示而非 'hello world'。修法：`{{ val() }}`——调用 signal getter 拿到实际 string 值。教训：**迁移 @Input 到 input() 时全局搜索模板里的引用加 ()** 是必做步骤；Angular codemod `ng generate @angular/core:signal-input-migration` 会自动做这一步——别手改。

### 10. (A) viewChild.afterRender() 变体解决了什么时序问题？与旧的 ngAfterViewInit 的关系？

**来源**：转述自本关 §四 .afterRender 注释与旧 @ViewChild 时序对比

旧问题：@ViewChild 在 ngAfterViewInit 前是 undefined——但 ngAfterViewInit 里如果做了条件渲染（*ngIf 让子组件消失再出现），@ViewChild 不会重新查询（它只在初始化时解析一次）。新 viewChild() signal 在子元素出现/消失时自动更新值——但首次渲染时值也是 null（因为 Angular 还没创建子元素）。`.afterRender` 变体 = 「我接受首次 null、渲染完成后自动给我非 null 值」——等价旧 ngAfterViewInit 的时机保证但**不需要手写钩子、后续变化还自动响应**。用法：`panel = viewChild.afterRender<ElementRef>('panel')` 在模板渲染后才有值、effect 里可以安全操作 DOM。

### 11. (D) 面试官让你在一个 Angular 组件里实现「父组件滚动到底部时自动加载更多」——用 viewChild + effect + DestroyRef 组合写核心代码。

**来源**：转述自本关 §四-六的组合应用

```ts
import { Component, viewChild, effect, inject, DestroyRef } from '@angular/core';

@Component({ /* ... */ })
export class ListPage {
  container = viewChild.afterRender<HTMLDivElement>('scrollBox');
  page = signal(1);
  loading = inject(LoadingService);

  constructor(private destroyRef: inject(DestroyRef)) {
    effect(() => {
      const el = this.container(); // Signal 值变化时自动重跑
      if (!el) return;
      const handler = () => {
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
          this.page.update(p => p + 1);
        }
      };
      el.addEventListener('scroll', handler);
      this.destroyRef.onDestroy(() => el.removeEventListener('scroll', handler));
    });
  }
}
```
加分：说明为什么用 effect 而非 ngAfterViewInit——viewChild signal 可能从 null→有值（@if 条件渲染）、effect 自动重新执行；旧 ngAfterViewInit 只跑一次。DestroyRef 保证每次 effect 重跑时旧的 handler 被清理。

### 12. (C) 有人说『OnPush 在 zoneless 下完全没用了』——给一句反驳它的反例场景。

**来源**：转述自本关 §五 OnPush 剩余职责段

反例：组件里有 `@HostListener('window:resize') onResize() { this.width = innerWidth; }` ——window:resize 事件不经过 signal 写，zoneless 下没有 signal 变化→模板不重算。要么用 signal 包（`width = signal(0)` + `this.width.set(innerWidth)`），要么保留 OnPush + 在 handler 里调 `markForCheck()`。另一反例：第三方回调（WebSocket onmessage）写入普通属性而非 signal。结论：zoneless 下**非 signal 驱动的更新仍需手动触发**——OnPush+markForCheck 不是万能但仍是兜底工具；更好的做法是消灭非 signal 突变路径。

### 13. (B) model() 双向绑定在组件内部写 `this.value.set('new')`，但父组件绑的 `[(value)]="parentSignal()"` 发现父 signal 没更新。可能的两种原因。

**来源**：转述自本关 §三 model() 机制段与常见坑

原因一：父组件绑定写成了 `[value]="parentSignal()"` 而没加 `()` 输出监听——只做了单向输入、model 的 change 事件没人接。正确写法是 `[(value)]="parentSignal"` **不带括号**（Angular 编译器自动展开为 input+output 两件事——带括号是手动调用 signal getter 返回纯值、编译器无法识别这是一个可写绑定目标）。原因二：父绑的不是 signal 而是一个普通属性 `[(value)]="plainVar"`——model() 的双向回写需要父侧是可写的（signal 或有 setter），普通属性在 zoneless 下不会触发通知——父侧模板不更新。结论：model() 双向链路的两端都应该是 signal。

### 14. (A) input() 的 transform 选项与旧 @Input setter 做类型转换有什么功能差异？为什么 transform 更适合 zoneless？

**来源**：转述自本关 §二 transform 示例（呼应 sig-mutability 的纯函数观）

功能差异：@Input setter 可以**做副作用**（`set age(v){ this._age = Number(v); this.ageChange.emit(...) }`——setter 里偷偷 emit 事件）；transform 是**纯函数**——只接收原始值返回转换后值，不能写外部状态。为什么 transform 更适合 zoneless：纯函数保证「相同输入→相同输出→无隐藏副作用」——signal 通知链路上不存在突变、computed 的 memo 化假设不会被 setter 副作用打破。旧 setter 的副作用是 zone.js 时代「脏检查总能发现一切」的隐性依赖——zoneless 下 signal 只追踪显式的值变化、setter 的副作用可能丢通知。

### 15. (D) 你被要求给 50 个存量 Angular 组件统一迁移到 input()/output()/model()——设计迁移方案：按什么顺序迁、用 codemod 还是手改、如何保证 PR 不爆、每步验收什么。

**来源**：转述自本关全篇 API 知识在迁移场景的应用（方法论呼应 sig-migrate 三段渐进）

方案四段：① **地基**：工程已 v19+ standalone + strictTemplates 确认——没这前提迁了也没类型收益；② **按层不按页**：先迁 leaf 组件（无子组件依赖它的 Input/Output）、后迁容器——避免同时改上下游；codemod 做批量替换（`ng generate @angular/core:signal-input-prototype-migration` 或社区 angular-signal-input codemod），**副作用型 setter 与复杂 ngOnChanges 排除 codemod 手改**；③ **PR 控制**：每 PR ≤10 组件；模板改动（val→val()）由 codemod 同一 commit 带上——避免「TS 改了模板没改」的 [object Object] 静默 bug（见 Bug 题 q9）；④ **验收**：每步 `ng build`（strictTemplates 过=接口一致）+ 单测跑 `Testbed.createComponent` 检查 Input signal 是否初始化正确 + 视觉回归（Storybook/Chromatic）。关键纪律：**model() 双向迁移放最后**——它改变数据流方向（之前父写子读、现在子可反写父），需要父组件同步改 signal 持有——是牵一发动全身的跨组件变更。
