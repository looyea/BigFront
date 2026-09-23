# sig-perf：性能坑清单——过度订阅与漏订

> 目标：把前六关散落的性能事故收拢成一张『可张贴的坑清单』：四大高频坑各给 症状-定位-修法 三段；建立『先归因再优化』的排查流程；理解过度订阅与漏订这对孪生病的统一诊断视角（呼应 mobx-react、za-core、rx-inapp）

## 〇、总纲：性能问题只有两种

**做多了（过度订阅/重渲风暴）**和**没断奶（漏订/泄漏）**。前者用户立刻骂卡，后者用户过俩小时骂卡——诊断入口统一是 DevTools Performance 录一段 + 渲染计数（React Profiler commit 次数）/ 内存快照对比。下面的坑全挂在这两个钩子上。

## 一、坑1：selector 每次返回新对象 → 重渲风暴

- **症状**：React 报 `The result of getSnapshot should be cached`，或组件树无规律全体抽搐；Zustand 版事故：`useStore(s => ({a: s.a, b: s.b}))`；Redux 版：未 memo 的 `useSelector(s => s.items.filter(...))`；signal 版：computed 里每算必产的 new 值缺 equals 判等。
- **定位**：Performance 录屏看 commit 高频且与真实变更频率脱钩；在 selector 里临时加 `console.count()`——计数远超业务更新次数即实锤『比较面永变』。
- **修法**：三家同构的闸门三件套——Zustand 用 useShallow/拆原子；Redux 用 createSelector/浅比较版 useSelector with shallowEqual；signal 用 computed+自定义 equals（tc39-control 第三阀）。**记法：凡『产物是现造的』，比较面就要现造的对策。**

## 二、坑2：observer『没读到字段』→ 该更新的没更新（静默漏订）

- **症状**：MobX 数据变了 UI 不动，无报错无警告——比风暴更阴。经典三式：解构后读（`const {x} = store`，mobx-react 头号禁忌）、渲染期外读（生命周期里取值缓存进本地变量）、分支短路（`store.flag && <B/>` 里 B 的依赖没被读，flag 翻回 true 才一起结清）。
- **定位**：why-did-update/Profiler 里看该组件 commit 缺席；或 `reaction(() => [读到的字段清单], ...)` 打日志对照预期依赖集。
- **修法**：渲染体内直接 `store.x` 读（让 observer 的读订阅生效）；分支保护用可选链+默认值而非提前 return 整棵子树；本地镜像变量只作派生入口不作订阅替身。**漏订的反直觉处：它长得和『渲染正常』一模一样，直到数据变的那天。**

## 三、坑3：流没退订 → 慢泄漏

- **症状**：路由来回切 N 次后，一次输入触发 N 个请求/N 个定时器并发；内存锯齿波只升不降。rx-inapp 治理清单的现场复发：手写 subscribe 无配对 unsubscribe、setInterval 忘 clear、add+addEventListener 不成对。
- **定位**：Performance 的 Memory 面板三次快照差集找存活增长对象；给订阅临时打标签 `sub.__who='SearchBox#'+id`，堆快照里同名多份即泄漏指纹。
- **修法**：层级化拥有——Angular async pipe/takeUntil 销毁链、React useEffect cleanup 强返回退订、Solid effect 自动配对；跨组件共享订阅收到 store 层一次性建立（subscribe 旁路），别让每个组件各养一份。**判断句：这段代码建立订阅的那一行，往上看三行有没有对应的退订？**

## 四、坑4：深层可变对象 → 引用相等失效（静默错值/静默不更）

- **症状**：两副面孔。A：memo/deps/selector 比较对『内容已变、引用未换』的深层对象判『没变』→ 不重渲（sig-mutability 面试 q7）；B：反过来，浅拷贝只换根节点、深层内容其实没变，而订阅面恰好卡在会被换掉的那层（整棵子树/根对象）→ Object.is 判变白渲（解药恰是 useShallow/原子化 selector 把比较面下移到未变的叶层）。多发于可变/不可变混居边界（MobX 对象漏进 React 比较世界、structuredClone 与手搓浅拷混用）。
- **定位**：比较两难现场取证：`console.log(prev === next, deepEq(prev, next))` 一行日志分辨『引用变内容没变』vs『内容变引用没变』——两种病修法相反，先分型再开药。
- **修法**：边界协议（toJS/getState 出境、入境重建——L4/za 两家同款）、全家统一 immer+结构共享（未改分支引用天然稳定）、实在要深比较的地方用 shallowDiff 定制闸门而不是 Object.is 硬扫。**根药方一句：比较策略必须覆盖『内容到引用』的映射链全段，断一环静默一环。**

## 五、排查流程（贴墙版）

```
卡/不更/内存涨？
  ├─ 录 Performance + Profiler 计数 → commit 过多？→ 坑1/坑4-B
  │                                → commit 缺席？→ 坑2/坑4-A
  │                                → 内存锯齿升？→ 坑3
  └─ 修复后回归：给本次病灶加一条断言/用例（marble 或计数断言）
```

两个纪律：**一次只改一处**（并发优化无法归因）；**优化前后各留一份 Profiler 截图**（没有基线的优化是玄学）。高频瞬态的通用形状（源头降频/中间 transient/终点 commit，za-patterns §二）不在这四坑里——那是架构层，坑清单管的是写错的那一行。

## 六、清单之外的半条：细粒度不是免检牌

Solid 表达式级更新也栽坑1 的亲戚：`<div>{arr.filter(x => x.hot).length}</div>` 在模板里现造新值+无 memo=每次 arr 触底全量重算。细粒度只是『默认订阅面小』，**派生表达式的成本与稳定性仍要人管**——各家工具不同（Solid memo()/Vue computed/Preact computed signal），心法同一条：反复被读的派生，值得一个带闸门的容器（『值→变化闸门家族』在性能端的投影）。

> 🚀 部署预告：把 §〇 到 §四 做成一页 A4 检查单（症状关键词+定位命令两列）；然后回到 12/13 包你最熟的一个 demo，按五流程图跑一次完整体检——多数真实项目的体检报告会意外地短，因为四坑在这行代码里已被你亲手拆过。
