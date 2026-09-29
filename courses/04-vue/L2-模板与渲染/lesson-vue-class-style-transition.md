# class/style 绑定与过渡动画

> 目标：`class` 和 `style` 是最常用的动态属性，Vue 为它们提供了**专门的绑定语法**；界面"动"起来靠 `<Transition>` 与 `<TransitionGroup>`。本课掌握 **`:class` 对象/数组语法、`:style` 驼峰与自动前缀、绑定 CSS 变量**、多类合并，以及 **`<Transition>` 的 6 个过渡类与 enter/from/to 机制、`mode="in-out|out-in"`、JS 钩子、`<TransitionGroup>` 列表动画与 FLIP**。（呼应 vue-conditional-list、vue-template-syntax、DOM/CSS）

---

## 一、`:class` 绑定：对象、数组、混合

```vue
<!-- 目的：:class 的三种写法——对象（值为布尔）/数组（并列）/混合 -->
<!-- 对象语法：值是布尔表达式 -->
<div :class="{ active: isActive, disabled: isDisabled }"></div>   <!-- isActive 真→加 active 类 -->

<!-- 数组语法：并列多个（含三元/变量） -->
<div :class="[baseClass, isActive ? 'active' : '', errorCls]"></div>   <!-- 数组里的 ''/null/undefined 会被忽略 -->

<!-- 对象 + 数组混合 -->
<div :class="[cls1, { active: isActive, 'text-danger': hasError }]"></div>

<!-- 整个对象抽出去，可读性更好 -->
<div :class="classObj"></div>
```
```js
// 目的：把 class 逻辑下沉到 computed，模板只读一个结果
const classObj = computed(() => ({ active: props.active, large: size.value > 20 })); // ✅ 依赖变化自动重算类集合（呼应 vue-reactivity 第四节）
```

**合并规则**：组件根元素上，**外部传入的 class 会与组件自身 class 自动合并**（fallthrough，见 L3 vue-component-basics），数组里的 `false`/`null`/`undefined`/`''` 会被忽略。

---

## 二、`:style` 绑定

```vue
<!-- 目的：:style 用驼峰键、数组并列、自动厂商前缀，还能驱动 CSS 变量 -->
<div :style="{ color: color, fontSize: size + 'px' }"></div>   <!-- 驼峰键 fontSize（也可写 'font-size'） -->
<div :style="[{ display: 'flex' }, styleObj]"></div>           <!-- 数组：多个样式对象合并 -->
<div :style="{ transform: 'rotate(45deg)' }"></div>            <!-- 无需写 -webkit-，Vue 自动补前缀 -->
<!-- ❌ :style="{ color: null }" → 该声明被跳过（不输出 color）；要给值才能生效 -->
```
绑定 CSS 变量（主题切换实用）：
```vue
<div :style="{ '--main-color': themeColor, color: 'var(--main-color)' }"></div>
<!-- ✅ 应用：改 themeColor 就实时驱动 --main-color，进而改变所有引用它的 color -->
```
这让 JS 状态能直接驱动 CSS 变量，主题切换尤其实用。

---

## 三、`<Transition>`：单元素进出场

包一个**单元素/组件**，在其**插入/删除（v-if/v-show/动态组件切换）**时自动加过渡类：

```vue
<!-- 目的：<Transition> 在单元素 v-if/v-show 切换时自动加六个过渡类 -->
<Transition name="fade">
  <p v-if="show">hello</p>          <!-- name="fade" → 生成 .fade-enter-from 等类 -->
</Transition>
<!-- ❌ <Transition> 里放多个直接子节点会告警：它只能观测单节点的进出场 -->
```
```css
/* 目的：六个过渡类——enter-from→enter-active→enter-to，leave 同理 */
.fade-enter-from, .fade-leave-to { opacity: 0; }          /* 起始/终止态：全透明 */
.fade-enter-to,   .fade-leave-from { opacity: 1; }        /* 终态/起始态：不透明 */
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }  /* 贯穿动画期：0.3s 淡入淡出 */
```

**六个类**：`enter-from → enter-active → enter-to`，`leave-from → leave-active → leave-to`。`enter-from`/`leave-to` 是起止态，`*-active` 贯穿动画期，`*-to` 是终态。动画结束 Vue 自动清理这些类。

