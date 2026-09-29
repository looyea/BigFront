# focusAtom / selectAtom / splitAtom

## 一、selectAtom：派生选择 + 浅比较

```ts
// 目的：selectAtom——从大对象源派生“只在选中值变化时更新”的切片原子，躲无关字段重渲
import { selectAtom } from 'jotai/utils';
const nameAtom = selectAtom(userAtom, (user) => user.name);   // 只挑 name，其余字段变不动它
// ✅ userAtom 被别处频繁整体更新时，订 nameAtom 的组件只在 name 真变才重渲（第二参可传自定义 equality）
// ❌ 直接 useAtomValue(userAtom) 订阅整个大对象→任一字段变化全组件跟着重渲，等于放弃细粒度红利
```
从源 atom 派生一个「只在选中值变化时更新」的原子，避免无关字段变化引发重渲（呼应 za-selectors-deep）。

它解决的是「源原子是大对象，我只想订阅其中一个字段」：userAtom 整体被别处频繁更新时，订阅 nameAtom 的组件只在 name 真变时动——等于给「不可拆的源」打了个选择器补丁。第二参可传自定义 equality。

## 二、focusAtom：聚焦对象/lens

```ts
// 目的：focusAtom——用 lens optic 从嵌套对象聚焦出可读写子原子，双向且细粒度
import { focusAtom } from 'jotai/utils';
const addressCityAtom = focusAtom(userAtom, (optic) => optic.prop('address').prop('city'));   // 聚焦深层 city，可读可写
// ✅ set(addressCityAtom,'Beijing') 自动做深层不可变更新，替掉手写三层 {...u, address:{...u.address, city}} 展开
// ❌ 把聚焦当只读、期望 set 直改 userAtom 却不产生新引用→focus 依赖不可变更新，mutate 原对象订阅者收不到
```
用 lens optic 从嵌套对象「聚焦」出可读写子原子——像直接编辑深层字段，但仍是细粒度订阅。

focus 是**双向**的：set(addressCityAtom, 'Beijing') 会自动做「深层不可变更新」把 userAtom 里该路径克隆替换——手写 `{...u, address:{...u.address, city}}` 三层展开（再深十层呢？）被 optic 链一行替代。数组同理 `optic.index(2)`。

## 三、splitAtom：数组拆子原子

```ts
// 目的：splitAtom——把数组 atom 拆成“一个 atom 列表”，每元素独立可订阅/删除，随源派生零缓存
import { splitAtom } from 'jotai/utils';
const [itemAtoms, removeItem] = splitAtom(itemsAtom);   // itemAtoms 是原子数组，removeItem 接收“要删的原子”
// ✅ 外层 map itemAtoms、行内 useAtom(itemAtom) 各订各的，改一行只渲一行；itemsAtom 增删自动同步行原子
// ❌ removeItem 误传下标数字而非待删原子→splitAtom 要的是 item 原子引用，传 index 删不掉还报错
```
把一个数组 atom 拆成「一个 atom 列表」，每元素独立可订阅/删除——ToDo/表单字段数组利器（呼应 jo-family 行级）。

用法是双层渲染：外层 map itemAtoms 拿「原子的数组」，每项再传给行组件 `useAtom(itemAtom)`——行内编辑只重渲该行，删除用 removeItem(atindexAtom)。itemsAtom 与行原子的父子同步全自动，这就是「随源派生、零缓存」的行级状态方案（对比 family 的显式回收，jo-family 第五节的第三条路就是它）。

## 四、实战：表单字段级订阅
整表单一个对象 atom，字段用 focusAtom 聚焦，单字段改动只重渲该字段组件，性能极佳（呼应 pinia-form）。

```tsx
// 目的：字段级订阅实战——整表单一个对象 atom，字段用 focus 聚焦，单字段改动只重渲该字段
const formAtom = atom({ name: '', profile: { city: '' } });                 // 真相仍是单个对象 atom（提交/校验按整对象走）
const cityAtom = focusAtom(formAtom, (o) => o.prop('profile').prop('city')); // 聚焦出 city 可读写子原子
function CityInput() {
  const [city, setCity] = useAtom(cityAtom);   // 只订阅 city，name 变化不惊动本组件
  return <input value={city} onChange={(e) => setCity(e.target.value)} />;  // 受控直连，写回自动深层不可变更新 formAtom
}
// ✅ 改 name 时 CityInput 零重渲，订阅粒度到字段而真相仍是一份 formAtom
// ❌ 图省事让每个字段都 useAtom(formAtom) 订整对象→任一字段击键全表单重渲，focus 白做
```

「表单放一个对象 atom 还是拆散？」——拆到 focus 这一层就够了：真相仍是一份 formAtom（提交/校验/草稿 persist 全按整对象走），订阅却细到字段。与 za-forms「值归 RHF」不同路线，Jotai 生态更习惯受控直连。

## 五、组合心法
select=读派生、focus=读写深层子集、split=数组拆列表；三者把「一个原子」优雅地细分。

再加一条判据：**源在你手里能不能拆**。能拆（新代码、状态设计权在你）→ 直接多个原子（最干净）；不能拆（后端返回的大对象、三方 SDK 状态）→ select/focus/split 三件套做「视图细分」。工具是给存量数据用的，原子化才是增量设计的正解（呼应 jo-atom 第六节）。

## 六、性能验证套路

一个 30 字段的表单 atom：先整对象 useAtom 全量渲染，Profiler 记重渲数；换 focus 版对比；再用 Jotai DevTools 看每字段原子的订阅边——三张截图就是「大对象 atom 有害」的铁证实验（呼应 jo-perf-test 诊断流）。

## 小结
utils 三剑客解决「大对象 atom」的订阅粒度问题：select 读切片、focus 双向聚焦深层、split 数组拆行；能拆原子就别靠工具细分——工具治存量，原子化治增量。

## 部署预告
本地写一个嵌套 3 层的个人资料表单：city 字段 focus 后验证改 name 时 city 输入框零重渲；再用 splitAtom 重写 todo 列表删行逻辑，对照 jo-family 的 Map 方案比较心智差异。
