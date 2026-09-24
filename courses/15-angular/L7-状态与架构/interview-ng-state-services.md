# ng-state-services 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 signal store 模式、asReadonly 封装、持久化、拆分粒度与何时上 NgRx 的题组。

### 1. (A) 描述 Angular signal store 的标准三件套（private writable / public readonly / action），解释为什么需要这个模式而不是直接暴露 writable signal。

**来源**：转述自本关 §二封装纪律段

三件套：① `private _todos = signal<Todo[]>([])` —— 内部唯一可写源；② `readonly todos = this._todos.asReadonly()` —— 外部只读视图（TS 类型无 set/update）；③ action 方法（add/toggle/remove）—— 所有写操作的入口。为什么不直接暴露 writable：a) 防止外部随意 set 绕过业务逻辑（如校验、日志、权限）；b) 集中变更便于调试追踪（所有写入都在 action 里可打断点）；c) 将来加乐观更新/撤销只需改 action 不影响消费方。

### 2. (B) 同事直接在组件里 `this.todoStore._todos.set([...])` 改了 store——TS 编译为什么没报错？怎么彻底防住？

**来源**：转述自本关 §二 asReadonly 写保护 + §八常见陷阱

`private` 是 TS 关键字——编译后的 JS 没有真正的私有（v22 前）。`_todos` 用下划线前缀只是约定。TS 的 private 在外部类通过 import 后 TS 会报错——但如果通过 `// @ts-ignore` 或在 template 里 `store._todos` 则绕过。**彻底防住**：只暴露 `todos = _todos.asReadonly()` —— readonly 类型 `Signal<Todo[]>` 没有 set 方法，TS 编译就报错。加 ESLint 规则 `no-underscore-dangle` 或 `@angular-eslint/no-private-lifecycle-access` 兜底。

### 3. (C) 对照 Zustand、Pinia、NgRx 三家的状态管理范式，说清 Angular signal store 在什么位置。

**来源**：转述自本关 §七对照 Zustand 与 §五何时需要状态库

| 维度 | Zustand | Pinia | NgRx | Angular signal store |
|------|---------|-------|------|---------------------|
| 核心理念 | hook-based store | options/setup store | Flux 单向流（action→reducer→state） | DI 单例 + signal |
| 可变性 | set 产生新 state | 可 mutate（Vue reactive） | 完全不可变 | 不可变（spread） |
| 派生 | 外部 useMemo | getters | selectors | computed 一等公民 |
| 学习曲线 | 低 | 中 | 高 | 低（官方内置） |
| DevTools | 有限 | Vue DevTools | Redux DevTools 时间旅行 | 无（需手动） |

定位：signal store = Zustand 的简洁 + Pinia 的 getter + Angular DI 免费单例——但不如 NgRx 的中间件生态。

### 4. (D) 设计一个电商「购物车 store」：条目增删、数量修改、折扣码、总价 computed、localStorage 持久化——完整代码。

**来源**：转述自本关 §二+§四+§六的综合应用

```ts
@Injectable({ providedIn: 'root' })
export class CartStore {
  private _items = signal<CartItem[]>(loadFromStorage());
  private _discount = signal<number>(0);
  readonly items = this._items.asReadonly();
  readonly discount = this._discount.asReadonly();
  readonly total = computed(() =>
    this._items().reduce((sum, i) => sum + i.price * i.qty, 0) * (1 - this._discount())
  );
  addItem(product: Product) { this._items.update(items => [...items, { ...product, qty: 1 }]); }
  removeItem(id: string) { this._items.update(items => items.filter(i => i.id !== id)); }
  updateQty(id: string, qty: number) { this._items.update(items => items.map(i => i.id === id ? { ...i, qty } : i)); }
  applyCode(code: string) { /* HTTP → this._discount.set(0.1) */ }
  constructor() { effect(() => { localStorage.setItem('cart', JSON.stringify(this._items())); }); }
}
```

