# L2 课后作业：模板与渲染

> 覆盖 **vue-template-syntax / vue-conditional-list / vue-class-style-transition** 三关。先读代码找 bug，再动手写，最后场景与简答。环境：Vue 3 + `<script setup>`。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段插值为什么报编译错误？
```vue
<p>{{ if (logged) '你好' else '请登录' }}</p>
```
> 改成合法写法（两种）。（呼应 vue-template-syntax 第一节）

**2.** 预测 `<input :disabled="0">` 与 `<a :href="null">` 渲染结果，并说明 `:title="''"` 会怎样。

**3.** 这段代码有什么安全隐患？给出最小修复。
```vue
<article v-html="commentFromUser"></article>
```
>（呼应 vue-template-syntax 第五节、interview 第 8 题）

**4.** `@[evt]="h"` 里 `evt = 'Click'`，实际会绑定成什么事件名？为什么？
>（呼应 vue-template-syntax 第三节动态参数）

**5.** 面板需要每几秒被用户展开/收起一次，用了 `v-if`。指出问题并改成更合适的指令。
>（呼应 vue-conditional-list 第一节）

**6.** 这段列表有什么问题？会导致什么现象？
```vue
<li v-for="(t, i) in todos" :key="i">
  <input v-model="t.text" />
</li>
```
> 当你从中间删一项时会发生什么？怎么修？（呼应 vue-conditional-list 第五节）

**7.** 这行为什么拿不到 `item`？
```vue
<li v-for="item in list" v-if="item.show" :key="item.id">
```
> Vue3 里的优先级是什么？正确写法？（呼应 vue-conditional-list 第六节）

**8.** 登录/注册用 v-if/v-else 切换两个 `<input>`，从登录切到注册后账号框里还是刚才输入的邮箱。为什么？怎么修？

**9.** 这段 `<Transition>` 进场动画不生效，最可能是 CSS 少了哪个类？
```css
.fade-enter-active { transition: opacity .3s; }
.fade-enter { opacity: 0; }
```
>（`v-enter` 在 Vue3 改名成什么了？呼应 vue-class-style-transition 第三节）

**10.** `<TransitionGroup>` 列表换位动画乱飞，检查发现子节点 `<li v-for="(x,i) in xs" :key="i">`。指出根因。（呼应 vue-class-style-transition 第五节、interview 第 9 题）

---

## 二、手写编程题（5 题）

**11.** 用 `:class` 的**对象 + 数组混合**语法实现一个按钮：基础类 `btn`、按 `type` prop 加 `btn-primary/btn-ghost`、按 `disabled` 加 `is-disabled`、外部传入的 `customCls` 也拼上。（呼应 vue-class-style-transition 第一节）

**12.** 用 `:style` 绑定一个 CSS 变量 `--progress`（0~100），配合 `linear-gradient` 做一个进度条，值来自一个 `shallowRef`（呼应 vue-class-style-transition 第二节、vue-reactivity-theory 第六节）。

**13.** 用 `<Transition name="slide" mode="out-in">` 实现"提示条列表里同时只显示一条、切换时旧的先滑走新的再滑入"，写全 6 个过渡类里至少 enter 三件套的 CSS。（呼应 vue-class-style-transition 第三、四节）

**14.** 有一个 `users`（含 `active` 字段）数组：用 `computed` 过滤出 `activeUsers`，再用 `<TransitionGroup>` 渲染，实现"移除某用户时该项淡出、其余平滑补位"。确保 key 正确。（呼应 vue-conditional-list 第六节 + vue-class-style-transition 第五节）

**15.** 用 `<Transition>` 的 JS 钩子（`@enter`/`@leave` + `done`）实现一个"数字滚动淡入"占位（可用 `requestAnimationFrame` 或简单 setTimeout），验证 Vue 能在 `done()` 后才移除元素。（呼应 vue-class-style-transition 第四节）

---

## 三、场景题（1 题）

**16.** 你在做一个"后台表格页"：顶部有搜索/筛选、中间一张 500 行的表、行可展开、支持批量选中、列可显隐、有加载/空/错误三态。请回答：
- (a) 行展开用 `v-if` 还是 `v-show`？列显隐呢？分别说明理由（呼应 vue-conditional-list 第一节）；
- (b) 表格行 `v-for` 的 key 用什么？为什么不能用行索引（呼应 vue-conditional-list 第五节）；
- (c) "被选中变色的行"用 `:class` 还是重新 filter 数组？为什么（呼应 vue-class-style-transition 第一节）；
- (d) 三态切换（loading/empty/data）你想加淡入淡出，怎么组织 `<Transition>`+`v-if`+`key`（呼应 vue-class-style-transition 第三、四节）；
- (e) 单元格里的富文本备注用 `v-html` 渲染，安全上必须做什么（呼应 vue-template-syntax 第五节）。

---

## 四、简答题（3 题）

**17.** 说清 `v-once` / `v-pre` / `v-cloak` 的区别与各自典型场景。（呼应 vue-template-syntax 第六节）

**18.** `<Transition>` 六个类分别在什么时刻被加上/移除？它怎么判断动画结束、什么时候需要显式 `:duration` 或 `done()`？（呼应 vue-class-style-transition 第三、四节）

**19.** 用一句话解释 FLIP，并说明为什么 `<TransitionGroup>` 能"零手写"实现列表补位动画（呼应 vue-class-style-transition 第五节、interview 第 8 题）。

---

## 五、挑战题 🏆

**20.** 🏆 手写一个 `<Collapse>` 单元素高度过渡组件：
- 进出场对 `height` 做 0 ↔ 内容高度的平滑过渡（`height: auto` 无法 transition，需 `scrollHeight` + JS 钩子）；
- 用 `<Transition>` 的 `@enter`/`@leave` 钩子动态读写 `el.style.height`，动画结束调 `done()`（呼应 vue-class-style-transition 第四节）；
- 暴露 `v-model` 控制展开（先按普通 ref 实现即可，L3 会正式讲组件 v-model）；
- 处理"动画途中再次点击"的取消（`@enter-cancelled`/`@leave-cancelled`）；
- 用 `prefers-reduced-motion` 媒体查询在无动画偏好下直接显隐（呼应可访问性、vue-performance 重排意识）。
