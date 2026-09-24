# ng-ngrx：NgRx 正统与信号派——企业剧本的现在

> 目标：Store/Action/Reducer/Effect/Selector 五件套一图流与 DevTools 时间旅行（对照 redux 家族）；NgRx SignalStore/ComponentStore 新派与 nx 生态；选型判据：Angular 官方「多数应用不需要 NgRx」的立场与团队偏好；本包定位主流够用即止（呼应 za-middleware、sig-migrate、mobx-stores）

## 一、NgRx 是什么：Redux 在 Angular 的官方实现

NgRx = **N**g**R**eactive **X**tensions——把 Redux 单向数据流（Action → Reducer → Store）+ RxJS 副作用管理搬到 Angular DI 体系。

```
┌─────────────────────────────────────────────────┐
│ Component dispatches Action                      │
│     ↓                                            │
│ Action ──→ Reducer ──→ new State ──→ Store       │
│     ↓                                ↓           │
│ Effect (异步/副作用)           Selector → 组件订阅 │
└─────────────────────────────────────────────────┘
```

五大概念：

| 概念 | 职责 | 例子 |
|------|------|------|
| **Store** | 全局唯一状态容器 | `AppState { users, orders, ui }` |
| **Action** | 描述「发生了什么」的纯对象 | `[Users Page] Load Users Success` |
| **Reducer** | 纯函数 (state, action) => newState | `createReducer` 里 `on(loadSuccess, (s,{users}) => ({...s, users}))` |
| **Selector** | 从 state 派生数据的纯函数 | `createSelector(selectUsers, users => users.filter(u => u.active))` |
| **Effect** | 响应 action 执行副作用（HTTP/WebSocket）再 dispatch 新 action | `createEffect(ofType(loadUsers), switchMap(() => http.get(...)))` |

## 二、最小 NgRx 代码示例

```ts
// actions
export const loadUsers = createAction('[Users Page] Load Users');
export const loadUsersSuccess = createAction('[Users API] Load Users Success', props<{ users: User[] }>());
export const loadUsersFailure = createAction('[Users API] Load Users Failure', props<{ error: string }>());

// reducer
const usersReducer = createReducer(
  initialState,
  on(loadUsers, state => ({ ...state, loading: true })),
  on(loadUsersSuccess, (state, { users }) => ({ ...state, users, loading: false })),
  on(loadUsersFailure, (state, { error }) => ({ ...state, error, loading: false })),
);

// effect
@Injectable()
export class UsersEffects {
  loadUsers$ = createEffect(() => {
    const actions$ = inject(Actions);
    return actions$.pipe(
      ofType(UsersPageActions.loadUsers),
      switchMap(() => inject(HttpClient).get<User[]>('/api/users').pipe(
        map(users => UsersApiActions.loadUsersSuccess({ users })),
        catchError(err => of(UsersApiActions.loadUsersFailure({ error: err.message }))),
      )),
    );
  }, { functional: true });
}

// selector
export const selectActiveUsers = createSelector(
  selectUsersFeature,
  (state) => state.users.filter(u => u.active),
);

// 组件
users$ = this.store.select(selectActiveUsers);
ngOnInit() { this.store.dispatch(loadUsers()); }
```

## 三、Redux DevTools 时间旅行

NgRx 最大卖之一是 **@ngrx/store-devtools**：

- 记录每个 action 及其前后的 state snapshot
- 可视化回放/跳转/暂停/dispatch 自定义 action
- 与 React Redux DevTools 相同协议——同一个浏览器扩展

这是 signal store 没有的能力——**复杂状态流的可观测性**是 NgRx 护城河。

## 四、NgRx Signals（新派）：@ngrx/signals

v17.1 起 `@ngrx/signals` 提供 **signal-based store**——更轻量：

```ts
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';

const UsersStore = signalStore(
  withState<{ users: User[]; loading: boolean }>({ users: [], loading: false }),
  withComputed((store) => ({
    activeUsers: computed(() => store.users().filter(u => u.active)),
  })),
  withMethods((store, http = inject(HttpClient)) => ({
    load() {
      patchState(store, { loading: true });
      http.get<User[]>('/api/users').subscribe(users => patchState(store, { users, loading: false }));
    },
  })),
);

// 组件中
private store = inject(UsersStore);
// store.users() / store.activeUsers() / store.load()
```

对比经典 NgRx：没有 Action/Reducer/Effect/Selector 四件套——只有 **state + computed + methods**。心智模型从 Redux 回到 signal store。

## 五、ComponentStore：组件级轻量状态

`@ngrx/component-store`——**不是全局 store**，作用域绑定到一个组件（或子树）：

```ts
@Injectable()
export class UserDetailStore extends ComponentStore<UserDetailState> {
  readonly vm$ = this.select(
    this.state$,
    (state) => ({ user: state.user, loading: state.loading }),
  );
  readonly loadUser$ = this.effect<string>((userId$) =>
    userId$.pipe(
      switchMap(id => inject(HttpClient).get<User>(`/api/users/${id}`)),
      tapResponse(
        user => this.patchState({ user, loading: false }),
        error => this.patchState({ error, loading: false }),
      ),
    ),
  );
}
// 组件 providers: [UserDetailStore] → 组件销毁 → store 销毁
```

适合「一页一 store」的局部状态管理——比 NgRx Store 轻、比裸 signal 多了 effect 管道。

## 六、nx 生态与 NgRx 的关系

**Nx** 是 Angular 社区最大的 monorepo 工具——NgRx 是 nx 公司(@nrwl/nx)旗下项目。nx 提供：
- `@nx/angular:ngrx` generator 一键生成 action/reducer/effect/selector
- 模块边界 lint 规则
- 依赖图可视化

大多数企业 Angular 项目 = nx + NgRx + Angular Material。

## 七、选型判据：什么时候才真的需要 NgRx？

| 信号 | 推荐 |
|------|------|
| 团队 < 5 人，状态简单 | signal store（本关前一课）足够 |
| 需要时间旅行 / action 日志 | NgRx Store + DevTools |
| 多团队共用一份全局状态且有严格流程约束 | NgRx（action type 是天然协议） |
| 组件局部状态 + 复杂异步流 | ComponentStore 或 @ngrx/signals |
| 官方态度 | "Start with services + signals; add NgRx when complexity demands it" |

## 八、常见误区

1. **把 NgRx 当唯一选择**：v17+ signal store 大幅降低了不需要 NgRx 的门槛——不要为简单 todo 上全栈 NgRx。
2. **Reducer 里做副作用**：reducer 是纯函数——HTTP/DOM/localStorage 必须在 Effect 里。
3. **过度设计 action 粒度**：一个按钮 click 发 3 个 action → 日志噪音。一个 action = 一个业务语义。
4. **Selector 不 memoize**：用 `createSelector`（自动缓存）而非 `store.select(state => ...)`（每次 state 变都重算）。

## 九、对照其他框架状态库

| 特性 | NgRx | Redux Toolkit | Zustand | Pinia |
|------|------|--------------|---------|-------|
| 范式 | Redux (immutable) | Redux (immer) | Hook-based | reactive + option |
| 异步 | Effect (RxJS) | createAsyncThunk | 自己写在 action | action 里 await |
| DevTools | ✅ | ✅ | 有限 | Vue DevTools |
| TypeScript | 强（typed store） | 强 | 强 | 中 |
| 学习曲线 | 高 | 中 | 低 | 低 |
| 框架绑定 | Angular 独占 | React 为主 | React | Vue |
