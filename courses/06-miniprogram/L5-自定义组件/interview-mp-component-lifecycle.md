# mp-component-lifecycle 面试题精选

> 共 15 题，覆盖 A 钩子与时机 / B observer 与数据流 / C behavior 复用 / D 跨框架对照。

## 一、钩子与时机（A 类）

### 1. 组件的 created/attached/ready/detached 分别对应 Vue/React 的什么？
created≈Vue created（实例有了、DOM 没有）；attached≈被挂载进树（Vue mounted 前夜/React effect 挂载阶段）；ready≈Vue mounted、React "首帧 effect 后"；detached≈unmounted / useEffect cleanup（呼应 vue-lifecycle、react-useeffect）。
**来源**：微信小程序官方文档《组件生命周期》；Vue 官方文档《组件生命周期图示》

### 2. 为什么 attached 还不能查布局？ready 和"页面 onReady"是一回事吗？
attached 只表示进入虚拟节点树，渲染层首绘尚未完成，宽高为 0。ready 是**该组件**首次渲染完成；页面 onReady 是**整页**首绘完成——一个页面多个组件各自 ready，时序互不保证（呼应 mp-lifecycle）。
**来源**：微信小程序官方文档《ready 与渲染时机》

### 3. 组件会有 onHide/onUnload 吗？页面切后台时组件怎么配合？
没有页面式钩子；页面级可见性走 `pageLifetimes.show/hide`（如视频组件暂停）。组件被 `wx:if` 移除则直接 detached，被 hidden 隐藏则什么都不会发生（仍在树上）（呼应 mp-component-lifecycle 第二节、mp-render）。
**来源**：微信小程序官方文档《pageLifetimes》

### 4. detached 里漏清 IntersectionObserver/定时器，微信有"自动回收"兜底吗？
不要赌。观察者回调、interval 闭包持有 this → 实例无法 GC，幽灵 setData 告警与内存缓涨（体验评分/内存快照可见）。detached 统一释放是纪律，与 React effect cleanup 同义（呼应 react-useeffect、mp-performance）。
**来源**：小程序性能与内存指南；社区内存泄漏排查帖

## 二、observer 与数据流（B 类）

### 5. properties observer 的触发条件与参数？
值变化即触发（浅比较，对象/数组按引用）；参数 `(newVal, oldVal, changedPath)`，changedPath 在路径更新时给定位。父级每次渲染传新对象=每次都触发，需缓存引用或子内比较（呼应 mp-component 面试第 6 题、mp-component-comm 第一节）。
**来源**：微信小程序官方文档《数据观察器》

### 6. observers 块能观察 data 吗？能观察路径与多字段吗？
能——observers 是统一的数据观察入口：可写 `'a, b'` 联合、`'obj.x'` 路径、`'obj.**'` 通配；properties 与 data 字段一视同仁（properties 的 observer 本质是同一机制的特例写法）。别与 properties 内 observer 混用同一字段（呼应 mp-component-lifecycle 第三节）。
**来源**：微信小程序官方文档《数据监听器 observers》

### 7. 用 observer 做"派生状态"和 Vue computed 的差异？
computed 是"拉"（惰性、自动追踪依赖、缓存）；observer 是"推"（变了才算，还要手动 setData 到另一个字段、初始值不会自动算——首次不进 observer！）。迁移者常忘"初始化也得手动调一次派生"这一差异（呼应 vue-reactivity、react-derived-state 话题）。
**来源**：Vue 官方文档《计算属性》；微信小程序官方文档 observer 触发时机说明

## 三、behavior 复用（C 类）

### 8. behavior 里可以有哪些成员？嵌套 behavior 支持吗？
properties/data/methods/生命周期/pageLifetimes/definitionFilter 都有；`behaviors: [base, ...]` 支持数组与嵌套引用（被依赖者先合并）。官方文档明确 behavior 是"组件间共享属性/方法/生命周期"的机制（呼应 mp-component-lifecycle 第四节）。
**来源**：微信小程序官方文档《behaviors》

### 9. behavior 与 Vue mixin 的异同？
同：选项式合并、钩子叠加不覆盖、来源不透明（模板里看不出 data 字段来自哪个 behavior）；异：behavior 无 `mixins` 的"组件内 mixins 数组 vs 全局 mixin"两级，也无反向依赖清理钩子之类扩展。教训相同：大规模使用后升级困难（呼应 vue-composables 对 mixin 的批判）。
**来源**：Vue 官方文档《Mixins 的陷阱》；微信小程序官方文档

### 10. 团队规范：哪些逻辑进 behavior、哪些进纯函数 utils、哪些进组件自己？
成套"状态+生命周期副作用"（倒计时、曝光埋点、分页加载器）→ behavior；无状态纯计算/格式化/请求封装 → js 模块（测试友好、调用显式）；只被一个组件用的 → 直接写组件里。判断轴是"复用粒度 × 是否需要挂时机"（呼应 react-custom-hooks 的抽象时机论、mp-interaction utils）。
**来源**：前端逻辑复用分层通用实践；社区 behavior 设计讨论

## 四、跨框架对照（D 类）

