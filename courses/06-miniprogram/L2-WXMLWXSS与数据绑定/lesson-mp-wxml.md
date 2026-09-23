# WXML 模板语法

> 目标：WXML 是小程序的"视图描述语言"——它不是 HTML，也不是 JSX，而是一门**只能写在 `.wxml` 文件里的模板语法**。本课讲四件事：`{{}}` 数据插值与运算、属性/事件绑定、`<block>` 分组、以及**在模板里跑的脚本 wxs**。学完你会发现它 ≈ Vue 的模板语法 minus 组件、plus 微信方言（呼应 **vue-template-syntax**、**react-jsx**）。

---

## 一、为什么 WXML 不能是 HTML？

回忆 **mp-overview**：渲染层是 WebView，逻辑层是独立的 JS 引擎，**逻辑层没有 DOM**。所以：

- 你不能 `document.createElement`，也不能把 HTML 字符串塞进页面；
- 视图**只能用 WXML 声明**，数据靠 `setData` 从逻辑层"快递"过来；
- WXML 最终被编译成渲染层认识的节点树。

这就是它长得像 HTML、却处处是方言的根本原因——**它本质是"模板"，不是"标记语言"**。

对照：Vue SFC 的 `<template>` 也是模板（呼应 vue-template-syntax），而 React 干脆用 JS（JSX，呼应 react-jsx）——三条路线，两种哲学。

---

## 二、`{{}}` 插值：唯一的"数据入口"

```wxml
<!-- data: { greeting: '你好', name: '大前端', raw: '<b>粗?</b>', n: 3 } -->
<view>{{ greeting }}, {{ name }}!</view>   <!-- 你好, 大前端! -->
<view>{{ n + 1 }}</view>                    <!-- 4：支持表达式 -->
<view>{{ n > 2 ? '大' : '小' }}</view>      <!-- 三元可用 -->
<view>{{ raw }}</view>                      <!-- 转义输出 <b>粗?</b>，不会变粗体 -->
```

关键规则：

1. **只能用于文本节点和属性值**，不能出现在标签名、节点类型上（`<{{tag}}/>` 是非法的——Vue 的动态组件 `<component :is>` 思路在这里只能靠 `wx:if` 分支或模板（template/is）实现）；
2. 支持**表达式**：算术、三元、逻辑、字符串拼接、下标访问 `list[0].name`；但**不支持** `import`、正则字面量、`new` 等完整 JS；
3. **默认转义**输出，天然防 XSS——和 React JSX 自动转义同一思路（呼应 react-jsx 的 XSS 一节）；想渲染富文本要用 `<rich-text nodes="{{html}}"/>`；
4. 插值里的数据**只来自 `data`**（或组件的 `properties`），逻辑层不 `setData`，视图永远看不到。

对照 Vue：`{{}}` ≈ `{{ }}` 插值；但 Vue 模板能写方法调用 `{{ fmt(d) }}`，WXML **不能调用 js 方法**——需要计算逻辑要么在 setData 前算好，要么交给 wxs（见第四节）。这是面试高频差异点。

---

## 三、属性与事件绑定：方言速查

```wxml
<image src="{{ avatarUrl }}" mode="aspectFill" />
<view class="box {{ active ? 'box--on' : '' }}">条件类名</view>
<input value="{{ keyword }}" bindinput="onInput" />
<button bindtap="onTap" data-id="{{ item.id }}">点我</button>
```

| 需求 | WXML 写法 | Vue 写法 | React 写法 |
|---|---|---|---|
| 属性插值 | `src="{{url}}"` | `:src="url"` | `src={url}` |
| 事件监听 | `bindtap="onTap"` | `@click="onTap"` | `onClick={onTap}` |
| 静态 vs 动态 | 不加 `{{}}` 即字符串 | 同左 | 同左（JSX 必须表达式） |

注意两点微信方言：

- **属性名单纯小写连字符**，`class` 可多个空格分隔、可 `{{}}` 混拼（动态类名玩法与 vue-class-style 的数组对象语法相比，只剩"字符串拼接"这一招）；
- `bindtap` 的值是**逻辑层方法名的字符串**，不是函数引用——找不到方法只是静默警告，这是新手"点了没反应"的头号原因。

