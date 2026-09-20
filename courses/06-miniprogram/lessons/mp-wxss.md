# WXSS 与 rpx 适配

> 目标：WXSS = CSS + 微信方言。核心三件事：**rpx 自适应单位**解决"一台代码、万种屏幕"；**样式的作用域规则**（app.wxss 全局、页面 wxss 局部、组件默认隔离）决定样式为什么"莫名生效/莫名失效"；**@import 与选择器限制**是工程组织的边界。对照 **vue-class-style-transition** 的 scoped 思想、**10-vite** 的 CSS 处理管线。

---

## 一、WXSS 与 CSS 的关系

官方定义：WXSS 在 CSS 基础上做了**扩展**和**裁剪**。

- **扩展**：新增尺寸单位 `rpx`；提供背景图本地/远程支持的差异约定；`@import` 引入样式文件；
- **裁剪**：**ID 选择器（`#id`）在组件内不可用**（官方文档明确组件样式只能用 class 选择器）；属性选择器、复杂组合选择器支持度也打折——**能用 class 就用 class** 是官方推荐姿势；
- 局部变量 `--var()`、`calc()` 等新 CSS 特性视 WebView 内核版本而定，基础库升级后支持度提升，老机型要留后手。

为什么裁剪？还是双线程+组件化埋的雷：组件样式要做隔离（见第四节），选择器越简单，隔离与 diff 越可控。

---

## 二、rpx：屏幕适配的一等公民

**rpx（responsive unit）**：规定屏幕宽为 **750rpx**。iPhone6（375px 宽）下 `1rpx = 0.5px`；任何设备上 `rpx = px × 750 / 屏幕宽度px`。

```wxss
/* 设计稿按 750px 宽出图 → 量出来多少 px 就写多少 rpx，零换算 */
.box { width: 375rpx; padding: 20rpx; font-size: 28rpx; }
```

换算速记：

| 设备 | 屏幕宽(px) | 1rpx = ?px |
|---|---|---|
| iPhone6/7/8 | 375 | 0.5 |
| iPhone Plus | 414 | ≈0.552 |
| 常见安卓 | 360 | ≈0.48 |

三条实战结论：

1. **布局尺寸用 rpx，细线/发丝级边框用 px**——1rpx 在小屏可能不足 1 物理像素，出现"边框消失/粗细不一"（业界通用解法：边框保留 px 或 4rpx 起）；
2. **字号**：正文用 rpx 随屏缩放是主流；做"大字模式/无障碍"适配时需混用 `px`+`media (prefers-color-scheme)` 级别的方案；
3. rpx 只是**布局适配**，不是高清适配——图片清晰度靠 `image` 的 `mode` 与多倍图（呼应 mp-interaction 里的图片组件）。

对照：H5 圈的 `vw`/`rem` 方案（`1rem` 思想与 750 设计稿换算，和 rpx 异曲同工，呼应 vue 课程里的移动端适配），小程序把这套折算交给了运行时。

---

## 三、样式的三层来源与优先级

一个页面的最终样式来自三层叠加：

```text
1. app.wxss        —— 全局样式，所有页可见
2. 页面目录 xxx.wxss —— 页面样式（app.wxss 的公共部分建议抽这里？不，公共放 app.wxss）
3. 组件 styleIsolation 后的组件样式 —— 见第四节
```

- 页面样式与全局样式**同权重时页面胜出**（后来者居上，层叠规则不变）；
- **行内 style 优先级最高**：`<view style="color: red"/>`，动态样式对象还能在逻辑层拼（`style="{{ itemStyle }}"`）；
- app.wxss 只放**真正的公共原子**（重置、字体、通用卡片），全塞全局会让每页都背全量样式——对照 **10-vite** 里"全局 CSS 有体积成本"的结论。

```wxss
/* @import：把公共片段拆文件 */
@import "../../styles/variables.wxss";
.page { background: var(--bg); }
```

`@import` 书写注意：**必须在文件最顶部**、多级页面路径用相对路径且**不能以 `./` 开头的写法混用出错**——分包场景路径解析是高频坑（呼应 mp-subpackage）。

---

## 四、组件样式隔离：为什么我的样式"出不去/进不来"？

自定义组件默认 `styleIsolation: 'isolated'`：

- 组件内样式**不影响外部**，外部（页面/app）样式也**不影响组件内**（除 `tag`/`id` 类通用规则外）；
- 可选值：`apply-shared`（页面 wxss 影响组件）、`shared`（组件与页面互相影响）、`page`（组件样式作用到页面）；也可在页面 `usingComponents` 处或组件 `options.styleIsolation` 配置；
- **app.wxss 是个例外**：部分版本对组件仍生效？——以官方"组件不受 app.wxss 影响"为准来写代码，**需要共享就显式 @import 或改隔离选项**，别赌历史行为。

这相当于 Vue 的 `<style scoped>`（呼应 vue-class-style-transition）但更严格：scoped 只是加属性选择器，小程序是**运行时真隔离**。

给组件内的原生节点写样式时：`isolated` 下父页面选不中组件里的 `view`，穿透需 `externalClasses`（外部类）——这是官方留的"样式插槽"（呼应 mp-component）。

---

## 五、暗色模式与主题

- `app.json` 配 `"darkmode": true` + 一份 `theme.json`，用 `@media (prefers-color-scheme: dark)` 写两套；
- 主题变量首选 **CSS 变量**（`--main-color`）+ 根节点 class 切换，比双份 wxss 好维护——与 Vue 项目主题化同套路（呼应 vue-project-architecture）。

---

## 六、自检清单

- [ ] 750rpx 是什么？375px 宽屏上 1rpx 等于多少 px？
- [ ] 哪些地方应该用 px 而不是 rpx？为什么？
- [ ] 组件默认隔离级别是什么？想让页面样式进组件该改哪个值？
- [ ] `@import` 的位置与路径有什么讲究？
- [ ] 为什么建议"能用 class 就用 class"？

---

## 🚀 部署预告

- 样式方言的根源仍是双线程：简单选择器 + 显式隔离，换来可控的 diff 与组件复用；
- 下一关 **mp-render**把"数据→节点"的最后一段讲完：`wx:for` 的 item/index/key、`wx:if` 家族、以及**为什么别拿 index 当 key**——这是 setData 性能课（mp-setdata）的前置（呼应 vue-conditional-list、react-lists-keys）。
