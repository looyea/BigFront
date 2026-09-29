# persist 深入：版本迁移 / partialize / SSR

## 一、最小用法

```ts
// 目的：persist 最小用法——包一层中间件，store 自动读写 localStorage 并按 name 建 key
import { persist } from 'zustand/middleware';
const useStore = create(
  persist(
    (set) => ({ token: '', user: null, setAuth: (t, u) => set({ token: t, user: u }) }),   // 被持久化的业务 store
    { name: 'auth-storage' }   // 存键名；值为 { state, version } 信封
  )
);
// ✅ 刷新后 create 时自动从 localStorage 水合，token/user 不丢
// ❌ name 与其他 store 重名→两份 state 互相覆写同一 key，数据串位
```
默认存 localStorage，key 即 name，值为 `{ state, version }`。

## 二、partialize：只持久化需要的字段

```ts
// 目的：partialize——只挑需要落盘的字段，剔除瞬态与敏感态
{
  name: 'cart',
  partialize: (s) => ({ items: s.items }),   // 只存 items，不存 loading/error 等瞬时态
}
// ✅ 存储体积小、无水合脏态；loading 这类运行态每次从初始值开始才对
// ❌ 不写 partialize 全量存→函数 action 被静默丢弃、loading 旧值也被恢复到新会话
```
避免把 loading/error/瞬态写进存储，也防止敏感字段泄漏。v5 起 persist 要求被持久化的 state 必须可 JSON 序列化——函数、Map、Date 会被静默丢失，用 partialize 剔除或自定义 storage 做序列化。

## 三、version + migrate：schema 升级

```ts
// 目的：version+migrate——改结构就 +version，旧数据逐版本升级到新 schema
{
  name: 'cart',
  version: 2,                                        // 当前 schema 版本
  migrate: (persisted, version) => {                 // 存着的 version 低于当前时被调
    if (version === 0) return { ...persisted, items: [] };    // v0→v1：补 items
    if (version === 1) return { ...persisted, coupon: null }; // v1→v2：补 coupon
    return persisted;
  },
}
// ✅ 升 version + 写纯函数 migrate，老用户无感迁移，配单测
// ❌ 改了结构却不升 version→migrate 不触发，旧 shape 直接当新 shape 用，读 s.coupon 报 undefined 崩
// ❌ migrate 不兜底 persisted 为 undefined→新访客首次进 migrate 抛错，水合失败
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
// 目的：onRehydrateStorage——把“水合完成”变成可订阅时机，水合好才渲染真实 UI
persist(fn, {
  name: 'cart',
  onRehydrateStorage: (state) => (state, error) => {   // 外层水合前调，内层回调在水合后触发
    if (error) report(error); else markReady();   // 水合完成再渲染真实 UI
  },
})
// ✅ 配合 UI 的 ready 标志控制渲染时机，不再用 setTimeout 猜水合时长
// ❌ 外层忘返回内层回调→钩子等于没注册，markReady 永不执行，UI 卡在 loading
```

配合 UI 的 ready 标志，把「水合完成」变成可订阅的渲染时机，替代 setTimeout 猜时长。

## 小结
partialize 控制「存什么」，version+migrate 控制「怎么升」，merge 控制「怎么合」，skipHydration+onRehydrateStorage 控制「SSR 时机」，storage 层控制「存哪、加密、容量」。

## 部署预告
本地把 cart store 的 version 从 1 提到 2 并写 migrate，用 DevTools 手改 localStorage 里的旧数据验证升级路径；生产构建前用 `JSON.parse(localStorage.getItem(key))` 核对实际落盘结构。
