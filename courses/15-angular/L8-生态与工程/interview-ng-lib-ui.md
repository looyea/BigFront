# ng-lib-ui 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Material/CDK 定位、样式封装、Web Components 集成与组件库生态的题组。

### 1. (A) 解释 CDK 与 Material 的关系：为什么有了 Material 还要 CDK？

**来源**：转述自本关 §二 CDK 定位段

CDK 是 Material 的**底层引擎**——Material 组件 = CDK 能力 + Material 视觉。提供 CDK 的原因：① 不是所有项目都要 Material Design 风格——但浮层/拖拽/表格/无障碍是通用需求；② 自定义设计系统的团队用 CDK 做行为骨架 + 自己的 CSS；③ CDK 保持 API 稳定（Material 可能改版）。类比：CDK = Radix (React) / Headless UI (Vue)——无样式的 accessible primitives。

### 2. (B) 同事在 standalone 组件模板里用了 `<mat-slide-toggle>` 编译报 'is not a known element'——怎么修？

**来源**：转述自本关 §三 standalone import + §六陷阱第 3 点

standalone 组件必须自己声明所有模板里用到的 directive/component：在 `@Component({ imports: [MatSlideToggle] })` 里加入。v19+ 默认 standalone 后不再有 NgModule 帮你 exports。修复：import MatSlideToggleModule（或 v20+ 的 MatSlideToggle 直接导出）。

### 3. (C) 对比 Angular Material、MUI (React)、Vuetify (Vue) 三大 Material Design 实现的选型差异。

**来源**：转述自本关 §五组件库生态锁定度对比

- **Angular Material**：官方维护、与框架同步发版、CDK 底座、v22 有 native controls 新线——最深度绑定 Angular DI/CD 体系。
- **MUI**：社区最大、emotion/webpack 样式方案、组件最丰富——锁定 React 但生态可换。
- **Vuetify**：Vue 最完整 Material 实现——但迁移困难因为深度依赖 Vue directive。
选型判据：如果项目严格遵循 Material Design → Angular Material 最顺滑；如果要自定义设计系统 → CDK/Radix headless 更合适。

### 4. (D) 设计一个暗色主题切换系统：用 Angular Material 3 + CSS 变量，支持用户手动切换且持久化。

**来源**：转述自本关 §三 CSS 变量 + §四持久化

方案：① 全局 CSS 定义两组变量 `.theme-light { --mat-sys-primary: #1976d2; ... }` / `.theme-dark { --mat-sys-primary: #90caf9; ... }`；② ThemeStore: `signal<'light'|'dark'>` + effect 持久化 localStorage；③ AppComponent: `[class.theme-dark]="themeStore.theme()==='dark'"`；④ 切换：`themeStore.toggle()`。加分：Material 3 已原生支持 `@angular/material/core/theming/prebuilt` + `colorScheme` 输入。

### 5. (A) ViewEncapsulation.ShadowDom 的实际影响：父组件样式能否影响子组件？全局 CSS 变量呢？

**来源**：转述自本关 §三样式封装四档表

ShadowDom 是**最强隔离**：父 CSS/全局 CSS 都不能通过选择器命中 shadow root 内的元素——但 CSS Custom Properties **可以穿透** Shadow DOM 边界（因为它们是继承属性）。所以 `--mat-sys-primary` 在全局设值 → shadow 内组件仍生效。全局 `.btn { }` 不生效。这是 Angular 唯一真正使用浏览器原生 Shadow DOM 的模式。

### 6. (B) 项目里用了 ::ng-deep 覆盖 Material dialog 的 padding——迁移到 v22 后样式失效了。为什么？替代方案？

**来源**：转述自本关 §六陷阱第 1 点与 CSS 变量

v22 Material 内部 DOM 结构改了——旧 ::ng-deep 选择器找不到目标节点。替代：① 用 Material 3 的 CSS 变量（`--mat-dialog-container-padding`）；② `ViewEncapsulation.None` 在专用 override CSS 文件里写选择器；③ Material 17+ 提供 `panelClass` 输入 → 自定义 class → 在全局样式里定义。

### 7. (C) 在 Angular 项目里使用 Web Components（如 Shoelace/Ionic 组件），与使用 Angular 原生组件有什么体验差异？

**来源**：转述自本关 §四 Web Components 出口

差异：① 模板中直接写 `<sl-button>` 但 TS 类型提示缺失（自定义元素 Angular 编译器不识别 → 需 CUSTOM_ELEMENTS_SCHEMA）；② 属性绑定要用 `[attr.xxx]`（不是 `[xxx]` 因为 WC 属性可能不是 Angular property）；③ 事件绑定用 `(customEvent)` 但 Angular 不感知 WC 内部事件流；④ 不走 Angular 变更检测——WC 自己管渲染。结论：能用但 DX 差于原生 Angular 组件。

### 8. (D) 面试官让你用 CDK 从零造一个 autocomplete 组件（不用 Material 样式）：给出 overlay + keyboard 的核心思路。

**来源**：转述自本关 §二 CDK overlay/a11y

