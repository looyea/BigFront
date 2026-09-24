# L1 阶段作业：导论与全景

> 覆盖：ng-landscape / ng-first-app / ng-version-map
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（版本张冠李戴）
某同学笔记写道："Angular v17（2023.11）引入了 zoneless 变更检测作为默认策略，从此不需要 zone.js。"
指出版本归属错误，说出 zoneless 正式成为默认是哪个版本、v17 时 signals 处于什么阶段。

**Bug 2**（启动方式混用）
```ts
// main.ts（声称 v21 新工程）
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
platformBrowserDynamic().bootstrapModule(AppModule);
```
文件注释写 v21，但代码用了旧启动方式。指出两处年代矛盾并给 v21 正确写法。

**Bug 3**（NgModule 残留）
```ts
@NgModule({
  declarations: [UserCard],
  imports: [CommonModule],
  exports: [UserCard],
})
export class UserModule {}
```
同事在 v21 新工程里建了上面这个 NgModule 来组织一个新组件。用本关学的骨架四层理论指出问题，给出 standalone 等价写法。

**Bug 4**（providers 层级错放）
app.config.ts 的 providers 里写了 `{ provide: LOCALE_ID, useValue: 'zh-CN' }` 和 `{ provide: AuthService, useClass: AuthService }`，同时 UserComponent 的 @Component({ providers: [AuthService] }) 里又注册了一次 AuthService。问：这会导致什么问题、谁的作用域更大。

**Bug 5**（zone provider 判断失误）
新同学看到 v21 工程的 app.config.ts 里没有任何 zone 相关 provider，在 Code Review 中写了评论："缺少 provideZoneChangeDetection，变更检测不会工作。" 用版本地图知识指出这条评论错在哪。

**Bug 6**（budgets 误解）
angular.json 里 `"budgets": [{ "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" }]`，同事把 maximumError 改成 "100mb" 说"反正只是警告不会真挡构建"。指出 budgets 的 maximumError 触发时的实际行为。

**Bug 7**（standalone flag 误判年代）
看到 `@Component({ selector: 'app-x', standalone: true, template: '...' })`，新人断言："有 standalone: true，所以这是 v14-v16 的工程。" 指出判断漏洞——v17-v18 工程同样有这个 flag 且合法。

**Bug 8**（strictTemplates 盲区）
模板中 `<input [(ngModel)]="userName">` 且组件只声明了 `userName = signal('')`，未声明 ngModel 的 import。ng build 不报错。同事说"strictTemplates 开着呢所以不可能有类型问题"——指出 strictTemplates 不能检查的是哪种错误。

**Bug 9**（测试器年代错配）
一份 v21 工程教程里写着 `npm install --save-dev karma jasmine-core` 并配 karma.conf.js。用版本探针指出为什么这份教程年代判定不可信。

**Bug 10**（拦截器写法混代）
```ts
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) { ... }
}
// app.config.ts
providers: [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }]
```
在 provideHttpClient() 的新工程里贴了这段旧拦截器代码。指出不兼容点并给函数式等价写法。

## 二、手写题（5 题）

**手写 1**：从零口述（不查资料）一个 v22 新工程从 ng new 到 ng serve 跑通的全部步骤，并列出 app.config.ts 里最简 providers 数组应包含哪两项。5 分钟内完成为标准。

**手写 2**：写出一个最小 standalone 组件（模板内联、包含一个 signal 计数器和 @if 控制流的按钮点击递增），不使用 NgModule。注意：v19+ 无需写 standalone: true。

**手写 3**：列出本关 §三版本探针表的五枚探针（启动方式/组织单位/控制流/拦截器/zone provider），每枚给一正一误两行代码示例并标注各属于哪个版本区间。

**手写 4**：把以下描述转成 angular.json 的 budgets 配置片段：initial 预算警告 2MB、错误 5MB；anyComponentStyle 警告 100kB、无硬限。

**手写 5**：用 30 秒面试语言回答：『ng new 出来的 Angular 项目比 Vite 的 React 项目多了哪些文件？它们各自帮你省掉了 React 生态里的哪个第三方选型？』至少对应四对。

## 三、场景题（1 题，20 分）

你入职一家有 8 年 Angular 历史的银行公司，系统从 v8（NgModule+ViewEngine）一路升到 v14（NgModule+Ivy），现启动「2026 现代化」专项要求升到 v22。给你 30 分钟向技术总监汇报迁移方案：① 画出分阶段路线图（至少 4 个里程碑），标注每阶段的核心 breaking 与 ng update schematics 动作；② 列出三处『旧知识保质期终结点』（即哪些已积累的团队最佳实践到某版本后变成反模式）；③ 设计一处『共存桥』策略让 v14 NgModule 与新 standalone 组件在同一工程里和平运行至少 6 个月；④ 给出团队培训节奏（每个里程碑前需要多少培训时、哪些关的内容对应）。

## 四、简答题（3 题）

**简答 1**：为什么本关说『默认值即版本号』？举 ng new 的 2023 年与 2026 年各产物的两处具体差异说明。

**简答 2**：解释 Angular『全家桶+强约定』路线与 React『库组合+自由选型』路线的本质分歧点（一个词：汇率），并各给一条优势与一条代价。

**简答 3**：v20 起 @angular/build（Vite 内核）成为默认——这对日常 ng serve 体验的两个最直观改善是什么？为什么官方不把这个插件独立发布为社区包？

## 五、挑战题 🏆（+10 分）

设计一份『Angular 教程/代码年代自动鉴定脚本』的 PRD（产品需求文档）：输入任意一段 Angular 源码文件或 GitHub 仓库 URL，输出年代区间判定与判定依据。要求：① 列出至少 8 条探针规则（每条给正则/AST 特征描述）与对应年代结论；② 设计一条决策链处理『混用过渡期』的 case（如 @if 与 *ngIf 并存时输出什么）；③ 给出置信度评分模型（15 条规则命中后如何加权输出最终判定）；④ 列出两条可能误判的 false positive 场景与缓解策略。
