# 组件生命周期与 behavior

> 目标：组件不跟页面走 onLoad/onShow——它有自己的一套 `created/attached/ready/detached`，外加"旁观页面"的 `pageLifetimes` 和数据侧的 `observer`。再把"多组件共享的逻辑块"交给 **behavior**。本课把这三层时机与复用机制钉牢（呼应 **mp-lifecycle**、**vue-lifecycle**、**react-custom-hooks** 的"逻辑复用"主题）。

---

## 一、组件四钩子：一棵树的生老病死

```js
Component({
  created()  { /* 实例刚创建：还不能用 setData、不能碰节点 */ },
  attached() { /* 进入页面节点树：可 setData；仍无布局 */ },
  ready()    { /* 首次渲染完成：可安全查节点/播放器可 init */ },
  detached() { /* 移出节点树：清定时器、解绑 bus、释放实例引用 */ },
})
```

与页面生命周期对齐记忆：

| 阶段 | 页面 | 组件 |
|---|---|---|
| 创建 | onLoad | created + attached |
| 可见 | onShow | （组件无"可见"概念，随页面）|
| 首绘 | onReady | ready |
| 销毁 | onUnload | detached |

三条时机铁律：

1. **created 里 setData 无效**（视图还不存在），初始化数据改 `data` 默认值或放 attached；
2. **attached 不等于"能查布局"**——宽高/位置要等 ready（页面等 onReady 的同款逻辑，呼应 mp-lifecycle 面试第 4 题）；
3. **detached 是唯一的清理点**：定时器、bus 订阅（mp-communication 的解绑纪律在组件端落地）、IntersectionObserver 的 disconnect、selectComponent 缓存——组件可被 `wx:if` 反复销毁重建，漏清就是"回调打给幽灵实例"（呼应 mp-component-comm 面试第 9 题）。

### 组件被 wx:if 反复创建/销毁时
每次 true→false→true 都会走完 attached→ready→detached 全周期，**内部 data 也会重置**——想保状态要么父级用 hidden（呼应 mp-render）、要么把状态提升到父/ store（呼应 react-state-mgmt 的"状态提升"）。

---

## 二、pageLifetimes：组件旁观页面事件

```js
Component({
  pageLifetimes: {
    show()  { /* 所在页面 onShow 时 */ },
    hide()  { /* 页面 onHide */ },
    resize() { /* 页面尺寸变化（横竖屏/键盘致窗口变化） */ },
  },
})
```

场景：地图组件在页面 hide 时暂停定位、resize 时重算画布。组件"寄生"于页面，页面钩子经此转发——**组件没有 onShow/onLoad，别把页面钩子写进 Component 顶层**（写了静默无效，新一代工具会提示）。

---

## 三、observer 全解：数据层的"生命周期"

```js
Component({
  properties: {
    price: {
      type: Number,
      observer(newVal, oldVal, changedPath) {
        this.setData({ yuan: (newVal / 100).toFixed(2) });
      },
    },
  },
  data: { userInfo: { name: '', vip: false } },
  observers: {
    // ① 多字段联合（逗号）；② 路径观察；③ 通配
    'data1, data2': function (d1, d2) { /* 都到位再拼展示文案 */ },
    'userInfo.**': function (path, value) { /* 对象任意层变化 */ },
  },
})
```

五条军规：

1. **observer 里不要再 setData 被观察的同一字段** → 无限循环（工具会报 setData 循环告警）；派生值写**另一个** data 字段（同 Vue computed 与 watch 的分界，呼应 vue-reactivity）；
2. properties 的 observer 在**组件实例的整个生命周期**里跟随值变化；同值不触发、新对象引用必触发（呼应 mp-component-comm 第一节引用坑）；
3. `observers` 块与 properties 内 observer **并存时 observers 优先**？——官方建议统一用一处，别混；
4. 派生计算**先想"能不能不观察"**：能在 setData 前算好就别 observer，能在渲染层 wxs 就别 setData（呼应 mp-wxml 第五节）；
5. observer 是"组件版 watch"，React 迁移者注意：**它不是 useEffect**——没有"渲染后执行"语义，数据一变立刻跑，别在里面做 DOM/布局操作（那是 ready 或 setData 回调的事，呼应 react-useeffect 执行时机）。

---

## 四、behavior：小程序的"混入/组合函数"

```js
// behaviors/countdown.js —— 倒计时逻辑打包
export const countdown = Behavior({
  properties: {
    endTime: Number,
  },
  data: { timeText: '00:00' },
  attached() { this._startCountdown(); },     // 钩子可合并：behavior 与组件同名钩子都会跑
  detached() { clearInterval(this._timer); },
  methods: {
    _startCountdown() {
      this._timer = setInterval(() => {
        const left = Math.max(0, this.properties.endTime - Date.now());
        this.setData({ timeText: fmt(left) });
        if (left === 0) { clearInterval(this._timer); this.triggerEvent('finish'); }
      }, 1000);
    },
  },
});

// 组件里使用
import { countdown } from '../../behaviors/countdown';
Component({
  behaviors: [countdown, anotherBehavior],   // 数组：靠后者覆盖前者同名成员
  methods: { /* ... */ },
});
```

behavior 能带：properties、data、methods、生命周期、页面事件声明、甚至嵌套其他 behavior。合并规则：**数据/属性按"组件 > 后 > 前"浅合并覆盖，生命周期不覆盖而是**都执行（behavior 先于组件，≈Vue mixin 的钩子合并）。

对照复用谱系：Vue mixin（选项合并）→ behavior（几乎同款的选项合并）→ Vue3 composables / React custom hooks（函数组合，无命名冲突焦虑）。behavior 的历史包袱与 mixin 一样：**来源不透明、命名易撞、依赖黑盒**——新代码里"逻辑复用"优先考虑抽纯函数 utils（js 模块直接 require，比 behavior 更透明），behavior 留给"需要挂生命周期/properties 的成套能力"（呼应 react-custom-hooks 的"组合优于混入"、mp-interaction 的 utils 封装）。

---

## 五、自检清单

- [ ] 组件四钩子与页面五钩子的对应表？
- [ ] created 里为什么不能 setData？attached 里为什么查不了布局？
- [ ] 组件被 wx:if 销毁重建时，内部状态会怎样？两条保全方案？
- [ ] observer 里 setData 同字段的后果？派生值的正确姿势？
- [ ] behavior 与直接抽 js 函数，何时选谁？

---

## 🚀 部署预告

- L5 收官：组件 = 构造器 + 通信 + 生命周期/复用，三课闭环，你已经能读懂 vant-weapp 的源码结构；
- 下一站 **L6 网络与开放能力**：先 **mp-network**——wx.request 的域名白名单铁律、Promise 封装与拦截器，把 09-express 的接口终于接到"小程序端"这一侧（呼应 exp-rest、react-data-fetching）。
