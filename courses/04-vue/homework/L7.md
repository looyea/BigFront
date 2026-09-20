# L7 课后作业 —— 编译器宏、性能与测试

> 覆盖本阶段三关：vue-sfc-compiler-macros、vue-performance、vue-testing。先找 bug（练眼），再手写（练手），最后场景与简答（练表达）。

---

## 一、读代码找 Bug（10 小题）

指出每段的问题并一句话说清为什么。

1. ```vue
   <script setup>
   if (isAdmin) { const props = defineProps({ id: Number }); }
   </script>
   ```
2. ```vue
   <script setup lang="ts">
   const props = defineProps<{ tags: string[] }>();
   // 期望默认空数组
   </script>
   ```
   父不传 `tags` 时报错，应怎么补？
3. ```vue
   <script setup>
   import Child from './Child.vue';
   const emit = defineEmits(['change']);
   emit('change');   // 写在 setup 顶层、非回调里立即触发
   </script>
   ```
   这段本身语法没错，但有个常见误用点是什么？
4. ```vue
   <style scoped>
   .child-inner { color: red; }   /* 想改子组件内部节点 */
   </style>
   ```
5. ```vue
   <script setup>
   const { msg } = defineProps({ msg: String });   // Vue 3.4 环境
   setTimeout(() => console.log(msg));             // 3.4 下 msg 的响应性？
   </script>
   ```
6. ```vue
   <template>
     <li v-for="(item, i) in list" :key="i">{{ item.name }}</li>
   </template>
   <script setup>
   const list = reactive(bigNestedArray /* 2 万条深层对象 */);
   </script>
   ```
   渲染明显卡顿，两个优化点？
7. ```vue
   <script setup>
   const data = shallowRef([]);
   onMounted(async () => { data.value = await api.list(); });
   onMounted(() => { data.value.push({ id: 1 }); });   // push 后视图更新吗？
   </script>
   ```
8. ```js
   // 测试
   const w = mount(MyComp);
   w.find('button').trigger('click');
   expect(w.text()).toContain('已提交');   // 偶发失败
   ```
   最可能原因与修法？
9. ```js
   const w = shallowMount(Parent);
   expect(w.find(Child).exists()).toBe(true);   // shallowMount 下子组件渲染吗？
   ```
10. ```js
    expect(wrapper.html()).toMatchSnapshot();   // 团队把它当成唯一正确性保障
    ```
    这种做法的隐患是什么？

---

## 二、手写编程（5 题）

1. 用**类型声明式** props + `withDefaults` 写一个 `Badge.vue`：`label: string`（必填）、`count?: number`（默认 0）、`items?: string[]`（默认空数组，注意工厂）。
2. 给上题加 `defineEmits` 的类型化签名：`click: [id: number]`，并在按钮点击时 `emit('click', props.count)`。
3. 用 `defineModel` 重写一个可 `v-model` 的 `Toggle.vue`（布尔开关），再改成支持 `.disabled` 修饰符的版本。
4. 把一个渲染 5 万条只读记录的列表改造成：`shallowRef` 持有数据 + `v-memo` 缓存未变行，说明你改后的更新触发方式。
5. 为 `Counter.vue`（含 pinia useCounter）写一个 Vitest 用例：`beforeEach` 里 `setActivePinia(createPinia())`，点击 +1 按钮后断言 `store.count === 1` 且 DOM 文本同步。

---

## 三、场景题（1 题）

你负责一个后台大表格页面：初始加载慢（首屏 JS 3MB）、滚动卡顿（2 万行 × 40 列）、每次某个单元格变化整页重渲染。请给出一份**分层排查与优化方案**：
- 首屏 JS：如何用路由/组件分包 + 预加载 + visualizer 定位？
- 滚动：DOM 数量与响应式各怎么治？
- 重渲染：如何用 patchFlag/v-memo/key 与 Devtools Perf 定位热点？
- 优化完如何防回归（测试层面）？
（要求点出至少 5 个本关/跨关的具体机制。）

---

## 四、简答题（3 题）

1. 编译器宏为什么必须写在 `<script setup>` 顶层？这和"import 的组件自动注册""props 能纯类型声明"是同一个原因吗？请解释。
2. `v-once`、`v-memo`、`computed` 三者都带"缓存/跳过"意味，它们的缓存粒度和失效条件分别是什么？
3. 组件测试里 `nextTick` 与 `flushPromises` 有何区别？分别覆盖哪种异步？

---

## 五、挑战题 🏆

给团队写一份 **150 字以内的「Vue 性能 & 测试军规 checklist」**，要求：
- 编译期：至少覆盖静态提升、patchFlag、v-memo 的适用判断；
- 响应式：shallowRef/markRaw 的使用边界；
- 列表：key 与虚拟滚动；
- 分包：路由懒加载 + 预加载；
- 测试：mount vs shallow、emitted 断言、快照边界、pinia 隔离。
每条都要能被"一句反例"检验（即写得出违反它的坏代码）。
