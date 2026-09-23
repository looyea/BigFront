# L4 阶段作业：MobX 实战

> 覆盖：mobx-core / mobx-react / mobx-stores
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（解构丢追踪）
```jsx
const Panel = observer(({ store }) => {
  const { open } = store.ui;
  return open ? <Body /> : null;
});
```
点击按钮 action 里 `store.ui.open = true` 后面板不动。指出读取时机错误，给两种修法。

**Bug 2**（异步裸写）
```js
async load() {
  const res = await fetch('/api/user');
  this.user = await res.json();     // 控制台告警
}
```
指出 action 事务边界为何在 await 后失效，给两个修法。

**Bug 3**（追踪作用域误解）
某同学说："autorun 里读到的 signal 字段会建依赖，但我把读取写在 autorun 调用的普通函数里就不算依赖。" 判断对错并说明追踪上下文如何随调用栈传播。

**Bug 4**（深读风暴）
```jsx
const Stats = observer(() => (
  <pre>{JSON.stringify(toJS(rootStore), null, 2)}</pre>
));
```
任意字段变化 Stats 必渲且页面卡。指出『读取面=订阅面』在这里的体现，给保留调试功能的替代方案。

**Bug 5**（reaction 方向搞反）
```js
reaction(
  () => console.log('同步中'),                      // 数据函数
  () => analytics.track(store.filter),              // 效果函数
);
```
订阅永远不触发。指出两段函数写反了哪两件事，并说明效果函数里读 store.filter 为什么不建依赖。

**Bug 6**（computed 当 action 用）
```js
get total() { this.count++; return this.items.length; }
```
把计数写进 getter 被 lint 拦截。用 computed 的纯读取契约解释为什么 getter 里禁止写。

**Bug 7**（disposer 泄漏）
路由离开销毁了组件，但 store 里三个 reaction 仍活着并持有组件闭包引用。指出 store 级副作用的收纳缺失，写出 start/stop 模式骨架。

**Bug 8**（边界漏 Proxy）
把 observable 数组直接 postMessage 给 Worker，对端 structuredClone 报错/数据巨大。指出出境前的缺失动作，说明『代理不过界』协议。

**Bug 9**（SSR 串数据）
Node 端用模块级 `export const store = new RootStore()`，并发两个请求 A 用户看到了 B 用户的购物车。指出根因与正确生命周期。

**Bug 10**（join 思维错配）
从 Redux 迁移的同事坚持把对象图拆成 usersById/postsById+selector join，抱怨'MobX 也是这套'。指出这种迁移丢掉了 MobX 的什么红利，什么时候才该用扁平化。

## 二、手写题（5 题）

**手写 1**：用 makeAutoObservable 写 Counter store（count+increment+ doubled computed），再写一个 observer 组件只订 doubled。3 分钟内完成为标准。

**手写 2**：默写 reaction/autorun/when 各一个 5 行内示例，并为每个标注『谁建立依赖』。

**手写 3**：写 RootStore（userStore+cartStore）组装：Cart 的总价 computed 跨 store 读 catalogStore 的单价；给出测试里注入 fakeCatalogStore 的骨架。

**手写 4**：用 onSnapshot+compareStructural 给 settings store 做『内容真变了才写 localStorage』，并处理 disposer。

**手写 5**：口述『observable → 持久化 → 重启注水』完整链路：toJS 时机、序列化格式、注水入口（构造器）、失败降级（默认值）。

## 三、场景题（1 题，20 分）

协作白板应用（MobX 技术栈）：画布上有形状对象图（shape 有位置/样式/层级）、支持撤销、多端同步、每 5 分钟版本存档。请给出：① store 树设计（哪些实体、关系用引用还是 id，说明理由）；② patch 层方案（onPatch 聚合粒度、网络传输格式、丢失对账策略）；③ 撤销栈的入栈单位与逆操作来源；④ observer 组件树的订阅规划（画布节点怎么拆组件让拖拽一个形状时其他形状零重渲）。

## 四、简答题（3 题）

**简答 1**：observer 组件的两条重渲触发通道是什么？各自归谁管？

**简答 2**：MobX 的『字段级订阅+组件级重渲』与 Solid 的『表达式级更新』差在哪一档？举一个 Solid 赢而 MobX 输的性能场景。

**简答 3**：为什么说可变对象图路线的『时间旅行要补票』？写出 onPatch 逆操作撤销的最小原理。

## 五、挑战题 🏆（+10 分）

用 MobX 实现一个 100 行的『响应式番茄钟工作流』：Task 实体对象图（任务含子任务与状态）、跨任务统计 computed（完成率/预计剩余）、持久化边界（onSnapshot+结构比对落 localStorage、启动注水恢复）、一个 observer 面板组件树（列表/进度条/计时器三块，要求：改单个任务的 title 只有该任务行与列表外其他两块都不重渲——用 React Profiler 截图或日志计数证明）。（分项合计 ≤10 分：对象图与统计 3 + 持久化边界 3 + 订阅面隔离证明 4。）
