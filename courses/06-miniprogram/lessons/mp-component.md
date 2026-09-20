# 组件创建与 properties

> 目标：`Component()` 构造器是自定义组件的心脏——它和 `Page()` 同宗同源（Page 本质是"注册到页面的特殊 Component"），但多了一套**对外接口**：properties（入参）、methods、behaviors。本课讲组件四件套的创建、usingComponents 登记、properties 的类型/观察者初探、以及 styleIsolation 在组件实战中的落点（呼应 **vue-component-basics**、**react-component**、**mp-wxml**、**mp-wxss** 第四节）。

---

## 一、从"复制粘贴 WXML"到真组件

mp-wxml 里 template 只能复用结构；一旦要复用"**结构 + 样式 + 逻辑 + 状态**"，就升级到 `Component`。目录组织：

```text
components/
└── product-card/
    ├── product-card.js
    ├── product-card.json   ← 必须 "component": true
    ├── product-card.wxml
    └── product-card.wxss
```

```json
// product-card.json —— 没有 "component": true 就只是普通页面片段
{ "component": true, "usingComponents": {} }
```

### usingComponents：组件的"登记表"

WXML 里能出现什么标签，由**当前页/当前组件 json 的 usingComponents** 决定：

```json
// pages/home/home.json
{
  "usingComponents": {
    "product-card": "/components/product-card/product-card",
    "van-button": "@vant/weapp/button/index"
  }
}
```

- 登记后可在**本页** wxml 写 `<product-card />`；想让整个 app 都能用某组件，写在 **app.json 的 usingComponents**（全局组件，但所有页都会带上，权衡同全局样式，呼应 mp-wxss 第三节）；
- 标签名规则：小写+连字符；组件名不能与原生组件冲突；**未登记的自定义标签只会显示为空白**（又一个静默失败，WXML 传统艺能）；
- npm 组件（vant/weapp 等）需工具里"构建 npm"后才可用路径引用（呼应 mp-framework、10-vite 的依赖观）。

---

## 二、Component 构造器全解

```js
// components/product-card/product-card.js
Component({
  options: {
    styleIsolation: 'isolated',   // 默认值，可改（呼应 mp-wxss 第四节）
    addGlobalClass: false,        // true = 允许 app/页面全局类影响组件内部
  },

  properties: {                   // ← 对外"props"
    title: String,                          // 简写：仅类型
    price: {                                // 完整写：五件套
      type: Number,                          // 必填（Type 校验，见第三节）
      value: 0,                              // 默认值
      optionalTypes: [String],               // 补充可接受类型
      observer(newV, oldV, path) {           // 值变化回调（mp-component-lifecycle 专讲）
        this.setData({ yuan: (newV / 100).toFixed(2) });
      },
    },
    tags: { type: Array, value: [] },
  },

  data: {                          // ← 组件私有状态
    yuan: '0.00',
  },

  methods: {                       // ← 事件处理与对外 API 都在这
    onFav() { this.triggerEvent('fav', { id: this.properties.bid ?? '' }); },
    playAnimation() { /* 供父页 selectComponent 调用 */ },
  },

  // 组件级生命周期 created/attached/ready/detached 与页面事件 pageLifetimes
  // —— 下一关 mp-component-lifecycle 专讲
});
```

对照记忆：**properties ≈ props（只读！）、data ≈ 组件内 state、methods ≈ 事件处理集合**——Vue 的 props/data/methods 三分法几乎逐字平移；React 里 props/state 合一进函数体，概念相同形态不同（呼应 vue-component-basics、react-component）。

使用（页面侧）：

```wxml
<product-card title="{{ item.title }}" price="{{ item.price }}" bind:fav="onFav" />
```

---

## 三、properties 的三条铁律

1. **只读**：组件内 `this.properties.title = 'x'` 会告警且不生效——要改就拷进 `this.data`（内部镜像）或通知父级改（triggerEvent）。这与 React/Vue 的 props 单向流同一宪法（呼应 react-component props 只读）；
2. **type 是校验+转换，不是 TS 那种类型**：`type: Number` 时父传 `"199"` 字符串会被**自动转数字**；传类型不符 → 控制台告警 + 保留转换失败值。合法 Type：String/Number/Boolean/Object/Array/null(任意)；
3. **对象/数组属性：默认值是引用陷阱吗？** 是——`value: {}` 写在构造器里，组件实例间**共享同一对象定义**（构造器对象本身被所有实例共享，properties 的值倒是每实例拷贝），改 `this.properties.tags.push(...)` 等于偷改"全局模板"。**永远通过 setData 换新值**，这与 React 不可变更新同一戒律（呼应 react-usestate 不可变、node-config 深拷贝话题）。

**属性名转换**：properties 里写 `bgColor`，wxml 里用 `bg-color`（小驼峰 ↔ 连字符自动互转，与 Vue 的 prop 规则同款，呼应 vue-component-basics）。

---

## 四、组件也是"setData 独立王国"

- 组件的 setData **只更新组件自己的子树**——大列表拆组件后，更新范围显著变小（性能正收益，呼应 mp-setdata）；
- 但数据从页面进组件**多一跳**：父 `setData({list})` → 子 properties 更新 → 子内再加工 setData——链路上"别把加工逻辑写回父页面"，各管各的呈现（组件自治原则，呼应 vue 的"智能组件/哑组件"分层）；
- `this.selectComponent('.xxx')` 可查组件内子节点组件实例；`this.createSelectorQuery()` 查的是**组件内**节点（作用域自动限定，避免跨组件误伤，呼应 mp-performance 的查询姿势）。

---

## 五、组件的"样式插槽"再探：externalClasses

mp-wxss 埋过的问题：隔离下父页面想改组件内某节点的类怎么办？

```js
Component({
  externalClasses: ['ext-class'],   // 声明对外暴露的"类占位"
  properties: { /* ... */ },
});
```

```wxml
<!-- 组件内 -->
<view class="card ext-class">内容</view>
<!-- 页面里 -->
<product-card ext-class="promo-card" />
```

父级的 `.promo-card` 样式被"注入"到 `ext-class` 位置——这是官方给的**样式级受控接口**，vant-weapp 大量用它做外观定制。对照：React 传 className prop、Vue 传 class 自动落根节点——小程序要显式开口子（呼应 vue-class-style-transition）。

---

## 六、自检清单

- [ ] 组件 json 里 `"component": true` 和 usingComponents 各管什么？
- [ ] properties 完整定义有五要素，是哪五个？
- [ ] 组件内能直接改 properties 吗？想"改"的两条正路？
- [ ] type: Number 收到 "199" 会怎样？
- [ ] 组件 setData 与页面 setData 的更新范围差异？externalClasses 解决什么？

---

## 🚀 部署预告

- 组件第一课解决"是什么、放哪、怎么登记、props 宪法"；
- 下一关 **mp-component-comm**：数据流双向闭环——properties 下行、triggerEvent 上行、slot 内容分发、selectComponent 命令式后门（呼应 vue 组件通信全家桶、react-composition）。
