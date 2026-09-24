# ng-directives：自定义指令——Angular 的『无组件复用』原语

> 目标：指令（Directive）= 给已有 DOM 元素附加行为的轻量复用单元，不引入新视图、不创建子节点；掌握 @Directive 的 host 绑定、inject(TemplateRef/ViewContainerRef) 造结构指令、指令组合、以及『何时用指令何时用组件』的判断标准（呼应 vue-directives-teleport、svelte-actions、ng-templates）

## 一、指令定位：组件的『瘦身版』

Angular 里 `@Component` 本身就是 `@Directive` 的子类（`class Component extends Directive`）——组件 = 指令 + template。所以：

| | Directive（指令） | Component（组件） |
|---|---|---|
| 有模板 | 无 | 有 |
| 创建 DOM | 不创建，附着在宿主元素上 | 创建自己的视图 |
| 复杂度 | 低（几行到几十行） | 中到很高 |
| 典型用途 | 行为/外观/事件增强 | UI 区块 |

对标其他框架：**Vue 自定义指令**（v-colorPicker/v-click-outside）≈ Angular 属性指令；**Svelte actions**（`use:clickOutside`）≈ Angular host listener 指令；**React hooks**（useIntersection/useClickOutside）≈ Angular 指令要做的事但 React 没有指令概念——它用自定义 hook 替代。

## 二、属性指令：Host 绑定的三种形态

```ts
import { Directive, HostListener, HostBinding, input } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
})
export class HighlightDirective {
  // 用 input() 接收参数
  color = input('yellow');

  // HostBinding：动态设置宿主元素的 class/attr/style
  @HostBinding('style.backgroundColor')
  get bg() { return this.color(); }

  // HostListener：监听宿主元素事件
  @HostListener('mouseenter') onMouseEnter() {
    this.color.set('red');
  }
  @HostListener('mouseleave') onMouseLeave() {
    this.color.set('yellow');
  }
}
```

使用方：`<p appHighlight>鼠标悬停变红</p>`——指令附着在 `<p>` 上、不改变 DOM 结构。

三种 host 交互方式：
1. **@HostListener**（事件→指令方法）：监听宿主 DOM 事件（click/focus/keydown/自定义）；
2. **@HostBinding**（指令值→DOM 属性/类/样式）：把指令状态映射到宿主外观；
3. **inject(ElementRef)**：直接操作 DOM（最后手段——绕过封装、慎用）；或 inject(Renderer2) 做 SSR 安全的 DOM 操作。

## 三、结构指令：TemplateRef + ViewContainerRef 造 @if

