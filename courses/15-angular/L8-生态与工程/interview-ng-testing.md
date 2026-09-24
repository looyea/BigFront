# ng-testing 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Vitest 默认栈、standalone 组件测试、signal store 纯测与 HttpClient mock 的题组。

### 1. (A) 解释 v21+ Vitest 取代 Karma 的核心原因与收益。

**来源**：转述自本关 §一默认栈切换段

原因：① Karma 维护缓慢、插件生态老化、启动慢（需要真实浏览器）；② Angular v20 切 @angular/build (Vite) 后，测试栈与构建栈不统一——Vitest 共享同一套 Vite transform 管道（TS/SCSS/HTML 模板编译一致）→ 更快、更一致。收益：启动从 5s→< 1s；watch 模式增量极快；jsdom 环境跑单元无需浏览器。

### 2. (B) 同事写组件测试 `fixture.componentInstance.user = { name: 'A' }` 但模板不显示——为什么？

**来源**：转述自本关 §二 setInput + §九常见陷阱

v16+ signal-based input 不能用直接赋值——必须 `fixture.componentRef.setInput('user', { name: 'A' })`。原因：signal input 是只读 Signal 包装——外部写入只有 setInput API 才触发 signal 通知链 → 变更检测 → 模板更新。旧 @Input 装饰器才用 componentInstance 直接赋值。

### 3. (C) 对比 Angular TestBed 测试与 React Testing Library / Vue Test Utils：三种组件测试哲学的异同。

**来源**：转述自本关 §二与 React/Vue 测试生态对照

- **Angular TestBed**：创建完整组件 fixture → detectChanges → 查询 DOM 断言。哲学：「黑盒 + DOM 查询」但 API 更重（configureTestingModule）。
- **React Testing Library**：render + screen.getByText → 强调「用户视角查询」不测实现细节。
- **Vue Test Utils**：mount + wrapper.text()/find() —— 与 Angular 最像（wrapper = fixture）。
核心差异：standalone 组件让 Angular TestBed 更接近 RTL 的轻——不需要 NgModule 包裹。

### 4. (D) 为一个 signal store (TodoStore) 设计完整单测：覆盖 add/toggle/delete/computed 派生/边界条件。

**来源**：转述自本关 §三纯测写法

```ts
describe('TodoStore', () => {
  let store: TodoStore;
  beforeEach(() => TestBed.runInInjectionContext(() => { store = new TodoStore(); }));

  it('starts empty', () => expect(store.todos().length).toBe(0));
  it('adds todo', () => { store.add('Buy'); expect(store.todos()[0].title).toBe('Buy'); });
  it('toggles done', () => { store.add('A'); store.toggle(0); expect(store.todos()[0].done).toBeTrue(); });
  it('computes remaining', () => { store.add('A'); store.add('B'); store.toggle(0); expect(store.remaining()).toBe(1); });
  it('deletes todo', () => { store.add('A'); store.remove(0); expect(store.todos().length).toBe(0); });
  it('filters by status', () => { store.add('A'); store.toggle(0); store.setFilter('active'); expect(store.filteredTodos().length).toBe(0); });
});
```

### 5. (A) HttpTestingController 的 expectOne + flush 模式是怎么拦截真实请求的？

**来源**：转述自本关 §四 HttpClient 测试段

provideHttpClientTesting() 注册一个 **Backend mock**：它 intercept HttpClient 发出的所有 HttpRequest → 不执行真实 fetch/XHR → 请求进 pending 队列。测试代码 `httpMock.expectOne('/api/users/1')` 从队列取出匹配请求 → `req.flush(mockData)` 用 mock 数据 complete Observable → 订阅者收到数据。verify() 确认队列清空。

### 6. (B) zoneless 项目下 detectChanges() 的行为有什么变化？测试里要注意什么？

**来源**：转述自本关 §八 zoneless 配置 + L4 ng-zoneless 知识

zoneless 下变更检测由 signal 驱动——只有被读取的 signal 变化才标脏。fixture.detectChanges() 仍有效——但语义变了：不再「遍历所有组件」而是「处理所有已标脏的 signal 通知」。测试注意：① signal.set 后必须 detectChanges 才能反映到 DOM；② 不需要 fixture.ngZone?.run() 包裹（无 zone）。

### 7. (C) Angular 测试金字塔与 14 包 sig-testing 推荐的 Zustand store 测试有什么共通原则？

**来源**：转述自本关 §三纯测 + §八金字塔

共通原则：① **store 测试不需要 UI**——直接实例化调 action 断言 state（Zustand 的 create 出来的 store.getState()/setState 同理）；② **不 mock 被测逻辑**——只 mock 外部 I/O（HTTP）；③ **断言可观察行为**——不测 signal 内部实现而是测 computed 结果和 DOM 输出；④ **一个测试一个行为**。

