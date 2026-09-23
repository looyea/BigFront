# rx-inapp：RxJS 在现代前端的位置

> 目标：给 RxJS 找到当代的生态位——React 桥的正确姿势、与 fetch/AbortController/AsyncIterator 的分工、Angular 的官方常客身份，以及最重要的：什么时候不该用 RxJS（呼应 tc39-core、vue-use-fetch）

## 一、React 桥：useObservable 的写法与坑

React 世界没有内建流支持，桥必须自己搭。看似简单的三行 hook，每一行都有坑位：

```js
function useObservable(obs$, initial) {
  const [state, setState] = useState(initial);
  const [, setError] = useState(null);
  useEffect(() => {
    const s = obs$.subscribe({
      next: setState,
      error: (e) => setError(e),   // 坑1：不处理 error，流死得无声无息
    });
    return () => s.unsubscribe();  // 坑2：忘 cleanup = 每次重渲叠一条订阅
  }, [obs$]);                      // 坑3：obs$ 引用稳定吗？
  return state;
}
```

三个坑逐个拆：

- **引用稳定**：`useEffect` 依赖 `obs$`，若流在组件体内现造（`const v$ = interval(1000)`），每次重渲都重建流→重订阅→状态重置——经典『无限重订阅』事故。规范：流放模块顶层或 `useMemo`（且 deps 要配平）；
- **冷流的重复执行**：同一个冷流 hook 被两个组件用 = 两份生产（两次 fetch），要共享必须 `shareReplay` 或提升到 store；
- **error 通道**：setState 里别忘了错误的渲染表达，否则 UI 卡在 loading 转圈。

社区现成轮子（rxjs-react 系 hook 库）本质都在处理这三件事——**自己写过一次桥，再用库才心里有底**。

## 二、分工对照表：RxJS vs fetch/AbortController vs AsyncIterator

现代浏览器 API 各守一块江山，RxJS 的领地是『事件之间的关系』：

| 需求 | 轻量方案 | RxJS 方案 | 分界线 |
| --- | --- | --- | --- |
| 一次性异步 | fetch + async/await | from(fetch) | 单值无关系→别上流 |
| 可取消请求 | AbortController + signal | 内层流接 abort 的 from | 取消单个→原生够 |
| 防抖/节流的输入 | 手写 30 行闭包 | debounceTime | 参数一多手写即腐 |
| 竞态（只要最新） | latest-token 样板 | switchMap | 多请求竞态→流大赢 |
| 顺序消费事件 | for-await-of | from(asyncGen) | 拉模型顺序→迭代器 |
| 多源组合/时序断言 | 手写状态机 | combineLatest/zip | 关系复杂→流大赢 |

裁决公式：**『事件间关系』的复杂度 > 手写样板的复杂度时，RxJS 回本；否则它就是多余的抽象税。** 一次性 Promise 包流（`from(fetch).subscribe` 当 then 用）是最常见的滥用——退化成了带 import 的 await。

## 三、AsyncIterator 的正面相遇

ES 的 `for await` 与 Observable 是同一问题的两种哲学（pull vs push），今天互相能转化：

```js
import { from, firstValueFrom, lastValueFrom } from 'rxjs';

// AsyncGenerator → Observable：from 直接吃异步可迭代对象
async function* ticks() {
  for (let i = 0; i < 5; i++) { await sleep(1000); yield i; }
}
from(ticks()).subscribe(console.log);        // 0,1,2,3,4（拉转推）

// Observable → Promise：只取一个值时，流可以变回期货
const first = await firstValueFrom(clicks$);  // 等下一个点击（推转拉的极限：单值）
const all = await lastValueFrom(some$);      // 等 complete 拿最后一个值
```

两个方向都有标准桥，说明生态共识：**Promise/AsyncIterator 管『单值与顺序』，Observable 管『多值与关系』**——选型看你要表达的东西长什么样，而不是哪个更时髦。

## 四、Angular：官方钦定的常客

Angular 的 HTTP、路由参数、表单值流全是 Observable，async 管道在模板里托管订阅——在 Angular 里 RxJS 不是选型题而是必答题（接口层躲不掉）。但注意风向：Angular 17+ 引入 signal 系并推 zoneless，官方叙事里『RxJS 管数据流、signal 管状态』双轨并行——**连 RxJS 最大的庄家都在把它挪回『编排层』而不是『全局状态层』**（呼应 tc39-frameworks）。这个趋势对选型的启示：流的归流（异步编排），状态的归状态（signal/store）。

## 五、什么时候不该用 RxJS（负面清单）

1. **单值异步**：`from(fetch).subscribe(r => ...)` 不如 `await`——Promise 是单值的正确抽象；
2. **纯事件转发**：`fromEvent(el,'click').subscribe(handler)` 与 `addEventListener` 打平，没赚回学习曲线；
3. **团队里只有你懂**：RxJS 代码的维护者认知门槛真实存在——没有第二个人能 review 的管道等于技术债发生器；
4. **可以用 React Query/SWR 整包代劳的服务端态**：缓存、重试、失效都替你设计好了（呼应 sig-server），自撸管道是用爱发电；
5. **状态快照需求**：要的是『现在购物车里有什么』而不是『购物车的变化历史』——那是 signal/store 的地盘（L1『寄存器 vs 磁带』再落地）。

## 六、内存泄漏治理清单（带走即用）

- 每条 `subscribe` 必须有归属：async 管道 / takeUntil 闸刀 / Subscription 容器 / useEffect cleanup 四选一，裸奔即违规；
- 组件卸载打日志核对订阅数（或 Chrome Memory 面板比对 detached 对象）；
- 热流（share 后）确认 refCount 语义，避免源头永生；
- error 通道 100% 覆盖：一个未处理的 error 让流猝死，比内存泄漏更隐蔽——泄漏至少还看得见内存涨；
- Code review 口诀：**见 subscribe，先问谁退订；见 pipe，先问错误归谁。**

> 🚀 部署预告：RxJS 体积按具名导入可 tree-shake（约 5-8KB gzip 起步，操作符按需加）——在 10-vite 包的 build 分析里亲眼看看你引入了几个操作符的账，决策『要不要用』时才有数据（呼应 sig-size）。
