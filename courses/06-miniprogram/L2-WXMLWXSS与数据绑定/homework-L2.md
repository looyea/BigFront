# L2 课后作业 · WXML / WXSS 与数据绑定

> 覆盖：WXML 模板语法与 wxs、WXSS 与 rpx 适配、列表与条件渲染。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 这段 WXML 有两处错，指出并改正：
```wxml
<view wx:for="{{ list }}">{{ item.name }}</view>
<view hidden="false">这行该显示出来</view>
```

**2.** 为什么这行的价格显示不出来（无报错、无输出）？
```wxml
<!-- data: { price: 1990 }；Page 里有 formatPrice 方法 -->
<text>{{ formatPrice(price) }}</text>
```

**3.** 嵌套列表渲染"串数据"（内层总显示外层内容），问题出在哪？
```wxml
<view wx:for="{{ groups }}">
  <text wx:for="{{ item.members }}">{{ item.title }}-{{ item.name }}</text>
</view>
```

**4.** 这段列表能跑，但每次头部插入一条就全列表闪一下，最可能的原因？给出修复。
```wxml
<view wx:for="{{ todos }}" wx:key="index">{{ todo.text }}</view>
```
（提示：还有第二个小错）

**5.** `{{ 3 + '4' }}` 输出什么？`{{ a.b.c }}` 中 b 不存在会输出什么？说明 WXML 表达式的容错特性。

**6.** 组件内部文字莫名被页面样式改掉了颜色，列举两种可能配置成因（styleIsolation / externalClasses 方向）。

**7.** 分包页面里 `@import "../../app.wxss"` 报错或样式丢失，多半是什么坑？（口述思路即可）

**8.** 这段代码 1rpx 边框在部分机型"有的看得见有的看不见"，为什么？改法？
```wxss
.cell { border-bottom: 1rpx solid #eee; }
```

**9.** 指出问题：`<view wx:for="{{ rows }}" wx:if="{{ show }}" wx:key="id">` ——为什么 wx:if 放同级浪费？两种改法。

**10.** 页面把 `<b>{{ title }}</b>` 里的 title 设为 `'<i>斜?</i>'`，页面显示成什么？为什么不是斜体？想渲染富文本怎么办？

---

## 第二段 · 手写编程（5 小题）

**11.** 写一段 wxs（可内联）实现 `fen2yuan(fen)`（1990 → "19.90元"），在商品列表 `{{ fmt.fen2yuan(item.price) }}` 中调用；再用"setData 前算好"的方式重写一遍，各写一句两种方案的适用场景。

**12.** 设计稿 750 宽：一个卡片左右边距 32、卡片内头像 96×96、标题字号 34、底部 1 物理像素分割线。全部写成 wxss（该用 rpx 用 rpx，该用 px 用 px），并逐行注释单位选择理由。

**13.** 用 `<template>` 定义"用户卡片"（头像+昵称+等级），在两个页面分别 `<import>` 并 `<template is data="{{...user}}"/>` 复用；然后说出它的两条能力边界（做不到什么）。

**14.** 实现一个"只显示已付款订单"的渲染：data 里 `orders` 有 200 条（含 `paid` 布尔）。要求：**不允许** wx:if+wx:for 同级混用。写出 js（过滤+路径追加更新思路）与 wxml 两半。

**15.** 列表每行有一个 input（可编辑昵称）。初始 3 行 ["a","b","c"]，编写"在第 1 行前插入 d"的 setData 代码，并论证：为什么用 `wx:key="uid"` 时用户已在第 3 行输入框里的内容不会跑位，而 index-key 会？

---

## 第三段 · 场景题（1 小题）

**16.** 电商商品列表页首屏卡顿，排查发现：app.wxss 60KB 全是非公共样式；列表 30 项每项 `wx:for` 内再嵌 5 层节点、`wx:key="index"`；每次筛选都 `setData({ list: 全新大数组 })`；价格格式化在每次 setData 前用 js 循环算完再整体下发。请逐项给出优化方案（至少 4 条），每条注明对应的课程小节依据（可跨引用 mp-wxml/mp-wxss/mp-render/mp-setdata 预告）。

---

## 第四段 · 简答题（3 小题）

**17.** wx:if 与 hidden 的机制区别、各自适用场景？与 Vue 的 v-if/v-show 对比一句话总结。

**18.** 组件的 styleIsolation 四个值分别是什么语义？默认值是什么？想让"页面样式作用进组件"选哪个？

**19.** 为什么 WXML 里 `{{}}` 不能调用 js 方法？给出框架层面的原因（双线程）与两条替代路线。

---

## 第五段 · 挑战题 🏆

**20.** 实现"虚拟列表"简化版：data 准备 1000 条 `{ id, text }`，页面高 100 条、每行固定 80rpx。要求：① 只渲染视口附近约 15 条（监听 onPageScroll 计算 startIndex，`slice` 后 setData 一个 `viewList`）；② 用占位块撑出总高、偏移用 transform 或 padding；③ 对"每次 scroll 都 setData"做节流并说明为什么必须节流（跨线程成本，呼应 mp-setdata 原理）。写出完整 js+wxml，并测算一次 setData 的传输量相比全量 1000 条缩小约多少倍。
