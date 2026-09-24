# 测试深化：纯测 store + 组件集成

## 一、store 是最易测的状态单元

Zustand store 是纯 JS，无需 render：

```ts
import { createStore } from 'zustand';
const make = () => createStore((set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }));
test('inc', () => {
  const s = make();
  s.getState().inc();
  expect(s.getState().count).toBe(1);
});
```

「先测 store、组件只做薄胶水」是测试金字塔在状态管理上的落法：逻辑价值 90% 在 action 里，而 store 测试毫秒级、零 DOM、天然稳定。

## 二、resetState 工厂保持干净

模块级 create 单例在测试间共享会污染。用工厂每用例新建，或提供 reset 并在 beforeEach 里 setState(初始)。

```ts
// 单例难逃时的兜底：导出初始态
const initial = useCartStore.getInitialState(); // v4.4+
beforeEach(() => useCartStore.setState(initial, true));
```

getInitialState 返回**永远不变**的初始快照（不受后续 setState 影响），比手存一份 initialState 常量可靠。更彻底的方案还是回到 za-factory：能工厂化的都工厂化。

## 三、async action 用 msw mock
用 msw（Mock Service Worker）拦截 HTTP，测 loading→success/error 三态与竞态（呼应 pinia-testing）。

```ts
server.use(http.post('/api/login', async () => await delay(50) || HttpResponse.json({ token: 't' })));
await act(async () => { useAuthStore.getState().login(creds); });
expect(useAuthStore.getState().token).toBe('t');
```

竞态用例是富矿：连发两次 setQuery，断言最终 state 对应**后发**请求的响应（配合 za-race 主题，Zustand 需自己在 action 里做 request-id 守卫——写一个失败用例再修，是 TDD 教 this 的最快方式）。

## 四、persist 测法
注入内存版 storage（自定义 StateStorage）或 store.persist 前不自动水合，测 partialize/migrate 纯函数。

```ts
const mem = new Map();
const memStorage = { getItem: k => mem.get(k) ?? null, setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k) };
create(persist(fn, { name: 't', storage: createJSONStorage(() => memStorage) }));
```

migrate 本身就是纯函数——直接喂旧 JSON 断言新结构，别绕 store（呼应 za-persist-deep）。

## 五、组件级集成
`renderHook` + `act` 测 selector 订阅是否正确重渲；自定义 render 包 StoreProvider（多实例，呼应 za-factory）。

计数重渲的标准写法：

```ts
let renders = 0;
const { result } = renderHook(() => { renders++; return useStore(s => s.a); }, { wrapper });
act(() => useStore.setState({ b: 2 }));          // 与 a 无关
expect(renders).toBe(初始值);                      // 不增长 = 订阅粒度正确
```

这条测试把「selector 粒度」从口头规范变成 CI 断言（呼应 za-selectors-deep）。

## 六、别测什么

不测第三方行为（persist 写没写进 localStorage 是浏览器的事，测你的 partialize 输出）；不测快照像素（store 状态断言优于渲染快照）；不在组件测试里验证业务规则（下沉到 store 层测）。测试预算永远花在「你的代码」上。

## 小结
优先纯测 store（工厂/getInitialState 隔离 + setState 造场景 + msw 测异步竞态），组件层用 renderHook 数渲染次数验证订阅粒度；migrate/partialize 按纯函数直测。

## 部署预告
本地给本包任一 store 配一套 Vitest + msw：一条纯 action 测、一条竞态测、一条 renderHook 重渲计数测；把「重渲次数」断言加进 CI 防回归。