### 5. (A) 为什么 signal store 里数组更新必须用 spread 产生新引用？解释 Object.is 检测机制。

**来源**：转述自本关 §八常见陷阱第 4 点与 14 包 signals 知识

Angular signal 写入后通知下游依赖者的条件是 `Object.is(newValue, oldValue) === false`。`array.push(x)` 返回 length 且原数组引用不变——`Object.is(sameArray, sameArray) === true` → signal 认为「没变」→ 不通知 → 模板/computed 不更新。`[...array, x]` 创建新数组引用 → Object.is 为 false → 触发更新。这就是为什么 Redux/Zustand/Angular signal 都强调不可变。

### 6. (B) signal store 里的 computed 访问了另一个 service 的 signal——这两个 service 有循环依赖怎么办？

**来源**：转述自本关 §六 store 拆分粒度与 13 包 ng-services 循环依赖处理

Angular DI 不允许循环注入（A inject B、B inject A → NullInjectorError）。解法：① 提取第三个共享 store C，A 和 B 都 inject C；② 用 `forwardRef(() => B)` 延迟解析（不推荐 signal 场景）；③ computed 里用 `inject()` 时通过 `runInInjectionContext` + 可选注入 `inject(B, { optional: true })`。最佳实践：按业务域拆 store——购物车不需要反向依赖用户，用户不需要反向依赖购物车。

### 7. (C) Angular signal store 与 14 包 Zustand 在「跨路由共享」和「组件卸载后状态是否保留」上的行为差异？

**来源**：转述自本关 §五 何时一个 service 够 + Zustand 知识对照

- **Zustand**：`create()` 返回的 store 挂在模块级——SPA 期间全局存在；路由切走不销毁（除非用 `useEffect` 手动 reset）。
- **Angular providedIn:'root' service**：与应用同生命周期——切路由/组件销毁都不影响——状态天然持久。
- 差异在 **组件级状态**：Zustand 无 scoped store（需要 Provider 手动限范围）；Angular 可在 component providers 里 provide 让 store 随组件销毁 → 更灵活的生命周期控制。

### 8. (D) 面试官问「你的 signal store 需要支持 undo/redo——怎么做？」给出两种方案。

**来源**：转述自本关 §五何时需要状态库

方案一（轻量 signal 版）：store 内部维护 `history = signal<Todo[][]>([])`，每次 action 前 push 当前 state；undo 时 pop → `this._todos.set(history.pop())`。限制：内存膨胀需限深度。方案二（NgRx ComponentStore）：`patch` + `undoable` 操作符——内置 `withUndoRedo` 中间件自动记录 patch 快照。加分：讨论 deep clone vs immer 的开销；signal 场景推荐 immer（`produce` from `@ngrx/signals`）。

### 9. (A) 持久化 effect 中 `effect(() => localStorage.setItem('key', JSON.stringify(this._data())))` 有什么性能隐患？怎么优化？

**来源**：转述自本关 §四持久化段

隐患：每次 _data signal 变 → 整个对象 JSON.stringify + 写 localStorage（同步阻塞主线程）。大对象/高频更新（如拖拽实时保存）会卡帧。优化：① 加 `debounceTime`：用 RxJS Subject + pipe(debounceTime(500)) 替代 effect；② `requestIdleCallback` 延后写入；③ 拆细粒度只序列化变化部分（structuredClone + diff）；④ 对 _data 用 `asReadonly` 包一层 computed 过滤——只有实质变化才写。

### 10. (B) 组件里 `ngOnDestroy` 时发现 store 的 effect 仍在运行并访问已销毁的 DOM 引用——怎么防？

**来源**：转述自本关 §八常见陷阱与 14 包 signals 知识

