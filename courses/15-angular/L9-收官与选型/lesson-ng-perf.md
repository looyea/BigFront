# ng-perf：性能实战——bundle 预算、@defer 与渲染诊断

> 目标：angular.json budgets 预算门禁；@defer 按需加载块（on viewport/idle/prefetch 触发器）与路由级懒加载的配合；zoneless+signal 的默认性能面与剩余热点（@for track/OnPush/不可变数据）；DevTools 与 ng inspect 的渲染取证；包体积量级对照 sig-size 的账（呼应 sig-size、sig-perf、vite-ci-perf）

## 一、angular.json budgets：性能门禁

```json
// angular.json
"budgets": [
  { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
  { "type": "anyComponentStyle", "maximumWarning": "2kB", "maximumError": "4kB" }
]
```

- **initial**：主包 JS + CSS 总大小——超标 CI 直接失败（warning 提示、error 阻断构建）
- **anyComponentStyle**：单组件样式体积——防某组件 SCSS 塞了整个 Bootstrap
- **anyScript**：单个懒加载 chunk 上限

与 L1 呼应：新 angular.json 默认已配 500kB warning——很多团队从没改过也没意识到。

## 二、@defer：模板级按需加载

```html
@defer (on viewport) {
  <app-recommendations />
} @placeholder (minimum 500ms) {
  <div class="skeleton"></div>
}

@defer (on idle) {
  <app-footer />
}

@defer (prefetch on hover; on timer(5s)) {
  <app-heavy-modal />
}
```

触发器类型：

| 触发器 | 何时加载 chunk |
|--------|---------------|
| `on viewport` | 滚动到可见区域 |
| `on idle` | hydration 后浏览器空闲 |
| `on hover` | 鼠标悬停父容器 |
| `on timer(Xs)` | 延迟固定秒数 |
| `on interaction` | 用户点击/键盘 |
| `prefetch` | 只下载不渲染 |

配合路由级 loadComponent：路由懒加载控制**页面级**分包；@defer 控制**组件内**更细粒度。

## 三、zoneless + signal 的默认性能面

v21+ zoneless 默认后：
- **不遍历组件树**：旧 zone.js 每次异步都跑一遍完整 CD → O(N) 所有组件；zoneless 只更新 signal 依赖链上的节点 → O(变化量)
- **OnPush 不再是性能优化**：zoneless 下所有组件都是 push-based——OnPush 的历史使命完成（v20+ 默认 OnPush 新组件）
- **computed 惰性**：不被读取的 computed 永不执行

剩余性能热点：
1. **@for track 策略**：`track $index` → 大列表重排时 DOM 全销毁重建；`track item.id` → 复用 DOM。
2. **signal 不可变更新**：`_list.update(list => [...list, x])` → 整个新数组引用；大列表用 `patch`（局部更新）代替 spread。
3. **模板函数调用**：`{{ expensive(item) }}` 每次 CD 都调用——改为 computed。

## 四、DevTools 与 ng inspect

**Chrome Angular DevTools 扩展**：
- Components 树：查看组件层级、signal 值、inputs/outputs
- Profiler：录制渲染 timeline → 看哪个组件 render 最慢
- Budgets：实时显示 bundle 大小 vs 阈值

**ng inspect**（v20+ CLI 命令）：
```bash
ng inspect
# → 列出所有组件的选择器 + 所属模块/懒加载边界
# → 检测未使用的依赖/重复导出
```

**Performance 面板**：
- 长任务（> 50ms）通常来自：大数据 @for 渲染 / 重计算 computed / 同步 localStorage
- 用 `console.time` 在 effect/computed 里打点定位

## 五、包体积优化清单

| 手段 | 效果 | 难度 |
|------|------|------|
| loadComponent/loadChildren | 路由级分包 | 低 |
| @defer 非首屏组件 | 组件级懒加载 | 低 |
| 第三方库按需 import | 避免全量（如 lodash → lodash-es） | 中 |
| tree-shakeable providers | providedIn:'root' 自动 | 低 |
| budgets 门禁 | 团队纪律保证不膨胀 | 低 |
| 图片/字体优化 | CDN + preload + font-display | 中 |
| Nx 库拆分 | 精确 chunk 粒度 | 高 |

## 六、对照 14 包 sig-size 的量级

| 框架 | 最小应用 gzip | 典型中型 SPA |
|------|-------------|-------------|
| Angular v22 zoneless | ~75KB | 200-400KB |
| React 19 | ~45KB | 150-300KB |
| Vue 3.5 | ~35KB | 100-250KB |
| Svelte 5 / Solid 1.9 | ~15KB | 50-150KB |

Angular 因全家桶（Router+Forms+HTTP+DI）基础更重——但 zoneless 去掉了 zone.js 的 ~15KB；@defer 和懒加载可有效控制实际加载量。

## 七、@for track 的性能命门

```html
<!-- ❌ 大列表 track by index → 中间删除导致后续全重渲染 -->
@for (item of items(); track $index) { ... }

<!-- ✅ track by unique id → DOM 复用 -->
@for (item of items(); track item.id) { ... }
```

10K 行数据、删除中间一行：index track → 销毁 9999 个 DOM 再创建 9999；id track → 只删 1 个。

## 八、effect 调度与 afterNextRender

zoneless 下 effect 的执行时机：signal 变 → effect 在当前微任务结束后异步执行 → 不阻塞渲染。

```ts
// 只在浏览器执行（SSR 跳过）
afterNextRender(() => {
  // 操作第三方 DOM 库（ECharts 初始化等）
});
```

`untracked(() => ...)` 在 computed/effect 内读取 signal 但不建立依赖 → 该 signal 变不触发重算。
