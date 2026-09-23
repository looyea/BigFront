# mp-events 面试题精选

> 共 12 题，覆盖 A 事件流与绑定 / B dataset 与事件对象 / C 性能与高频事件 / D 组件边界与跨框架对照。

## 一、事件流与绑定（A 类）

### 1. 小程序的事件传递分几个阶段？bind/catch 各控制哪一段？
捕获（根→目标）与冒泡（目标→根）两站。四种绑定：`bind`（冒泡监听不截断）、`catch`（冒泡监听并截断）、`capture-bind`（捕获监听不截断）、`capture-catch`（捕获阶段直接截断，冒泡段不会再收）。
**来源**：微信小程序官方文档《事件 > 事件流》

### 2. 为什么 WXML 里事件绑定写的是"方法名字符串"而不是函数引用？
WXML 编译产物与逻辑层分离，模板只描述"结构+绑定意图"；运行时按名字到 Page/Component 的方法表里找 handler。代价：拼错只给 warning、点击无响应（呼应 mp-wxml 面试第 10 题）。React 直接传函数引用，因为 JSX 就是代码（呼应 react-jsx）。
**来源**：微信小程序官方文档《事件 handler 注意点》

### 3. tap 和 touchend 有什么区别？能同时用吗？
touchend 是触摸序列结束（含滚动收尾）；tap 是"点按"语义（短触 + 小位移）。同时绑会一次点击触发两个 handler，常造成重复提交；需要防误触才用 touchstart/touchend 手算，一般场景用 tap（部分组件如 movable-view 会消费手势导致 tap 不触发）。
**来源**：微信开放社区《tap 与 touchend 同时触发》高赞回答；官方文档《视图容器 > movable-view 手势冲突》

## 二、dataset 与事件对象（B 类）

### 4. 事件处理函数如何接收参数？为什么官方推荐 dataset 而不是闭包思路？
`data-xxx="{{v}}"` → `e.target.dataset.xxx`。小程序没有"在模板里造闭包"的能力（模板不是代码）；dataset 随事件对象序列化传输，天然可 JSON。注意 dataset 只放可序列化的小数据，长对象放 data 里用 id 反查。
**来源**：微信小程序官方文档《事件 > 事件传参》

### 5. e.target 和 e.currentTarget 的区别？什么场景下必须用 currentTarget？
target=触发事件的源节点（可能是很深的子节点），currentTarget=绑定当前 handler 的节点。事件委托下两者必不同：handler 绑在列表容器、dataset 挂在行上却点到行内按钮时，取 `currentTarget.dataset` 才对。
**来源**：微信小程序官方文档；MDN Event.currentTarget（同一概念对照）

### 6. e.detail 和 e.target.dataset 各装什么？
detail：组件"值语义"的载荷——input/change 的 value、picker 选择结果、tap 的 x/y；dataset：开发者自定义的携带数据。一个由组件规范定义、一个由你定义（呼应 react-forms 里 event.target.value 与自定义 data-* 的分工）。
**来源**：微信小程序官方文档《表单组件事件》

## 三、性能与高频事件（C 类）

### 7. 一次点击从手指到 setData 完成，完整链路经过哪些角色？
渲染层节点命中 → Native 事件系统打包序列化 → 逻辑层 JS 引擎执行 handler → setData 数据 diff 序列化 → 经 Native 回传渲染层 → WebView diff 更新节点。全程"两线程从不直接见面"（呼应 mp-overview）。
**来源**：《小程序运行机制》官方指南

### 8. scroll / touchmove 每帧触发，绑定复杂 handler 会卡，怎么办？
① 节流（如 100ms 一次）+ 处理函数里避免重 setData；② 能 CSS 解决的（视差、显隐箭头）用 CSS 动画/Skyline 手势驱动；③ 只监听必要方向，`onPageScroll` 不想要就不绑（绑了就有转发成本）；④ 大数据计算挪到 setTimeout 空闲期（呼应 mp-performance）。
**来源**：微信开放社区《onPageScroll 性能》技术精选；小程序性能优化指南

### 9. 列表 1000 行每行绑 tap，和容器绑一次+dataset 反查，差别在哪？
前者 1000 条绑定记录进事件表、setData 更新时随之维护；后者一条。事件委托还能避免"新行忘绑 handler"。这与 DOM 事件委托同源，但小程序里收益更偏"内存与序列化"而非 DOM 操作（呼应 mp-events 第四节、mp-render）。
**来源**：微信小程序官方文档《事件 > 事件委托/合并 View》

## 四、组件边界与跨框架对照（D 类）

### 10. 自定义组件内部点击，为什么父页面 bindtap 收不到？跨边界有几种方式？
普通事件不冒泡出组件边界（边界即封装）。跨边界方式：① 组件 `triggerEvent('name', detail)` + 父 `bind:name`（首选）；② `this.triggerEvent` 里 `bubbles:true/capture` 可控穿透（官方选项）；③ selectComponent 拿实例直调方法（命令式，慎用）（呼应 mp-component-comm、vue `$emit`）。
**来源**：微信小程序官方文档《组件间通信 > triggerEvent》

### 11. Vue 的 `@click.stop`、React 的 `e.stopPropagation()`、小程序的 `catchtap`——为什么第三种是声明式？
小程序模板无代码能力，拦截意图必须编译期可见 → 语法层提供 catch；Vue 用修饰符编译成 `.stop` 包装；React 事件是代码里真函数，命令式调用随意。三者本质相同（截断冒泡），差异是"表达绑定意图的载体"（呼应 react-forms、vue-class-style）。
**来源**：三框架官方文档事件章节对照

### 12. input 输入即搜索（联想）在小程序里怎么做不卡？
`bindinput` 里**防抖 300ms** 再发请求；回包后 setData 只写 `suggestions` 一个字段；列表项 key 稳定；必要时渲染层 wxs 格式化避免二次加工。核心：**把"每次击键"与"每次网络/渲染"解耦**——和 React 受控输入的 debounce 完全同构（呼应 react-forms、react-effect-patterns 竞态处理）。
**来源**：微信开放社区搜索联想性能实践；Lodash debounce 文档概念对照
