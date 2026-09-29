# 登录态与权限 store

## 核心需求

登录态是全局状态：token、用户信息、权限列表——跨路由/组件共享，刷新保持，登出清除。

## 实现

```ts
// 目的：登录态 store——token/用户/权限集中管理，刷新从 localStorage 恢复，登出清空
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));   // 初始从本地存储恢复，刷新保持登录
  const user = ref<User | null>(null);
  const permissions = ref<string[]>([]);

  const isLoggedIn = computed(() => !!token.value);   // 有 token 即登录态

  async function login(username: string, password: string) {
    const { access_token, user: u, perms } = await api.post('/auth/login', { username, password });
    token.value = access_token;
    user.value = u;
    permissions.value = perms;
    localStorage.setItem('token', access_token); // 持久化（user/perms 未存，刷新后需重拉）
  }

  function logout() {
    token.value = null;
    user.value = null;
    permissions.value = [];
    localStorage.removeItem('token');
    router.push('/login');   // router 应延迟到函数体内取，避免顶层 undefined
  }

  function hasPerm(perm: string) {
    return permissions.value.includes(perm);   // 细粒度权限判断
  }

  return { token, user, permissions, isLoggedIn, login, logout, hasPerm };
});
// ✅ 登录写 token+localStorage，刷新时初始值恢复→登录态不丢
// ❌ 只存 token 不存 user/perms，又不在启动时重拉→刷新后 isLoggedIn 真但 permissions 空，页面报错
```

## axios 拦截器联动

```ts
// 目的：axios 拦截器与 auth store 联动——请求自动带 token，401 强制登出
// api/http.ts
import { useAuthStore } from '@/stores/auth';

http.interceptors.request.use((config) => {
  const auth = useAuthStore(); // 在回调体内才调（延迟到 pinia 已就绪），不能放模块顶层
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`;   // 每个请求自动注 token
  return config;
});

http.interceptors.response.use(undefined, (err) => {
  if (err.response?.status === 401) {
    useAuthStore().logout(); // token 过期强制登出
  }
  return Promise.reject(err);
});
// ✅ useAuthStore() 写在拦截器回调体内→执行时 pinia 已注册，拿得到实例
// ❌ 在拦截器文件顶层直接 const auth = useAuthStore()→pinia 未注册时报 getActivePinia() no active Pinia
```

> **注意**：拦截器文件在 pinia 注册前 import 会报 `getActivePinia()` 错误——用 `markRaw` 或把 `useAuthStore()` 放在拦截器回调函数体内（延迟调用）。

## 路由守卫

```ts
// 目的：全局路由守卫——需登录的页未登录时重定向到 login 并带上回跳地址
router.beforeEach((to) => {
  const auth = useAuthStore();   // 守卫执行时 pinia 已就绪，可安全取 store
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };   // 登录后可按 redirect 回原页
  }
});
// ✅ 未登录访问受限页→跳登录且记住来路，登录后 router.push(route.query.redirect) 回去
// ❌ 只拦 requiresAuth 却不处理“已登录又去 /login”→已登录还能重复看登录页
```

## 登出清场

- 清 token → localStorage → Pinia state
- 跳登录页
- 清除所有其他 store 的缓存数据（`pinia.state.value = {}` 重置所有 store state）

## 跨标签页同步

```ts
// 目的：跨标签页同步登出——监听 storage 事件，任一处清除 token 就全局登出
window.addEventListener('storage', (e) => {   // storage 事件只在“其他同源标签页”修改时触发
  if (e.key === 'token' && !e.newValue) {
    useAuthStore().logout(); // 其他 tab 登出时同步
  }
});
// ✅ A 标签登出清 token→B 标签收到 storage 事件同步登出，多标签一致
// ❌ 误以为 storage 事件会在修改它自己的标签页触发→当前 tab 听不到自己的改动，需另外主动 logout
```

## 部署预告

本地 `npm create vue@latest` + 一个 mock 登录接口（如 json-server）。验证：登录后刷新保持、登出跳转、401 自动踢出。
