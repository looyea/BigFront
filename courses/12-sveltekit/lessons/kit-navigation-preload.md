# 导航与预取：让点击零等待

> 目标：掌握 SvelteKit 客户端导航的完整机制——data-sveltekit-* 属性族的两档预取语义与四档激进级别、saveData 尊重策略、布局打断属性，以及 preloadData/preloadCode 的编程式入口。

## 一、导航模型：普通 <a> 就是路由器

SvelteKit 用**原生 `<a>` 元素**做应用内导航，没有 `<Link>` 组件这种方言。用户点击一个 href 属于本应用的链接时，Kit 接管：先 import 目标路由的代码，再调用其 load 函数取数据，然后渲染——全程不刷新页面。外部链接与特殊情况才走浏览器原生整页导航。

预取（preload）的全部意义在于**抢跑这两步**：官方原话，提前 import 代码 + 预取数据能抢出大约两百毫秒——"界面卡不卡"的体感分水岭就在这两百毫秒里。

## 二、data-sveltekit-preload-data：数据预取两档制

- `"hover"`：桌面端鼠标在链接上停住即开始预取；移动端 `touchstart` 即开始；
- `"tap"`：`touchstart` / `mousedown` 注册的那一刻才开始——比 hover 保守一档。

官方脚手架已经默认给你配好：`src/app.html` 的 `<body data-sveltekit-preload-data="hover">`，全站链接悬停即预取。什么时候该降级到 tap？官方点名的场景：数据时效性极高的页面（示例是个股票行情页）——hover 到点击之间有个延迟窗口，预取的数据可能已经旧了；或者 hover 误触率高，白白打爆后端。

**saveData 红线**：用户系统开了"省流量"（`navigator.connection.saveData` 为 true）时，数据与代码预取**一律自动失效**，不用你写任何判断——这是内置的尊重用户策略，别用编程式 API 绕过它。

## 三、data-sveltekit-preload-code：只热代码，四档激进级

不想提前打数据（有鉴权开销、行情类数据），但想提前把 JS chunk 拉回来？`data-sveltekit-preload-code` 按激进程度递减给四档：

| 值 | 触发时机 |
|---|---|
| `"eager"` | 页面就绪立刻预取 |
| `"viewport"` | 链接进入视口就预取 |
| `"hover"` | 悬停时（只预取代码） |
| `"tap"` | 按下时（只预取代码） |

两条官方限制必须记住：
1. **`eager` 与 `viewport` 只对"导航完成后就在 DOM 里"的链接生效**——之后 `{#if}` 里新渲染出来的链接不会被主动预取（官方明示这是为了避免 DOM 观察的性能陷阱），它们只能等 hover/tap 触发；
2. **代码预取是数据预取的前提**，所以这个属性只有在比同元素上 `preload-data` **更激进**时才有效果——两个属性并存时取保守侧的行为是有前提的。

## 四、属性族其余成员与继承规则

属性可挂在 `<a>` 上，也可挂在**任意父容器**上继承；对 `<form method="GET">` 同样生效：

- `data-sveltekit-reload`：让 Kit 别接管，走浏览器整页导航；`rel="external"` 同效，且额外在预渲染时被忽略；
- `data-sveltekit-replacestate`：点击后用 replaceState 替换当前历史条目，不新增记录；
- `data-sveltekit-noscroll`：导航后不重置滚动位置（Kit 默认滚到 0,0，带 `#hash` 则滚到对应元素）；
- `data-sveltekit-keepfocus`：导航后保持当前焦点——官方提醒别用在链接上（焦点会停在 `<a>` 本身），且目标页里该元素必须还存在，否则焦点凭空丢失，对读屏用户是灾难。

**局部关闭**：嵌套容器写 `data-sveltekit-preload-data="false"` 可在"已全局开启"的范围内反向豁免一片链接；条件开关的官方写法是 `data-sveltekit-preload-data={condition ? 'hover' : false}`。

## 五、编程式入口与导航生命周期概览

属性够不到时上函数（均从 `$app/navigation` 导入）：`preloadData(href)` 手动触发"取代码+跑 load"，返回 Promise，解析出 `{ type, status, data }`——与用户 hover/tap 触发的预取同一条行为链；`preloadCode(pathname)` 只热代码不跑 load，同样返回 Promise，且支持 `/blog/*` 这样的通配路径匹配未访问过的路由。配合 `goto`、`beforeNavigate`（拦截：导航对象上调 `cancel()`，离站型导航会触发浏览器原生确认弹窗）、`onNavigate`、`afterNavigate` 构成完整编程面——典型用法是搜索结果列表渲染后对前 N 条预取，hover/tap 都等不到这么快。拦截与状态钩子的深水区在 L7 正片，这一关先立索引。

## 六、自检清单
- [ ] 说出点击"自家链接"到渲染之间 Kit 做了哪两步、预取抢的是哪两百毫秒
- [ ] hover 与 tap 两档数据预取的触发事件；什么场景该从 hover 降到 tap
- [ ] preload-code 四档取值 + eager/viewport 的 DOM 时机限制 + "只认更激进档位"规则
- [ ] saveData 开启时预取的行为，以及嵌套 "false" 的局部豁免写法
- [ ] data-sveltekit-reload / replacestate / noscroll / keepfocus 各自解决什么问题

🚀 **下一站 L3**：kit-load-universal——load 函数全解：event 契约、依赖追踪与失效重取，从"路由语法"进入"数据协议"主场。
