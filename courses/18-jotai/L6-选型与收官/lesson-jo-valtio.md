# Jotai 兄弟：Valtio 的 proxy 路线

## 一、Valtio 是什么
同作者（Daishi Kato）生态里的另一极：用 Proxy 把**可变对象**变成可订阅状态。

```ts
import { proxy, useSnapshot } from 'valtio';
const state = proxy({ count: 0, list: [] });
state.count++;                       // 直接可变地改
// 组件
const snap = useSnapshot(state);     // 只读快照，自动订阅
```

「像 Vue 的 reactive」是最快的心智锚点：改的是对象本体，订阅靠 Proxy 拦截属性读写自动建立——深路径 propsUsed 级精确追踪，Vue3 用户零学习成本（呼应 vue-reactive、solid-signals 的同族谱系）。

## 二、与 Jotai 的互补关系
- Valtio：像 MobX，可变对象 + Proxy 自动追踪，深层嵌套改动省心；
- Jotai：像 signals，离散不可变原子 + 显式 get，依赖清晰。
两者解决同一问题的两种风格（呼应 mobx-core）。

互补不是客套话，是官方定位：Valtio README 直接写「与 Jotai 是兄弟不是对手」，两者可同项目混用——嵌套表单画布状态放 proxy，离散交互开关放 atom，各吃各的数据形态。Kato 一人两库，本质是把「可变派 vs 不可变派」都做到极致的对照实验。

## 三、何时选 Valtio
深层嵌套对象多、希望「直接改不用展开」、命令式操作频繁（表格编辑、画布）（呼应 svelte-runes-mutation）。

「直接改」的价值在嵌套深度下才显形：三层表单里 `state.profile.address.city = 'Beijing'` 一行，对应在 Jotai 里要么 focusAtom 建透镜（jo-focus-select）、要么手写三层 spread——Valtio 原生就是前者语义。命令式批量操作（拖拽画布挪 20 个元素）同理：for 循环直改，不必组装 updater。

## 四、何时选 Jotai
大量离散小状态、跨组件依赖派生、需要原生 async/Suspense、想保持不可变纯函数式。

两个 Valtio 给不了的硬能力：① async atom + Suspense（proxy 世界里没有「渲染期 throw promise」的挂起原语，取数要借 useEffect 或 Query）；② 派生的惰性缓存图（Valtio 的 derive 包较新且弱于 atom getter 的 DAG 语义）。异步重度、派生重度的项目，Jotai 不可替代。

## 五、心智成本
Valtio 可变写法直观但可能弱化「数据流向追踪」；Jotai 原子图显式但文件易碎。选风格而非对错。

可变派的暗坑要摆开：① `state.x = v` 可以发生在任何文件任何角落，「谁改了它」靠纪律或 devtools 而非结构约束——MobX 的三十年老话题准时重演（呼应 mobx-core 第五节）；② useSnapshot 是**代理只读对象**，把它传进依赖原始对象引用的库（如某些 memo 比较）会踩 hidden class 差异；③ 脱离组件的订阅回收（proxy 没有 sub/unsub 显式句柄，借 subscribe 的返回函数）。不可变派的文件碎则是另一笔账：一个 30 字段表单拆 30 个 atom 是反模式，该 focus 就 focus。

## 六、同族图谱一句话
Proxy 可变派：Vue reactive / MobX / Svelte 4 store / Valtio；不可变原子派：Signals 谱系 / Jotai / Zustand(set)。四包学到这里，状态管理的「流派树」已经完整——库会过时，树不会（呼应 sig-genealogy、za-compare）。

## 小结
Jotai/Valtio 是同一作者的两种范式对照实验：Proxy 可变省心 vs 原子不可变显式；嵌套深、命令式重投 Valtio，异步挂起、派生图、可追踪性投 Jotai——可同项目共存各吃形态，选风格不选对错。

## 部署预告
本地各写一个「三层嵌套个人资料表单」：Valtio 版直改 + useSnapshot，Jotai 版 focusAtom 透镜；对比代码行数与「改一个字段时谁在重渲」，再故意在 Valtio 组件里对快照做 JSON.stringify 缓存，观察代理对象与纯对象的差异。
