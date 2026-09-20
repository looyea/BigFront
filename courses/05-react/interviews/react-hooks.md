# 面试题 · React Hooks

1. **为什么 Hooks 不能在条件/循环里调用？**
   Hooks 按**调用顺序**关联组件实例上的槽位；条件改变顺序会错位。ESLint 的 rules-of-hooks 强制约束。

2. **useState 的更新为什么是异步的？想立刻拿新值怎么办？**
   React 18 起 setState 在事件处理器中会被批处理。**函数式更新**：`setCount(c => c + 1)`；想读新值用 useEffect 监听，或者在事件外 setTimeout 微任务里读 ref。

3. **useEffect 依赖数组的正确姿势？如何避免闭包陷阱？**
   - 只列**在 effect 里用到的、会变的外值**。
   - 闭包陷阱：effect 里的函数捕获了旧 state，用函数式更新或 useCallback 修依赖。

4. **useMemo vs useCallback vs 组件缓存？**
   - useMemo 缓存**值**；useCallback 缓存**函数引用**（等价 useMemo(() => fn, deps)）。
   - React.memo 缓存**整棵组件渲染**。
   只在昂贵计算 / 传给 memo 子的 props 引用稳定时才用。

5. **useRef 能干什么？**
   ① 存 DOM 引用；② 存「跨渲染不触发重渲的可变值」（如上一次 props 快照、请求 id）。

6. **什么是自定义 Hook？命名规则？**
   以 `use` 开头、内部可以用其他 Hook、复用**有状态逻辑**。例：useLocalStorage、useDebounce、useMediaQuery。

7. **React 18 并发：useTransition 与 useDeferredValue 各解决什么？**
   - useTransition：把某个 setState 标记为「非紧急」，允许中断/降级。
   - useDeferredValue：把某个值以「稍后的值」形式传给下游，减少大列表重渲染压力。

8. **说说 key 与 reconciliation。**
   React 用 key 在同层列表中标识节点身份；不用 index 作 key 的场景是**列表可变 + 有内部状态/动画**。

9. **如何写一个不依赖闭包陷阱的防抖 Hook？**
   ```ts
   function useDebounced<T>(v: T, ms = 300) {
     const [d, setD] = useState(v);
     useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
     return d;
   }
   ```
