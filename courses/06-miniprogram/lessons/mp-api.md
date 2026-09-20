# 小程序 L2 · 官方 API 与交互

> 🎯 目标：会发起网络请求、使用交互 API，并了解组件与分包优化

## 一、网络请求

```js
wx.request({
  url: 'https://example.com/api',
  success(res) { this.setData({ data: res.data }) }
})
```

> 正式项目必须在后台配置 **request 合法域名**（HTTPS），且不能用 localhost。

## 二、常用交互 API

`wx.showToast` 提示、`wx.navigateTo`/`wx.switchTab` 跳转、`wx.setStorageSync` 本地缓存。

## 三、组件与优化

内置 `view/button/image/scroll-view` 等；可自定义组件。主包有大小限制，用「分包加载」拆分非首屏页面。
---

> 🚧 骨架关卡：在 `courses/06-miniprogram/lessons/mp-api.md` 继续扩写，
> 小测放 `quizzes/mp-api.json`，作业放 `homework/L2.md`，平台自动读取。