v17 前的 *ngIf/*ngFor 就是**结构型指令**——它们不渲染自己，而是**有条件地创建/销毁嵌入视图**。新控制流 @if/@for 变成编译器内建后不再是指令，但**你仍可以自定义结构指令**处理特殊场景。

```ts
import { Directive, input, TemplateRef, ViewContainerRef, effect } from '@angular/core';

@Directive({
  selector: '[appUnless]',
})
export class UnlessDirective {
  condition = input.required<boolean>();
  private tpl = inject(TemplateRef);
  private container = inject(ViewContainerRef);

  constructor() {
    effect(() => {
      if (this.condition()) {
        this.container.clear();       // 条件为 true → 移除视图
      } else {
        if (this.container.length === 0) {
          this.container.createEmbeddedView(this.tpl);  // 为 false → 渲染
        }
      }
    });
  }
}
```

使用方（用 ng-template 包裹内容）：
```html
<ng-template [appUnless]="isLoggedIn()">
  <p>请先登录</p>
</ng-template>
```

核心 API 三件套：
- **TemplateRef**：`<ng-template>` 内容的引用（不立即渲染的模板块）；
- **ViewContainerRef**：宿主元素的视图容器（createEmbeddedView / clear / insert）；
- **effect + signal**：zoneless 下替代旧 ngOnChanges 做响应式控制。

进阶：`createEmbeddedView(tpl, { $implicit: value, context: {...} })`——传入上下文给 ng-template 的 `let-x="key"` 局部变量，与 @for 的 track 类似地控制循环。

## 四、@for 的 track 为什么是性能命门（指令视角深挖）

@for 不再是用户可写的指令，但它的**底层实现**用的是与结构指令相同的 ViewContainerRef 机制：每个循环项对应一个 embedded view。track 的作用是在列表变化时让 diff 算法**匹配新旧项**：匹配到→只更新数据、不销毁重建 DOM；匹配不到→销毁旧 view + 创建新 view（触发 OnInit/OnDestroy、丢失动画状态、丢失 DOM focus）。

track 写错的代价量化：500 行列表、中间插一行——有 track（按 id）→ 1 次 createEmbeddedView + 499 次更新；无 track（index 错位）→ 500 次 createEmbeddedView + 500 次 destroy——**O(n) 退化为 O(2n) DOM 操作**，每帧多渲染几毫秒→列表滚动掉帧。Angular 把 track 做成必填（不写编译报错）是刻意的『强约定防坑』。

## 五、指令的组合与继承

**多指令共宿主**：一个元素可挂多个指令——`<div appHighlight appTooltip="提示" appLazyLoad>`——三个指令各自注入 ElementRef、各自监听事件，**互不干扰**（不像 React HOC 的嵌套地狱）。

**composition（替代继承）**：Angular 不鼓励指令 class 继承（v16 起 lint 规则 warn），推荐组合：
```ts
@Directive({
  selector: '[appFocusable]',
  host: {
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
    '[class.focused]': 'focused()',
  },
})
export class FocusableDirective {
  focused = signal(false);
  onFocus() { this.focused.set(true); }
  onBlur() { this.focused.set(false); }
}
```
`host: {}` 是 @HostListener/@HostBinding 的**对象字面量合并写法**——更适合声明简洁场景、少一层装饰器噪音。

**standalone 指令的导出**：指令与组件一样是 standalone 的——使用方 import { FocusableDirective } from '...' 写进 @Component({ imports: [FocusableDirective] })；无需 NgModule declarations。

## 六、何时用指令、何时用组件：三问决策树

1. **需要新 UI 结构吗？** 是→组件；否→指令。
   - 加 class、绑事件、改属性→指令；画一块面板/表格/弹层→组件。
2. **复用维度是『行为』还是『外观+行为』？** 纯行为→指令；外观+行为→组件。
   - v-click-outside 只做监听→指令；一个 dropdown 有面板+动画+定位→组件。
3. **需要在模板里写 `<>` 标签吗？** 需要自定义标签→组件；附着到已有标签→指令。

边界 case：**需要注入 ViewContainerRef 动态创建视图**——是指令还是组件？答：指令做控制器+组件做视图（动态创建 `ComponentRef<Component>` 插到 ViewContainerRef 里）——这是 CDK Overlay/Menu 的架构模式。

## 七、与 Vue 指令 / Svelte Actions 的横向对比

| 能力 | Angular Directive | Vue Custom Directive | Svelte Action |
|------|-------------------|---------------------|---------------|
| 接收参数 | `input()` / `@Input` | `binding.value` | `action(node, params)` |
| 生命周期 | ngOnInit / DestroyRef | mounted/updated/unmounted | action 返回 `{update, destroy}` |
| 操作 DOM | ElementRef / Renderer2 | el 直接访问 | node 直接访问 |
| 结构指令（创建/销毁子树） | TemplateRef + ViewContainerRef | 仅 mounted 内 el.parentNode | 不支持（改用 {#if} 块） |
| 注册方式 | imports 数组（standalone） | app.directive() 全局或组件级 | 局部 import 用 `use:` |

Svelte actions 最轻量（就是一个函数）、Vue 指令居中（有钩子对象）、Angular 指令最『重』（class + DI + input 信号）——换来的是**类型安全 + 可注入服务 + 与 zoneless 变更检测无缝集成**。

> 🚀 下一站：L3 依赖注入与服务——把 inject() 从指令/DI token/provider 体系角度拆透。
