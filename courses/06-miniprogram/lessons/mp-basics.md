# 小程序 L1 · 小程序目录与页面

> 🎯 目标：看懂小程序四类文件与页面生命周期，会用数据绑定渲染列表

## 一、四类文件

- `.js` 逻辑、`.json` 配置、`.wxml` 结构(类 HTML)、`.wxss` 样式(类 CSS)
- 全局 `app.json` 声明 `pages` 列表与 `window` 样式，第一项是首页

## 二、页面与数据绑定

```js
Page({
  data: { list: ['a','b'] },
  onLoad() { /* 页面加载 */ }
})
```

```html
<view wx:for="{{list}}" wx:key="*this">{{item}}</view>
```

## 三、双线程架构（重要心智）

渲染层(WEBVIEW) 与逻辑层(JS引擎) 分离，通过 Native 中转——所以小程序**没有 DOM**，不能直接操作节点，只能改 data 触发视图更新。

## 四、生命周期

`onLoad / onShow / onReady / onHide / onUnload`，请求多发在 onLoad/onShow。
---

> 🚧 骨架关卡：在 `courses/06-miniprogram/lessons/mp-basics.md` 继续扩写，
> 小测放 `quizzes/mp-basics.json`，作业放 `homework/L1.md`，平台自动读取。
