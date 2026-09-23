# mp-lifecycle 面试题精选

> 共 15 题，覆盖 A 应用生命周期 / B 页面生命周期 / C 时序与栈 / D Vue/React 对照类。

---

## 一、App 生命周期（A 类）

### 1. App 有哪些生命周期？onLaunch 和 onShow 的区别？

**答**：`App({ onLaunch, onShow, onHide, onError })`（新版还有 `onPageRoute` 等）。**onLaunch**：冷启动时触发、**全局仅一次**，用于初始化（读缓存、判登录、取系统信息）。**onShow**：小程序**从后台切到前台**或进入时**反复触发**；onHide 相反。区别就是"一次性初始化" vs "每次可见"。options 携带 `scene`（场景值）、`path`、`query`，可判断来源（扫码/分享/消息）（呼应 mp-lifecycle 第一节）。

**来源**：微信小程序 — App 生命周期、场景值 scene

### 2. onError 能捕获所有错误吗？通常拿来做什么？

**答**：`App.onError(msg)` 捕获小程序运行时的**全局 JS 异常与部分 API 报错**，用于**统一上报监控**（接 Sentry/自建埋点）。但它不是万能 try/catch：某些异步/被 catch 的错误不一定进 onError，页面级错误也不完全等价。工程上常 onError + `wx.onError` 组合做崩溃收集（呼应 react-testing 监控、mp-publish）。

**来源**：微信小程序 — onError、错误处理与监控

---

## 二、页面生命周期（B 类）

### 3. Page 的五个核心生命周期各自适用场景？

**答**：`onLoad(query)` 页面加载一次——解析入参、初始化 data；`onShow` 每次显示——刷新/恢复；`onReady` 首次渲染完成——查节点、初始化需布局的组件（如图表/地图）；`onHide` 被切走未销毁——暂停计时；`onUnload` 销毁——清理定时器、解绑。典型分配：取数在 onLoad、依赖"每次可见都最新"的在 onShow、要操作已渲染节点的在 onReady（呼应 mp-lifecycle 第二、三节）。

**来源**：微信小程序 — 生命周期函数

### 4. 为什么"从别的页面返回后要刷新数据"要写在 onShow 而不是 onLoad？

**答**：因为被返回的页面**仍在页面栈里、并未销毁重载**，返回只触发它的 **onShow**，不会重新走 onLoad（onLoad 每页仅一次）。把刷新写在 onLoad 就永远只在首次执行，看不到别处的修改。这与 React "同路由换参数不重挂载需监听参数"、Vue keep-alive 的 `activated` 属同一心智（呼应 mp-lifecycle 第三节、react-router-basics 第 8 题）。

**来源**：微信小程序 — 页面栈与生命周期、navigateBack 行为

### 5. onReady 和 onLoad 都能初始化，有何讲究？

**答**：onLoad 时**视图尚未渲染完成**，此时 `createSelectorQuery` 查不到节点、拿不到布局尺寸；onReady 表示**初次渲染完毕**，可安全查节点/初始化依赖真实布局的东西（地图、canvas、滚动定位）。数据准备放 onLoad，涉及"渲染后 DOM/布局"的操作放 onReady。onReady 每页也只触发一次（呼应 mp-lifecycle 第二节）。

**来源**：微信小程序 — onReady、节点查询 boundingClientRect

---

## 三、时序与页面栈（C 类）

### 6. 描述一次冷启动到首页可交互的完整生命周期顺序。

**答**：`App.onLaunch →（options 带 scene）→ App.onShow → 首页 Page.onLoad → Page.onShow → Page.onReady`。onLaunch/onShow 属全局，页面三个按 load/show/ready 依次；之后用户可交互。若后续切后台再回来，只再触发 `App.onHide → App.onShow`（+ 当前页 onShow），不会再走 onLaunch/onLoad（呼应 mp-lifecycle 第四节）。

**来源**：微信小程序 — 启动流程 / 生命周期时序

### 7. navigateTo 一个页面，两个页面的生命周期分别怎么变？

**答**：当前页触发 **onHide**（未销毁、压入栈），新页 **onLoad→onShow→onReady**。之后 `navigateBack`：新页 **onUnload**（销毁），回到原页 **onShow**（不 onLoad）。这正是"栈"模型：最多 10 层（超出某些跳转改用 redirectTo，呼应 mp-route）。理解栈能解释为何返回页只 onShow（呼应 mp-lifecycle 第四节）。

**来源**：微信小程序 — 路由与页面栈、getCurrentPages

### 8. 下拉刷新、触底加载分别用哪些钩子？需要注意什么？

**答**：`onPullDownRefresh`（需在页面/全局 json 开 `enablePullDownRefresh`），处理完必须 `wx.stopPullDownRefresh()` 收起动画；`onReachBottom`（可配 `onReachBottomDistance`）做分页加载。`onPageScroll` 监听滚动（高频，勿在其中做重活/频繁 setData，呼应 mp-setdata）。这些是"事件型"钩子，和核心五钩子分开（呼应 mp-lifecycle 第五节、mp-performance）。

**来源**：微信小程序 — 页面事件处理函数、下拉刷新

---

## 四、Vue / React 对照（D 类）

### 9. 小程序 Page 生命周期和 Vue 生命周期怎么对应？

