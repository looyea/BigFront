# 面试题：组件测试（vitest-component）

### 1. (实战类) React 组件测试用什么栈、基本流程？
**来源**：https://vitest.dev/guide/browser/component-testing.html

React Testing Library + Vitest：render(<App/>) 挂载 → screen.getByRole/getByText 查询 → userEvent 交互 → jest-dom matcher 断言。核心理念是「按用户视角测行为」，不测实现细节。

### 2. (实战类) Vue 组件怎么测？
**来源**：https://vitest.dev/api/browser/vue.html

用 @vue/test-utils 的 mount/shallowMount，Vitest 借 @vitejs/plugin-vue 直接吃 .vue。传 props、slots 通过 mount 选项，断言用 wrapper.text()/find()/emitted()。也可 Vue Testing Library 走 RTL 风格。

### 3. (原理类) 为什么 RTL 强调 getByRole 而不是 querySelector？
**来源**：https://vitest.dev/guide/browser/component-testing.html

按 a11y 角色/可见文本查询，把断言绑在「用户能感知的语义」上，重构 class/id/标签不会误红，也顺带验证了可访问性。querySelector 绑死 DOM 结构，脆且测的是实现而非行为。

### 4. (对比类) userEvent 和 fireEvent 有何区别？
**来源**：https://vitest.dev/guide/browser/component-testing.html

userEvent 模拟真实用户操作序列（点击会带 pointerover/focus 等一连串事件、type 会逐字符触发 input），更贴近浏览器；fireEvent 只发单个裸事件、快但欠真。默认用 userEvent，特殊场景才降级 fireEvent。

### 5. (实战类) 组件依赖 Pinia store 怎么测？
**来源**：https://vitest.dev/api/browser/vue.html

mount 时 global.plugins:[createPinia()] 注入真 store，或先 setActivePinia + store.setState/调用 action 预置状态再挂。别 mock 掉 Pinia——喂真实例才测到「状态驱动视图」这条真实链路。呼应 16-pinia 包。

### 6. (实战类) Zustand 组件怎么测（呼应 17 包）？
**来源**：https://vitest.dev/guide/browser/component-testing.html

用 store 的 setState(initialState) 在用例前重置，保证隔离；再 render 组件、交互、断言由 store 驱动的视图变化。别 mock useStore，让它真跑订阅。多 store 时注意模块级状态在文件间默认隔离。

### 7. (坑类) render 后立刻断言异步数据常常拿不到？
**来源**：https://vitest.dev/guide/recipes/wait-for.html

onMounted/effect 里的请求异步更新 DOM，同步断言跑太早。用 await screen.findByText(...)（内部轮询）、vi.waitFor、或 flushPromises（await 微任务队列）等渲染稳定后再断言。这是组件异步测试头号坑。

### 8. (对比类) 组件快照该多用吗？
**来源**：https://vitest.dev/guide/learn/snapshots.html

不该。整棵 DOM 快照极易因无关改动全红、还掩盖「到底断言了什么」。策略：关键行为用 RTL 语义断言，快照只作「防意外结构变化」的辅助，少而精，且红时必须读 diff。

### 9. (实战类) 怎么测子组件 emit 了正确事件？
**来源**：https://vitest.dev/api/browser/vue.html

Vue test-utils：mount 后触发交互，读 wrapper.emitted() 断言事件名与载荷。React 侧把回调 prop 传成 vi.fn()，交互后 expect(cb).toHaveBeenCalledWith(...)。验的是组件间契约。

### 10. (实战类) 组件里有真实网络请求怎么办？
**来源**：https://vitest.dev/guide/mocking/requests.html

用 MSW 在 setupFiles 起 server、声明 handler 给假响应，组件照常发真请求、渲染真结果。别 vi.mock 掉 axios——那会测不到「请求→状态→渲染」这条链。详见网络关。

### 11. (原理类) browser mode 组件测试和 jsdom 有何不同？
**来源**：https://vitest.dev/guide/browser/component-testing.html

browser mode 在真实浏览器（Playwright/WebdriverIO 驱动）里跑组件，DOM/CSS/事件都是真的，能测布局、动画、真交互；jsdom 是模拟。API 大体一致，代价是更重、配置更多。本包以 jsdom 为主。

### 12. (坑类) 多个组件用例跑在一起互相干扰？
**来源**：https://vitest.dev/guide/browser/component-testing.html

多半是没 cleanup：上条用例的 DOM 残留在 body。RTL 现代版自动 cleanup，否则显式 afterEach(cleanup)；Vue 记得 unmount。文件级默认隔离，但同文件内用例共享 document，必须每条清干净。

### 13. (实战类) 怎么测一个受控表单与校验？
**来源**：https://vitest.dev/guide/browser/component-testing.html

render 表单 → userEvent.type 往 input 输入 → 断言校验文案出现/按钮禁用状态（toHaveErrorMessage/toBeDisabled）。提交场景 userEvent.click 后断言回调载荷。全程按用户可见行为断言、不碰内部 state。

### 14. (对比类) React 和 Vue 的测试思路共同点？
**来源**：https://vitest.dev/api/browser/react.html

都主张「测行为不测实现」：挂载组件、按语义查询元素、模拟用户交互、断言可见结果与对外契约（回调/emit）。差异只在工具 API（RTL vs test-utils），理念一致，可迁移。

### 15. (坑类) flushPromises 是什么、哪来的？
**来源**：https://vitest.dev/guide/recipes/wait-for.html

一个「等微任务队列 flush」的小工具（常见实现就是 await new Promise(r=>setTimeout(r)) 或 await Promise.resolve()），用来让 Vue/React 的异步渲染/effects 落地后再断言。更推荐 screen.findBy / vi.waitFor，语义更明确。
