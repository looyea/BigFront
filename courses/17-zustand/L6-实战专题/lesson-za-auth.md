# 登录态 store 实战

## 一、store 形状

```ts
// 目的：auth store 形状——token 与 user 同进同退，login 是 async action，pending 态也进 store
interface AuthState {
  token: string | null;                    // 未登录 null，登录写入
  user: User | null;                       // 与 token 同步，杜绝“有 token 没 user”中间帧
  login: (p: Creds) => Promise<void>;      // async action：一次 set 写完 token+user+status
  logout: () => void;                      // 复位初值 + 清 persist
}
// ✅ token/user/status 在一个 action 里一次 set 落定，订阅者看到的每帧都自洽
// ❌ 先 set({token}) 再 set({user}) 分两帧→中间帧“有 token 没 user”，守卫据此放行就渲染空用户崩
```

设计要点：token 与 user 同进同退（一个 action 里一次 set 写完，避免「有 token 没 user」的中间帧）；login 是 async action，pending 态也放 store（`status: 'idle' | 'pending'`），组件订阅 status 渲染按钮 loading。

## 二、token + persist

用 persist 把 token/user 存下来，partialize 只留必要字段；name 用带用户维度的 key 防串号（呼应 za-hydration）。敏感 token 更稳的是 httpOnly cookie，store 只留「是否已登录」标志。

两档方案的取舍背下来：**localStorage token** 实现快、SPA 够用，但要自己面对 XSS 面与过期同步；**httpOnly cookie + 内存 loginState** 安全边界好，但 SSR 首屏判登录态要服务端读 cookie 注水（呼应 za-next-app）。面试答「都不完美，看威胁模型」是加分项。

## 三、axios 拦截器读 token

```ts
// 目的：拦截器 getState 非响应式读 token——请求头注入，401 统一登出（非渲染管线才用 getState）
axios.interceptors.request.use((c) => {
  const t = useAuthStore.getState().token;                 // 拦截器不在组件渲染里，getState 直读最新值
  if (t) c.headers.Authorization = 'Bearer ' + t;          // 有 token 才挂头，避免 'Bearer null'
  return c;
});
axios.interceptors.response.use(r => r, (e) => {
  if (e.response?.status === 401) useAuthStore.getState().logout();   // 过期统一登出
  return Promise.reject(e);
});
// ✅ getState 只用在拦截器/回调这类非渲染管线，读到的是当下最新 snapshot
// ❌ 把 getState() 塞进组件 render 里判 token→它不订阅、变了不重渲，登录态更新界面不跟（渲染期只该用 useStore 订阅）
```
用 getState 非响应式读、401 统一登出（呼应 za-store-api）。

进阶防抖动：401 先尝试 refresh（单飞：用模块级 Promise 缓存，多个 401 共享一次刷新），刷新失败才 logout——否则一个页面 8 个并发请求会触发 8 次登出跳转。

## 四、路由守卫

```tsx
// 目的：路由守卫订阅式判登录——token 变化触发重渲，未登录重定向登录页
function RequireAuth({ children }) {
  const ok = useAuthStore((s) => !!s.token);   // 用 selector 订阅（非 getState），token 变则本组件重渲
  return ok ? children : <Navigate to="/login" replace />;   // 未登录跳走，replace 不留历史
}
// ✅ selector 订阅保证登录/登出即时反映到路由
// ❌ SSR 首帧 token 常尚未 rehydrate→直接重定向会把刷新用户踢到登录页；应先等 ready 标志渲染骨架
```
或 selector canAccess(route)。

SSR 场景下 RequireAuth 首帧 token 可能尚未 rehydrate——加 `ready` 标志（persist onRehydrateStorage 置位，呼应 za-hydration），ready 前渲染骨架而不是重定向，否则会「刷新页面被踢到登录页」的经典 bug。

## 五、登出与跨 tab
logout: setState 初始 + persist.clearStorage；监听 storage/BroadcastChannel 让其他 tab 同步登出（呼应 za-hydration）。SSR 下用 skipHydration 防首屏误判已登录。

## 六、测试姿势

auth store 是纯 JS——单测直接 `makeAuthStore()` 工厂新建，登录流程 mock api（vi.mock 或 msw）断言 token 写入、401 后清空；组件层用 StoreProvider 注入假 store（呼应 za-factory、za-testing-deep）。登录态是最容易被测试遗忘也最容易测的模块。

## 小结
token 存哪看安全等级、拦截器 getState 注入、401 单飞刷新再登出、守卫等 ready 再跳转、登出清存储并跨 tab 同步——五步构成 auth store 的完整闭环。

## 部署预告
本地 json-server 搭一个 401 接口，验证「多并发请求只触发一次 logout」；再双开标签页验证登出同步。与 pinia-auth 对照着写，两家代码几乎同构。
