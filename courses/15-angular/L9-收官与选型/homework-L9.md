# homework-L9：收官与选型

> 五段式 · 建议用时 120 min · 覆盖 ng-perf / ng-compare / ng-capstone

---

## 第一段：Bug 修复（每题 3 分，共 30 分）

**1.1** angular.json budgets 报 "initial exceeded maximum" 但项目已配 loadChildren。发现 app.config.ts 里 `import { AdminStore } from './features/admin/admin.store'` → 为什么这行让 admin 代码进主包？

**1.2** @defer 块里放了 `<h1>{{ pageTitle }}</h1>` → LCP 变成 5s → 为什么 @defer 不该包含首屏关键文字？

**1.3** zoneless 项目里组件用 `this.data = apiResult`（普通属性赋值）+ OnPush → 视图不更新。改成什么写法？

**1.4** @for 用了 `track $index` → 删除中间一行后表单输入框的焦点跳到了错误位置。修法？

**1.5** 毕业项目 SSR 部署后 signal store 跨请求共享了登录态 → 缺了什么配置？

**1.6** 同事在 computed 里调了 `this.http.get(...)` → 死循环。为什么？数据获取该放哪？

**1.7** 项目 budgets 配了 error=1MB 但 CI 从没拦住 → `ng build` 退出码仍为 0。检查哪里可能没触发 budgets。

**1.8** effect 里 `this.router.navigate(...)` → 每次 CD 都触发导航循环。修法（提示：untracked / afterNextRender）。

**1.9** 四框架对比：React 开发者说"Angular 就是更重没优势"——用 zoneless + signal + budgets 数据反驳（举一条具体场景）。

**1.10** 毕业项目 Lighthouse Accessibility 扣分：modal dialog 打开后焦点还在背景。用什么 CDK 能力修？

---

## 第二段：手写代码（每题 7 分，共 35 分）

**2.1** 配置 angular.json budgets：initial error 800KB/warning 500KB；anyComponentStyle error 4KB/warning 2KB。写出完整 JSON 片段。

**2.2** 写一个 @defer 组合：on viewport 加载推荐位、on idle 预加载 analytics 模块、prefetch on hover 加载导出工具。

**2.3** 给 dashboard 页面设计性能优化方案：列出哪些组件懒加载(loadComponent)、哪些 @defer、哪些首屏直接渲染。文字+代码。

**2.4** 写一段 Angular vs React vs Vue 的"相同 CRUD 功能"对比代码（各 10 行以内核心逻辑）。

**2.5** 设计毕业项目 authInterceptor 的完整代码：从 AuthService 拿 token → clone 加 Bearer → 无 token 直接 next 通过。

**2.6** 写一个 Playwright E2E 测试：登录 → 导航到用户列表 → 点新增 → 填表提交 → 断言列表多一条 → 登出。

**2.7** 用伪代码/文字描述毕业项目记分卡中你如何量化"代码质量 30%"——给出 lint 规则清单 + review 检查点。

---

## 第三段：场景设计（20 分）

**终战设计题**：

一个 SaaS 公司需要「客户管理后台」：

- 3 角色（admin/editor/viewer）权限矩阵
- 客户列表（虚拟滚动 10000+条）
- 客户详情 + 编辑（复杂表单 20 字段 + 异步校验）
- 仪表盘（图表 + 统计卡片 + 实时 WebSocket 推送）
- SSR 首屏（管理后台也要求 SEO——因为带公开帮助文档页）
- 暗色主题 + 品牌色定制
- CI 性能门禁（主包 < 400KB gzip）

要求：用本包全部知识给出**完整技术方案**（目录结构 + 路由 + 守卫 + store 设计 + 表单选型 + @defer 策略 + SSR 配置 + budgets + 测试金字塔）。字数不限、代码+文字混排。

---

## 第四段：简答（每题 5 分，共 15 分）

**4.1** zoneless + signal 模式下 Angular 还剩哪些性能热点？给出三个优化手段。

**4.2** 用四把尺子（响应式模型/编译深度/约定强度/全栈方案）快速评判一个你没学过的新框架。

**4.3** 毕业项目为什么不推荐用 NgRx？在什么条件下你应该改变这个决定？

---

## 第五段：挑战题 🏆（10 分，加分项）

**终极挑战**：写一份「给 CTO 的技术选型备忘录」——公司启动新 SaaS 产品线（预计 50 人团队、10 年生命周期、需要国际化 + 可定制主题 + 移动端 PWA + 私有部署）。

从以下维度对比 Angular/Vue/React + Next.js 三方案：① 人才市场；② 长期维护成本；③ 包体积性能；④ 全栈/SSR 成熟度；⑤ DI/架构约束；⑥ 国际化（i18n）；⑦ 私有部署友好度。

结论给出你的推荐 + 风险 + 缓解策略。800-1500 字。

---

> 🎓 **完成本作业 = 15-angular 全包 27 关毕业。恭喜走完四大框架收官之路！**
