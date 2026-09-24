# ng-ngrx 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Redux 单向流五件套、Effect 异步模式、@ngrx/signals 新派与选型判据的题组。

### 1. (A) 画出 NgRx 完整数据流图（从组件 dispatch 到视图更新），标注每个节点的职责约束。

**来源**：转述自本关 §一 NgRx 五件套与数据流图

组件 → dispatch(Action) → Store → Reducer(state, action) → newState → Store 发射新 state → Selector 派生 → 组件 AsyncPipe/toSignal 订阅 → 视图更新。并行：Action 同时流入 Actions observable → Effect 监听(ofType) → 执行异步(HTTP) → dispatch 新 Action(成功/失败)。约束：Reducer 纯函数无副作用；Effect 不直接改 state（只 dispatch）；Selector 纯函数可 memoize；Action 可序列化纯对象。

### 2. (B) 同事在 Reducer 里写了 `state.users.push(action.newUser)` — 为什么这是严重 bug？

**来源**：转述自本关 §二 Reducer 纯函数约束 + §五 DevTools 时间旅行前提

两个问题：① **突变**（mutate）——push 改了原数组引用 → NgRx 用 Object.is 检测变化 → state === prevState → Store 不发射 → 视图不更新；② **破坏不可变性**——DevTools 快照记录的是引用 → 后续 push 会改变历史快照内容 → 时间旅行失效。正确：`on(addUser, (state, {newUser}) => ({ ...state, users: [...state.users, newUser] }))`。

### 3. (C) NgRx SignalStore（@ngrx/signals）和经典 NgRx Store 的核心差异是什么？各自适合什么团队？

**来源**：转述自本关 §四 @ngrx/signals 与 §七选型判据

| 维度 | 经典 NgRx Store | SignalStore |
|------|----------------|-------------|
| 心智模型 | Redux 单向流（Action 驱动） | signal store（method 直接改） |
| 样板量 | 需 Action + Reducer + Effect + Selector 四文件 | withState + withComputed + withMethods 一文件 |
| DevTools | 完整时间旅行 | 无（或有限） |
| 异步 | Effect 集中管理 | 方法内自由用 HttpClient/RxJS |
| 学习曲线 | 高（需理解 Flux） | 低（与 signal service 同思路） |
适合：大团队（20+）流程约束 → 经典；中小团队要轻量组织 → SignalStore。

### 4. (D) 面试官让你从零设计 NgRx 的「用户列表+分页+搜索」feature module：给出 actions/reducer/effect/selector 文件结构和核心代码。

**来源**：转述自本关 §二最小示例与 §八常见误区的综合应用

文件结构：`user-list.actions.ts / user-list.reducer.ts / user-list.effects.ts / user-list.selectors.ts`。
Actions：`loadUsers({page, query})` / `loadUsersSuccess({users, total})` / `loadUsersFailure({error})`。
Reducer：`{ entities: Record<id, User>, page, total, loading }` + `on(loadUsersSuccess, (s,a) => ({...s, entities: upsertMany(a.users, s.entities), loading:false}))`。
Effect：`ofType(loadUsers), switchMap(({page, query}) => http.get(...))`。
Selector：`selectAllUsers` = `getEntities + 排序`；`selectPageInfo` = `page/total`。
加分：讨论用 @ngrx/entity 简化 entities CRUD。

### 5. (A) NgRx Effect 的 `dispatch: false` 选项是干什么的？什么场景需要？

**来源**：转述自本关 §二 Effect 与 §八常见误区

默认 Effect 期望返回一个 Observable<Action>——Router 自动 dispatch 它。`dispatch: false` 表示这个 Effect 只做副作用（如 console.log、showToast）不再 dispatch 新 Action：`createEffect(() => actions$.pipe(ofType(loadSuccess), tap(() => toast.show('加载完成'))), { dispatch: false })`。适合：UI 反馈、埋点、通知等只产生 side effect 不触发新状态变化的场景。加分：v14+ 推荐 functional effects + tap。

### 6. (B) 项目里 NgRx store 越来越大导致内存和性能问题——列举三种优化策略。

**来源**：转述自本关 §七选型判据 + §八 过度设计

① **feature lazy load**：用 `StoreModule.forFeature('users', usersReducer)` 在 loadChildren 路由里注册——未访问的 feature 不占内存；② **实体裁剪**：列表页只存 ID（normalize）+ @ngrx/entity 的 adapter——不存完整对象数组；③ **组件级 ComponentStore 替代全局 Store**：局部状态（表单草稿、UI 折叠）不该进全局 store。加分：讨论 `State` 接口按 feature 拆分 + 避免巨型单 AppState。

### 7. (C) 对比 NgRx Effect 与 Redux Toolkit 的 createAsyncThunk：两者都是「异步 action」的处理方式，有什么设计差异？

**来源**：转述自本关 §二 Effect + §九对照其他状态库

- **NgRx Effect**：独立 Injectable 类/函数——从 Actions stream 里 ofType 筛选 → RxJS 管道（switchMap/mergeMap/concatMap）→ dispatch 新 action。**异步逻辑与组件完全解耦**。
- **RTK createAsyncThunk**：一个函数里写 payloadCreator（async 返回数据）→ 自动派发 pending/fulfilled/rejected 三个 action → 在 extraReducers 里处理。**异步与 action 创建绑在一起**。
差异：NgRx 更正交（Effect 可监听任何 action 不一定要「创建」的）；RTK 更集中（thunk 是 action 的 creator 本身）。学习曲线：NgRx 需要 RxJS → RTK 只需 async/await。

### 8. (D) 面试官问「你们团队用 NgRx 但有人说太重了，你怎么评估是否需要保留 NgRx？」——给出决策框架。

