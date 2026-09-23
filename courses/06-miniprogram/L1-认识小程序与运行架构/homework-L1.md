# L1 课后作业 · 认识小程序与运行架构

> 覆盖：双线程架构、目录与配置、应用/页面生命周期。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 为什么这段在逻辑层会报错？
```js
Page({
  onLoad() { document.getElementById('box').style.color = 'red'; }  // ← ?
})
```

**2.** 首页进不去、`navigateTo` 到某页失败，`app.json` 里最可能漏了什么？

**3.** 这个刷新为什么不生效？
```js
Page({
  onLoad() { this.loadData(); },     // 列表页
  // 从详情 navigateBack 回来后数据没刷新  ← 该写在哪
})
```

**4.** 这段 setData 有什么问题（双线程角度）？
```js
onPageScroll(e) { this.setData({ scrollTop: e.scrollTop, bigObj: hugeData }); } // ← ?
```

**5.** `getApp()` 应该在哪里调用、不该在哪里调用？
```js
App({ onLaunch() { console.log(getApp().globalData); } })   // ← ?
```

**6.** 页面想改导航栏标题，但只改了 `app.json` 的 window，为什么所有页都变了、这页改不动？该怎么做？

**7.** `onReady` 里查节点为空/布局没好，多半是把它挪错了——它应放哪个钩子、或为什么现在不行？（辨析 onLoad vs onReady）

**8.** 新增页面只写了 `.js` 和 `.wxml`，运行白屏/报错，还缺什么？

**9.** 把一次性初始化写成在 `onShow` 里跑，反复切前台会怎样？

**10.** `project.config.json` 里误把密钥写进去并上传，有什么问题？（口述）

---

## 第二段 · 手写编程（5 小题）

**11.** 手写一个最小可运行页面 `pages/home/home` 的四件套：`home.js`(Page + data + onLoad)、`home.wxml`(展示 `{{msg}}`)、`home.wxss`、`home.json`(改标题)，并在 `app.json` 注册为首页。

**12.** 用 `App.onLaunch` 读取本地缓存的 token、写入 `globalData`；页面 `onShow` 里读 `getApp().globalData.token` 判断是否登录并提示，说明为何判断逻辑放 onShow。

**13.** 给一个列表页实现"下拉刷新"(onPullDownRefresh + stopPullDownRefresh) 与"触底分页"(onReachBottom)，写清需要在页面 json 开哪些配置。

**14.** 在 `onReady` 里用 `wx.createSelectorQuery` 获取某个 view 的高度并 `console.log`，对比放在 `onLoad` 时的差异（写出观察）。

**15.** 把 `app.json` 配置成：两个页面、全局导航栏绿色标题"我的"、其中一个页面单独把标题改成"详情"，验证"页面级覆盖全局"。

---

## 第三段 · 场景题（1 小题）

**16.** 你刚接手一个卡顿明显、页面结构混乱（40 个页面平铺、globalData 塞满各种东西、setData 频繁传大列表）的小程序。请从"双线程架构 + 目录组织 + 生命周期"三个角度，列出至少 5 条你会优先做的整改，并各写一句原理依据（哪条架构约束导致的）。

---

## 第四段 · 简答题（3 小题）

**17.** 画出小程序双线程架构示意，并说明 setData 与事件分别跨越了哪个方向。

**18.** onLaunch / onLoad / onShow / onReady 各自的触发时机与次数分别是？

**19.** `app.json` 的 window 与页面 `.json` 是什么优先级关系？举两个页面级能覆盖的字段。

---

## 第五段 · 挑战题 🏆

**20.** 设计一个"生命周期埋点方案"：封装一个全局函数，让**任意页面**不必逐个手写，就能自动记录该页 onLoad/onShow/onHide/onUnload 时间戳并上报停留时长与进入路径（含 scene）。要求：① 用 `Page` 的构造拦截或behavior/包装思路（可用 `App` + 自定义 `Page` 封装）；② 不改动每个页面已有代码；③ 说明这种"包装生命周期"和 Vue 混入 / React 高阶封装的相通之处。写出关键代码与一段原理说明。