**答**：`onLoad`≈Vue `created`（数据初始化、可取参数但不碰 DOM）；`onReady`≈`mounted`（渲染完成、可操作节点）；`onShow/onHide`≈Vue 中 keep-alive 的 `activated/deactivated` 或页面可见性；`onUnload`≈`unmounted`（清理）。差异：小程序无"beforeUpdate 系列"，更新由 setData 驱动、无组件级细粒度钩子（组件另有一套，呼应 mp-component-lifecycle、vue-lifecycle）。

**来源**：Vue 生命周期钩子图、微信小程序 — 生命周期

### 10. 和 React 函数组件的 useEffect 挂载/卸载相比，小程序生命周期思路有何异同？

**答**：相同：都要区分"只做一次(挂载)"与"清理(卸载)"——`onLoad`/`onUnload` ≈ `useEffect(fn,[])` 的 setup/cleanup；防泄漏都在卸载清定时器。不同：React 用**声明式 effect + 依赖数组**、组件级；小程序是**具名钩子**、以 Page 为粒度、无"依赖变化重跑"概念（要重跑靠 onShow 或 observer）。React 心智需从"顺序即身份"切换回"框架按约定回调你"（呼应 react-useeffect、react-component）。

**来源**：React useEffect 文档、微信小程序 — 生命周期

### 11. App.onShow 拿到的 scene 有什么实际用途？

**答**：`scene`（场景值）标明用户**从哪个入口进入**小程序（扫码 1011、公众号菜单、分享卡片 1007、小程序消息、发现栏…）。据此可做：入口埋点/来源统计、"从分享进来给特殊引导"、差异化首屏、判断是否带 `shareTicket` 处理群分享。是运营与体验个性化的重要输入（呼应 mp-openapi 分享、mp-publish 埋点）。

**来源**：微信小程序 — 场景值列表、转发 shareTicket

### 12. 面试问"你把定时器和一次性的首屏请求分别放哪、清理放哪"，如何答？

**答**：一次性初始化/取参/首屏数据 → `onLoad`（仅一次）；依赖渲染后布局的 → `onReady`；"每次可见都要刷新/暂停恢复"的 → `onShow`/`onHide`；定时器/事件监听的**创建**放 onLoad 或 onShow、**清理**必须放 `onUnload`（页面销毁），避免离开后仍在跑造成泄漏和错 setData。全局级（如登录、系统信息）放 `App.onLaunch`。答出"次数语义 + 卸载清理"最稳妥（呼应 mp-lifecycle 全课、react-effect-patterns）。

**来源**：微信小程序 — 生命周期最佳实践、内存泄漏防范

---

## 补充（新专题 13-15）

### 13.  描述一次「冷启动到首页可交互」的完整生命周期顺序，并指出首屏取数该放哪。

顺序：App.onLaunch（全局初始化、可读场景值/启动参数）→ App.onShow → Page.onLoad(query，拿页面参数) → Page.onShow → Page.onReady（首次渲染完成）。首屏数据：放在 onLoad 尽早发起请求（不必等 onReady，因为取数不依赖真实节点），setData 后触发渲染；若「要等取到的数据渲染完再做某事」，用 setData 的回调或 onReady。onShow 适合「每次进入都要刷新/校准」的数据（回到前台、别的页改了要同步）。冷启动优化点：onLaunch 里别做重同步阻塞、把首屏接口在 onLoad 立刻并发发出、配合骨架。分清「一次性(onLoad/onLaunch/onReady) vs 每次显示(onShow)」是答这题的骨架。

**来源**：小程序 App/Page 生命周期文档与冷启动时序；性能优化首屏取数实践。

### 14.  定时器和「一次性首屏请求」分别放哪个钩子、清理放哪？为什么？

一次性首屏请求放 onLoad（只该跑一次，页面实例存续期间不重复）；每次回到前台/显示要校准的放 onShow。定时器：若只在「页面可见时」跑（轮询、倒计时动画），onShow 起、onHide 停、onUnload 清——因为小程序对已入栈隐藏页的 JS 不一定冻结，不停就会后台空转、甚至 setData 到隐藏页报错/耗电；纯一次性延时（如 1s 后自动收起 toast）也务必在 onUnload clearTimeout，防止页面销毁后回调仍持有已卸载实例（内存泄漏 + 潜在 this 已销毁）。核心：起停配对、作用域跟随可见性、销毁必清理，和 React useEffect 的 cleanup 心智同构。

微信官方文档《小程序生命周期》；掘金《App 与 Page 生命周期执行顺序图解》

### 15.  小程序 Page 生命周期与 Vue 的 created/mounted、React 函数组件的 useEffect 挂载/卸载怎么对照？

对应关系（近似，别硬套）：onLoad≈created/挂载 effect（初始化、拿参数，但视图未渲染）；onReady≈mounted/挂载 effect 里 DOM 就绪那次（可查节点）；onShow≈Vue activated(KeepAlive)/再次可见，React 没有直接等价（可用 useFocusEffect——React Navigation——类比）；onHide≈deactivated；onUnload≈unmounted/卸载 cleanup。本质差异：① 小程序有「显隐(onShow/onHide)」这一维是因为页面栈常驻、页面不销毁也切换显隐，Vue/React SPA 默认路由离开即卸载、要显式 KeepAlive 才有 activated；② 小程序显式给 onLoad/onReady 两个点，把「数据就绪」与「视图就绪」分得很清，而 Vue/React 靠 mounted/effect 时机隐式表达；③ 清理：小程序手写在 onUnload，React 用 effect 返回函数、Vue3 用 onUnmounted。

SegmentFault《onLaunch 里请求接口为什么会竞态》；CSDN《小程序启动流程与冷启动优化》
