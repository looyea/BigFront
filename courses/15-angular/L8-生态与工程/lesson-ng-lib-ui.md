# ng-lib-ui：UI 生态——Material、CDK 与第三方集成

> 目标：Angular Material（含 v22 MDC 原生控件新线）与 CDK 的 headless 能力（a11y/overlay/拖拽）；样式封装四档 ViewEncapsulation 与主题 CSS 变量；集成无框架绑定的第三方组件（headlessui/shadcn/webcomponents 出口）；对照各框架组件库生态的锁定度差异（呼应 kit-overview 组件生态、nuxt-modules）

## 一、Angular Material：官方组件库

```bash
ng add @angular/material
```

v22 提供两套线：
- **MDC-based**（传统）：`MatButton`、`MatDialog` 等——Material Design 3 主题
- **Native controls**（新）：用 HTML 原生 `<input type=date>` + CDK 行为——更轻量、无障碍更好

```ts
// standalone 使用
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>邮箱</mat-label>
      <input matInput [formControl]="email" />
    </mat-form-field>
    <button mat-raised-button color="primary">登录</button>
  `,
})
```

## 二、CDK：Headless 能力层

CDK (Component Dev Kit) 提供**无 UI 骨架能力**：

| CDK 模块 | 能力 | 例子 |
|----------|------|------|
| @angular/cdk/overlay | 浮层定位（dialog/dropdown/tooltip） | 自定义下拉 |
| @angular/cdk/drag-drop | 拖放排序/移动 | 看板 |
| @angular/cdk/a11y | 键盘导航/焦点管理/LiveAnnouncer | 列表键盘选 |
| @angular/cdk/table | 表格数据源/列绑定 | 自定义 DataTable |
| @angular/cdk/portal | 动态挂载组件到任意 DOM 位置 | Modal body |

```ts
// 用 CDK 造自定义 dropdown（无 Material 样式）
import { CdkOverlayOrigin, OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';  // listKeyManager
```

CDK 是 Angular 独有能力——React 有 Radix、Vue 有 Headless UI，但 CDK 覆盖面最广。

## 三、样式封装：ViewEncapsulation 四档

```ts
@Component({
  encapsulation: ViewEncapsulation.None,  // 全局样式（不隔离）
  // 或
  encapsulation: ViewEncapsulation.ShadowDom,  // 原生 Shadow DOM
  // 或（默认）
  encapsulation: ViewEncapsulation.Emulated,  // 模拟 scoped（加 _ngcontent_xxx 属性选择器）
})
```

| 模式 | 效果 | 适用 |
|------|------|------|
| Emulated（默认） | Angular 编译时给选择器加 `_ngcontent` 属性 → 模拟 scoped | 99% 场景 |
| None | 组件 CSS 直接进全局 → 可影响其他组件 | 全局 reset/主题变量定义 |
| ShadowDom | 浏览器原生 Shadow DOM → 最强隔离 | Web Component 互操作 |
| 外部 SCSS + ::ng-deep | 穿透封装改子组件样式 | 慎用——Angular v22 已 warning |

主题定制推荐 CSS 自定义属性（Material 3 已走这条路）：
```css
:root {
  --mat-sys-primary: #1976d2;
  --mat-sys-surface: #fafafa;
}
```

## 四、第三方无框架组件集成

Angular 集成非 Angular 绑定组件库的三种出口：

1. **Web Components 出口**：shoelace / stencil 组件——Angular 直接当自定义元素用：
```ts
// 声明为 CUSTOM_ELEMENTS_SCHEMA
@Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA], template: `<sl-button>Hi</sl-button>` })
```

2. **无框架核心 + Angular wrapper**：headlessui 思路——核心 JS + 各框架薄壳：
```ts
// 自己包 @headlessui/react 的等价物（如果是纯 JS lib）
@Component({ selector: 'app-menu', template: `...` })
export class MenuComponent implements OnInit, OnDestroy {
  private headlessMenu = createMenu({ /* 纯 JS 配置 */ });
}
```

3. **CDK 自建**：不用外部库——用 CDK overlay + a11y 自己写（Angular 官方推荐路线）。

## 五、组件库生态锁定度对比

| 框架 | 官方组件库 | 第三方主流 | 锁定度 |
|------|-----------|-----------|--------|
| Angular | Material + CDK | PrimeNG、DevExtreme | 中（Material 强绑定但 CDK 可自建） |
| React | 无 | MUI、shadcn/ui、Radix | 低（无官方锁定） |
| Vue | 无 | Element Plus、Naive UI、Vuetify | 低 |
| Svelte | 无 | Skeleton、Flowbite Svelte | 最低 |

Angular 的 Material 是全家桶的一部分——不强制但最顺滑；v22 的 native controls 新线在降低锁定。

## 六、常见陷阱

1. **::ng-deep 滥用**：穿透封装导致样式污染——Angular 官方文档明确标注 deprecated。
2. **Shadow DOM 下全局 CSS 失效**：主题变量/字体继承断裂——需要 `::part()` 或 CSS custom properties。
3. **Material 组件没 import 对应模块**：standalone 后必须 `imports: [MatButtonModule]` 在组件级别——忘加就编译报 "mat-button is not a known element"。
4. **暗色主题切换不生效**：Material 3 主题用 CSS 变量——需要在 html/body 上切 class 或改 `--mat-sys-*` 变量值。
