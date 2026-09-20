# 页面路由与跳转

> 目标：小程序**没有 URL 栏、没有 `<a>` 标签、没有 history**——所有页面跳转都是"调 API + 操作一个页面栈"。本课讲透五种跳转 API 各自的边界（尤其 **tabBar 页只能 switchTab/redirectTo、不能 navigateTo** 这条铁律）、页面栈 10 层上限、url 传参的编码规则，并把 vue-router / react-router 的路由心智"降级翻译"到小程序（呼应 **vue-router-basics**、**react-router-basics**、**mp-lifecycle 页面栈**）。

---

## 一、小程序路由 vs SPA 路由：世界观差异

| | Vue/React Router | 小程序 |
|---|---|---|
| 触发方式 | `<router-link>`/`<Link>`、`router.push` | `wx.navigateTo` 等 API |
| 地址栏 | 有 URL、可分享链接、可前进后退 | 无 URL，只有**页面栈** |
| 页面实例 | 一个组件复用渲染不同 route | **每个页面是独立 WebView 实例**（呼应 mp-overview） |
| 路由守卫 | `beforeEach` | 无内置，onLoad 里自判 or 拦截封装 |
| 懒加载 | 动态 import 分包 | 天然按页加载 + 分包（mp-subpackage） |

一句话：**小程序路由 = 命令式地 push/pop 一个"原生页面栈"**，没有声明式链接、没有匹配表（path→component 在 app.json pages 里静态登记，呼应 mp-directory）。

---

## 二、五种跳转 API：一张决策表

```js
wx.navigateTo({ url: '/pages/detail/detail?id=5' });   // 入栈：保留当前页，可 back 回来
wx.redirectTo({ url: '/pages/login/login' });           // 替换：关闭当前页再打开（栈不加深）
wx.navigateBack({ delta: 1 });                          // 出栈：返回上（delta）页
wx.switchTab({ url: '/pages/home/home' });              // 跳 tabBar 页（且会清空非 tab 栈）
wx.reLaunch({ url: '/pages/home/home' });               // 重启：关掉所有页，打开唯一页
```

| 需求 | 用哪个 | 页面栈变化 | 传参后原页数据还在吗 |
|---|---|---|---|
| 详情→可返回 | navigateTo | +1（压栈） | 在（原页 onHide 不销毁） |
| 登录成功回跳、流程不让回退 | redirectTo | 替换栈顶 | 没了（原页 onUnload） |
| 返回 | navigateBack(delta) | -delta | — |
| 切到 tabBar 首页 | switchTab | 清非 tab 页 | — |
| 退出登录/异常兜底回首页 | reLaunch | 清所有，剩 1 页 | 全没了 |

### 铁律：tabBar 页与普通页的"通行规则"

- **tabBar 页**（在 app.json `tabBar.list` 里登记的）**只能** `switchTab` 或 `reLaunch` 进入，**`navigateTo`/`redirectTo` 会失败**（报 "can not navigateTo a tabbar page"）；
- 反之，`switchTab` 只能去 tabBar 页，去普通页失败；
- 为什么？tabBar 页是常驻底栏的"根级"页面，压进普通页面栈会破坏"切 tab 保留各自栈"的模型（呼应 mp-tabbar）。

`wx.navigateTo` 的 `url` **不能带 tab 页**，也**不能跳 `currentPage` 自身无意义**；页面栈**最多 10 层**，第 11 次 navigateTo 失败——深层嵌套流程要改 redirectTo 或重新设计。

---

## 三、url 传参：小程序唯一的"路由参数"

```js
// 跳转
wx.navigateTo({ url: `/pages/detail/detail?id=${id}&from=list` });

// 接收（呼应 mp-lifecycle onLoad）
Page({ onLoad(query) { this.setData({ id: query.id, from: query.from }); } });
```

规则与坑：

1. query 值**都是字符串**——`?id=5` 收到 `"5"`，数字/布尔要自己转（同 web 的 `location.search`，呼应 vue-router 的 `params` 需 `Number()`）；
2. 传对象：`?data=${encodeURIComponent(JSON.stringify(obj))}`，接收端 `JSON.parse(decodeURIComponent(query.data))`——**但这是坏味道**：大数据别走 url（长度限制、可读性差），改用 globalData/缓存/只传 id（呼应 mp-setdata 面试第 6 题、mp-communication）；
3. 参数是"进入时一次性"的——**返回时想带回新数据？url 做不到**，得靠 eventChannel 或页面实例引用（下一关 mp-communication）。

---

## 四、没有守卫怎么做路由控制？

Vue `router.beforeEach` 判 token 拦未登录——小程序无路由表，两个替代：

- **入口页判断**：App.onLaunch/onShow 或首页 onLoad 里查登录态，未登录 `wx.redirectTo('/pages/login')`（登录后再 redirect 回原目标，目标 url 用参数带过去）；
- **封装跳转**：把 `wx.navigateTo` 包一层 `guardTo(url)`，在里面集中做权限判断/埋点/参数编码——"拦截器"思想（呼应 exp-auth、react-router-guard-lazy、mp-interaction 封装）。

`wx.onAppRoute`/新版路由事件可监听跳转做埋点（呼应 mp-lifecycle 的 onPageRoute、mp-publish 埋点）。

---

## 五、自检清单

- [ ] 五种跳转 API 各自让页面栈发生什么变化？
- [ ] 为什么 tabBar 页不能 navigateTo？该用什么？
- [ ] 页面栈上限几层？超了怎么办？
- [ ] onLoad 收到的 query 参数类型是什么？想传对象该怎么办、且为什么不该这么干？
- [ ] 没有路由守卫，登录拦截怎么实现两条路？

---

## 🚀 部署预告

- 路由课钉死了"命令式操作页面栈 + tabBar 通行规则 + query 全是字符串"三条小程序特有约束；
- 下一关 **mp-tabbar**：把 app.json 里的 tabBar 配置讲全（list/图标/selectedColor/徽标/自定义 tabBar），并解释"tab 页各自的页面栈"到底怎么工作（呼应 mp-directory、mp-subpackage 首页分包）。
