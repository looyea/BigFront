# SSR / Next.js 集成

## 一、每请求一个 store
SSR 必须每个请求 createStore 一份，绝不复用全局默认 store（呼应 jo-store）。Next App Router 在 server 组件里建 store 并透传给客户端 Provider。

「全局单例在 SSR 下是跨请求的」——这句话值得用事故来记：A 用户的请求把 token 写进默认 store，B 用户的渲染读到它。Node 进程只有一个模块作用域，而你以为的「页面级」其实是「进程级」。每请求一 store 是唯一安全姿势（与 za-next 里 Zustand 的同款铁律一字不差）。

App Router 骨架：

```tsx
// app/page.tsx (Server Component)
const store = createStore();          // 每请求新建
store.set(userAtom, await fetchUser());
return <Provider store={store}><ClientTree/></Provider>;
```

## 二、水合：dehydrate / hydrateAtoms

```ts
import { dehydrate, hydrateAtoms } from 'jotai/utils';
const values = dehydrate(store);            // 服务端序列化
// 客户端：
hydrateAtoms(new Map(values), store);        // 水合避免二次取数
```
把 async atom 已 resolve 的结果一并传下去，防止客户端重新请求（呼应 jo-async）。

dehydrate 只收集**已被 mount 订阅过**的原子值——这既是特性也是坑：服务端只 store.get 没订阅的原子不会被序列化，客户端水合后读到空。显式清单交给 `dehydrate(store, { atoms: [...] })`。hydrateAtoms 必须在客户端首帧 render 前调用（放 Provider 外的 bootstrap 或 use 之前），否则 async atom 会先自己发起一次取数再被覆盖——白闪一下还多一次请求。

## 三、atomWithStorage 与闪烁
getOnInit 控制是否初始就读存储；配合「首帧渲染一致的占位」避免 hydration mismatch（呼应 za-hydration）。

SSR + storage 的时序三角：服务端没有 window，atomWithStorage 服务端首帧必是初值；客户端若 getOnInit:true 首帧就是存储值——两帧不一致，React 直接报 hydration error。所以 SSR 项目保持 getOnInit:false（两帧首帧一致，mount 后再同步存储值，闪烁用 CSS 或骨架遮），纯客户端项目才享受 getOnInit:true 的无闪待遇（呼应 jo-storage 第六节）。

## 四、RSC 边界
useAtomValue 是 hook，只能在 `'use client'` 用；server 组件里用 store.get 直读并作为 props 下发（呼应 za-rsc-boundary）。

组合姿势：server 组件里 store.get(asyncAtom 已 await 的数据) → 喂给客户端树 → hydrateAtoms 预置同一份值 → 客户端组件 useAtomValue 直接命中不发二跳请求。「服务端取、水合传、客户端读」三段式是 Jotai 在 RSC 时代的标准数据流。

## 五、Client 边界与 Provider 位置
Provider 放在需要 store 的最小 client 子树根，避免整页 client 化损失 RSC 收益。

反模式警告：为了「方便」在 layout 顶层放一个 client 壳包住全站——整棵树退化为客户端 bundle，RSC 归零。Provider 是 client 组件，其位置就是「交互岛」的边界；岛外的静默内容留在 server 渲染。store 作用域大小与 client 边界大小被迫一致，反而逼出健康的架构切分（呼应 za-rsc-boundary 的交互岛心法）。

## 六、Pages Router 速记
Pages Router 下用 getServerSideProps 拿初始值，组件树顶部 useEffect 里 hydrateAtoms 一次；或直接用生态的 jotai-next 类封装。原则与 App Router 无差，只是「每请求 store」的挂点从 RSC 换到了 page 的 wrapper。

## 小结
SSR 四要点：每请求 store（进程单例即泄漏源）、dehydrate/hydrateAtoms 传递已取结果（注意订阅收集规则与调用时机）、storage 防闪烁按渲染环境选 getOnInit、Provider 位置=交互岛边界。

## 部署预告
本地跑一个 Next App Router demo：根 page 建 store 并 store.set 预取数据，客户端组件 useAtomValue 确认零二次请求（Network 面板验证）；再故意给某组件直接 useAtomValue 一个未水合的 async atom，观察二次取数与闪烁的区别。
