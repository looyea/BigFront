# 目录结构与全局配置

> 目标：认清一个小程序工程"文件长什么样、谁管什么"。本课讲：根目录必备文件（`app.js`/`app.json`/`app.wxss`）、开发者工具配置 `project.config.json`、站点地图 `sitemap.json`、页面目录四件套（`.js/.json/.wxml/.wxss`）、`pages` 注册、`window` 全局外观、页面级 `json` 如何局部覆盖全局。呼应 **vue-project-architecture**（组织与门面）、**10-vite**（配置文件分层）。

---

## 一、根目录：三个 app 起步文件

```
project/
├─ app.js            // 逻辑：注册 App()、全局生命周期、globalData
├─ app.json          // 全局配置：pages 路由表、window、tabBar、分包…
├─ app.wxss          // 全局样式（所有页面可用）
├─ project.config.json   // 开发者工具/构建配置（appid、编译选项）
├─ sitemap.json      // 允许微信索引页面的规则
└─ pages/
   └─ index/
      ├─ index.js    ├─ index.json
      ├─ index.wxml  └─ index.wxss
```
- 三者分工正如前端工程：**逻辑入口(app.js) / 清单配置(app.json) / 全局样式(app.wxss)**；
- `app.json` 是**整个小程序的"总装配清单"**——路由、外观、tabBar、权限、分包全在里面（对照 vue 的 `main.js` + `vite.config` + `package.json` 合体）；
- 只有 `project.config.json`、`sitemap.json` 是工具/平台侧文件，不参与业务运行时。

---

## 二、app.js：App 构造器与 globalData

```js
App({
  onLaunch() { /* 小程序初始化，全局只跑一次 */ },
  globalData: { userInfo: null },   // 全局共享数据（同逻辑线程）
})
```
- 一个小程序**有且仅有一个** `App()`，在 `app.js` 顶层调用；
- `globalData` 是跨页面共享内存（因逻辑层单线程，呼应 mp-overview 第四节、mp-communication）；
- 页面/组件里用 `getApp()` 拿实例——注意别在 `App.onLaunch` 里 `getApp()` 自己。

呼应 **react-context / vue-provide-inject**：`globalData` 是最朴素的"全局态"，简单但缺乏响应式与约束，大项目要谨慎（易变成"全局垃圾桶"）。

---

## 三、app.json：全局配置核心

```json
{
  "pages": [
    "pages/index/index",     // 第一项 = 启动首页
    "pages/logs/logs"
  ],
  "window": {
    "navigationBarTitleText": "示例",
    "navigationBarBackgroundColor": "#07c160",
    "backgroundTextStyle": "dark"
  },
  "tabBar": { /* 见 mp-tabbar */ }
}
```
- **`pages`**：路由表（数组），**每一项是页面路径（不写扩展名）**，必须真实存在四件套；第一项是冷启动首页；未注册的路径 `navigateTo` 会失败（呼应 mp-route）；
- **`window`**：全局外观（导航栏标题/颜色、下拉背景、是否透明…），**只对非 tabBar 生效的默认**；
- 还有 `permission`（授权描述）、`requiredPrivateInfos`、`debug` 等；
- `pages` 里**分包**页面不写主包，见 mp-subpackage。

---

## 四、页面四件套与 page.json 局部覆盖

每个页面目录：
- `index.wxml`（视图）/ `index.wxss`（页面样式）/ `index.js`（`Page({})` 逻辑）/ `index.json`（**页面配置**，可省略）；
- `index.json` 里写的 `navigationBarTitleText`、`usingComponents`、`enablePullDownRefresh`、`backgroundColor` 等会**覆盖 `app.json` 的 `window` 同名全局项**；
- 组件也类似：`Component` 有自己的 json（`component: true` + `usingComponents`）。

> 这种"全局配置 + 页面级局部覆盖"的分层，和 Vite `base`/build 全局 + 路由级 meta 覆盖是同构思路（呼应 10-vite-deploy、vue-router-basics）。

---

## 五、project.config.json 与 sitemap.json

- **`project.config.json`**：给**开发者工具/构建**看，不参与运行——`appid`、项目名、编译设置（ES6→增强编译、样式自动补全、minify）、忽略目录、上传时的 `packOptions` 等；`project.private.config.json` 放个人本地偏好、通常不入库（呼应 node-config 区分共享/本地配置）；
- **`sitemap.json`**：声明哪些页面**允许被微信"搜索直达"索引**（`rules` 配 `action: allow/disallow`、`page`）；不影响功能，只影响搜索收录（呼应 SEO 概念、react-nextjs）。

---

## 六、自检清单

- [ ] app.js / app.json / app.wxss 各管什么？哪个是"总装配清单"？
- [ ] pages 数组第一项是什么？没注册的路径会怎样？
- [ ] 页面级 index.json 能做什么？和 app.json 的 window 谁优先？
- [ ] globalData 依赖了双线程架构的哪条前提？
- [ ] project.config.json / sitemap.json 分别是给谁看的？

---

## 🚀 部署预告

- 本课把"工程骨架 + 配置分层（全局/页面级、工具/平台）"理清，是组织中型项目的地基；
- 下一关进入 **mp-lifecycle**：`App` 与 `Page` 各自的生命周期钩子、触发顺序与用途、页面栈——把"什么时候该跑哪段代码"讲透（呼应 vue-lifecycle、react-component）。
