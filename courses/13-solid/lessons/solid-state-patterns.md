# 状态组织：从"信号泥潭"到 store + 派生 + 共享

> 目标：能给中大型应用选对状态组织方式——什么时候用 signal、什么时候收进 store、派生值为什么不该存、如何避免 prop drilling——写出既响应式又不过度重算的状态结构。呼应课业「状态组织与性能」的第一半。

## 一、"一堆零散 signal"的困境

官方用一个任务列表示范问题：为 `tasks`、`numberOfTasks` 各开一个 `createSignal`、再用 `createMemo` 算 `completedTasks`。带来的麻烦：
- **啰嗦**：多个 signal + memo 各管一摊；
- **易失同步**：每次改 `tasks` 都要手动去同步 `numberOfTasks`，漏一处就前后矛盾；
- **频繁重算**：toggle 一次就重算 `completedTasks`，逻辑还依赖当前 `numberOfTasks`/`completedTasks` 的状态，难读难维护。

应用越大，这种"手动维持一致性"越容易出错、越难把功能切成可复用组件。

## 二、用 store 收拢相关状态

把成组的状态塞进**一个** `createStore`：
```ts
const [state, setState] = createStore({ tasks: [], numberOfTasks: 0 });
```
- 读：`state.tasks`、`state.numberOfTasks`（点属性，**别解构**）；
- 写：**路径 setter**——`setState("tasks", state.tasks.length, {...})` 追加到数组末尾，`setState("tasks", t => t.id===id, "completed", !v)` 定点改。

一个 store 取代了"要分别追踪的多个 signal"，一致性由结构本身保证。

## 三、produce：一次改多处

要同时改多个字段，别写一堆 `setState`，用 `produce` 直接"变更"草稿：
```ts
import { produce } from "solid-js/store";
setState("tasks", t => t.id === id, produce((task) => {
  task.text = "I'm updated text";
  task.completed = true;
}));
```
官方点明 produce 的好处：**无需多次 setStore 调用**就能改一个对象的多个属性（等价于把 `batch` 里的多写合并成一次直观变更）。

## 四、派生值优先"算"不要"存"

`numberOfTasks`、`completedTasks` 这类**能从源数据推出**的值，最佳实践是用 **memo 派生**，而不是存进 state 再手动同步：
- 存了就得在每次改动后手动维护，**漏同步 = bug**；
- 官方在 effects 页更明确：**尽量别在 effect 里 set 信号**（可能触发额外渲染甚至无限循环），要算新值**用 `createMemo`**。

```ts
const completed = createMemo(() => state.tasks.filter((t) => t.completed));
```
> 反例：`createEffect(() => setState("numberOfTasks", state.tasks.length))`——官方示例用它只为演示"路径写入需追踪作用域"，实际这种能派生的量直接 `state.tasks.length` 或 memo 即可，别绕 effect 去 set。

## 五、store 属性是懒建的：写入要落在追踪作用域

store 的属性 signal 是**访问时才创建**的。若在组件函数体（非追踪作用域）里 `setState("numberOfTasks", …)` 而不被任何 observer 读，**不会响应式更新**——要么在读取它的作用域里写，要么用路径写法让依赖正确建立。这是"信号泥潭"换 store 后新踩的坑，务必知道。

## 六、跨组件共享：context 终结 prop drilling

多层组件传递 state 和函数（prop drilling）会让代码啰嗦、数据流难追。Solid 用 **context**：
```ts
const TaskContext = createContext();
// 顶层
<TaskContext.Provider value={{ state, setState }}>{...}</TaskContext.Provider>
// 任意后代
const { state, setState } = useContext(TaskContext);
```
把 store（或 signal + 动作）放进 Provider 的 value，后代按需 `useContext` 取用——比逐层传 props 干净得多。

工程上更稳的写法是把「建 context + 提供 + 消费」封进一个模块，并在消费处挡掉 `undefined`（`useContext` 的类型带 `| undefined`，没有 Provider 会拿到 undefined）：
```ts
const TaskCtx = createContext<ReturnType<typeof createTaskStore>>();
export const TaskProvider = (props) => {
  const store = createTaskStore();
  return <TaskCtx.Provider value={store}>{props.children}</TaskCtx.Provider>;
};
export const useTasks = () => {
  const c = useContext(TaskCtx);
  if (!c) throw new Error("useTasks 必须在 TaskProvider 内使用");
  return c;
};
```
这样状态、动作、共享入口集中在一个文件里，组件只认 `useTasks()`，既防 prop drilling、又不会因为漏包 Provider 而在运行时静默拿到 undefined。

## 七、选型口诀

| 场景 | 选择 |
| --- | --- |
| 单个、独立、基本类型的值 | `createSignal` |
| 成组/嵌套、需按路径局部更新 | `createStore`（别解构、用路径/produce） |
| 能从别处推出的值 | `createMemo` 派生，**不存**、不用 effect set |
| 服务器/异步数据 | `createResource`（配 Suspense） |
| 跨多层共享 | Context（Provider + useContext），避免 prop drilling |
| 就近的一次性 UI 状态 | 直接放在需要它的那个组件里（colocate），只在共享时才上提 |

## 八、自检清单

- [ ] 能说清"零散 signal"的失同步与重算问题、store 如何收拢
- [ ] 会用路径 setter 与 produce 做定点/多字段更新
- [ ] 坚定"派生用 memo、不在 effect 里 set 信号"的原则
- [ ] 知道 store 属性懒建、写入要落在追踪作用域
- [ ] 会用 context 解决 prop drilling，并按“就近→上提”决定状态放哪

🚀 **下一站**：性能（solid-performance）——组织好状态后，让细粒度保持“细”、把该省的省掉。
