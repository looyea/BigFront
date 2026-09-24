# Hydration 模式与跨端持久化

## 一、两种水合困境

1. **首屏无值**：SSR 渲染时 store 是初始值，客户端才有真实数据 → 内容跳动。
2. **值不一致**：persist 客户端读到旧值与服务端 HTML 不符 → mismatch 报错。

React 19 对 mismatch 更严格：文本不一致直接清掉整棵子树客户端重渲染（日志里 "Hydration failed because the initial UI..."），比「闪一下」严重得多。

## 二、对策：skeleton + 延迟注入

```tsx
const [ready, setReady] = useState(false);
useEffect(() => { useStore.persist.rehydrate(); setReady(true); }, []);
return ready ? <RealUI/> : <Skeleton/>;
```
首帧统一渲染 skeleton，水合完成后切换真实 UI，规避 mismatch。

变体：用 `useSyncExternalStore(store.subscribe, sel, serverSel)` 的第三参给服务端快照，让「服务端/首帧」固定渲染默认值，第二帧再真实——原理同上，粒度更细。

## 三、getStorage 双适配（Cookie / localStorage）
SSR 能读的是 Cookie。自定义 storage：server 用 cookie、client 用 localStorage，实现「服务端可读的首屏偏好」：

```ts
storage: createJSONStorage(() => (typeof window === 'undefined' ? cookieStorage : localStorage))
```

theme 类偏好的业界更优解是「一行阻塞 script 提前改 html class」（next-themes 原理），完全不经过 React——SSR 直出的就是正确主题，零闪烁零水合负担（呼应 07-nextjs、08-nuxt 的主题方案）。

## 四、跨标签页同步
监听 `storage` 事件或 BroadcastChannel，一个 tab 改 persist → 其他 tab setState 更新：

```ts
window.addEventListener('storage', (e) => {
  if (e.key === 'auth-storage') useAuthStore.persist.rehydrate();
});
```

storage 事件只在**其他**标签页触发（本 tab 不触发，天然防回声）；同源 iframe 也算其他 browsing context。结构复杂的同步用 BroadcastChannel 自定协议（发 action 名而非全量 state，避免 merge 打架）。

## 五、登出清存储
store.persist.clearStorage() 同时清内存与存储，防止 token 残留（呼应 pinia-auth）。

安全提醒：token 放 localStorage 有 XSS 面；高安全场景走 httpOnly cookie，store 只留 loginState 标志（呼应 za-auth）。多用户共用一台设备时给 persist key 加用户 id 命名空间，防止 A 的草稿出现在 B 的会话里。

## 六、时间旅行式排错

出现 mismatch 先三问：① 该值服务端存在吗（window/storage/Math.random/Intl 时区）？② 首帧两边一致吗？③ 谁先谁后（effect 时序）？把「只有客户端有」的读取全部推到 ready 标志之后，90% 的水合报错消失。

## 小结
skeleton 化解首屏跳动、cookie storage 换服务端可读、storage 事件/BroadcastChannel 做跨标签同步、clearStorage 干净登出；mismatch 排错按「服务端存在性」三问走。

## 部署预告
本地双开标签页验证登出同步；再故意把 `new Date().toLocaleString()` 渲染进 SSR 页面复现 mismatch，然后用「二、对策」两种方式各修一遍。