### 8. (D) 写一个路由守卫测试的完整 setup：验证 authGuard 未登录时返回 UrlTree 指向 /login。

**来源**：转述自本关 §五守卫测试段

```ts
it('returns login UrlTree when not logged in', () => {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { isLoggedIn: () => false } },
      provideRouter([]),
    ],
  });
  const urlTree = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
  );
  expect(urlTree).toBeInstanceOf(UrlTree);
  expect((urlTree as UrlTree).toString()).toContain('/login');
});
```

### 9. (A) `beforeEach(async () => { await TestBed...compileComponents(); })` 里 async/await 和 compileComponents 的作用是什么？

**来源**：转述自本关 §二 TestBed 写法

compileComponents() 触发 AOT 风格的模板编译（把 template string / templateUrl 编译成 render function）——如果有外部模板文件需异步加载则返回 Promise → await 确保编译完再开始测试。async 包裹使 Zone.js/Vitest 能正确追踪异步完成。standalone + inline template 时可以省略（v20 后 TestBed 默认预编译）。

### 10. (B) 测试里 `fixture.whenStable()` 和 `fixture.detectChanges()` 的区别？什么时候必须用 whenStable？

**来源**：转述自本关 §九陷阱第 3 点

`detectChanges()` 同步触发一次 CD——不等异步。`whenStable()` 返回 Promise 等所有异步任务（setTimeout/Promise/Observable delay）完成后 resolve。场景：组件 ngOnInit 里 subscribe 了 HTTP mock flush 后的数据 → detectChanges + whenStable 才能确保 DOM 已更新。zoneless 下 whenStable 仍然有效（基于 pending 任务计数）。

### 11. (D) 设计一个「登录页组件」的完整测试套件：表单验证、HTTP 调用、成功跳转、失败提示。

**来源**：转述自本关 §二/§四/§五的综合应用

测试点：① 初始 render → 提交按钮 disabled（表单 invalid）；② setInput 合法值 → 按钮 enabled；③ 点击 → expectOne POST /api/login → flush 成功 → router.navigate 被调用 to '/'；④ flush 401 → 显示错误提示 `fixture.nativeElement.querySelector('.error').textContent`。setup 需 provideRouter + provideHttpClientTesting + Router spy。

### 12. (A) E2E (Playwright) 与组件集成测试 (TestBed) 的边界在哪？一个「下单流程」用例该放哪层？

**来源**：转述自本关 §七 E2E 分工段

边界：TestBed 测**单组件/少量组件协作**（无真实路由/HTTP）；Playwright 测**跨页面完整用户旅程**（真实路由+真实后端或完整 mock server）。「下单流程」：选商品→加购物车→填地址→确认→支付→结果页 → 跨 6 页面 + 路由导航 + 真实 store 持久化 → **Playwright E2E**。但「购物车组件数量加减按钮」→ TestBed 足矣。

### 13. (C) 对比 Angular Vitest 测试配置与 React 项目 vitest + @testing-library/react：谁需要更多样板？

**来源**：转述自本关 §一~§二

Angular 需要：① `@analogjs/vite-plugin-angular`（编译模板）；② TestBed.configureTestingModule（虽然 standalone 简化了）；③ 处理 DI（provideRouter/provideHttpClientTesting）。React 需要：jsdom 环境 + render() + Provider 包裹（Context/Router）。结论：Angular 样板略多（DI 是核心差异）；standalone 已大幅缩小差距。

### 14. (B) 测试通过但生产环境报 'Cannot read property of undefined'——列举三种「测试覆盖不到」的常见盲区。

**来源**：转述自本关 §八常见陷阱与测试金字塔

① **未覆盖的异步竞态**：测试里 flush 是同步的——生产中响应延迟 2s 且组件可能已销毁 → 需要 E2E 或 fakeAsync；② **未测错误路径**：只测了 happy path（flush 200）——未测 500/timeout → 加 error 分支测试；③ **环境差异**：测试 jsdom 无 IntersectionObserver/localStorage 限制——真实浏览器不同。

### 15. (D) 面试官问「你怎么给一个遗留 NgModule 项目引入测试？先测什么后测什么？」给出策略。

**来源**：转述自本关 §八金字塔与实战经验

策略：① **先测 core services**（signal store / 纯业务逻辑）——不需要改组件、投入产出最高；② **再测 shared 层 pipes/directives**——纯函数输入输出；③ **关键路径组件**（表单/列表）用 TestBed 写集成测——不追 100% 覆盖；④ **E2E 覆盖主流程**（登录+核心 CRUD）——Playwright 5-10 条用例；⑤ 用 `ng generate component --skip-tests` 渐进——不一次铺满。加分：强调先建立 CI 跑通测试 → 再提升覆盖率。
