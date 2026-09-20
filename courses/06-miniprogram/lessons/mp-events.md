# 事件系统与传参

> 目标：点击、输入、滚动……用户的手只能落在**渲染层**的节点上，事件要跨越 Native 才能到达逻辑层——这条"回程链路"正是 mp-overview 双线程的另一半。本课讲：`bind`/`catch` 与事件流、常用事件类型、**dataset 传参**（小程序的"事件委托"）、事件对象结构、以及组件边界对事件的截断。呼应 **vue-class-style-transition**（`@` 语法与修饰符）、**react-forms**（合成事件）。

---

## 一、事件怎么"跑"回逻辑层

```text
用户手指 → 渲染层节点(绑了 bindtap) → Native 事件系统转发
        → 逻辑层执行 handler(e) →（若 setData）→ 渲染层更新
```

- 绑定写在 WXML：`bindtap="onTap"`，值是**方法名字符串**（呼应 mp-wxml 第三节）；
- 事件对象 `e` 是**序列化后跨线程传来的普通对象**，不是浏览器的 Event——拿不到 `e.target.style` 这种东西；
- 每次事件往返都有通信成本，**高频事件（滚动/触摸）是性能重灾区**（呼应 mp-setdata）。

---

## 二、bind vs catch：冒泡的两道闸门

事件流分两站：**捕获（capture，从根往下）→ bubbling（冒泡，从目标往根）**。

```wxml
<view bindtap="onParentTap">
  <view bindtap="onChildTap">子</view>        <!-- 点子：onChildTap → onParentTap（冒泡） -->
  <view catchtap="onChildStop">子(拦截)</view> <!-- 点它：只跑自己，冒泡到此为止 -->
</view>
```

| | bind | catch | capture-bind | capture-catch |
|---|---|---|---|---|
| 阶段 | 冒泡 | 冒泡 | 捕获 | 捕获 |
| 行为 | 监听并**继续传递** | 监听并**阻止继续** | 捕获阶段监听 | 捕获阶段拦截 |

对标记忆：`bind`≈DOM `addEventListener`、`catch`≈`stopPropagation()`；Vue 的 `@tap.stop` 修饰符就是 catch 的语法糖（呼应 vue-class-style）。口诀：**bind 听而放行，catch 听而截断**。

---

## 三、常用事件类型速查

| 分类 | 事件 | 触发时机 | 备注 |
|---|---|---|---|
| 触摸 | `tap` | 点按 | 最常用 |
| 触摸 | `longpress` | 按住 >350ms 且移动 <10px | |
| 触摸 | `touchstart/move/end/cancel` | 触摸各阶段 | cancel：来电/手势打断 |
| 输入 | `input` | **每敲一键**触发，`e.detail.value` 是最新值 | 高频！ |
| 输入 | `confirm` | 键盘完成键 | 搜索框刚需 |
| 滚动 | `scroll` | ScrollView 滚动 | 高频，注意节流 |
| 组件 | `change` | 值改变（picker/switch/checkbox） | 语义随组件而定 |

**tap 与 touchend 别同时绑**——一次点击触发两个 handler，重复提交事故常客；`movable-view` 等组件还会拦截手势，遇到"绑了没反应"先查组件文档的手势冲突表。

---

## 四、dataset：小程序式"传参"与事件委托

WXML 里不能写 `bindtap="onEdit(item.id)"`（**不能传参、不能是表达式**），怎么知道"点的是哪一行"？——`data-*`：

```wxml
<view wx:for="{{ todos }}" wx:key="id">
  <view data-id="{{ item.id }}" data-role="editor" bindtap="onTap">
    {{ item.text }}
  </view>
</view>
```

```js
onTap(e) {
  const { id, role } = e.target.dataset;  // data-id → dataset.id
  // data-user-name → dataset.userName（连字符转小驼峰）
}
```

三个高频坑：

1. **`e.target` vs `e.currentTarget`**：点击落在子节点上时，`target` 是**最初触发的节点**、`currentTarget` 是**绑定该 handler 的节点**——dataset 挂在谁身上就取谁，混用必错（DOM 里同款问题，呼应 vue 事件对象）；
2. dataset 值是 WXML 表达式求值后的结果，**只支持可 JSON 序列化**的数据；
3. 命名 `data-` 前缀必需，`id`/`index` 也别省前缀写成裸属性。

**事件委托**：列表 100 行不必绑 100 个 handler——容器绑一次 `bindtap`，行上只放 `data-id`，处理函数里查。节点事件表更小、setData 更新时少绑解绑（呼应 mp-render 面试第 9 题）。

---

## 五、事件对象解剖

```js
onTap(e) {
  e.type            // 'tap'
  e.timeStamp
  e.target          // 触发源头节点：id/dataset/offsetLeft...
  e.currentTarget   // 绑定 handler 的节点
  e.detail          // 附加值：tap 的{x,y}坐标；input 的{value}；change 的{value,...}
  e.changedTouches  // 触摸信息
}
```

记忆主线：**"谁触发"看 target，"谁绑定"看 currentTarget，"携带什么数据"看 detail 和 dataset**。`e.stopPropagation()` 不存在——要拦冒泡请在模板里换 `catch`（声明式，这是与 DOM/Vue 命令式的最大差异）。

---

## 六、组件边界：普通事件出不去组件

自定义组件标签上写 `bindtap="xx"` **收不到组件内部的点击**——普通事件不跨越组件边界。要通信：组件内 `this.triggerEvent('myevent', detail)`，父页 `bind:myevent`（详见 mp-component-comm；呼应 vue `$emit`、react 回调 props）。同理 `catch` 也拦不住"组件外"对"组件内"的影响方向问题——边界即隔离。

---

## 七、自检清单

- [ ] bind 和 catch 在冒泡/捕获两阶段各四种写法，分别什么语义？
- [ ] 如何给事件处理函数"传"行 id？为什么不能在模板里写函数调用？
- [ ] target 与 currentTarget 的区别？dataset 命名规则？
- [ ] 为什么 input/scroll 事件要特别小心？
- [ ] 组件内部的点击，页面能直接 bind 到吗？正确做法？

---

## 🚀 部署预告

- 事件 = 回程链路：dataset 携带身份、detail 携带数据、catch 控制流、组件边界逼出 triggerEvent；
- 下一关 **mp-setdata**：去程链路的主角——一次 setData 到底干了什么、为什么它是小程序性能的第一瓶颈、路径更新与回调怎么用（呼应 mp-overview、react-render-model）。
