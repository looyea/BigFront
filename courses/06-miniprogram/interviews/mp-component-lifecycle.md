# mp-component-lifecycle 面试题精选

> 共 12 题，覆盖 A 钩子与时机 / B observer 与数据流 / C behavior 复用 / D 跨框架对照。

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