如果在组件里 `effect(() => { document.getElementById(...) })`——组件销毁后 DOM 不存在但 effect 仍活。修：① 组件内 effect 自动跟随组件销毁（DestroyRef）——Angular v16+ 在组件 injection context 里创建的 effect 自动清理；② 如果 effect 在 service 里且访问 DOM——**不要在 service 里访问 DOM**，提取到组件；③ `DestroyRef.onDestroy(() => { /* cleanup */ })`。

### 11. (C) 对比 Angular signal store、MobX store（14 包）、React Redux Toolkit createSlice 三种「状态即对象」的写法风格。

**来源**：转述自本关 §七对照 + MobX/Zustand/Redux Toolkit 知识

- **Angular signal store**：class + signal + computed + method；显式不可变；DI 单例；无装饰器响应式。
- **MobX store**：class + `makeObservable(this, { count: observable, double: computed })`；隐式可变——`this.count++` 直接改；reaction 自动追踪。
- **Redux Toolkit createSlice**：纯函数 reducer + immer；状态是 plain object 不是 class；action → dispatch → reducer 单向流。
一句话：Angular 重 class 纪律、MobX 重隐式魔法、RTK 重函数纯度。

### 12. (D) 设计一个多 tab 同步的 signal store（localStorage 方案）：一个 tab 改了购物车，其他 tab 实时同步——给核心代码。

**来源**：转述自本关 §四持久化段扩展 + 跨 tab 通信

```ts
@Injectable({ providedIn: 'root' })
export class CartStore {
  private _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();

  constructor() {
    // 初始化
    this._items.set(JSON.parse(localStorage.getItem('cart') ?? '[]'));
    // 监听其他 tab 的 storage 事件
    fromEvent<StorageEvent>(window, 'storage').pipe(
      filter(e => e.key === 'cart' && e.newValue),
      map(e => JSON.parse(e.newValue!)),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(items => this._items.set(items));
  }

  addItem(item: CartItem) {
    this._items.update(items => {
      const next = [...items, item];
      localStorage.setItem('cart', JSON.stringify(next));
      return next;
    });
  }
}
```
加分：讨论 BroadcastChannel 替代 storage event 的优势（同 tab 也能收到 + 更灵活）。

### 13. (A) 在 zoneless 模式下 signal store 的性能特性是什么？为什么 computed 不会「过度计算」？

**来源**：转述自本关 §二 computed + L4 ng-zoneless 知识

zoneless 下变更检测完全由 signal 驱动。computed 是 **lazy**（惰性）——只在被读取时且依赖变了才重算。如果组件模板不消费某个 computed → 它根本不执行。同时 **memoized**：依赖未变时重复读取返回缓存值。所以 store 里定义 10 个 computed 不影响性能——只有模板实际用到的那几个会在依赖变化时计算一次。

### 14. (B) 同事把 store 注入到组件的 `providers: [TodoStore]` 而非用 providedIn:'root'——效果有什么不同？什么场景该这么做？

**来源**：转述自本关 §五跨路由共享 + §六 store 拆分

`providers: [TodoStore]` → 每个组件实例拥有**独立的 store 实例**（不共享）。场景：编辑器里每个 Tab 是一个独立编辑器实例——每个有自己的 undo 历史。对比 providedIn:'root' 全局一份。面试考点：Angular DI 层级——root injector vs component injector 决定单例归属。

### 15. (D) 面试官让你口述给一个 React 开发者解释「Angular 里不需要 Redux/Zustand」——怎么组织你的论点？

**来源**：转述自本关 §一~§五与 React 生态对照

论点三步：① DI 给免费单例——React 需要 Context/Provider 包裹 + 手动 useMemo 才拿到全局 store；② signal 给自动依赖追踪——React setState 需要不可变 spread + useMemo 手算派生；Angular computed 天然惰性 memo；③ 80% 场景 = 跨组件共享状态 = providedIn:'root' service + signal 搞定。只有乐观更新/时间旅行/中间件链才需要 NgRx。一句话：「Angular 的 DI + signal 让 store 开箱即用」。
