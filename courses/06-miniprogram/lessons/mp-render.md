# 列表与条件渲染

> 目标：把 data 里的数组/布尔变成节点树，靠的是 `wx:for`、`wx:if` 家族和 `hidden`。本课重点不在"会不会写"，而在**三组性能与正确性决策**：wx:if vs hidden 选谁、wx:for 的 key 怎么给、以及"改一条数据为什么要 setData 整个数组"。全部呼应 **vue-conditional-list** 与 **react-lists-keys**——同一面试题，三种框架答案。

---

## 一、wx:if 家族

```wxml
<view wx:if="{{ score >= 90 }}">优秀</view>
<view wx:elif="{{ score >= 60 }}">及格</view>
<view wx:else>加油</view>

<!-- 一组节点：block 当括号（呼应 mp-wxml 第四节） -->
<block wx:if="{{ logged }}">
  <view>{{ name }}</view>
  <image src="{{ avatar }}" />
</block>
```

机制：`wx:if` 为假时**节点压根不创建**，切换时经历"销毁/重建 + 渲染层 diff"；期间数据变了但条件没变，则**什么都不发生**（惰性）。

### wx:if vs hidden

| | wx:if | hidden |
|---|---|---|
| 假时节点 | 不存在 | 存在，`display:none` |
| 切换成本 | 建/毁子树 | 只改样式 |
| 适用 | 分支少变、初值假可省首屏 | 频繁切换（tab 内容、弹窗） |

与 Vue 的 `v-if` vs `v-show` 逐字同构（呼应 vue-conditional-list）。口诀：**频繁切换用 hidden，昂贵子树用 if**。

---

## 二、wx:for：循环的四个关键字

```wxml
<!-- items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] -->
<view wx:for="{{ items }}" wx:key="id">
  {{ index }} - {{ item.name }}
</view>

<!-- 重命名 item/index；嵌套循环必须改名，否则内层遮蔽外层 -->
<view wx:for="{{ groups }}" wx:for-item="g" wx:key="gid">
  <text wx:for="{{ g.members }}" wx:for-item="m" wx:for-index="mi" wx:key="mid">
    {{ g.title }}-{{ m.name }}
  </text>
</view>

<!-- 只渲染数组一段 -->
<view wx:for="{{ list }}" wx:for-index="i" wx:for-item="x" hidden="{{ i < 20 }}">{{ x.t }}</view>
<!-- 惯用替代：逻辑层 slice 后再 setData，或虚拟列表（呼应 mp-performance） -->
```

要点：

1. 默认变量名 `item`/`index`，用 `wx:for-item`/`wx:for-index` 重命名；**嵌套忘改名 = 内层覆盖外层**，列表"串数据"的经典成因；
2. `wx:for` 也可遍历**对象**（此时 index 键名、item 值）；
3. `{{...}}` 别漏：`wx:for="items"`（字符串）不会报错但也不渲染——静默失败是 WXML 的常态（呼应 mp-wxml 的 bindtap 同款坑）。

---

## 三、wx:key：请给稳定的身份证

`wx:key` 的值有三种合法形态：

```wxml
<view wx:for="{{ list }}" wx:key="id">      <!-- item 里的属性名（字符串字面量，不加{{}}）-->
<view wx:for="{{ list }}" wx:key="*this">   <!-- item 本身是原始值且唯一 -->
<view wx:for="{{ list }}" wx:key="index">   <!-- ← 能跑，但是错的，见下 -->
```

**为什么不能用 index 当 key？**（微信/React/Vue 三家同一答案，呼应 react-lists-keys 第 4 节）

列表"头部插入/删除/排序"时，index-key 让 diff 认为"第 0 项变了、第 1 项变了……"→ **全列表重渲染**；更糟的是**有状态的节点会错位**：input 已输入的文本、复选框勾选态跟着位置"漂"到别的行。稳定 id 则让 diff 只认"谁移动了"，节点直接复用。

- 无自然 id：setData 前映射出一个（`list.map((x,i)=>({...x,_k:x.uid ?? i}))`）；
- 完全不写 wx:key：只警告不报错，diff 退化为 index 行为——**控制台那条 warning 就是性能事故的起点**；
- key 重复：渲染错乱 + 警告，`wx:key="id"` 的前提是 id 真的唯一。

---

## 四、渲染层视角：wx:for 与 setData 的关系

回忆双线程（mp-overview）：`wx:for` **不循环 js**——它把"数组→节点模板"下发给渲染层，由渲染层按数据展开。因此：

- 列表增删改的代价 ≈ **setData 传输的字节数 + 渲染层 diff 的节点数**（下一课 mp-setdata 展开）；
- "改第 3 项标题"正确姿势是**路径更新**只传差异：`this.setData({ 'list[2].title': t })`，而不是整个 list 重发（呼应 react 不可变更新的"只换变化的引用"，react-usestate）；
- 长列表别指望 wx:for 天生快：万级数据要 `recycle-view`/虚拟列表，思路同 React 窗体库（呼应 react-performance）。

---

## 五、条件 + 循环混用时

`wx:if` 与 `wx:for` 同标签时，**wx:for 优先级更高**——先展开全列表再逐条判条件，浪费。正确做法：过滤后 setData（数据层过滤），或外层 `<block wx:if>` 圈住整个 `wx:for`。这与 Vue 2 "`v-for` 优先于 `v-if`、别同级混用"的告诫一字不差（呼应 vue-conditional-list）。

---

## 六、自检清单

- [ ] wx:if 和 hidden 分别适合什么场景？
- [ ] wx:key 的三种合法写法？为什么 index 是错的？
- [ ] 嵌套循环两个都叫 item 会发生什么？
- [ ] 改列表一项，最小代价的 setData 怎么写？
- [ ] wx:if + wx:for 同标签为什么浪费？两种改法？

---

## 🚀 部署预告

- L2 收官：视图三课（模板语法/样式/渲染）闭环，你现在能解释"数据怎么变成屏幕上的像素"的完整链路；
- 下一关进入 **L3**：先看 **mp-events** 事件系统——bind/catch 冒泡、dataset 传参，把"像素上的点击"送回逻辑层，完成交互闭环（呼应 vue-class-style 的事件修饰符与 react-forms）。