① Overlay：`Overlay.connect()` + `Overlay.position().connectedTo(inputElement)` → 在 input 下方渲染 suggestion panel；② ListKeyManager：`new ListKeyManager(options).withWrap().trackByValue` → 上下键选高亮项；③ ARIA：`role=listbox` + `aria-activedescendant` 通过 FocusMonitor 管理；④ 数据源：input signal 变化 → filter 过滤列表 → 更新 overlay 内 @for。CDK 帮你搞定定位、键盘、焦点、层级——你只管渲染和内容逻辑。

### 9. (A) Material 的 Overlay 系统如何处理多个浮层的 z-index 堆叠和点击外部关闭？

**来源**：转述自本关 §二 CDK overlay 段

CDK Overlay 维护一个**全局 overlay container**（`<div class="cdk-overlay-container">` 挂在 body 末尾）。每个 overlay 是一个 `.cdk-overlay-pane`——z-index 由 overlay 创建顺序递增。backdrop 层点击触发 `detach()` → 关闭最上层 overlay。Dialog/Menu/Tooltip 都走同一套——自动管理焦点陷阱（focus trap）和滚动锁（scroll block）。

### 10. (B) 集成一个纯 JS 图表库（如 ECharts）到 Angular standalone 组件：给出核心 lifecycle 处理。

**来源**：转述自本关 §四 wrapper 模式与 Angular lifecycle

```ts
@Component({ selector: 'app-chart', standalone: true, template: `<div #container></div>` })
export class ChartComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('container') el!: ElementRef;
  private chart?: echarts.ECharts;
  @Input() option!: echarts.EChartsOption;

  ngAfterViewInit() { this.chart = echarts.init(this.el.nativeElement); this.chart.setOption(this.option); }
  ngOnChanges() { this.chart?.setOption(this.option); }
  ngOnDestroy() { this.chart?.dispose(); }
}
```
注意：zoneless + signal 版本用 `afterNextRender` + `effect` 替代 ngAfterViewInit/ngOnChanges。

### 11. (D) 设计一个跨项目共享的设计系统包（design-system lib）：内部包含 tokens、基础组件、复合组件——给出 npm 包结构和 Angular 集成方式。

**来源**：转述自本关 §五生态与 §三主题

结构：
```
@myorg/design-system/
├── tokens/          ← CSS 变量 + TypeScript 类型 (间距/颜色/字体)
├── primitives/      ← Button, Input, Card 等基础 standalone 组件
├── composites/      ← DataTable, FormWizard 等复合组件
├── styles/          ← theme.css (light/dark)
└── index.ts         ← public API barrel
```
集成：`ng add @myorg/design-system` → 自动在 angular.json 加 styles 预编译 + 提供 Migration。组件用 `import { ButtonComponent } from '@myorg/design-system/primitives'` standalone 方式。

### 12. (A) Angular 的 CDK 和 React 的 Radix UI 都走 headless 路线——两者 API 设计风格有什么差异？

**来源**：转述自本关 §二 CDK 与 Radix headless 对照

- **CDK**：面向**服务/类 API**——`Overlay.create()`、`ListKeyManager` 是 class + 方法调用；与 DI/Angular 生命周期深度绑定。
- **Radix**：面向 **JSX compound components**——`<Dialog.Root>`, `<Dialog.Trigger>`；声明式 + 组合。
哲学差异：CDK 更像 SDK（命令式 API 库），Radix 更像组件（声明式组合）。Angular 没有等价的 compound component 语法糖——得用 Content Projection 模拟。

### 13. (C) 如果面试官问「我们的 Angular 项目要不要用 Angular Material 还是自己写组件库」——你怎么决策？

**来源**：转述自本关 §五锁定度与 §二 CDK

决策树：① 产品遵循 Google Material Design 规范且无特殊定制 → 直接用 Material；② 有自己的视觉规范（品牌色/形状/动效）→ **CDK + 自建组件**（用 Material 改样式太痛苦）；③ 需要极轻量（只有 5 个基础组件）→ 纯 HTML/CSS 自己写。一句话：「Material 是快速起点，CDK 是自由度上限」。

### 14. (B) Material 组件在 zoneless + signal 项目下有没有已知不兼容？

**来源**：转述自本关 §六陷阱与 L4 zoneless 知识

v21 zoneless 默认后 Material 已全面适配（v17.3+ 的组件支持 zoneless——内部改用 signal + markForCheck 替代 zone 自动触发）。已知小问题：极少数使用 `ChangeDetectorRef.detectChanges()` 手动刷新的旧版组件可能在 zoneless 下行为微变——但官方 issue tracker 已修复。结论：v22 Material + zoneless 完全兼容。

### 15. (D) 面试官让你给一个移动端为主的 Angular 应用推荐组件方案——Material 桌面优先你怎么看？

**来源**：转述自本关 §五生态与 Material native controls

分析：传统 Material 偏桌面（密集数据/表格）但 v22 新增 native controls 线正好解决移动端——`<input type=date>` 在移动端是原生日期选择器（比 MatDatepicker 体验好 10 倍）。推荐：① 表单用 Material native controls 新线；② 布局用 CDK + 自定义 CSS（不背 Material 桌面尺寸）；③ 导航用 CDK 的 Tabs/Drawer + 自己移动 UI。结论：Material 不是唯一选择——CDK 才是 Angular 组件方案的基石。
