# 组件测试：Vitest 与 Vue Test Utils

> 目标：会写组件还得会**给它上锁**。本课用 Vitest（Vite 原生 test runner）+ `@vue/test-utils` 讲组件测试的最小闭环：`mount`/`shallowMount` 的区别、`find`/`get`/`getByText` 查询、`trigger`/`setValue` 模拟交互、断言渲染 DOM 与 `props`/`emits`/`exposed`、`await nextTick`/`flushPromises` 等待更新、mock Pinia/Router，以及快照测试该用在哪、不该用在哪（呼应 node-testing 的 test runner / 断言 / mock 思想、vue-lifecycle 的挂载时机、vue-pinia）。

---

## 一、为什么是 Vitest

- Vitest 复用 Vite 的配置与转换管线，天然懂 `.vue`（配 `@vitejs/plugin-vue`）、TS、别名，**和 `vite.config` 共享环境**（呼应 10-vite）；
- API 兼容 Jest（`describe`/`it`/`expect`/`vi.fn`），但有 ESM、watch、更快冷启动；
- `test` 字段写在 `vite.config.ts` 或 `vitest.config.ts`，`environment: 'jsdom'` 提供 DOM。

这套"runner + 断言 + mock"的心智与 **node-testing**（内置 `node:test` + `assert`）完全一致，只是换到前端 DOM 环境。

---

## 二、mount vs shallowMount

```js
import { mount, shallowMount } from '@vue/test-utils';
import Parent from '@/components/Parent.vue';

const w1 = mount(Parent);           // 渲染 Parent 及其【所有子组件】
const w2 = shallowMount(Parent);    // 只渲染 Parent，子组件用【桩】替代
```
- **`mount`**：测"整棵子树协作"的集成行为；
- **`shallowMount`**：隔离被测组件，不被子组件实现细节拖累——单元测首选。

挂载后 `w.find(...)` 查询、`w.html()` 看结构。子组件因 `onMounted` 才碰 DOM，挂载即触发（呼应 vue-lifecycle）。

---

## 三、查询：find / get / findByText

```js
w.find('button.submit')          // 返回 DOMWrapper（找不到是空 wrapper）
w.get('button.submit')           // 找不到直接【报错】，更适合断言前置
w.findAll('.row')                // 数组，遍历列表项
w.findComponent(Child)           // 拿到子组件的 VueWrapper
screen.getByText('欢迎')          // Testing Library 风格：按用户可见文本查
```
原则：**按用户能感知的东西查**（文本、role、label），别绑死 class 名，重构样式不至于全线红。

---

## 四、交互与异步更新

```js
await w.find('button').trigger('click');       // 触发事件
await w.find('input').setValue('abc');         // 双向绑定输入
await w.find('select').setValue('b');
```
Vue 更新 DOM 是**异步**（微任务批量，见 vue-reactivity-theory nextTick）。触发后要等一轮更新：

```js
import { nextTick, flushPromises } from 'vue';
btn.trigger('click');
await nextTick();                 // 等一次 DOM 更新
await flushPromises();            // 等所有挂起的 Promise（如接口回来）
```
忘了 await 是"测试偶发红"的头号原因（呼应 node-testing 的 async 测试）。

---

## 五、断言 props / emits / exposed

```js
// 传 props
const w = mount(Child, { props: { title: 'Hi' } });
expect(w.text()).toContain('Hi');

// 断言子组件 emit
w.find('button').trigger('click');
expect(w.emitted().submit).toBeTruthy();
expect(w.emitted().submit[0]).toEqual([1, 'x']);   // 第一次调用的参数

// 断言 defineExpose 暴露的方法/状态
const vm = w.vm;
vm.someMethod();
expect(w.vm.exposedFlag).toBe(true);
```
`emitted()` 是验证"子契约"的关键——父该收到什么事件，不依赖内部实现（呼应 vue-component-basics emits、vue-sfc-compiler-macros defineExpose）。

---

## 六、mock Pinia / Router / 网络

```js
import { createPinia } from 'pinia';
import { setActivePinia } from 'pinia';

setActivePinia(createPinia());         // 每个用例一个干净 pinia（呼应 vue-pinia-advanced SSR 防水合污染同理）
const store = useCounter();
store.increment();
expect(store.count).toBe(1);
```
- **Router**：`global.mocks: { $router: { push: vi.fn() } }` 或用 `createRouter({ history: createMemoryHistory() })`（memory 路由专供测试，呼应 vue-router-basics）；
- **网络**：`vi.mock` 掉 api 模块，或 msw 拦截 fetch。核心是**隔离外部世界**，测组件自身逻辑（呼应 node-testing 的 mock/stub）。

---

## 七、快照测试：用对地方

```js
expect(w.html()).toMatchSnapshot();
```
第一次存基准，之后结构变了就 diff 提示。**适合**：锁定"输出结构整体形状"、防手滑。**不适合**：把快照当正确性断言——它只保证"和上次一样"，一旦实现本来写错，错也会被固化；且任意 class/时间戳都会造成脆断。建议**行为断言为主、快照为辅**，快照要人工 review。

---

## 八、自检清单

- [ ] `mount` 和 `shallowMount` 分别在什么时候用？
- [ ] `find` 和 `get` 的差别是什么？为什么推荐按可见文本查询？
- [ ] 为什么 `trigger('click')` 之后常要 `await nextTick()`/`flushPromises()`？
- [ ] 怎么用 `emitted()` 断言子组件抛的事件与参数？
- [ ] 测 store 为什么要每个用例 `setActivePinia(createPinia())`？
- [ ] 快照测试能替代行为断言吗？为什么？

---

## 🚀 部署预告

- 测试依赖挂载/更新时机——`onMounted`、DOM 可用点、nextTick 批处理都在 **vue-lifecycle / vue-reactivity-theory** 里；
- mock 与 test runner、async 测试的心智迁移自 **node-testing**；分包与 vitest 复用 vite 配置见 **10-vite**；
- L7 到此收官。**下一关进入 L8 开篇 vue-project-architecture**：把 24 关的散点组织成一个可维护的大型工程——目录（features vs layers）、容器/展示分层、composables 库、全局错误处理、避免过度全局化。