### 11. React 没有"组件销毁钩子"，cleanup 在 useEffect 返回函数里；小程序为什么需要 detached？
React 组件是函数、每次渲染新建闭包，"销毁"是 effect 依赖变化驱动；小程序组件是**长生命周期对象实例**（构造一次、驻留树中），资源释放只能挂在实例消亡点 detached 上——两种内存模型决定两种 API 形态（呼应 react-useeffect、react-component）。
**来源**：React 官方文档《Effect 清理函数》；小程序组件模型文档对照

### 12. 组件"被 wx:if 重建丢状态"与 React 组件 key 变化重挂载，是同一件事吗？怎么治？
同一件事：实例生命周期与条件/身份绑定。React 用 key 强制 remount 重置状态；小程序 wx:if 销毁即重置。治理一致：① 保状态→改 hidden/常驻渲染；② 状态提升（父/store）；③ 或干脆把"重建"当重置手段用（表单提交成功后靠 wx:if 翻一下清空整个表单——两派都合法，要写进设计说明）（呼应 react-render-control、mp-render）。
**来源**：React 官方文档《用 key 重置组件》；小程序社区实践对照

---

## 补充（新专题 13-15）

### 13.  created/attached/ready/detached 对应 Vue/React 的什么？ready 和"页面 onReady"是一回事吗？

近似映射：created≈Vue beforeCreate/created（实例化、无 DOM）、React 函数体首次执行；attached≈Vue mounted 之前进入 DOM 树/React commit 挂载（节点已挂但可能未完成首帧布局）；ready≈Vue mounted/React 挂载 effect 后能查 DOM 那次（初次渲染完成，可安全查布局）；detached≈Vue unmounted/React 卸载 cleanup。区别点：小程序把"进入节点树(attached)"与"首次渲染完成(ready)"拆成两个钩子，比 Vue 的 created/mounted 之间更细。ready≠页面 onReady：组件的 ready 是该组件初次渲染完成、页面的 onReady 是页面初次渲染完成，二者时机不同且各自独立；页面里多个组件各有 ready。别把"组件会有 onHide/onUnload 吗"想当然——组件没有 onHide/onUnload/于页级，它靠页面用 behaviors 的 pageLifetimes（show/hide/resize）感知所在页显隐。

微信官方文档《组件生命周期》；掘金《attached 里发请求.ready 里测量的时机学》

### 14.  properties observer 的触发条件与参数？observers 块能观察 data、路径、多字段联动吗？和 Vue computed 差异？

observer（单个 property 定义里）在该属性被父"设置新值"时触发，参数 (newVal, oldVal, changedPath)；父反复传相同值，框架有值比较通常不重复触发（但传的是对象/数组引用变化时按引用判，可能触发）。observers（组件级选项块）更强大：能观察 properties 也能观察 data 字段、支持路径（`obj.a.b`）、支持多字段联合监听（用通配 `a, b` 或一个函数监听组合），触发时给 (变更值)。做"派生状态"用它，但要点：① observer 里只能 setData 到别的字段（别回写被观察项，防循环）；② 每次触发都可能一次 setData，昂贵派生要加守卫。与 Vue computed 差异：computed 是"惰性 + 自动依赖收集 + 缓存"，读时才算、依赖变了自动失效；observer 是"命令式 push——写时主动算并 setData"，不自动追踪依赖、无缓存，需你显式列出观察谁、自己防重复。所以 Vue 里 `get total(){...}` 的活，在小程序要转成 observers + 手动 setData。

SegmentFault《show/hide 与页面生命周期触发顺序实测》；知乎《组件销毁漏清理定时器的泄漏排查》

### 15.  behavior 与 Vue mixin 异同？哪些逻辑进 behavior、哪些进纯 utils、哪些留组件自己？以及 React 无销毁钩子而小程序为何需要 detached？

behavior=小程序的混入单元，可含 properties/data/methods/lifecycle/observers，组件用 behaviors:[...] 混入，支持嵌套、多 behavior 合并（同名后者覆盖/生命周期按序都跑）——与 Vue mixin 心智几乎相同（复用横切逻辑），也共享 mixin 的通病：来源不透明、命名冲突、隐式依赖，故要克制、命名带前缀、文档化字段。分工：纯函数 utils=无状态可独立测试的计算（格式化、校验、日期），别塞进 behavior；behavior=要挂到组件生命周期/数据/方法上的横切能力（埋点、列表分页、表单校验、可见性监听 pageLifetimes）；组件自身=与该组件唯一职责强绑定的逻辑。React 没有显式"组件销毁钩子"是因为 effect 的返回函数就是 cleanup、卸载时自动调，且组件即函数、无独立实例生命周期概念；小程序有 detached 是因为组件是有状态实例、副作用（setInterval、IntersectionObserver、事件监听、原生上下文）要一个明确的"离场点"来回收——detached 里必须手动 off/clear/disconnect，微信没有可靠的自动回收兜底，漏清即泄漏。

CSDN《observers 与生命周期协作的数据流设计》；InfoQ《一次组件生命周期重构梳理的依赖图》
