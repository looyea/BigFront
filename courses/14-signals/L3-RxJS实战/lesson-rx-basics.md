# rx-basics：Observable / subscribe / teardown——流的三要素

> 目标：从"手写事件监听的账本之痛"推出 Observable 的存在理由，掌握流的三通道与退订纪律，能一眼判断冷流热流（呼应 rx-operators、mp-events）

## 一、先看没有 RxJS 的世界要记多少账

一个"每 500ms 轮询 + 点击取消 + 出错重试"的需求，纯 DOM 写法：

```js
let timer = setInterval(poll, 500);
function onClick() { clearInterval(timer); timer = null; }
element.addEventListener('click', onClick);
// 请牢记：卸载时 clearInterval + removeEventListener；异常路径也要清
```

三笔账：**开始、值、清理**。手写版本腐烂的经典方式：忘清 interval、addEventListener 在重渲染里重复注册、错误分支提前 return 跳过了清理。RxJS 的解法粗暴有效——**把"随时间产生值"这件事整个收进一个对象**：

```js
import { interval, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

const clicks$ = fromEvent(element, 'click');
interval(500).pipe(takeUntil(clicks$)).subscribe(() => poll());
// clicks$ 本身不用清？—— fromEvent 也自带 teardown，订阅被它终止时自动解绑
```

Observable 三要素由此立起：**Observable（产生值的配方）、subscribe（按下载开关）、teardown（退订时自动还账）**。`$` 后缀是社区命名礼仪：看到 `xxx$` 就知道这是个流，不是值。

## 二、三通道：next / error / complete

Promise 只有一个结局；流是一生多个值加一个终局。subscribe 回调的三个方法对应三种信号：

```js
const sub = some$.subscribe({
  next: (v) => render(v),        // 每来一个值
  error: (e) => toast(e),        // 出错 → 同时也是终局，流就此死亡
  complete: () => showEnd(),     // 正常收工 → 终局，不再可能有 next
});
```

铁律三条：

1. `error` 与 `complete` 至多到达其一，到达即终结；
2. **终局之后这个 Observable 不会复活**——想再要一遍只能重新 subscribe（区别于事件监听器"一直挂着"）；
3. 三通道之外没有"暂停/恢复"——需要缓冲、回放、节流都靠操作符（L3 rx-operators 的 replay/scan）。

对照记忆：Promise=单张期货券（一次性的未来值）、AsyncIterator=pull（你要我才给）、Observable=push（我好了通知你）——三者是"单个异步"与"多个异步"的不同答案（与 01-es 包迭代器一关、05-node 流一关遥相呼应）。

## 三、subscribe 返回的东西：teardown 的把手

```js
const sub = interval(1000).subscribe(console.log);
// ...组件卸载、路由离开、开关关闭时：
sub.unsubscribe();   // 触发 interval 的 teardown：清掉背后的 setInterval
```

所有 RxJS 内建 Observable 创建时都自带 teardown 逻辑（interval 清 timer、fromEvent 解事件）。三种官方退订姿势，工程里按场景挑：

| 姿势 | 写法 | 适用 |
| --- | --- | --- |
| 手动句柄 | `sub.unsubscribe()` | 生命周期钩子分明的场景 |
| 容器托管 | `new Subscription(); c.add(sub1); c.add(sub2); c.unsubscribe()` | 一次注册多处清理 |
| 流内自灭 | `take(n)` / `takeUntil(stop$)` / `first()` | 声明式，最防泄漏 |

React 函数组件里最顺手的桥（18 后标准姿势）：

```js
useEffect(() => {
  const s = some$.subscribe(setState);
  return () => s.unsubscribe();
}, [some$]);
```

## 四、制造流的三板斧

```js
import { of, from, fromEvent, interval, timer } from 'rxjs';

of(1, 2, 3);                 // 同步吐 1,2,3 然后 complete——把"值"包成流
from([1, 2, 3]);             // 把可迭代对象/Promise 转成流：from(fetchJson()) 也合法
fromEvent(button, 'click');  // 把事件目标变成流（自带 teardown！）
interval(1000);              // 定时器流：0,1,2,...（永不 complete）
timer(800, 800);             // 延迟+周期：治 setTimeout 嵌套地狱
```

选型口诀：有 Promise 用 `from`（能混进管道继续 play）、只有值用 `of`、事件/DOM 用 `fromEvent`、时间用 `interval/timer`。

## 五、冷流 vs 热流：订阅时机决定一切

**冷流（cold）**：每次 subscribe 都"从头开始生产一份专属数据"——像点歌，每人一份完整音轨：

```js
const cold$ = fromEvent(document, 'click'); // 每次订阅各自记各自的账
const cold2$ = interval(1000);              // 两个订阅各自从 0 数起，互不相干
```

**热流（hot）**：生产只有一个，值广播给"订阅那一刻恰好在听"的人——像直播间，晚到的没回放：

```js
import { share } from 'rxjs';
const hot$ = someAjaxPolling$.pipe(share());
```

判断三连：① 订阅前数据已在产生？热。② 两个订阅者拿到的序列一致？冷。③ 错过就没了？多半热。冷转热的标准工具 `share()`/`shareReplay()`（回放是热流买回放券），热转冷 `startWith` 补初始值。**冷热的坑直接连通后端的 SSE/WebSocket（05 包）与小程序消息（mp-events）——面试问"两次 subscribe WebSocket 为什么行为不一样"，答案就是冷热。**

## 六、RxJS 5→7+ 的迁移防坑一句

老代码 `rxjs/add/operator/map` 猴子补丁式 import 已死；现代姿势统一 `import { map } from 'rxjs/operators'`（v7 起也可直接 `from 'rxjs'`）。看教程先核版本年份，RxJS 是"三年前的文章就能教错你"的重灾区。

> 🚀 部署预告：rx-basics 全部实验零构建成本——CodePen 直接引 rxjs UMD CDN 即可开跑；后续 rx-inapp 会把流接进真实 React 组件并讨论部署时的 bundle 体积账（呼应 sig-size）。
