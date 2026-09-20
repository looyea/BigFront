# 组件通信与 slot

> 目标：组件边界确立后，剩下的全是怎么"合规地穿墙"。本课四条通道：**下行 properties、上行 triggerEvent、内容分发 slot、后门 selectComponent/组件实例**，外加属性 observer 作为"下行数据落地处理"的配套。每条都对照 Vue（props/emit/slot）与 React（props 回调/children/forwardRef）做第四次翻译（呼应 **mp-component**、**vue-composables/Composition**、**react-composition**、**react-refs**）。

---

## 一、下行：properties（复习即开战）

```wxml
<!-- 页面 -->
<search-box value="{{ kw }}" placeholder="搜商品" bind:confirm="onSearch" />
```

下行只有两条注意事项：

1. **父每次传新对象引用，子 observer 必触发**——`value="{{ list.filter(...) }}"` 这种模板里造新数据的写法，会让子组件白重渲染一轮（React 的 memo 失效同款问题，呼应 react-memo-hooks）；
2. "受控 vs 非受控"在小程序同样存在：父用 `value` 属性+子 `bindinput` 回传 = 受控；子内部自持状态、只在 confirm 时上报 = 非受控。**input 类组件务必二选一并写进文档**——混用就是"输入被父级神秘回滚"的经典 bug（呼应 react-forms 受控/非受控之争）。

---

## 二、上行：triggerEvent 家族

```js
// 子组件内
this.triggerEvent('myblur', { value: this.data.val }, { bubbles: true, composed: true });
```

```wxml
<!-- 父：bind/catch/capture-bind/capture-catch 四前缀同样适用自定义事件 -->
<search-box bind:myblur="onBlur" catch:submit="onSubmit" />
```

```js
// 父 handler 的事件对象
onBlur(e) {
  e.type;        // 'myblur'
  e.detail;      // 子传来的 { value }   ← 数据在这
  e.target;      // 触发组件
  e.timeStamp;
}
```

要点：

- **三个参数**：事件名、detail（自定义载荷，可序列化）、options（`bubbles`/`composed` 控制能否冒泡穿透组件边界）——默认不穿透，这就是 mp-events 第六节"页面收不到组件内部点击"的机制本尊；
- 事件名规范：小写连字符（`bind:price-change`），别用原生同名（tap/change）以免语义混乱；
- 对照：**`triggerEvent('xx', detail)` ≈ Vue `$emit('xx', payload)` ≈ React `props.onXxx(payload)`**——三者表达同一件事："我不猜父级想干嘛，我喊一声"（呼应 vue `$emit` 的直觉训练，组件才能复用）。

### 何时不需要 triggerEvent？

子只是"转发原生事件"时，vant 的做法是**不拦截**、让原生组件的事件经 `composed` 冒泡出边界——父直接 `bind:change`。原则：**语义化新事件用 triggerEvent，透传原生行为用 composed 冒泡**，别把每条 change 都手写一遍转发（管道代码税）。

---

## 三、内容分发：slot

```wxml
<!-- 组件 card.wxml -->
<view class="card">
  <view class="card__hd">{{ title }}</view>
  <slot />                          <!-- 默认插槽 -->
  <view class="card__ft"><slot name="footer" /></view>   <!-- 注意：slot 不支持 fallback 默认内容 -->
</view>

<!-- 页面使用 -->
<card title="会员">
  <view>正文塞这里</view>
  <button slot="footer">续费</button>   <!-- 插槽内容用 slot="名字" 指定坑位 -->
</card>
```

- slot 的编译本质：内容在**父作用域**编译（数据源是父的 data），只"挂"到子组件的坑位上——所以**子组件模板里不能直接用 slot 内容引用子的数据**，想传数据给子内容用"作用域插槽"？小程序原生**没有** `slot-scope`（Vue）/render props（React）等价物；变通：把内容也做成组件、用 properties 喂数据（这是小程序组件化与 Vue/React 的显著能力差，面试可展开，呼应 vue-composables、react-composition 的 children 模式）；
- 插槽内容的样式：内容属父，样式默认按父的隔离域处理，子的 `.card__body p` 选不到插槽里的 p——跨边界样式还得 externalClasses（呼应 mp-component 第五节）。

---

## 四、命令式后门：selectComponent 与组件实例方法

```js
// 父页/父组件
const child = this.selectComponent('#swiper-card');   // id 或 class 选择器
child.playNext();                                     // 直接调子 methods
child.setData({ paused: true });                      // 甚至改它内部（能做，但羞耻）
```

- 适用：命令式 imperative API（播放器 play/pause、弹窗 open/close、表单 validate）——声明式属性表达"状态"，命令式方法表达"动作"，两者分工与 React `useImperativeHandle`/`ref.current.xxx()` 完全同构（呼应 react-refs）；
- 红线：跨层 `child.child.child.setData` 是耦合核弹；组件应暴露**方法 API**而不是让你翻它 data；
- 组件内查子子：`this.selectComponent` 只查自己子树自定义组件；查跨边界需 `composed` 事件或重新设计（呼应 mp-component 面试第 10 题的引用清理）。

---

## 五、选型速查表

| 需求 | 首选 | 次选 |
|---|---|---|
| 父给子数据/配置 | properties | （全局态时 store）|
| 子通知父"用户干了什么" | triggerEvent | 父传回调？没有这机制 |
| 父定制子的内容区 | slot 默认/具名 | 多 properties 拼内容（丑）|
| 父命令子做动作 | selectComponent + 方法 | properties 驱动（open:true 式）|
| 兄弟组件互传 | 共同父级中转 | bus/store（跨页面才值）|

**默认永远向下流动、事件永远向上冒（你主动穿）、内容一次分发、命令最后手段**——和 React/Vue 社区宪法逐字一致（呼应 react-state-mgmt 的"最近共同父级"原则）。

---

## 六、自检清单

- [ ] triggerEvent 三个参数各管什么？不传第三个参数时事件能冒出组件吗？
- [ ] slot 内容能用子组件的 data 吗？为什么？小程序有作用域插槽吗？
- [ ] 受控/非受控 input 组件在小程序分别怎么写？
- [ ] selectComponent 拿实例调方法，什么场景正当、什么场景是耦合？
- [ ] "透传原生事件"靠什么机制省掉手写转发？

---

## 🚀 部署预告

- 通信四通道 + 一张选型表，组件协作的心智模型齐了；
- 下一关 **mp-component-lifecycle**：created/attached/ready/detached 四钩子、pageLifetimes、observer 全解与 **behavior 复用**——组件版的"生命周期与混入"故事（呼应 mp-lifecycle、vue-lifecycle、react-custom-hooks）。
