# 选型收官：Pinia vs Composables vs Pinia Colada

## 判据三问

1. **需要跨组件/页面持久共享？** → Pinia store
2. **需要时间旅行 / 插件 / DevTools？** → Pinia store
3. **需要 store 间组合编排？** → Pinia store

三问都是"否" → **composable** 足够（ref + 导出函数）。

## Pinia vs 纯 Composable

| 维度 | Composable | Pinia |
| --- | --- | --- |
| 作用域 | 每个调用处独立实例 | 全局单例 |
| 持久化 | 需手动 useLocalStorage | 插件自动 |
| DevTools | ❌ | ✅ |
| HMR | 组件级 | store 级 |
| 适合 | 局部逻辑复用 | 全局状态 |

## Pinia Colada：服务端状态新宠

`@pinia/colada`（posva 2025 发布）定位"Vue 数据拉取缓存层"——类似 TanStack Query 但 Pinia 原生集成：

- `useQuery({ key, query })`：声明式数据拉取 + 自动 cache/invalidate/retry
- `useMutation`：mutation + 乐观更新
- 与 Pinia store 互补：store 管客户端状态、colada 管服务端状态

## 选型决策矩阵

| 状态类型 | 推荐方案 |
| --- | --- |
| UI 偏好（主题/侧栏） | Pinia 或 composable |
| 表单草稿 | composable（局部）或 Pinia（跨步） |
| 用户信息/权限 | Pinia store |
| API 列表数据+缓存 | @pinia/colada 或 TanStack Query |
| URL 参数 | vue-router query |
| 组件局部 | ref/reactive |

## 毕业检查清单

- [ ] 所有 store 有明确业务域（无"上帝 store"）
- [ ] action 做异步、getter 做纯派生、无 mutation 残留
- [ ] 持久化策略明确（哪些字段存、哪些不存）
- [ ] SSR 安全（import.meta.client 守卫）
- [ ] 单元测试覆盖核心 store 逻辑
- [ ] DevTools 可追踪（action 命名语义化）

## 与全仓其他包的衔接

- **04-vue**：组件/模板/composable 基础
- **14-signals**：Zustand 对照（Pinia 的 Vue 等价物）
- **08-nuxt**：SSR 水合机制
- **10-vite**：HMR / Vitest 工具链

## 部署预告

包收官——本地 `npm run build` 验证 Pinia 打包体积约 1.2KB gzip。
