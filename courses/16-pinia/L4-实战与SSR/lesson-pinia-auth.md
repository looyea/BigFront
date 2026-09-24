# 登录态与权限 store

## 核心需求

登录态是全局状态：token、用户信息、权限列表——跨路由/组件共享，刷新保持，登出清除。

## 实现

```ts
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);
  const permissions = ref<string[]>([]);

  const isLoggedIn = computed(() => !!token.value);

  async function login(username: string, password: string) {
    const { access_token, user: u, perms } = await api.post('/auth/login', { username, password });
    token.value = access_token;
    user.value = u;
    permissions.value = perms;
    localStorage.setItem('token', access_token); // 持久化
  }

  function logout() {
    token.value = null;
    user.value = null;
    permissions.value = [];
    localStorage.removeItem('token');
    router.push('/login');
  }

  function hasPerm(perm: string) {
    return permissions.value.includes(perm);
  }

  return { token, user, permissions, isLoggedIn, login, logout, hasPerm };
});
```

## axios 拦截器联动

```ts
// api/http.ts
import { useAuthStore } from '@/stores/auth';

http.interceptors.request.use((config) => {
  const auth = useAuthStore(); // action 外调用需 pinia 已就绪
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`;
  return config;
});

http.interceptors.response.use(undefined, (err) => {
  if (err.response?.status === 401) {
    useAuthStore().logout(); // token 过期强制登出
  }
  return Promise.reject(err);
});
```

> **注意**：拦截器文件在 pinia 注册前 import 会报 `getActivePinia()` 错误——用 `markRaw` 或把 `useAuthStore()` 放在拦截器回调函数体内（延迟调用）。

## 路由守卫

```ts
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});
```

## 登出清场

- 清 token → localStorage → Pinia state
- 跳登录页
- 清除所有其他 store 的缓存数据（`pinia.state.value = {}` 重置所有 store state）

## 跨标签页同步

```ts
window.addEventListener('storage', (e) => {
  if (e.key === 'token' && !e.newValue) {
    useAuthStore().logout(); // 其他 tab 登出时同步
  }
});
```

## 部署预告

本地 `npm create vue@latest` + 一个 mock 登录接口（如 json-server）。验证：登录后刷新保持、登出跳转、401 自动踢出。
