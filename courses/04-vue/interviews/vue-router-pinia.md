# 面试题 · 路由与状态管理

1. **Vue Router 的三种 history 模式？**
   - hash（老）：兼容好、URL 有 #。
   - html5（Web History）：干净 URL，需要服务端 fallback 到 index.html。
   - abstract：非浏览器环境（如 SSR、测试）。

2. **路由守卫有哪几类？执行顺序？**
   全局 before → 路由独属 beforeEnter → 组件内 beforeRouteEnter → 全局 resolve → afterEach。离开时反向。

3. **路由懒加载怎么写？原理？**
   ```js
   component: () => import('@/views/User.vue')
   ```
   构建工具把动态 import 拆成异步 chunk；运行时命中才请求。

4. **Pinia 为什么取代 Vuex？**
   无 mutations、组合式 API 风格、天然 TS 支持、模块化无需手动注册、体积更小、SSR 友好。

5. **Pinia 里 state 与 getters 的关系？如何持久化？**
   state 是响应式数据、getters 是 computed；持久化用 `pinia-plugin-persistedstate` 或手写 watch + localStorage。

6. **如何在 setup 之外使用 store？**
   `import { useUserStore } from '@/stores/user'; const s = useUserStore();` —— 必须在 `app.use(Pinia)` 之后。

7. **keep-alive 和 <RouterView> 的组合？**
   ```vue
   <RouterView v-slot="{ Component }">
     <KeepAlive include="List">
       <component :is="Component" />
     </KeepAlive>
   </RouterView>
   ```
   用 include/exclude 精确控制缓存；组件必须命名。

8. **一次完整「登录后带 token 跳回原页」的流程你会怎么设计？**
   全局 beforeEach → 未登录 & 目标非白名单 → next('/login?redirect=' + to.fullPath)；登录页读取 query.redirect → router.replace 回去。
