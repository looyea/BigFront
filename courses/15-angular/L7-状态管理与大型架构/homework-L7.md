# homework-L7：状态管理与大型架构

> 五段式 · 建议用时 90 min · 覆盖 ng-state-services / ng-ngrx / ng-arch

---

## 第一段：Bug 修复（每题 3 分，共 30 分）

**1.1** signal store 暴露了 writable signal：
```ts
todos = signal<Todo[]>([]);
```
→ 改为标准三件套写法。

**1.2** action 里用了 push 修改数组：
```ts
add(todo: Todo) { this._todos.update(todos => { todos.push(todo); return todos; }); }
```
→ 为什么视图不更新？修正。

**1.3** computed 里做了副作用：
```ts
total = computed(() => { this._log.update(l => l + 1); return this._items().reduce((s,i)=>s+i.price,0); });
```
→ 违反什么规则？怎么改。

**1.4** SSR 项目 service 构造函数里 `localStorage.getItem('theme')` 报错。
→ 加平台判断修复。

**1.5** NgRx Effect 里直接改了 state：
```ts
loadUsers$ = createEffect(() => this.actions$.pipe(ofType(loadUsers), tap(() => this.store.dispatch(...))));
```
→ tap 改 dispatch 的写法对吗？如果要在 Effect 里返回 action 应该用什么操作符？

**1.6** Reducer 里 `state.users.push(action.user)` — 指出两个问题。

**1.7** features/orders 里 `import { UserStore } from '../../features/users/user.store'` — 这违反了什么规则？给出两种合规替代。

**1.8** core/auth.service.ts 里 `import { UserListComponent } from '../features/users/...'` — 为什么这行代码在架构上不可接受？

**1.9** `app.config.ts` 顶部 `import { UsersEffects } from './features/users/users.effects'` — 这会导致什么问题？

**1.10** Nx 项目 lint 报 "A project tagged with 'type:feature' cannot import a project tagged with 'scope:other'" — 这是什么规则？怎么正确解耦？

---

## 第二段：手写代码（每题 7 分，共 35 分）

**2.1** 写一个 `ThemeStore`（signal store 三件套）：支持 dark/light/system 三模式、持久化到 localStorage、SSR 安全。

**2.2** 用 @ngrx/signals 的 signalStore API 重写 2.1。

**2.3** 写一个 NgRx Feature：`products`——含 loadProducts action/reducer/effect/selector（分页 + loading 状态）。

**2.4** 设计 core/shared/features 三层目录：写出一个「带登录、商品列表、购物车、后台管理」四个 feature 的完整文件树（至少到第二层目录）。

**2.5** 写 Nx `project.json` 的 tags 配置 + `.eslintrc` 的 enforce-module-boundaries 规则：禁止 features 横向 import。

**2.6** 写一个跨 feature 通信方案：orders 完成后通知 users 更新积分——用共享 core service 实现。

**2.7** 把一段 providedIn:'root' 的巨型 God Service（50 个方法、10 个 signal）拆成 3 个按业务域的 signal store。给出拆分方案和接口。

---

## 第三段：场景设计（20 分）

**设计题**：为一家金融公司内部系统设计 Angular 架构。

需求：
- 3 个产品线（风控、合规、报表）共享同一套组件库
- 跨产品有统一用户认证和权限系统
- 风控和合规之间有数据联动（风控标记 → 合规展示）
- 报表模块需要 30+ 图表组件懒加载
- 20 人团队，要求代码审查可追踪状态变更
- 需要 DevTools 时间旅行调试复杂状态流

请设计：目录结构（Nx monorepo）+ tag 策略 + 依赖规则 + 状态管理选型（signal store vs NgRx 按模块给结论）+ 跨 feature 通信方案。

---

## 第四段：简答（每题 5 分，共 15 分）

**4.1** signal store 和 NgRx Store 各自的适用场景判据是什么？「大多数应用不需要 NgRx」这句话的依据是什么？

**4.2** 为什么官方推荐避免 barrel？在什么情况下 barrel 仍可以接受？

**4.3** 在 standalone 组件时代，Angular 的模块边界靠什么保证？与 NgModule 时代有什么本质区别？

---

## 第五段：挑战题 🏆（10 分，加分项）

**挑战**：设计并实现一个「可插拔 Feature Module」系统——主应用不直接 import 任何 feature，而是运行时从远端 JSON 读取已注册 features 列表（含 path、chunk URL、权限要求），动态构建 Routes 并 `provideRouter`。给出核心架构方案和关键代码，讨论对 tree-shaking/懒加载/budgets 的影响。
