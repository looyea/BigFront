# L3 作业：架构模式

## 一、知识回顾
1. StateCreator 四个泛型含义与 slice 组合写法。
2. 何时从单例切到 createStore + Context 多实例？
3. UI / 业务 / 服务端三层各自的归属库与持久化策略。

## 二、代码实操
1. 把一个 300 行的 useAppStore 拆成 uiSlice、cartSlice、userSlice 三个文件并组合。
2. 用 createStore + Context 实现「可重复添加」的 Table 组件，每个表格分页互不干扰。
3. 设计一个「文章列表页」：列表用 TanStack Query、本地草稿用 Zustand，说明二者如何协作与失效。

## 三、思考题
1. 为什么跨 slice 调用推荐 get().action 而不是 import 另一个 store 实例？
2. 服务端态放进 persist 会引发什么问题？

## 四、延伸阅读
- Zustand contexts / vanilla store 文档
- TanStack Query：server state vs client state

## 五、自查清单
- [ ] 每个 slice 一文件、导出 selector
- [ ] 多实例用 useRef 持有工厂 store
- [ ] 服务端态未拷进 Zustand
- [ ] 每层单一写路径
