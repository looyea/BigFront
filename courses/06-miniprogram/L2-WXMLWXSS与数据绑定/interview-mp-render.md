# mp-render 面试题精选

> 共 12 题，覆盖 A 条件渲染 / B 列表与 key / C 渲染原理与性能 / D 跨框架对照。

## 一、条件渲染（A 类）

### 1. wx:if 和 hidden 的本质区别？怎么选？
wx:if 假时节点不创建、切换伴随子树销毁重建；hidden 节点常驻、只切 display。频繁切换选 hidden（省建树成本），初始化概率低或子树昂贵选 wx:if（惰性省首屏）。等价于 Vue 的 v-if/v-show（呼应 vue-conditional-list）。
**来源**：微信小程序官方文档《条件渲染》；Vue 官方文档《条件渲染》

### 2. wx:if 是"活的"吗？数据变了会怎样？
条件渲染有惰性：`wx:if="{{false}}"` 时内部绑定表达式不参与更新，直到条件转真才整体建帧。所以"条件长期为假 + 内部表达式巨复杂"的场景，wx:if 反而是性能正解。
**来源**：微信小程序官方文档《条件渲染》；《小程序条件渲染更新机制》社区实证帖

### 3. 一组兄弟节点共用一个条件怎么写？
`<block wx:if>`——block 是虚拟分组标签，不渲染任何实际节点。对标 Vue `<template v-if>`（呼应 mp-wxml 第四节）。
**来源**：微信小程序官方文档《<block> 标签》

## 二、列表与 key（B 类）

### 4. 为什么强烈反对 wx:key="index"？
列表头部插入/删除/重排时，index 让 diff 误判"每一项都变了"→全列表重渲染；更严重的是节点复用时状态错位——第 1 行输入框的内容跟着"index=0"漂到新插的条目上。稳定 key 让 diff 只识别移动、复用节点与状态（与 React 完全同理，呼应 react-lists-keys）。
**来源**：微信小程序官方文档《列表渲染 > 关于 wx:key》；React 官方文档《列表与 key》

### 5. wx:key 能写表达式吗（如 `{{item.id}}`）？
不能。wx:key 要的是**属性名字符串**（`wx:key="id"`）或 `*this`（item 本身是原始值）。它由框架拿去从每个 item 上取值，写表达式反而错。key 必须全局唯一于该列表。
**来源**：微信小程序官方文档《列表渲染》

### 6. 不写 wx:key 会怎样？
仅控制台警告不报错，行为退化为按 index diff——小列表看似无恙，一旦有输入态/动画/排序就翻车。工程上应把该 warning 当 error 对待（呼应 mp-directory 的调试建议）。
**来源**：微信开发者工具调试警告说明；微信小程序官方文档

## 三、渲染原理与性能（C 类）

### 7. wx:for 发生在逻辑层还是渲染层？这对性能意味着什么？
数据经 setData 序列化传到渲染层后，由渲染层按模板展开并 diff。列表性能成本≈**传输字节数+diff 节点数**：所以"改一项传整数组"是双线程下最贵的写法，应用路径更新 `setData({'list[2].title': v})`（呼应 mp-setdata、mp-overview）。
**来源**：《小程序运行机制》官方指南；微信开放社区性能优化专栏

### 8. 长列表（上千条）怎么渲染？
① 数据侧分页/懒加载（onReachBottom，呼应 mp-lifecycle）；② 视图侧虚拟滚动/recycle-view 组件——只渲染视口内节点，思路同 React virtualized（呼应 react-performance）；③ Skyline 渲染引擎对列表有节点复用优化（呼应 mp-performance）。
**来源**：微信小程序官方文档《recycle-view 列表复用组件》《Skyline 介绍》

### 9. wx:for 里每项都有点击事件，绑定会很重吗？
小程序事件是声明式委托到渲染层、经 Native 转发逻辑层，节点级 bindtap 数量大时事件表膨胀。惯用优化：容器上绑一次 + `data-id` 在子节点携带，处理函数从 `e.target.dataset` 取——即"事件委托"思想（下一课 mp-events 展开，呼应 vue 事件对象）。
**来源**：微信小程序官方文档《事件 > 事件委托/合并 View》社区实践

## 四、跨框架对照（D 类）

### 10. 同一道"列表 key"面试题，Vue/React/小程序答案有何差异？
原理同一：key 给 diff 提供稳定身份。差异在写法——React `key={x.id}` 写在 children 上且必须表达式；Vue `:key` 指令、v-for 同级；小程序 `wx:key="id"` 写**属性名字符串**且与 wx:for 同标签。小程序还多一层"跨线程 diff"的成本放大效应（呼应 react-lists-keys、vue-conditional-list）。
**来源**：三框架官方文档对照；《列表渲染优化漫谈》技术博客

### 11. "过滤后列表"三家各怎么写？小程序为什么更该在数据层做？
Vue/React 可模板内 filter/computed 派生；WXML 不能调方法（呼应 mp-wxml），只能在 setData 前算好放 data，或 wxs 里做纯展示加工。**副作用**：数据层过滤意味着"过滤结果也要参与 setData 传输"，大列表高频过滤时考虑节流与增量（呼应 react-derived-state 思路、mp-setdata）。
**来源**：微信小程序官方文档；Vue 官方文档《计算属性》

### 12. 为什么"条件渲染的频繁切换"在小程序比 React 更值得优化？
React 的切换是 JS 层 vDOM diff + 少量 DOM 操作，进程内完成；小程序每次切换都要经历**逻辑层→Native→渲染层**的通信与子树建销毁，固定开销更高。所以"能 hidden 别 if"在小程序是更硬的规则——跨线程架构决定了成本模型（呼应 mp-overview、react-render-model）。
**来源**：《小程序双线程与通信成本》技术分析专栏；微信小程序性能优化指南
