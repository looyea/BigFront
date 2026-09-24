# 数据生命周期：staleTime 与 gcTime

## 一、一块缓存的三段人生

每条查询一生只有三个位置：**fresh（新鲜）→ stale（陈旧）→ garbage collected（已回收）**。两只时钟各管一段：

- **staleTime**：数据出生后多久变「陈旧」。陈旧≠删除，只是「下次被用到时该重取」。默认 **0**——出生即陈旧。
- **gcTime**：订阅数归零后多久被丢出内存。默认 **5 分钟**（v4 叫 cacheTime）。回收才是真没了。

```
 挂载取数 ──staleTime到──> 变stale ──(有人再读)──> 后台重取
                          └──(无人订阅)──gcTime到──> 内存回收
```

## 二、「陈旧」何时被兑现成重取

stale 只是标记，重取要触发时机：**组件挂载**（refetchOnMount）、**窗口聚焦**（refetchOnWindowFocus）、**网络恢复**、**invalidate/refetch 手动**。所以 staleTime:0 + 挂载即 stale = 「每次挂载都发请求」——官方 important-defaults 页面明说这是激进保新鲜、按应用调优的起点。

## 三、两个时间的调优手册

| 数据形态 | staleTime | 理由 |
|---|---|---|
| 股价/在线人数 | 0~2s（配 refetchInterval） | 秒级时效 |
| 列表/详情常规业务 | 1~10min | 平衡新鲜与请求量 |
| 用户名/头像 | 1h+ | 一天变不了几次 |
| 配置/字典/静态 JSON | Infinity | 永不重取，配 initialData 更狠 |

gcTime 几乎不用动；做「返回秒出」体验的列表 App 可加大到 30min+，让短暂离开的页面回来仍命中。

## 四、一个常见误区：「缓存 5 分钟就没了」

staleTime:0 的应用里，第二次进详情页依然白屏——这不是 gcTime 太短，而是数据**一直 stale**，挂载必然重取；缓存其实命中过（isPreviousData/短暂旧数据可见），只是策略要求再验证。治法是加 staleTime，不是调 gcTime。**新鲜度策略与内存策略是两条正交的轴**，背下来。

## 五、观察实验（三十秒看穿）

```tsx
useQuery({ queryKey: ['now'], queryFn: () => Date.now(), staleTime: 5_000 });
```

devtools 面板里盯 status 列：fresh 期切换组件秒出旧值；5 秒后变 stale，下次挂载才见新值；全部卸载 5 分钟后条目从面板消失（GC）。三个现象对应三节内容，一次跑通。

## 小结
双时钟模型：staleTime 管「要不要再验证」，gcTime 管「还占不占内存」；重取只在 stale+触发时机同时成立时发生；调优先动 staleTime，gcTime 是内存层面的配角。

## 部署预告
按「调优手册」表给手头四类数据各配 staleTime，用 DevTools 面板逐一验证 fresh/stale/GC 三态；再把 refetchOnWindowFocus 关掉对比一次切 tab 回来的请求数差异。
