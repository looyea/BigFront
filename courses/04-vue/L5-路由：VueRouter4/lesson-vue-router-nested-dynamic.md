# 嵌套路由与动态匹配

> 目标：真实 App 的 URL 是层级的（`/user/42/posts`），组件也应是层级的。本课掌握 **`children` 嵌套路由与 `<RouterView>` 出口**、**动态路由段 `:id` 与 params**、**可选/可重复/catch-all（`:id?`、`:id+`、`:id*`、`/path/:seg(.*)*`）**、**props 解耦（把 params 当 prop 传给组件）**、**嵌套命名出口**、**404 通配 `/:pathMatch(.*)*`**、以及 query 与 params 的取舍。（呼应 vue-router-basics、vue-component-basics props）

---

## 一、嵌套路由：children + 内层 RouterView

```js
const routes = [
  {
    path: '/user/:id', component: UserLayout,
    children: [
      { path: '',        component: UserHome },        // 默认子路由：/user/42
      { path: 'posts',   component: UserPosts },       // /user/42/posts
      { path: 'posts/:pid', component: UserPost },     // /user/42/posts/7
    ],
  },
];
```
```vue
<!-- UserLayout.vue：外层布局里放一个出口给子路由 -->
<template>
  <aside>用户 {{ $route.params.id }} 的侧栏</aside>
  <RouterView />          <!-- 匹配到的子路由渲染在这里 -->
</template>
```
- **子 `path` 不带前导 `/`**（相对父级）；`path: ''` 是**默认子路由**（父路径命中即渲染它）；
- 每层组件各放自己的 `<RouterView>`，形成**层层出口**（呼应 vue-router-basics 第三节、vue-component-basics）。

---

## 二、动态路由段与 props 解耦

`/user/:id` 把 `id` 收进 `route.params.id`。组件里**直接读 `$route` 会让它和路由耦合**，推荐 **`props: true` 把 params 变 props**：

```js
{ path: '/user/:id', component: User, props: true }   // params 自动作为 props 传入
```
```vue
<!-- User.vue -->
<script setup>
defineProps({ id: String });   // 直接用 id，组件不依赖 route，可复用/可测
</script>
```
进阶：`props: route => ({ id: route.params.id, tab: route.query.tab })` 自定义映射（呼应 vue-component-basics props 单向流、vue-testing 可测性）。

---

## 三、可选、可重复、catch-all 参数

| 写法 | 匹配 | params |
|---|---|---|
| `/users/:id?` | `/users`、`/users/5` | `id` 可选 |
| `/files/:name+` | 至少一段 | `name` 为数组 |
| `/files/:name*` | 零或多段 | `name` 数组/可空 |
| `/:pathMatch(.*)*` | **任意未匹配（404）** | `pathMatch` 数组 |

```js
// 404 通配（Vue Router 4 语法）
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
```
匹配优先级：静态 > 带正则的动态 > 动态 > 通配。**catch-all 必须放在 routes 数组最后**，否则会先吞掉其它路由。

---

## 四、命名视图与嵌套命名出口

一层里想并排渲染多个组件（侧栏、主体）：

```js
{
  path: '/dash',
  components: { default: Main, sidebar: Side },   // 命名组件
}
```
```vue
<RouterView />                       <!-- default -->
<RouterView name="sidebar" />        <!-- 指定出口 -->
```
配合 `children` 的嵌套命名出口，可以构建复杂布局（主区+多面板）（呼应 vue-router-basics interview 第 6 题）。

---

## 五、query 与 params 怎么选

- **params**：标识"资源身份"、参与路径结构（`/user/42`），**要求路由定义里有 `:id`**；刷新/分享保持；
- **query**：过滤、分页、排序、tab 等**附加状态**（`?page=2&sort=asc`），不必在 path 声明、可任意增删：
```js
router.push({ path: '/list', query: { page: 2 } });
// 读：route.query.page（注意都是字符串，需转数值）
```
经验：**层级身份用 params、非层级筛选态用 query**（呼应 vue-state-patterns：URL 也是状态来源）。query 值永远是字符串/数组，别当 number 用。

---

## 六、路由复用的坑：同组件不同参数

`/user/1` → `/user/2` 命中同一组件，Vue Router **复用实例、不重新挂载**，`onMounted` 不再跑。三种解法（呼应 vue-router-basics interview 第 12 题、vue-lifecycle）：
```js
// 1) watch 参数变化重取数
watch(() => route.params.id, load, { immediate: true });
// 2) 给出口加 key 强制重建组件
<RouterView :key="$route.fullPath" />
// 3) 组件内 beforeRouteUpdate 守卫（见下一关）
```

---

## 七、自检清单

- [ ] 子路由 path 为什么要用相对、`path:''` 表示什么？
- [ ] `props: true` 解决什么问题？和直接读 `$route` 比好处在哪？
- [ ] `:id?`、`:name+`、catch-all 分别匹配什么？catch-all 为什么放最后？
- [ ] params 和 query 分别在什么场景用？query 值类型要注意什么？
- [ ] 同组件切换参数时为什么会"数据不更新"？三种解法？

---

## 🚀 部署预告

- `props: true` 让路由组件回归"普通受 props 驱动的组件"，可测性对接 **vue-testing（L7）**；
- 动态段 + catch-all 是 SPA 深层直链的地基，刷新回退依赖 **vue-deploy（L8）** 的服务器配置（呼应本包 vue-router-basics 第二节）；
- "同组件参数复用"的第三解法 `beforeRouteUpdate`、以及鉴权用的 `meta`+全局守卫，正是下一关 **vue-router-guard-lazy** 的核心。

下一关进入 **vue-router-guard-lazy**：导航守卫的三种作用域与执行顺序、`next`/返回值的导航控制、`meta` 驱动的鉴权重定向、滚动行为，以及路由懒加载与分包。
