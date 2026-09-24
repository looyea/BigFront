# RSC 与 Client Component 边界

## 一、RSC 不能 import zustand

RSC（服务端组件）没有 React 运行时 hook，也拿不到浏览器存储——不能直接 import 使用 `useXxxStore`。store 必须待在 `'use client'` 边界内。

注意「不能 import」的精确含义：订阅 hook 不能在服务端跑；纯 vanilla store 的**函数定义**可以被服务端 import（比如共用校验/格式化工具），只要不读写 React 订阅即可。

## 二、Server Action 里读写 store？

Server Action 运行在服务器，同样无法访问浏览器里的 client store 实例。若要「服务端改状态后通知客户端」，通过：
1. Action 返回新数据 → Query 失效/重取；
2. 或下发一个「待水合值」由 client effect setState。

```tsx
'use server';
export async function rename(name) { await db.update(name); revalidatePath('/'); }
// client: const pending = useTransition(); 提交后靠 RSC 重渲染带回新数据
```

「action 里偷偷 set 客户端 store」的幻觉来自 SPA 经验——Server Action 是 HTTP 请求，跟浏览器内存里的 store 是两个世界。

## 三、server 下发 → client 注入模式

```tsx
// page.server
<ClientWidget initial={await fetchConfig()} />
// ClientWidget: useEffect(()=>store.setState({config:initial}),[])
```
服务端取数、客户端注入 store，边界清晰。

注入只做「初始化」；后续同步靠 Query invalidation 或 Router Refresh，别在 effect 里轮询对账——那是双真相源在互相打架（呼应 za-layers）。

## 四、useSyncExternalStore.server

外部 store 在 SSR 需提供稳定 server snapshot（getServerSnapshot），否则水合期读客户端值不一致（呼应 za-sync-external）。

推论：任何「值只在浏览器存在」的 selector（localStorage、window.innerWidth）都会造成 server/client 两帧不同——要么初始渲染占位，要么放到 effect 之后再显示真实值。

## 五、client 边界的最小化

`'use client` 是子树传染的：入口文件一旦标注，其 import 图全部进客户端 bundle。实践：把 store 模块与组件都放 client 目录，RSC 页面只 import「展示型 server 组件 + 少量 ClientIsland」；用 `ANALYZE=1`（next-bundle-analyzer）盯 client chunk 是否被 store 连带拖大。

## 六、三层组合建议

RSC 负责读、Query 负责服务端态缓存、Zustand 负责跨组件交互态——三层在 Next 里各就各位。

一句话分工表：首屏要快 → RSC 直出；数据要新 → Query；交互要顺 → Zustand。哪个诉求主导就把对应层放主路径，其余两层做辅助，不抢写路径。

## 小结
认清 client/server 边界：store 只在 client；服务端数据下发后一次性注入；异步失效交给 Query/Router Refresh；client 边界越小，bundle 与水合越健康。

## 部署预告
本地 Next App Router 里故意在 server component import 一个 create store 触顶报错，再用 ClientIsland + initial props 注入修复；跑 ANALYZE 对比边界收缩前后的 client bundle 体积。