**来源**：转述自本关 §七选型判据与 §六官方立场

决策四问：① 是否有跨 10+ 组件的全局状态？——如果 3 个 signal service 能覆盖 → 不需要 NgRx；② 是否需要时间旅行/审计日志？——需要 → NgRx DevTools 无可替代；③ 团队是否有新人频繁改状态逻辑？——是 → NgRx 强约定（Action type 是协议）降低犯错；④ 是否有乐观更新 + rollback 需求？——是 → NgRx 中间件方案成熟。四项都没命中 → 推荐迁移到 signal store + @ngrx/signals。

### 9. (A) NgRx Selector 的 memoize 机制是怎么实现的？为什么 store.select(state => state.users) 每次 state 变都会触发下游重渲染而 createSelector 不会？

**来源**：转述自本关 §二 Selector + §八 Selector 不 memoize 误区

createSelector 内部缓存上一次输入的引用和输出结果——只有输入 selector 返回新引用时才重新计算。直接 `store.select(fn)` 没有缓存——Store 每次 state 发射都执行 fn → 即使返回同一份引用（因为父 state 对象是新的 spread 产生的）→ `distinctUntilChanged` 判不等 → 下游重渲染。createSelector + 稳定引用 → 只在 users 数组本身变时才通知。

### 10. (B) Effect 里用了 mergeMap 做搜索请求——用户连续输入 abc 发了 3 个请求结果 d 的响应比 c 先回来覆盖了——怎么修？

**来源**：转述自本关 §二 Effect 与 §九对照 RTK

mergeMap 并行处理所有请求不取消旧的 → 响应乱序。修法：改 `switchMap`——新值来时自动取消前一个 inner Observable → 只有最新请求的结果会 dispatch。如果必须保序用 concatMap（一个完了才发下一个）。最佳实践：搜索类 Effect 默认 switchMap + debounceTime。

### 11. (C) ComponentStore vs NgRx Store vs signal service 三者定位有什么本质区别？

**来源**：转述自本关 §五 ComponentStore + §四 SignalStore

- **signal service**（@Injectable providedIn:'root'）：全局共享、无框架依赖、最轻量。
- **ComponentStore**：组件级作用域、有 RxJS effect 管道（tracing）、随组件销毁——适合一页一 store 的局部状态 + 复杂异步流。
- **NgRx Store**：全局单例、跨 feature 共享、DevTools 时间旅行——适合多团队大项目的统一状态协议。
选择逻辑：先 signal service → 局部复杂 → ComponentStore → 全局复杂 → NgRx Store。

### 12. (D) 设计一个「乐观更新 + 失败回滚」的 NgRx 方案：用户点赞帖子、API 失败时撤销本地状态变化。

**来源**：转述自本关 §二 Effect + §五 DevTools + 14 包 sig-migrate 乐观更新知识

```ts
// actions
like({postId}), likeSuccess({postId}), likeFailure({postId, previousCount})

// reducer
on(like, (state, {postId}) => ({ ...state, posts: mapPost(state.posts, postId, p => ({...p, liked: true, count: p.count+1})) }))
on(likeFailure, (state, {postId, previousCount}) => ({ ...state, posts: revertPost(state.posts, postId, previousCount) }))

// effect
like$ = createEffect(() => actions$.pipe(
  ofType(like),
  switchMap(({postId}) => http.post(`/api/posts/${postId}/like`).pipe(
    map(() => likeSuccess({postId})),
    catchError(() => of(likeFailure({postId, previousCount: /* snapshot */}))),
  )),
));
```
加分：用 NgRx snapshot middleware 自动记录 before state。

### 13. (A) 解释 NgRx Action 的 `createAction` + `props<T>()` 设计——为什么 action 必须是纯对象且 type 字段是唯一标识？

**来源**：转述自本关 §一五大概念与 §五时间旅行前提

Action 是 Redux 流的消息单元——纯对象保证：① 可序列化 → DevTools 可记录/回放/导入导出；② 可重放 → 时间旅行需要确定性；③ type 是唯一标识 → Reducer/Effect 通过 ofType(type) 筛选处理。`props<T>()` 给 action 添加 payload 类型（TS 推断）。禁止在 action 里放函数/class 实例——否则序列化失败。

### 14. (B) 同事在组件 constructor 里 `this.store.select(selectUsers).subscribe(...)` 手动订阅——zoneless 项目下有什么风险？

**来源**：转述自本关 §九对照 + L4 ng-rx-bridge 知识

手动 subscribe 不自动清理 → 组件销毁后订阅仍活 → 内存泄漏。zoneless 下没有 zone.js 兜底帮你触发变更检测——但更重要的是必须用 `takeUntilDestroyed()` 或 `AsyncPipe`/`toSignal` 管理生命周期。推荐写法：`users$ = this.store.select(selectUsers)` → 模板 `users$ | async`，或 `users = toSignal(this.store.select(selectUsers), {initialValue: []})`。

### 15. (D) 面试官问「2026 年你会在新 Angular 项目里选 NgRx 还是 signal store？为什么？」给出你的判断和理由。

**来源**：转述自本关 §七选型判据 + §四 @ngrx/signals + 综合全课

我的判断：**先 signal store，不预设 NgRx**。理由：① v21+ zoneless 默认 → signal 是变更检测的一等公民 → NgRx 的 Observable 管道在 zoneless 下需要额外 AsyncPipe/toSignal 桥接；② @ngrx/signals 已发布覆盖大部分 Redux 特性（entity、responses）且更 signal-native；③ 官方推荐 start simple。只在这三条件同时满足时上经典 NgRx：跨 feature 共享 + DevTools 审计 + 团队 20+ 人需强约定。一句话：架构选型由问题规模决定——不因「企业级」标签无脑上 NgRx。
