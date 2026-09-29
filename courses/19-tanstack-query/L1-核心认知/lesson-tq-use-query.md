# useQuery 初体验

## 一、两要素：queryKey + queryFn

```tsx
// 目的：useQuery 两要素最小用法——queryKey 数组定身份、queryFn 收 context 取数并把 signal 透传给 fetch
const { data } = useQuery({
  queryKey: ['user', userId],          // 缓存身份，必填；数组可前缀匹配，userId 参与身份才能“换 id 重取”
  queryFn: async ({ queryKey, signal }) => {   // 怎么取，必填（除 initialData）；从 context 解出 key 与取消信号
    const r = await fetch('/api/user/' + queryKey[1], { signal });   // signal 透传给 fetch，查询被取消时请求随之中断
    return r.json();
  },
});
// ✅ 应用：queryFn 里非 2xx 自己 throw，错误才会进 error 分支（Query 只在 reject 时算失败）
// ❌ fetch 不判 res.ok：4xx/5xx 也 resolve 成“成功”，错误被当数据吞掉
```

queryKey 是数组不是字符串——序列化后作缓存主键，还能前缀匹配（tq-query-key 专讲）；queryFn 收到 context：{queryKey, signal, client, meta}，**signal 记得透传给 fetch**，取消能力就靠它（tq-cancel 专讲）。

## 二、返回值速览

| 成员 | 含义 |
|---|---|
| data / error | 最近一次成功数据 / 错误对象 |
| isPending | 还没成功过（首次取数中或等待） |
| isSuccess / isError | 状态细分 |
| isFetching | **任何**进行中请求（含后台重取） |
| isLoading | isPending && isFetching |
| dataUpdatedAt | 最近成功时间戳 |

三个「看着像」的标志：isPending 管「有没有数据」、isFetching 管「有没有在请求」、isLoading 是两者交集——后台刷新时 isFetching=true 而 isLoading=false，这就是「陈旧-而-有效」UI 的原料。

## 三、v5 的两维状态模型

status 描述**数据**（pending/success/error），fetchStatus 描述**请求**（fetching/paused/idle）。二维组合出全部 UI 场景：有数据+在取=右上角小转圈；无数据+暂停(enabled false)=骨架都不给。背下这个矩阵，一切 isXxx 都不懵。

## 四、默认行为即策略

首次挂载就取（refetchOnMount: true 配 staleTime:0 ⇒ 挂载必重取）、窗口聚焦重取（refetchOnWindowFocus: true）、失败重试 3 次指数退避。「激进的新鲜度」默认值适合开发期；生产按数据时效性调 staleTime（tq-lifecycle 专讲）——**默认值不是最佳答案，是安全答案**。

## 五、写组件的习惯

```tsx
// 目的：三态早返回的书写习惯——pending/error 先返回，主路径 data 天然非空
if (isPending) return <Skeleton/>;                    // 还没成功过：骨架
if (isError) return <Error msg={error.message}/>;   // 失败：错误 UI
return <List items={data}/>;                         // 成功：data 已由 TS 自动收窄为非空
// ✅ 先窄后宽早返回，末行 data 类型被收窄，无需 data! 或可选链
// ❌ 不判空直接 return <List items={data}/> → 首取时 data 为 undefined 组件崩
```

先窄后宽：pending/error 早返回，主渲染路径拿到的 data 天然非空（配合 TS 泛型，data 类型在 success 分支自动收窄，见官方 TypeScript 指南）。

## 小结
useQuery=queryKey+queryFn 的声明式缓存取数；status 管数据、fetchStatus 管请求，isLoading 是交集；signal 透传、默认策略心里有数，第一课就毕业了。

## 部署预告
本地做一个用户页：useQuery 取 /api/user/:id，切换 id 观察 Network 面板的去重与竞态处理；故意让接口 500，数一数默认重试几次、间隔多少。