---

## 四、`<block>` 与 `<template>`：分组与复用

```wxml
<!-- block：不渲染任何节点的"分组括号"，配合 wx:for/wx:if -->
<block wx:if="{{ logged }}">
  <view>欢迎 {{ nickName }}</view>
  <view>积分 {{ points }}</view>
</block>

<!-- template：定义可复用片段，{{ ...data }} 一次性灌入 -->
<template name="userCard">
  <view class="card">{{ name }} / {{ level }}</view>
</template>
<template is="userCard" data="{{ ...userInfo }}" />
```

- `<block>` 对标 Vue 的 `<template v-if>`（无容器包裹多个兄弟节点的场景）；
- `<template>` 是 WXML 层的"函数组件"雏形：**只能复用视图结构，不能带逻辑与状态**——真正的复用要等自定义组件（mp-component）。跨文件用 `<import src="..."/>` 或 `<include src="..."/>`（include 只取 `<template>` 之外的内容，官方文档明确）。

---

## 五、wxs：模板里的"受限脚本"

WXML 不能调 js 方法，那"价格分转元"这种小格式化怎么办？——**wxs**：跑在**渲染层**的受限脚本语言。

```wxml
<wxs module="fmt">
module.exports.yuan = function (fen) {
  return (fen / 100).toFixed(2) + '元'
}
</wxs>
<text>{{ fmt.yuan(price) }}</text>

<!-- 也可以放独立 .wxs 文件 -->
<wxs src="../../utils/fmt.wxs" module="fmt" />
```

wxs 的三条"铁律"（全部源于它工作在渲染层）：

1. **不能调用逻辑层的 js 方法**，反之逻辑层也不能 import wxs——两个世界各写各的；
2. 语法是 **ES5 子集**：没有 `let/const`、箭头函数、`Date` 构造之外很多新 API 被阉割，官方文档有完整清单；
3. `<wxs>` 内**不能有空行出现在函数体中**？——不必背坑，记住"报错先查语法年份"，用 ES5 思维写它。

对照：wxs ≈ Vue 的 **computed/过滤器思路在模板层的手动挡**；React 里同样位置你直接写 JS 表达式即可（呼应 react-jsx"模板即代码"）。**选型直觉**：能在 setData 前算好的就别丢给 wxs；wxS 适合"纯展示格式化、不想为此多一次 setData"的场景。

---

## 六、转义与易错点清单

- `{{}}` 输出自动转义，防 XSS（同 JSX）；
- **布尔属性**：`hidden="{{ false }}"` 传的是布尔，`hidden="false"` 传字符串——字符串 `"false"` 在 WXML 里按"存在即真"处理会**意外生效**（呼应 Vue 的 `v-bind` 与非 bind 差异）；
- `{{}}` 两侧空格可有可无，但**引号不能省**（属性值里）；
- 注释：`<!-- -->`，wxs 内用 `/* */`；
- WXML 没有 `v-html`，富文本只有 `<rich-text>` 且节点要传**对象数组**最稳（字符串也行但受限）。

---

## 七、自检清单

- [ ] 为什么 WXML 里不能写 `{{ formatDate(d) }}`？两条替代路线是什么？
- [ ] `<block>` 解决什么问题？对标 Vue 的什么写法？
- [ ] wxs 能调用 `Page` 里的方法吗？为什么？
- [ ] `hidden="false"` 和 `hidden="{{false}}"` 差别？
- [ ] `template is` 与自定义组件的复用边界在哪？

---

## 🚀 部署预告

- 本课钉死了"视图只能声明式地吃 data"这一心智：`{{}}` 是入口、转义是默认、wxs 是渲染层的小后门；
- 下一关 **mp-wxss**：样式也方言——`rpx` 自适应单位、`@import`、全局与页面样式的层叠、选择器的限制清单（呼应 vue-class-style-transition 与 10-vite 的 CSS 处理）。
