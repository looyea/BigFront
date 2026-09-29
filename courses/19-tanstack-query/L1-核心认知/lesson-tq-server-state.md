# 服务器状态：为什么手写 fetch 不够用

## 一、什么是服务器状态

浏览器里的数据其实分两种。**客户端状态**（modal 开没开、主题、表单草稿）由你说了算，存在本地；**服务器状态（server state）**是别人数据的只读镜像——存在服务器上、会随时间过期、多标签页/多用户共享。这个提法是 TanStack Query 作者 Tanner Linsley 立起来的，也是整本书的世界观：**服务器状态需要的是缓存系统，不是又一个 store**。

## 二、手写 fetch + useState 的痛

```tsx
// 目的：手写 fetch+useState 取数——正是 Query 要清偿的「轮子史」反面样本，七个坑见下方正文
const [data, setData] = useState(null);            // 数据本体
const [loading, setLoading] = useState(true);      // 手写 loading 标志
useEffect(() => {
  fetch('/api/todos').then(r => r.json()).then(d => { setData(d); setLoading(false); });  // 卸载后 promise 仍 resolve → setState 报警；不去重、无缓存、有竞态
}, []);   // 然后你会遇到 ↓ 七个躲不掉的坑
// ❌ 整块皆反模式：无 signal / 无缓存 key / 无过期策略——卸载报警、双组件重复请求、返回白屏、快速切参竞态覆盖、过期全靠猜、聚焦不刷新、缓存无人回收
// ✅ 对照下一块：同样需求用 useQuery 声明一次，七件套全部内置
```

七个躲不掉的坑：① 组件卸载后 setState 报警；② 两个组件各取一次，请求不去重；③ 返回上一页没有缓存，白屏再等一次；④ 快速切换参数，后发先至覆盖新值（竞态）；⑤ 数据何时算「过期」全靠猜；⑥ 窗口回来要不要刷新？没人管；⑦ 缓存什么时候丢？内存谁收？——每个坑都能手写解法，七个坑的合集就是一部轮子史。

## 三、Query 的解法：把取数变成声明缓存

```tsx
// 目的：useQuery 声明式取数——queryKey 定缓存身份、queryFn 定怎么取，上面七个坑由库内置接管
import { useQuery } from '@tanstack/react-query';
const { data, isPending, isError } = useQuery({
  queryKey: ['todos'],            // 我是谁（缓存身份，同 key 自动去重、共享一份缓存）
  queryFn: () => fetch('/api/todos').then(r => r.json()), // 怎么取（返回 Promise，resolve 值即 data）
});
// ✅ 声明一次即得：去重 / 缓存 / 过期重取 / 竞态忽略旧值 / 聚焦后台刷新 / 无人订阅自动回收
// ❌ queryKey 漏掉参与身份的变量（如把 userId 落进 ['user']）→ 换 id 仍命中旧缓存，数据永不更新
```

声明一次之后：同 key 请求自动**去重**、结果自动**缓存**、过期自动**重取**、竞态自动**忽略旧值**、窗口聚焦默认**后台刷新**、无人订阅自动**回收**。这就是上面七个坑的标准答案，全部内置。

## 四、不替代状态库，而是分工

Query 只管服务器状态；UI 交互状态仍归 Zustand/Jotai/Pinia 们。把接口数据拷进全局 store「再同步」是最常见的反模式——两份真相、双向搬运、迟早不一致。正确姿势是**三层分工**：服务端缓存归 Query、客户端状态归状态库、表单局部归表单库（za-layers、jo-race 两张分工表在这门课会合，L6 有总决算）。

## 五、装起来

```bash
npm i @tanstack/react-query
```

```tsx
// 目的：应用装配——模块级建一个 QueryClient，用 QueryClientProvider 把缓存所有权显式交给组件树
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const client = new QueryClient();   // 一个应用一个 client（模块级单例适合纯 CSR）
export default function App() { return <QueryClientProvider client={client}><Todos/></QueryClientProvider>; }   // Provider 注入，树内 useQuery 都经它找缓存
// ✅ client 引用稳定：整棵树共享同一份 QueryCache
// ❌ 把 new QueryClient() 写进组件体内 → 每次渲染新建、缓存永远为空（详见 tq-query-client）
```

一个应用一个 client（细节见 tq-query-client 关）。

## 小结
服务器状态=会过期的只读镜像，需要的是缓存系统；Query 用 queryKey+queryFn 两个声明换掉去重/竞态/失效/回收七件套，与客户端状态库是分工不是竞争。

## 部署预告
本地跑一个 todos 页：先用 useEffect 手写版故意制造一次快速切换 id 的竞态事故，再换成 useQuery 观察竞态自动消失，体感一次「轮子债」被清偿。
