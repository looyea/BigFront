# L3 课后作业：组件基础

> 覆盖 **vue-component-basics / vue-lifecycle / vue-refs-expose** 三关。先读代码找 bug，再动手写，最后场景与简答。环境：Vue 3 + `<script setup>`。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段子组件有什么问题？会发生什么？
```vue
<script setup>
const props = defineProps(['list']);
props.list.push('x');       // 想给父的列表加一项
</script>
```
>（呼应 vue-component-basics 第二节）

**2.** 这个 prop 默认值写法有何隐患？
```js
defineProps({ tags: { type: Array, default: [] } });
```
> 怎么改？（呼应 vue-component-basics 第二节、interview 第 2 题）

**3.** 父模板里 `<UserCard user-name="k" />`，子组件应声明的 prop 名是什么？为什么不是 `user-name`？

**4.** 这段 `<MyInput v-model="text" />` 想让子组件里的输入实时同步到 `text`，子组件缺了什么？（分别给"defineModel 版"和"props+emit 版"）（呼应 vue-component-basics 第五节）

**5.** 这个组件卸载后可能留下什么问题？
```js
onMounted(() => {
  setInterval(() => tick(), 1000);
});
```
> 怎么修？如果组件外面套了 KeepAlive，又该改放哪个钩子？（呼应 vue-lifecycle 第二、六节）

**6.** 为什么下面 `chart` 初始化多半会失败？应放到哪个钩子？
```js
const canvas = ref(null);
const chart = echarts.init(canvas.value);   // 在 setup 顶层
```
>（呼应 vue-lifecycle 第二节、vue-refs-expose 第一节）

**7.** `<KeepAlive>` 包住的路由页，切走再切回，`onMounted` 里的取数没有重新执行，为什么？该用什么钩子？（呼应 vue-lifecycle 第五、九节）

**8.** 这段拿子组件方法的代码有什么问题？
```js
const child = ref(null);
child.value.submit();     // 在 setup 里直接调
```
>（两个问题：时机 + 子是否开放，呼应 vue-refs-expose 第四、六节）

**9.** 子组件用了 `<script setup>`，父 `child.value.reset` 是 undefined，最可能漏了什么？（呼应 vue-refs-expose 第四节）

**10.** 这段用 ref 直接改样式，违背了什么原则？给声明式替代：
```js
onMounted(() => { box.value.style.background = 'red'; });
```
>（呼应 vue-refs-expose 第五节、vue-class-style-transition）

---

## 二、手写编程题（5 题）

**11.** 写一个 `<Rating>` 组件：`props: value / max=5`，点星星 `emit('update:value', n)` 并用 `defineModel` 支持父 `v-model`。（呼应 vue-component-basics 第五节）

**12.** 写一个 `<Card>` 组件，含**默认插槽**（正文）、**具名插槽 `#footer`**、以及一个**作用域插槽**：`<slot :score="内部计算" />`，父用 `#default="{ score }"` 自定义渲染。（呼应 vue-component-basics 第四节）

**13.** 写一个 `<AutoFocusInput>`：`onMounted` 里用 `useTemplateRef` 拿到 input 并 `focus()`；暴露一个 `clear()` 方法（`defineExpose`），父通过组件 ref 调用清空。（呼应 vue-refs-expose 第二、四节）

**14.** 用 `<KeepAlive :include>` 缓存两个标签页组件，其中一个每次 `activated` 时刷新时间戳、`deactivated` 时停掉一个 `console` 轮询。验证钩子触发顺序。（呼应 vue-lifecycle 第五、六节）

**15.** 写一个"命令式弹窗" `<Modal>`：父通过 `modalRef.value.open()/close()` 控制，内部用 `onMounted` 初始化、`defineExpose({open,close})` 开放，关闭时（`onBeforeUnmount`/关闭逻辑）清掉加在 `document.body` 上的 class。（呼应 vue-refs-expose 第四节、vue-lifecycle 第二节）

---

## 三、场景题（1 题）

**16.** 你在封装一个 `<DataTable>` 组件库组件：数据由父传入、支持排序、分页、行选择、自定义单元格渲染、以及外部"刷新/导出"命令。请回答：
- (a) `rows`/`columns` 用 props 传；那"排序后当前页数据"放哪、由谁维护？（props 单向流 + 内部 state，呼应 vue-component-basics 第二节、vue-state-patterns）
- (b) "自定义单元格"用什么机制最灵活？（作用域插槽，呼应 vue-component-basics 第四节）
- (c) "导出/刷新"父怎么触发？`emit` 还是 `defineExpose` 方法？分别适合什么？（呼应 vue-refs-expose interview 第 7 题）
- (d) 组件内挂了 `resize` 监听、有轮询，卸载/被 KeepAlive 缓存时分别要在哪些钩子清理？（呼应 vue-lifecycle 第二、六节）
- (e) 行内编辑单元格的 input 需要聚焦，你会用 ref 还是别的？（呼应 vue-refs-expose 第五节）

---

## 四、简答题（3 题）

**17.** 说清组件"数据向下(props)、事件向上(emits)"的单向流，`v-model` 为何只是它的语法糖。（呼应 vue-component-basics 第二、三、五节）

**18.** 列出组合式生命周期钩子并标出"DOM 何时可用""自动清理发生在哪一步"。SSR 少跑哪些？（呼应 vue-lifecycle 第一、二节）

**19.** 什么场景该用模板 ref、什么场景应改回数据驱动？各举两例。（呼应 vue-refs-expose 第五节）

---

## 五、挑战题 🏆

**20.** 🏆 做一个"受控 + 非受控双模"的 `<Tabs>`：
- 传 `v-model`（`defineModel`）时是**受控**（父掌握当前 tab）；不传时组件**内部自持**状态（非受控），并能被父通过 `defineExpose({ select })` 命令式切换（呼应 vue-component-basics 第五节、vue-refs-expose 第四节）；
- tab 面板用 `<KeepAlive>` 缓存、用 `<Transition mode="out-in">` 做切换动画（呼应 vue-lifecycle 第五节、vue-class-style-transition）；
- 面板内容用**具名插槽** `#panel-{name}`，找不到时回退默认插槽（呼应 vue-component-basics 第四节、`useSlots`）；
- 加 `onErrorCaptured` 兜底某个面板渲染错误并展示 fallback 文案（呼应 vue-lifecycle 第四节）。
