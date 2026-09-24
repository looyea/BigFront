# Atom 原语：一个原子一个值

## 一、atom 是什么

`atom` 是 Jotai 的最小状态单元——一个「可读可写的值」。

```ts
import { atom } from 'jotai';
const countAtom = atom(0);          // 可写原子（含初值）
const textAtom = atom('hello');
const readonlyAtom = atom((get) => get(countAtom) * 2); // 只读派生
```

注意第三行的形态差异：传「值」得到可写原子，传「getter 函数」得到只读派生原子——同一个 `atom()` 工厂，参数形状决定原子身份（详见 jo-derived）。

## 二、与 useState 的根本区别

useState 属于某个组件实例；atom 是**模块级、可跨组件共享**的独立单元，不依附于任何组件树。多个组件 useAtom(countAtom) 即共享同一份状态。

更本质的区别在更新语义：useState 的 setter 触发「该组件重渲」，atom 的 set 触发「依赖图上所有消费者的更新」——前者是组件私有账本，后者是全局广播网。从 useState 迁移的第一坑：`setCount(count + 1)` 连点两次会丢一次（闭包旧值），而 atom 的 updater 形式 `set(countAtom, (c) => c + 1)` 永远读到最新值。

## 三、与 Zustand store 的哲学差异

- Zustand：**自上而下**，先设计一个大 store，再用 selector 取子集。
- Jotai：**自下而上**，先有许多小 atom，再组合派生。原子是默认粒度，天然细订阅。

一个直观类比：Zustand 像一本账（查哪页要写页码选择器），Jotai 像一抽屉卡片（要哪张拿哪张，卡片之间还能用胶水互相引用）。拆需求时「先想有几张卡」而不是「先想有几本账」。

## 四、安装与使用

```bash
npm i jotai
```
Jotai v2 无需 Provider 即可用「全局默认 store」，import 一个 atom 就直接可读写（呼应 jo-global）。

```tsx
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

## 五、原子是不可变值 + setter 语义
写原子用 setter（set(countAtom, v) 或 set(countAtom, prev=>prev+1)），语义接近 setState 但作用在单个原子。

对象原子请保持不可变习惯：`set(userAtom, (u) => ({ ...u, name: 'x' }))`——直接改属性不会通知订阅者（Jotai 用 Object.is 判等，引用没变即视为无变化），这是 Zustand 同款的第一课（呼应 za-create）。

## 六、什么时候一个 atom 装不下了

单原子膨胀成「对象里塞十个字段、谁都不敢订阅整对象」时，说明该拆了：按变化原因拆成多个 atom，派生关系交给 getter 表达。经验线：**一个 atom 只因为一件事而变**（原子化的原子版 Single Responsibility）。

## 小结
atom = 可共享、可派生的最小状态；形状定身份（值→可写、getter→派生）、updater 永远读新值、不可变更新是铁律；Jotai 的世界由原子搭积木，而非一个大 store。

## 部署预告
本地 `npm i jotai` 后跑通 counter；再故意用「直接改对象属性」写一次更新，观察 UI 不动，亲手踩一遍不可变坑。
