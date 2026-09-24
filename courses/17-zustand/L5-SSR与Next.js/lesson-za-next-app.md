# Next.js App Router 集成

## 一、全局单例在 SSR 的致命问题

模块级 `create` 在 Node 里是**进程级单例**——多个请求共享同一份 store，A 用户的 token 泄漏给 B 用户。SSR 必须**每请求一份**。

原理：Node 进程复用模块作用域，dev 下每次请求重新 import 看似正常，一上 prod 打包常驻进程就翻车——这是最难在 dev 复现、面试最爱问的 SSR 事故。

## 二、per-request store（useRef 隔离）

App Router 是 RSC，客户端 store 放 `'use client'` 组件里：

```tsx
'use client';
export function StoreProvider({ children }) {
  const storeRef = useRef();
  if (!storeRef.current) storeRef.current = createStore(initialState);
  return <Ctx.Provider value={storeRef.current}>{children}</Ctx.Provider>;
}
```
配合 useStore(useContext(Ctx))，保证每个浏览器会话/水合实例独立（呼应 za-factory）。

要点：store 只在 client 子树存活；服务端组件要「读状态」只能靠 props 下发。严格的全 server-side per-request 需要 AsyncLocalStorage（官方 next-with-zustand 示例做法），多数业务用「client per-session + 服务端数据 RSC 直出」就够了——别为用 store 而把 RSC 数据灌进 store（呼应 za-layers）。

## 三、persist + skipHydration 防闪烁

SSR 无 localStorage，首帧渲染初始值；水合后 persist 读到旧值 → mismatch/闪烁。
设 `skipHydration: true`，在 `useEffect` 里 `useStore.persist.rehydrate()`，首帧渲染 loading skeleton 再切换。

## 四、初始化时序

```
SSR HTML(初始态) → 客户端 hydration(仍初始态)
→ useEffect rehydrate(读 localStorage) → setState → 二次渲染(用户数据)
```
把这一步用 skeleton 兜住，避免按钮/文案跳变。

对照错误时序：不 skipHydration 时 persist 在模块求值阶段就抢跑读 storage——服务端 undefined、客户端有值，两边 HTML 字符串不同直接报 Hydration failed（详见 za-hydration）。

## 五、动态 import 与 useSyncExternalStore 的 SSR 细节

next/dynamic ssr:false 可以整体把「依赖 store 的岛」退出 SSR——简单粗暴但损失首屏。更好的组合是保留 SSR、给组件传 getServerSnapshot 等价的初始值（createStore 初始 state 两边一致即可安全水合）。

## 六、layout 级 vs page 级 Provider

StoreProvider 包在 app/layout.tsx 影响整站会话；只包在某个路由段则切路由时实例重建——「编辑器页」常用后者拿到干净初始态。放错位置的典型症状：切 tab 后草稿「复活」或「丢失」，都是 Provider 生命周期与预期不符（呼应 za-factory 第四节的实体原则）。

## 小结
App Router 下 Zustand 三件套：per-session（或 per-request）store + skipHydration 受控水合 + 服务端数据走 RSC/Query 不进 store；Provider 位置决定 store 生命周期。

## 部署预告
本地 `npx create-next-app`，先用全局单例 store 在 `npm run build && npm start` 下复现跨请求串号，再换 StoreProvider 修复；prod 模式才能验证泄漏，dev 模式验不出来。
