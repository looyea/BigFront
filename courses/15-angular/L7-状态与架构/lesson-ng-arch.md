# ng-arch：大型项目架构——库分层与边界纪律

> 目标：core/shared/features 三层库与 barrel 禁令的官方风格指南依据；延迟 feature 边界（路由处才 import）；monorepo（nx）在 Angular 圈的常见形态；模块边界的依赖图纪律与 lint 规则（@angular-eslint）；对照 12/13 包的架构章节收企业级架构一课（呼应 nuxt-directory 目录分层、nuxt-architect）

## 一、Angular 官方推荐的三层架构

```
src/
├── app/
│   ├── core/          ← 单例服务、全局守卫、拦截器、错误处理
│   ├── shared/        ← 可复用组件/指令/管道/模型（不含业务逻辑）
│   └── features/      ← 业务特性模块（每个 feature 自治）
│       ├── users/
│       ├── orders/
│       └── products/
```

**依赖规则**（铁律）：
- `features/*` → 可 import `core` 和 `shared`
- `features/A` ↛ `features/B`（**禁止横向依赖**）
- `core` ↛ `features`（core 不知道业务模块的存在）
- `shared` ↛ `core` / `features`（shared 是纯 UI/工具层）

## 二、core 层：应用级单例

放什么：
- AuthService / ThemeService / ErrorInterceptor
- 全局守卫 authGuard
- HTTP 拦截器
- 一次性初始化 service（如 analytics setup）

```ts
// core/auth/auth.service.ts — 只在 core 里定义
@Injectable({ providedIn: 'root' })
export class AuthService { ... }
```

core 不做 barrel export（不写 `core/index.ts`）——**避免循环 barrel**。

## 三、shared 层：可复用 UI 积木

放什么：
- 通用组件（Button、Modal、DataTable）
- 通用指令（Highlight、ClickOutside）
- 通用管道（DateFilter、FileSize）
- 通用 model / interface（Page<T>、ApiResponse<T>）

```ts
// shared/components/data-table/data-table.component.ts
@Component({ selector: 'app-data-table', standalone: true, imports: [CommonModule], ... })
export class DataTableComponent<T> { ... }
```

v19+ standalone 组件不需要 NgModule 打包——直接 import 使用。

## 四、features 层：业务自治

每个 feature 是一个**完整业务切片**（含自己的路由、组件、service、store）：

```
features/users/
├── users.routes.ts
├── users.service.ts        ← 本 feature 私有 service（不提升到 core）
├── users.store.ts          ← signal store / NgRx feature
├── components/
│   ├── user-list/
│   └── user-detail/
└── models/
    └── user.model.ts
```

feature 的入口是 `users.routes.ts`——由 app.routes.ts 用 loadChildren 引入：

```ts
// app.routes.ts
{ path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) }
```

这是**延迟 feature 边界**——只有路由被导航到时才 import 该 feature 的所有代码（包括它 import 的 shared/core）。

## 五、Barrel 禁令与 tree-shaking

官方风格指南（v17 更新）：**避免在 feature 内用 `index.ts` barrel 导出一切**。

为什么：
```ts
// ❌ barrel
import { UserListComponent, UserDetailComponent } from './features/users';
// barrel 把 users 里所有东西都拉进来 → 破坏 tree-shaking

// ✅ 直接路径
import { UserListComponent } from './features/users/components/user-list/user-list.component';
```

例外：`shared/` 可以有一个窄 barrel（只导出公共 API）——因为 shared 本就是被到处 import 的。

## 六、Nx Monorepo 形态

大型企业 Angular 项目用 Nx 管理 monorepo：

```
projects/
├── my-app/                    ← 主应用
│   └── src/app/
├── my-app-e2e/
├── libs/
│   ├── core/                  ← 共享 core（多应用复用）
│   ├── shared-ui/             ← 组件库
│   ├── features/
│   │   ├── users/             ← feature lib
│   │   └── orders/
│   └── api/                   ← 后端 API（Nest.js）
```

Nx 的 `project.json` 定义每个 lib 的 tag：
```json
{ "tags": ["type:feature", "scope:users"] }
```

配合 `.eslintrc` 的 `@nrwl/taq` 规则约束依赖方向。

## 七、依赖图纪律与 lint 规则

用 `@angular-eslint` + 自定义 `no-cross-feature-import` 规则（或 Nx 的 enforce-module-boundaries）：

```json
// .eslintrc.json
{
  "rules": {
    "@nx/enforce-module-boundaries": ["error", {
      "restrictImportedDecorators": [],
      "depConstraints": [
        { "sourceTag": "type:feature", "onlyDependOnLibsWithTags": ["type:core", "type:shared"] },
        { "sourceTag": "type:core", "notDependOnLibsWithTags": ["type:feature"] }
      ]
    }]
  }
}
```

效果：`features/users` import `features/orders` → **编译期报错**。

## 八、循环依赖处理

常见原因：两个 feature 共享 model → 谁放哪？
解法：① 提升到 `shared/models/`（如果真的是通用的）；② 提取第三方 feature `shared-domain/`；③ Angular v17+ standalone 减少了 barrel 因此循环概率更低。

检测：`madge --circular src/` 或 Nx dependency graph `nx dep-graph`。

## 九、模块边界的「延迟 import」原则

```ts
// ❌ 在 app.module / app.config 顶部直接 import feature 的 service
import { UserService } from './features/users/users.service';  // 打进主包

// ✅ feature 路由内 import（只有懒加载触发时才拉取）
// users.routes.ts 里才 import UsersService
```

核心：**主包（initial bundle）只含 core + shared + bootstrap 逻辑**——feature 全在懒加载 chunk 里。

## 十、对照 Nuxt/SvelteKit 的目录分层

| 层 | Angular | Nuxt | SvelteKit |
|----|---------|------|-----------|
| 约定目录 | core/shared/features | composables/middleware/plugins | lib/routes |
| 路由级分包 | loadChildren 显式 | pages/ 自动 | routes/ 自动 |
| 全局共享 | providedIn:'root' service | useState/nuxt plugin | +layout store |
| 模块隔离 | lint + Nx tags | Nuxt modules | SvelteKit endpoints |
| 编译期检查 | @angular-eslint | nuxt ts config | svelte-check |

Angular 的架构约束靠**约定 + lint**（非文件系统强制），而 Nuxt/SvelteKit 靠**目录约定**——两种风格无优劣、只有效纪律差异。
