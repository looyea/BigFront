# L9 终战作业 · 内核、迁移与毕业项目（全课综合）

> 范围：响应式源码级内核、React→Solid 迁移翻译、毕业项目全栈架构综合。这是收官作业，Bug 跨全课。共 10 Bug + 5 手写 + 1 场景 + 3 简答 + 1 挑战。

## 一、找 Bug（每题 3 分）

**Bug 1**
```js
let cur = null;
function effect(fn){ cur = fn; fn(); }   // 少了什么？
```
把这段最小 createEffect 补成能正确支持嵌套 effect 的版本，指出缺陷。

**Bug 2**
```tsx
const [n, setN] = createSignal(1);
createEffect(() => {
  setTimeout(() => console.log(n()), 100);
});
setN(2);   // 期望打印 2，实际永远打印 1（且只打一次）
```
从"同步登记"角度解释为什么不更新，给两种修法。

**Bug 3**
```tsx
function Greeting(props) {
  const { name } = props;         // React 老手写法
  return <p>Hello {name}</p>;
}
```
父组件改了 name，这里不更新。为什么？React 里同样的解构为何没事？

**Bug 4**
```tsx
const fullName = createEffect(() => first() + ' ' + last());
```
想缓存派生值却写成了 effect。改对，并说 effect 与它在"是否产出可订阅值"上的区别。

**Bug 5**
```tsx
{user()?.admin && <AdminPanel/>}
{items.map(it => <Row key={it.id} item={it}/>)}
```
两处 React 惯用法在 Solid 组件里失效/低效。分别换成什么？

**Bug 6**
```tsx
const [s, setS] = createStore({ rows: [] });
function add() { const { rows } = s; rows.push({ id: 1 }); }
```
界面不动。指出 store 的两条违规并给正确写法（含多字段一次改）。

**Bug 7**
```tsx
const App = () => {
  const root = createRoot(() => createEffect(() => setInterval(tick, 1000)));
  return <div/>;
};
```
组件卸载后 tick 永不停。为什么 createRoot 这里帮了倒忙、怎么收？

**Bug 8**
```tsx
const getUser = query(async () => {
  const session = await useSession({ password: process.env.SECRET });
  return session.data;
}, "user");
```
上线后客户端 bundle 里搜到 SECRET 逻辑。缺哪一行？它编译后本应发生什么？

**Bug 9**
```ts
const update = action(async (id, fd: FormData) => {
  await db.update(id, { name: fd.get("name") });
  const fresh = await getProfile(id);     // 想"顺手"拉新数据
  return fresh;                            // 于是每次改动 = 2 个请求
}, "update");
```
没吃到 single-flight。按官方两前提补两处（其中一处不在本文件）。

**Bug 10**
```tsx
export default function Items() {
  const items = createAsync(() => getList());
  const { title } = items();   // 组件体第一行
  return <ul>{items().map(i => <li>{title + i.title}</li>)}</ul>;
}
```
偶发 `cannot read title of undefined`，且列表项不响应。三处错分别是什么？

## 二、手写（每题 7 分）

**手写 1**：用最小代码（signal + currentSubscriber + subscribers Set + === 短路）手写一个能跑通的 `createSignal`/`createEffect`，并写三行 `setSignal(相同值)` 演示"不触发"。

**手写 2**：给下列 React 组件做逐行 Solid 翻译（保留行为）：
```tsx
function Counter() {
  const [n, setN] = useState(0);
  const doubled = useMemo(() => n * 2, [n]);
  useEffect(() => { document.title = `${n}`; }, [n]);
  return <button onClick={() => setN(n + 1)}>{n}/{doubled}</button>;
}
```
要求：useState→createSignal、useMemo→createMemo、useEffect→createEffect、删掉多余依赖数组，事件正常。

**手写 3**：把"一个按位置更新、一个按身份更新"两个列表分别写成 `<Index>` 与 `<For>`，并注释两者回调参数顺序为何相反。

**手写 4**：毕业项目片段——`routes/board/[id]/card/[cardId].tsx`：从 props.params 取两参数、`getCard` query（"use server"）、`route.preload` 预热、`createAsync` 消费、外层 Suspense 骨架 + ErrorBoundary 重试按钮。

**手写 5**：为一个"完成度百分比"派生 + "当前用户"共享，分别用 `createMemo`（从 cards() 算）与 Context（`useUser()` 带 undefined 抛错守卫）实现，并各写一条用全局 signal 驱动更新的 testing-library 断言。

## 三、场景题（20 分）

**场景：** 你要把一个约 40 个页面、React 写的、带 Redux + axios 拦截器 + 大量 useMemo/useCallback 的中台，整体迁到 SolidStart（后端已有 REST，暂无 SSR 需求但将来要）。请给出：① 分阶段迁移路线（含每阶段验收）；② 状态层从 Redux 到 Solid 的映射决策（哪些进 store、哪些进 query、哪些就地 signal）；③ 全量要"删掉"的 React 优化清单与要"新引入"的响应式纪律；④ 数据层两跳（先 createResource、后 Start query/action）的先后与理由；⑤ 最大风险点（团队会不自觉解构/提前求值/effect 里 set）如何用 lint、code review、测试三道闸拦住。

## 四、简答（每题 5 分）

**简答 1**：Owner 树是什么、有哪两大职责？和渲染/DOM 树为何可能不一致（举 Portal 或传出 children 的例子）。

**简答 2**：Solid 里"读时登记、写时短路、拓扑批处理"三句话各自保证什么？合成起来带来什么效果？

**简答 3**：React→Solid 迁移中，哪些是"直译"、哪些是"必须转念"、哪些是"直接删除"？各举两个代表。

## 五、挑战题（加分 10 分）

🏆 **挑战**：阅读并预测输出、解释每步响应式原因：
```tsx
const [a, setA] = createSignal(1);
const [b, setB] = createSignal(2);
const sum = createMemo(() => { console.log("M"); return a() + b(); });
createEffect(() => console.log("E", sum()));
setA(1);      // ①
setA(5);      // ②
batch(() => { setA(6); setB(7); });  // ③
setB(7);      // ④
```
(a) 初始化时 M、E 各打印几次、顺序；(b) ① 会否触发、为什么；(c) ② 时 M 与 E 打印顺序；(d) ③ 与 ④ 分别让 "E" 打印几次、体现什么机制。

---

**本阶段关键词**：signal/observer、读时登记、=== 短路、同步追踪、Owner 树/onCleanup/createRoot、拓扑序+batch、props 不解构不提前求值、Show/For/Index、createMemo 派生、store/produce、query/createAsync/"use server"、single-flight、ErrorBoundary/Suspense、prerender/Nitro/CSP、React→Solid 翻译、毕业项目全栈综合。

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🎓 **毕业**：这是「大前端学院 · SolidJS」最后一份作业。全部九关注满并通过，即标志你已具备从零构建、迁移、部署并测试一个生产级 Solid/SolidStart 全栈应用的完整能力——恭喜完赛！