- **`mode`**：切换两个元素时默认同时进出会重叠；`mode="out-in"`（先离场再进场）最常用，`in-out` 反之；
- **`appear`**：组件初始挂载时也播放进场动画；
- **自定义类名**：`:enter-active-class`、`type="transition|animation"`、`:duration`；也常配 **Animate.css** 等第三方：
```vue
<Transition enter-active-class="animate__fadeIn" leave-active-class="animate__fadeOut">…</Transition>
```

---

## 四、JS 钩子（做无法用 CSS 表达的动画）

```vue
<!-- 目的：JS 钩子做 CSS 无法表达的动画，必须调 done 通知 Vue 动画结束时机 -->
<Transition
  @before-enter="onBeforeEnter"
  @enter="(el, done) => { gsap.to(el, {...onComplete: done}) }"   /* 用 done 通知完成，否则 Vue 不知何时结束 */
  @leave="(el, done) => { gsap.to(el, {...onComplete: done}) }"
  enter-active-class=""
>…</Transition>
<!-- ❌ 忘记调 done：Vue 会一直等，过渡不结束（或靠 transitionend 误判提前结束） -->
```
需要"控制结束时机"的 JS 动画，钩子里调用 `done()`（或用 `@enter-cancelled` 等）。这解决了 CSS 过渡"Vue 靠 transitionend/animationend 猜结束"不可靠的情况（呼应 vue-testing、动画库集成）。

---

## 五、`<TransitionGroup>`：列表进出场与 FLIP

```vue
<!-- 目的：给 v-for 列表的增删/移动加动画；每个子项必须有唯一 key -->
<TransitionGroup name="list" tag="ul">
  <li v-for="item in items" :key="item.id">{{ item.text }}</li>   /* :key 是 FLIP 能准确跟踪换位的前提 */
</TransitionGroup>
```

- 给 v-for 列表**增删/移动**加动画；**每个子项必须有唯一 `key`**（呼应 vue-conditional-list 第五节，正是列表动画不跳项的前提）；
- 类名同 `<Transition>`（`list-enter-from` 等），另有 **`*-move`** 类处理"位置变化"；
- **FLIP**（First-Last-Invert-Play）：`<TransitionGroup>` 默认开启 `move-class`，自动测量移动前后位置并用 transform 反向动画补间，实现"平滑换位"，无需手写 FLIP（呼应 vue-performance 大列表）。

---

## 六、`<Transition>` + 动态组件 / 路由

```vue
<!-- 目的：动态组件/路由切换的淡入淡出，mode="out-in" 避免新旧重叠 -->
<Transition name="fade" mode="out-in">
  <component :is="CurrentComp" />          <!-- 切换 CurrentComp 时先出场后进场 -->
</Transition>

<RouterView v-slot="{ Component }">
  <Transition name="page" mode="out-in"><component :is="Component" /></Transition>  /* 路由级页面过渡 */
</RouterView>
```
这是"页面切换淡入淡出"的标准做法（呼应 vue-router L5）。注意 `<Transition>` 只包**单个直接子节点**，多根会告警。

---

## 七、自检清单

- [ ] `:class` 的对象/数组/混合三种写法分别在什么时候用？
- [ ] `:style` 里怎么写才能驱动 CSS 变量？厂商前缀要自己写吗？
- [ ] `<Transition>` 的六个类是什么？`mode` 解决什么问题？
- [ ] JS 动画钩子里为什么要调 `done`？
- [ ] `<TransitionGroup>` 为什么强制 key？`*-move` 与 FLIP 是什么？

---

## 🚀 部署预告

- 动画"进出场"依赖 `v-if`/`v-show`/动态组件的插入删除时机——把 **L2 条件渲染**与 DOM 生命周期连了起来，下一阶段的 **vue-lifecycle（L3）** 会讲挂载/卸载钩子如何与过渡协作；
- `<TransitionGroup>` 的 key 与 FLIP，正是 **vue-conditional-list** "别用 index 当 key"在动画上的直接后果；
- 大量 `<Transition>`/`v-show` 与 `:style` 频繁改动会触发重排重绘，节流与 `will-change` 属 **vue-performance（L7）**；路由级过渡在 **vue-router（L5）** 落地。

L2 到此完成，进入 **L3 组件基础**——从"一个组件内部"走向"组件之间"：props、emits、slot 与 v-model 组件。
