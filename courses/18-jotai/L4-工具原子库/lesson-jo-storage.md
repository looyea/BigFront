# atomWithStorage / atomWithReducer / atomWithDefault

## 一、atomWithStorage：自动持久化

```ts
import { atomWithStorage } from 'jotai/utils';
const themeAtom = atomWithStorage('theme', 'light');          // localStorage
const sesAtom = atomWithStorage('sid', '', { getItem, setItem, removeItem }); // 自定义
```
读写透明同步到存储，SSR 下默认在客户端读取（可配 getOnInit 防闪烁，呼应 jo-ssr）。

同步是双向的：初始值「存储 > 默认值」，之后每次 set 落盘；多标签页还会经 storage 事件互相同步——这一条特性直接白嫖了 za-hydration 里手写的跨 tab 方案。

## 二、atomWithStorage 三兄弟选型

- `atomWithStorage`：localStorage（同步、5MB、仅浏览器）。
- `atomWithLocalStorage`（旧名）/ 同上——注意 v2 里 atomWithStorage 已泛化 storage 参数。
- `createJSONStorage` 助拆包：给 getItem/setItem/removeItem 三个异步实现即可接 AsyncStorage/sessionStorage/加密存储，无需自己写 JSON.stringify。

```ts
import { createJSONStorage } from 'jotai/utils';
const cookieish = atomWithStorage('sid', '', createJSONStorage(() => cookieLikeStorage), { getOnInit: true });
```

## 三、atomWithReducer：Redux 风格

```ts
import { atomWithReducer } from 'jotai/utils';
const counterAtom = atomWithReducer(0, (state, action) =>
  action.type === 'inc' ? state + 1 : state);
```
用 dispatch 风格更新，适合纯 reducer 逻辑迁移。

`useSetAtom(counterAtom).dispatch({ type: 'inc' })` 写法（v2 经 useAtom 返回 [state, dispatch] 对）——迁移旧 Redux reducer 时零改写量；但新代码不建议默认上 reducer 风格：Jotai 的 write atom 本就支持集中变更，多一层 action.type 间接反而更重（呼应 jo-write-only）。

## 四、atomWithDefault：可 reset
提供默认值来源，调用其 write 可 reset 回默认（呼应 pinia $reset 语义）。

```ts
const defaultFormAtom = atom({ name: '', age: 0 });
const formAtom = atomWithDefault((get) => get(defaultFormAtom));
// 提交成功后：set(formAtom, null) —— null 是 reset 的信号值
```

妙处在默认值本身可以是 atom：`defaultFormAtom` 变了（比如切换模板），formAtom 未被动过就自动反映新模板——「可覆写的默认值」这个常见需求（用户设置 > 系统默认）一行到位。

## 五、与 Zustand persist 对比
Zustand persist 是「整 store 级别 + version/migrate」；atomWithStorage 是「单原子级别」，更细但缺少内建版本迁移，需自己在 storage.get 里处理旧格式（呼应 za-persist-deep）。

迁移写法：自定义 storage 的 getItem 里按存的 `{ v, data }` 信封判断版本、逐级升级后回写——20 行工具函数即可复刻 migrate 能力；或者干脆给 key 带版本号（'cart@2'），新版新 key 老数据自然废弃——原子级持久化船小好调头。

## 六、SSR/类型与闪烁细节

storage 需实现 StateStorage（getItem 可返回 Promise 支持 async）；泛型保证值类型。

时序划重点：默认 getOnInit:false 时，服务端与客户端首帧都读**初值**（水合安全），mount 后才换成存储值（会闪一下）；getOnInit:true 只在客户端立即读存储（SSR 下无 window 自动退回初值）。主题类「宁可闪也别错」的场景用 false + skeleton 或干脆走 next-themes 式预刷脚本（呼应 za-hydration 第三节）。

## 小结
utils 三件套定位：storage 做持久化（跨 tab 白嫖、迁移自担版本）、reducer 做迁移兼容、default 做「可 reset 且默认值可派生」；粒度到单原子，心智比整 store persist 轻一档。

## 部署预告
本地给 theme/layout 上 atomWithStorage 并双开标签页验证同步；再造一个 v1 旧格式数据，写带信封版本的 storage 完成迁移；最后故意 set(formAtom, null) 体验 atomWithDefault 的 reset。
