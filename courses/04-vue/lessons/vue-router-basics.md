# Vue Router 入门

> 目标：SPA 只有一个 HTML，页面切换不能靠浏览器整页跳转，而要**前端路由**——监听 URL 变化、动态渲染对应组件。本课掌握 **`createRouter` + `createWebHistory`/`createWebHashHistory` 的区别与后端回退**、**`<RouterLink>`/`<RouterView>`**、**`useRoute`/`useRouter`（读 vs 导航）**、**声明式与编程式导航、命名路由**、以及路由与"后端真实请求"的关系（呼应 node-http、vue-deploy history fallback、exp 静态回退）。

---

## 一、为什么要前端路由 & 怎么装

MPA：每个 URL 对应服务器一个 HTML，切换即整页刷新。**SPA** 只有一个 `index.html`，靠 JS 监听 URL 变化切换视图组件，不重新加载页面。Vue Router 就是干这个的：

```bash
npm i vue-router        # 本项目已用；配 Vite 即可（呼应 10-vite）
```
```js
// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/views/Home.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/about', name: 'about', component: () => import('@/views/About.vue') }, // 懒加载见 vue-async-suspense
];

export const router = createRouter({
  history: createWebHistory(),   // 用 HTML5 History API
  routes,
});
```
```js
// main.js
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
createApp(App).use(router).mount('#app');
```

---

## 二、history 模式：webHistory vs hash vs memory

| 模式 | URL 长相 | 原理 | 需要后端配合 |
|---|---|---|---|
| `createWebHistory` | `/about` | HTML5 `history.pushState` | ✅ 刷新要**回退到 index.html** |
| `createWebHashHistory` | `/#/about` | `location.hash` + `hashchange` | ❌ `#` 后不发请求 |
| `createMemoryHistory` | 无地址栏 | 内存栈 | SSR/测试用 |

**关键坑**：`createWebHistory` 下用户直接访问/刷新 `/about`，会向服务器**真发请求**，静态服务器没有该文件 → 404。必须配置**回退（fallback）**把所有路径返回 `index.html`：
- Vite dev server 默认已处理；
- Nginx：`try_files $uri $uri/ /index.html;`；
- Express：`app.get('*', (req,res)=>res.sendFile('index.html'))`（呼应 09-express 静态/回退、node-http、vue-deploy）。

hash 模式不需要回退（`#` 后的部分服务器看不到），但 URL 不够干净、锚点语义冲突——现代部署优先 webHistory + 配好回退。

---

## 三、`<RouterLink>` 与 `<RouterView>`

```vue
<nav>
  <RouterLink to="/">首页</RouterLink>
  <RouterLink :to="{ name: 'about' }">关于</RouterLink>   <!-- 命名路由更稳 -->
</nav>
<RouterView />    <!-- 当前匹配路由的组件渲染出口 -->
```
- `<RouterLink>` 渲染成 `<a>` 但**拦截点击做前端导航**（不整页刷新）；`to` 是目标；
- 自动加 **`router-link-active`/`router-link-exact-active`** 类，用于导航高亮（可 `active-class` 自定义，呼应 vue-class-style-transition）；
- `<RouterView>` 是**出口**，路由变了就换里面渲染的组件（嵌套出口见下一关）。

> 为什么不直接写 `<a href="/about">`？原生 `<a>` 会触发**整页加载**，SPA 状态全部丢失。RouterLink 才走客户端路由。

---

## 四、读路由：`useRoute`；导航：`useRouter`

```vue
<script setup>
import { useRoute, useRouter } from 'vue-router';
const route = useRoute();   // 当前路由信息（响应式，只读语义）
const router = useRouter(); // 导航实例（执行跳转）

console.log(route.path, route.params.id, route.query.tab, route.hash);
console.log(route.name, route.meta);        // meta 见 vue-router-guard-lazy
</script>
```
- **`useRoute`**：当前激活路由的**只读**快照（`params`/`query`/`hash`/`fullPath`/`matched`/`meta`），本质是响应式对象，可在 `watch` 里跟随变化重取数（呼应 vue-watch、vue-router-guard-lazy）；
- **`useRouter`**：执行导航与订阅守卫。二者别混：读用 route、动作用 router。

> 用 `<script setup>` 必须在 setup 顶层调用 `useRoute/useRouter`（依赖组件实例，呼应 vue-composables 第一节）。

---

## 五、声明式 vs 编程式导航 & 命名路由

```vue
<!-- 声明式 -->
<RouterLink :to="{ name: 'user', params: { id: 1 }, query: { tab: 'posts' } }">U</RouterLink>
```
```js
// 编程式（useRouter）
router.push('/user/1');                          // 路径
router.push({ name: 'user', params: { id: 1 } }); // 命名路由（推荐，路径改了不用改调用点）
router.replace({ name: 'login' });               // 替换历史（不留后退项，登录重常用）
router.back();                                   // 等价 history.back()
router.go(-2);
```
- **命名路由**（`name` + `:to="{ name }"`）解耦"路径字符串"与"跳转点"，重构友好；
- `push` 新增历史、`replace` 替换当前（如登录后不该回退到登录页）；
- `router.push` 返回 Promise，导航被守卫中断会 reject（见 vue-router-guard-lazy、node-async-errors）。

---

## 六、自检清单

- [ ] SPA 为什么需要前端路由？它切换和 `<a>` 跳转的本质区别？
- [ ] `createWebHistory` 与 `createWebHashHistory` 差别？为什么前者刷新深层路径会 404、怎么解决？
- [ ] `<RouterLink>` 相比 `<a>` 做了什么？active 类怎么来的？
- [ ] `useRoute` 和 `useRouter` 分别用来干嘛？
- [ ] 命名路由好处？`push` 与 `replace` 何时用哪个？

---

## 🚀 部署预告

- history 回退是**部署期必配**项，落到 **vue-deploy（L8）** 的 Nginx/Express 配置，与 **node-http / 09-express** 同源；
- `route.params`/`query` 的读取、`:to="{ name }"` 的传参在下一关 **vue-router-nested-dynamic** 展开为嵌套路由与动态段；
- 本关的"导航被中断会 reject""`watch(route)` 重取数"，将在 **vue-router-guard-lazy** 里与导航守卫、`next`、异步组件懒加载合流。

下一关进入 **vue-router-nested-dynamic**：`children` 嵌套出口、动态 `:id`/catch-all、props 解耦、404 通配，以及 query 与 params 的取舍。
