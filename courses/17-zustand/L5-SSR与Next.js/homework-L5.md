# L5 作业：SSR 与 Next.js

## 一、知识回顾
1. 为什么 SSR 里全局单例 store 危险，如何 per-request 隔离。
2. skipHydration + rehydrate + skeleton 的配合。
3. RSC / Server Action 与 client store 的边界。

## 二、代码实操
1. 在 Next App Router 里搭 StoreProvider（工厂 + Context），杜绝跨请求泄漏。
2. 给 auth store 配 persist(skipHydration)，用 skeleton 消除首页闪烁。
3. 实现跨标签页登出同步（storage 事件或 BroadcastChannel）。

## 三、思考题
1. 主题持久化怎样做到 SSR 首屏无闪烁？
2. Server Action 改了数据，client store 里那份该怎么更新，为什么不直接 setState？

## 四、延伸阅读
- Next.js App Router：directives / server actions
- Zustand：persist 的 SSR 注意事项

## 五、自查清单
- [ ] store 仅在 client 边界
- [ ] per-request/per-session 工厂隔离
- [ ] persist 配 skipHydration + 骨架
- [ ] 敏感值不入 localStorage、登出 clearStorage
