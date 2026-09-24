# persist 深入：版本迁移 / partialize / SSR

## 一、最小用法

```ts
import { persist } from 'zustand/middleware';
const useStore = create(
  persist(
    (set) => ({ token: '', user: null, setAuth: (t, u) => set({ token: t, user: u }) }),
    { name: 'auth-storage' }
  )
);
```
默认存 localStorage，key 即 name，值为 `{ state, version }`。

## 二、partialize：只持久化需要的字段

```ts
{
  name: 'cart',
  partialize: (s) => ({ items: s.items }),   // 只存 items，不存 loading 等瞬时态
}
```
避免把 loading/error/瞬态写进存储，也防止敏感字段泄漏。v5 起 persist 要求被持久化的 state 必须可 JSON 序列化——函数、Map、Date 会被静默丢失，用 partialize 剔除或自定义 storage 做序列化。

## 三、version + migrate：schema 升级

```ts
{
  name: 'cart',
  version: 2,
  migrate: (persisted, version) => {
    if (version === 0) return { ...persisted, items: [] };
    if (version === 1) return { ...persisted, coupon: null };
    return persisted;
  },
}
```
每次改结构就 +version，migrate 里做「旧数据 → 新结构」的逐版本升级，用户无感。migrate 收不到当前 version 的旧值时可能为 undefined——加 `if (!persisted) return initialState` 兜底；升级逻辑写纯函数，配单测（呼应 za-testing-deep）。

## 四、merge：深合并 vs 浅覆盖

默认浅合并：水合值覆盖内存初始值。需要保留新增字段的初始值时，自定义 `merge: (persisted, current) => deepMerge`。典型翻车：v2 新增嵌套对象 `settings: { lang, theme }`，旧存储只有 `settings: { lang }`，浅合并后 theme 整个丢失——嵌套结构一律上 deepMerge 或 migrate。

## 五、SSR 与 skipHydration

SSR 时 localStorage 不存在 → 水合闪烁。用 `skipHydration: true` 关闭自动水合，客户端 mount 后手动 `useStore.persist.rehydrate()`，配合 loading skeleton 规避 mismatch（完整时序见 za-hydration）。

## 六、跨端存储与容量红线

React Native 用 `createJSONStorage(() => AsyncStorage)`；只要实现 getItem/setItem/removeItem 即可作为 storage。加密需求在 storage 层做（get/set 时加解密），不要污染业务 state。容量：localStorage 约 5MB 且同步读写——大列表、base64 图片永远不该进 persist，落 IndexedDB（idb-keyval 包一个 StateStorage 即可）。

## 七、onRehydrateStorage 时序钩子

```ts
persist(fn, {
  name: 'cart',
  onRehydrateStorage: (state) => (state, error) => {
    if (error) report(error); else markReady();   // 水合完成再渲染真实 UI
  },
})
```

配合 UI 的 ready 标志，把「水合完成」变成可订阅的渲染时机，替代 setTimeout 猜时长。

## 小结
partialize 控制「存什么」，version+migrate 控制「怎么升」，merge 控制「怎么合」，skipHydration+onRehydrateStorage 控制「SSR 时机」，storage 层控制「存哪、加密、容量」。

## 部署预告
本地把 cart store 的 version 从 1 提到 2 并写 migrate，用 DevTools 手改 localStorage 里的旧数据验证升级路径；生产构建前用 `JSON.parse(localStorage.getItem(key))` 核对实际落盘结构。
