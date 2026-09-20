# mp-wxml 面试题精选

> 共 12 题，覆盖 A 语法基础 / B 与 Vue/React 对照 / C wxs 与渲染层 / D 工程实践与踩坑。

## 一、语法基础（A 类）

### 1. WXML 和 HTML 有什么本质区别？
HTML 是浏览器直接解析的标记语言，脚本可以即时操作 DOM；WXML 是**编译期模板**——逻辑层没有 DOM（双线程架构，呼应 mp-overview），视图只能由 WXML 声明、由 `setData` 喂数据，最终编译成渲染层节点树。它更像 Vue 的 `<template>` 而非 HTML。
**来源**：微信小程序官方文档《框架 > WXML 概述》；《小程序双线程模型解析》

### 2. `{{}}` 插值支持哪些写法？不支持哪些？
支持：算术、三元、逻辑运算、字符串拼接、下标与点访问（`a.b[0]`）。不支持：调用 js 方法、`new`、正则字面量、赋值语句、`import`。复杂逻辑应在 setData 前算好，或用 wxs。
**来源**：微信小程序官方文档《WXML 数据绑定》

### 3. 如何让一段文本根据布尔值隐藏？两种机制的区别？
`hidden="{{flag}}"` 与 `wx:if="{{flag}}"`。hidden 是 CSS display:none，节点始终存在，切换开销小，适合频繁切换；wx:if 条件渲染，false 时节点不创建/被销毁，适合一次性或分支渲染。这与 Vue 的 `v-show` vs `v-if` 完全同构（呼应 vue-conditional-list、mp-render）。
**来源**：微信小程序官方文档；Vue 官方文档《条件渲染》

## 二、与 Vue / React 的对照（B 类）

### 4. 小程序 WXML、Vue template、React JSX 三种模板哲学怎么选？
Vue/WXML 同属"专用模板 DSL"：编译期优化、上手简单、表达力受限；JSX 是"模板即代码"：图灵完备、能调函数，但失去模板层的静态优化提示。小程序还多一刀：模板与逻辑层彻底分离，连方法调用都不允许，只剩 wxs 后门。面试答题落点：**表达力与约束度成反比，约束换来跨线程传输的性能可控**（呼应 react-jsx、vue-template-syntax）。
**来源**：《JSX 是什么》React 官方文档；Vue 官方文档《模板语法》；《为什么 WXML 不是 HTML》技术专栏

### 5. WXML 里动态 class 怎么写？和 Vue 比差在哪？
只能字符串拼接：`class="box {{ active ? 'box--on' : '' }}"`。Vue 支持对象/数组语法（`:class="{ box: true, on: active }"`），可读性与工具支持更好（呼应 vue-class-style-transition）。WXML 表达式复杂了就该在 setData 前拼好字符串。
**来源**：微信小程序官方文档；Vue 官方文档《 class 与 style 绑定》

### 6. `{{}}` 输出会转义吗？渲染富文本怎么办？
默认转义，天然防 XSS（同 JSX 的自动转义，呼应 react-jsx）。渲染富文本用 `<rich-text nodes="{{...}}"/>`，推荐传对象数组而非 HTML 字符串，可控且免二次解析。
**来源**：微信小程序官方文档《rich-text》；React 官方文档《 dangerouslySetInnerHTML 与 XSS》

## 三、wxs 与渲染层（C 类）

### 7. wxs 运行在哪个线程？这带来哪些限制？
渲染层。因此：不能调用逻辑层方法、不能 require 逻辑层模块；反过来逻辑层也不能 import wxs。本质是"为了在视图层本地完成小计算、避免为格式化多走一次跨线程 setData"（呼应 mp-overview 双线程、mp-setdata）。
**来源**：微信小程序官方文档《WXS 介绍与使用》

### 8. wxs 支持 ES6 吗？
不支持，是 ES5 子集，且部分全局对象被裁剪。写 wxs 要退回 `var`、函数表达式、字符串拼接的思维和写法。
**来源**：微信小程序官方文档《WXS 语法概要》

### 9. 什么场景值得用 wxs，什么场景不该？
值得：列表每项都要做的纯展示格式化（分转元、日期截断），用 setData 前算会带来大数据量跨线程开销。不该：需要调用业务逻辑、异步、或依赖 ES6 能力的——那些属于逻辑层（呼应 mp-setdata 性能一节）。
**来源**：《wxs 使用场景与最佳实践》微信开放社区技术精选

## 四、工程实践与踩坑（D 类）

### 10. bindtap 绑定的方法"点了没反应"，排查思路？
① 值必须是**方法名字符串**且定义在当前 Page/Component 的方法对象里；② 拼写与大小写；③ 若写在子组件标签上，普通事件不跨组件边界，需组件 `triggerEvent`（呼应 mp-component-comm）；④ 同名 `catch` 祖先拦截。找不到方法只有 console 警告，无红字报错，极易漏看。
**来源**：微信小程序官方文档《事件 handler 注意点》；微信开放社区问答精选

### 11. `<template>` 能替代自定义组件吗？
不能。template 只复用**结构**，无状态、无生命周期、无独立样式（数据靠 `data="{{...obj}}"` 一次性灌入）。带逻辑与样式的复用必须走 `Component` 构造（呼应 mp-component）。跨文件复用结构用 import/include，include 只包含 template 之外的部分。
**来源**：微信小程序官方文档《WXML 引用》

### 12. 布尔属性不带 `{{}}` 为什么会产生"意外生效"的 bug？
如 `hidden="false"`：属性值是字符串 `"false"`，非空字符串按真值处理，元素被隐藏。所有布尔型属性（disabled、checked 等）必须 `="{{bool}}"` 绑定才符合预期。这与早期 Vue 里 `:disabled="false"` 与 `disabled="false"` 的差异同源——**字面属性=字符串，绑定属性=原始值**（呼应 vue-template-syntax）。
**来源**：微信小程序官方文档《属性值的类型》；Stack Overflow 小程序相关高票回答
