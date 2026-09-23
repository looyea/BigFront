# mobx-react：observer 组件与细粒度重渲

> 目标：搞懂 observer 凭什么让 React 组件『只随渲染时读到的值重渲』，消灭三大经典事故（解构丢追踪/组件外读/漏 action），并给 MobX+React 与 React 原生粗粒度模型画清互补边界（呼应 react-render-model、solid-components、mobx-core）

## 一、observer 到底做了什么

```jsx
import { observer } from 'mobx-react-lite';
import { useStore } from './store-context';

const TodoList = observer(function TodoList() {
  const store = useStore();
  return (
    <ul>
      {store.visibleTodos.map((t) => (
        <li key={t.id}>{t.text}</li>
      ))}
    </ul>
  );
});
```

`observer` 把组件函数体变成一个 **reaction 作用域**：渲染期间读到的每个 observable 字段都被登记为该组件的依赖；任何被登记字段变化 → MobX 调度组件重渲。React 自己那一套『父渲子必渲 + memo 浅比较』在这里退居二线——**触发重渲的是数据，不是 props**。两个直接红利：

1. **不 memo 也细粒度**：store 里 filter 变了，只有渲染时真读了 filter 的组件重渲；没读 todos 内容的头部组件稳如泰山（对比裸 React：状态在父、props 下钻、memo 到处贴）；
2. **props 无关的订阅自由**：组件可以从 context、模块单例、props 任何来源读 observable，读了就订——React 的 props 流不再绑架状态流。

（mobx-react-lite 是函数组件时代的主角；老 mobx-react 的 inject/@observer 类组件全家桶已退居维护模式。新项目直接 lite。）

## 二、三大经典事故逐拆

### 事故 1：解构丢追踪

```jsx
const { count } = store;              // ❌ 解构=快照取值，之后 count 与 store 恩断义绝
return <b>{count}</b>;                 // 永不更新
```

解构那一刻只是读了一次值，之后的渲染不再读 store.count——没读就没订。**修法**：渲染表达式里直接读 `store.count`；实在要解构，用 MobX 给的 `computed(() => store.count)` 桥或干脆别解构。这条铁律的 signal 双胞胎是 `const c = sig.get` 后不再读——**隐式追踪的世界里，『读的动作必须发生在追踪作用域内』**。

### 事故 2：在组件外（事件回调里）读

```jsx
observer(function C() {
  const onClick = () => alert(store.count);   // 回调在渲染后才执行，不在追踪作用域内
  return <button onClick={onClick}>?</button>;
});
```

澄清两个方向：事件回调里**读** store 拿到的永远是当下最新值（没问题）；真正的坑是**期望回调里的读取建立订阅**——不会。需要"值变了自动做点什么"应回到 computed/reaction，而不是在回调里读。**追踪作用域只有三种：渲染体、computed getter、reaction 回调**——在清单外的读取都是一次性快照。

### 事故 3：改状态漏 action

```jsx
<button onClick={() => store.count++}>   // 严格模式告警：裸写
<button onClick={() => store.increment()} // ✓ action 在 store 里备好
```

组件侧的纪律：**store 是数据的唯一权威，组件只调方法不伸手**。这也是 MobX 项目里组件比 Redux 派更"瘦"的原因——dispatch 样板没了，但边界以更 OOP 的方式划在 store 类里。

## 三、与 React 粗粒度模型的互补关系

React 原生：状态提升→props 下传→组件树成片重渲→memo/useMemo/useCallback 人工止损（13 包 solid-components 里批判过的『全组件级粒度』）。MobX+observer：**订阅下沉到字段级，重渲面由读取行为自动圈定**——效果逼近 Solid 的细粒度（差别：MobX 仍按组件粒度重渲函数体，只是"该渲的才渲"圈得准；Solid 可以跳过函数体直改 DOM 文本节点）。

| 维度 | React 原生+Context | MobX+observer | Solid signals |
| --- | --- | --- | --- |
| 谁触发重渲 | 父更新/state 变 | 读到的字段变 | 读到的 signal 变 |
| 粒度 | 组件树成片 | 字段级订阅、组件级重渲 | 表达式级可跳过组件 |
| 手动优化 | memo/deps 全靠贴 | 几乎不需要 | 几乎不需要 |
| 心智 | 不可变+纯渲染 | 可变+action 纪律 | 显式容器 |

一句话定位：**MobX 是"给 React 装上细粒度变更检测"的最成熟方案**——这也是 React 官方状态库选型页长期把 MobX 列入推荐的原因。

## 四、性能边界的三个提醒

1. **大列表仍要虚拟化**：observer 圈准了"谁该渲"，但一万行 li 的 DOM 创建本身就是成本（呼应 13 包 solid-fine-grained 的性能账）；
2. **渲染里别造新对象再读**：`items.map(...)` 的 map 回调里读字段没问题，但把整个 store `toJS()` 进渲染会全量建依赖——精准订阅瞬间退化回大对象风暴（`useLocalStore`/结构化浅订阅缓解）；
3. **StrictMode 双渲染**：observer 组件开发模式跑两遍是常态， reaction 作用域的建依赖是幂等的，但别在渲染体里做副作用（ MobX 救不了 React 的这条规矩）。

> 🚀 部署预告：observer 组件在 SSR 下的正确姿势（renderToString 时 reaction 收集、hydration 一致性）在 L8 sig-server 展开；本关实验只需 Vite+React 模板装 mobx 与 mobx-react-lite 两包，五分钟起一个待办应用（呼应 10-vite）。
