# mobx-stores：业务域建模——多 store 组织

> 目标：用 MobX 的对象图能力建模业务域（多 store 互引、实体即对象），掌握 fromJS/toJS/patch/onSnapshot 的持久化边界，理解它与 Redux/Zustand『扁平不可变 store』的哲学分岔（呼应 za-patterns、svelte-stores、mobx-core）

## 一、两条建模路线的世界观差

Redux/Zustand 的 store 是一张**扁平 JSON 快照**：`{ usersById: {...}, postsById: {...}, commentsById: {...} }`，实体间只有 id 引用（范式化，数据库思维）。MobX 允许你建**对象图**：

```js
class Store {
  userStore = new UserStore(this);
  postStore = new PostStore(this);
  constructor() { makeAutoObservable(this); }
}

class User {                              // 实体是一等公民
  constructor(store, data) { this.store = store; Object.assign(this, data); }
  get posts() {                           // 关系是派生，不是 join 表
    return this.store.postStore.list.filter((p) => p.authorId === this.id);
  }
}
```

`store.userStore.currentUser.posts[0].author === store.userStore.currentUser` ——**循环引用在对象图里是常态，在扁平快照里是要避免的事故**。选型坐标：

| 维度 | 扁平不可变（Redux/Zustand） | 对象图可变（MobX） |
| --- | --- | --- |
| 实体关系 | id 外键+手工 join | 直接引用/方法 |
| 状态更新 | 生成新快照替换 | 就地改字段 |
| 时间旅行 | 天然（action 流水） | 靠 patch/onSnapshot 补 |
| 序列化/同构 | 天然 JSON | 需要 toJS 边界 |
| 心智模型 | 数据库 | 领域对象（DDD 味） |

结论先行：**领域关系密集（编辑器、协作、游戏、复杂表单）→ 对象图回本；以服务端缓存为主（CRUD 大盘）→ 扁平快照省事。**

## 二、store 树的组织纪律

多 store 互引很爽，也很容易写成意大利面。四条社区血泪纪律：

1. **RootStore 是唯一组装点**：子 store 通过 `this.store` 拿兄弟，禁止 store 之间直接 import 单例互引（import 循环+测试无法隔离双杀）；
2. **实体 store 与集合 store 分工**：`User`（单实体方法：follow()、派生 computed）与 `UserStore`（集合管理：byId Map、list 派生、加载 action）分开——实体的行为长在实体上，这就是 MobX 项目比 Redux 项目『OO 味重』的根源；
3. **生命周期三态**：store 树要有明确的 创建（每请求/每页面）→ 注水（JSON 进构造器）→ 销毁（dispose 所有 reaction）时刻表，SPA 全局单例和路由级临时树要分层；
4. **跨 store 修改走 action**：`postStore.add(post)` 里顺手 `userStore.incrementCount()`——同一次 action 调用栈内都算一个事务，没问题；但要警惕『A action 写 B 的字段』的网状调用，review 时按『谁的数据谁的门』收窄。

## 三、可变世界的边界协议：toJS / onSnapshot / onPatch

对象图逃不开两个现实：**存进 localStorage/发给后端**（得是 JSON）、**多端同步/撤销**（得知道变了什么）。MobX 核心库自带一组边界工具：

```js
import { toJS, onSnapshot, onPatch, compareStructural } from 'mobx';

const json = toJS(store.userStore.list);        // observable 图 → 纯 JSON（单向，断引用）
// 注水方向：由你的类构造器收 JSON（new UserStore(JSON.parse(raw))）

const stop = onSnapshot(
  store.settings,
  (snap) => localStorage.setItem('settings', JSON.stringify(snap)),
  { equals: compareStructural },                 // 结构比较版：真没变才不落盘
);

const stop2 = onPatch(store.todos, (patch) => ws.send(patch)); // 字段级流水账
// patch 形如 { op: 'replace', path: '/2/done', value: true }（JSON Patch 家族）
```

三个工具的分工说人话：`toJS` 是出境签证（observable→纯数据，别把代理漏出边界）；`onSnapshot` 是定时拍照（整体快照落盘，简单粗暴但大对象拍照贵）；`onPatch` 是流水账（字段级变更日志，网络传输与审计友好、撤销栈素材）。**可变 store 的时间旅行/协作同步，全部建立在这条边界协议上**——这也是它比不可变路线多出来的一层运维成本（呼应 mobx-core 的『结果账 vs 事件账』）。

## 四、disposer 收纳：store 级副作用的生命周期

```js
class SyncStore {
  disposers = [];
  start() {
    this.disposers.push(
      reaction(() => this.queue.length, flush),
      onSnapshot(this.settings, persist),
      onPatch(this.doc, sendPatch),
    );
  }
  stop() { this.disposers.forEach((d) => d()); this.disposers = []; }  // 一键灭灶
}
```

store 级 reaction 的泄漏比组件级更隐蔽（组件卸载框架帮你兜，store 销毁没人管）——**start/stop 成对、disposers 数组收纳**是 MobX 中大型项目的标配模式。React 侧对应：RootStore 挂 Provider 生命周期，SSR 每请求新建（mobx-react 关讲过的纪律）。

## 五、和邻近路线的握手

- **与 Zustand**：Zustand 也能往 store 里塞类实例，但 selector 的引用比较会逼你回扁平快照——两派工具链会把你推回各自哲学（za-core 见）；
- **与 svelte stores**：Svelte 的 writable/derived 是『最小 signal 容器+自动退订约定』，组织层自由度类似 Zustand——都证明 store 组织（对象图 vs 快照）与响应式原语是两个正交维度；
- **与 mobx-state-tree（MST）**：官方系带类型+快照+patch 全家桶的框架化选项，中小项目核心 MobX+约定即可，重协作/重回放需求再看 MST（sig-capstone 实战见取舍）。

> 🚀 部署预告：本关的边界三件套（toJS/onSnapshot/onPatch）全部纯 JS 可跑，配合 Vite 起的双窗口 demo 可现场演示『改一个字段、看到 patch 流水』——L8 sig-migrate 会把这套协议用于数据版本迁移演练。
