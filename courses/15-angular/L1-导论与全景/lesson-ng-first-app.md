# ng-first-app：第一个应用——ng new 之后每一层是什么

> 目标：跑通 ng new/ng serve 不是目的，目的是把新项目骨架的每个文件读成『设计声明』：bootstrapApplication 的 standalone 启动、app.config.ts 的提供者树、app.routes.ts 的路由配置、angular.json 的构建预算——看懂这套『默认值即版本号』的目录，比背十个 API 值钱（呼应 ng-version-map、ng-di-core、kit-project-structure）

## 一、三十秒建工程，然后立刻 `ng version`

```bash
npm i -g @angular/cli
ng new tour          # 交互式问两个问题：样式用 SCSS？不做 SSR（先选 No）
cd tour && npm start   # ng serve，默认 4200 端口
ng version           # 把输出抄进笔记——下面所有解读按这个版本对表
```

v20+ 的 CLI 已经不问『是否 standalone』——**因为默认就是**，这正是上关说的『默认值即版本号』：问什么问题、默认值是什么，就是 Angular 该年的产品形态。

## 二、骨架四层：启动层 / 应用层 / 组件层 / 工程层

```
tour/
├─ angular.json          # 工程层：构建目标、预算、多环境配置
├─ tsconfig.json(+2)     # 工程层：TS 严格档（v20 起新项目连 strictTemplates 都默认开）
├─ src/
│  ├─ index.html         # 壳：<app-root> 挂点
│  ├─ main.ts            # 启动层：bootstrapApplication(App, appConfig)
│  └─ app/
│     ├─ app.ts          # 组件层：根组件 App（standalone，template 内联）
│     ├─ app.config.ts   # 应用层：providers 树（路由/HTTP 的注册处）
│     ├─ app.routes.ts   # 应用层：Routes 配置数组
│     └─ app.spec.ts     # 工程层：Vitest 时代的默认单测桩
```

四个层各管一件事，从此你写的每样东西都要先回答『它属于哪层』——这就是强约定的第一面。

## 三、启动层与应用层：main.ts 和 app.config.ts 的分工

```ts
// main.ts —— 只管『启动』这一件事
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// app.config.ts —— 只管『这应用装配了哪些全局能力』
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // v21+ 新工程默认 zoneless，不再写任何 zone 相关提供者；
    // v18-20 的工程里这里可能是 provideZoneChangeDetection(...) 或手动换装的 provideZonelessChangeDetection()
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};
```

两行注释讲三个知识点：① **bootstrapApplication 是 standalone 世界的 main**——旧世界叫 platformBrowserDynamic().bootstrapModule(AppModule)，见到后者就是 v17 前教程（版本探针）；② **providers 数组是全应用的『总装配线』**——路由表、HTTP 客户端、变更检测策略全在这挂号，L3 的 DI 关会拆这台机器；③ 这个数组里 zone 提供者的有无本身就是一枚版本指纹——v21 起新工程默认什么都不写（zoneless），v18-20 之间则可能看见 provideZonelessChangeDetection() 手装或 provideZoneChangeDetection() 残留（L4 讲透，这里先认脸）。

## 四、组件层：App 组件只有八行，但每行都是新语法

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,          // v19 起组件默认 standalone，新代码可省；老代码里它是从 NgModule 解放的标志
  template: `<h1>Hello</h1>`,
})
export class App {           // 类名 App 不是 AppComponent——v20 起的简化命名
  title = 'tour';
}
```

`selector` 是自定义元素标签名、`template` 可以是内联字符串或 templateUrl 外链、类名去掉 .component 后缀的极简命名是 v20 新默认（旧教程都会写 AppComponent）——**组件自声明依赖、无 declarations 注册表**，这就是 standalone 的全部『革命成本』：八行起步，而不是先建一个 NgModule。

`ng generate component pages/home` 之后你会得到 standalone 组件四件套（ts/html/spec/css），CLI 还会自动把它 import 进使用方的 imports 数组（`--standalone` flag 已退役——默认即真）。

## 五、工程层：angular.json 的两处『先认脸后深挖』

① **budgets**——initial 与 anyComponentStyle 的体积预算，超了 build 直接红（默认 warning 阈值 4MB/1000kB 量级，以你工程实际值为准）。这就是 14 包 sig-size『size-limit 进 CI』的框架内置版：Angular 把体积门禁做成了出厂默认件；② **configurations/defaults**——production 默认开优化与哈希文件名，`ng build --configuration development` 切档；serve/build/test 都是 target，`ng test` 在 v21+ 走 Vitest（package.json 的 scripts 里能看到）。

第三处藏在 tsconfig：**strict 全家 + strictTemplates 默认开**（v20+ 新工程）——模板里的表达式也要过类型检查：`{{ user.naem }}` 拼错属性名，ng build 阶段就报错而不是运行时 undefined。**强约定的红利第一次到账**：模板不再是类型盲区。

## 六、跑起来之后做的三件小事

1. 改 `app.ts` 的 title 看热更（Vite 通道的毫秒级，v20 起 @angular/build 默认）；
2. 在 template 里故意写一个不存在的属性绑定，看 ng build 报什么（体验 strictTemplates）；
3. 把 budgets 的 maximumWarning 改成 '10b'，跑 `ng build` 看体积门禁如何变红——这套报错在 L9 性能关会正式用到。

> 🚀 部署预告：`ng generate` 命令族是本包的日常动词：component/service/directive/class/guard（v17 后 guard 生成的是函数式，L6 见）/interceptor（函数式，L5 见）。现在就把每个 schematic 跑一遍删掉——用生成的代码反推骨架理解，比读文档快。下一关给 17→22 六个版本发一张『该信谁』的地图。
