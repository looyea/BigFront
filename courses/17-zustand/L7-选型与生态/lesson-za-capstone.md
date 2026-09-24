# 收官：团队规范与进阶路线

## 一、封装统一 createStore

```ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
export const createStore = (name, initializer, opts) =>
  create(devtools(persist(immer(initializer), { name, ...opts }), { name }));
```
固定中间件顺序（呼应 za-middleware-chain）与命名。

团队里所有 store 必须从这个工厂出生——persist 可被 opts 关掉，但 devtools 不许关；想加新全局中间件（logger/undo）只改工厂一处，21 个 store 自动升级。

## 二、命名与结构约定
- hook：useXxxStore；selector：selectXxx（集中导出，呼应 za-slices）。
- action 动词、函数式 set；slice 按业务域。

目录基线：`store/<domain>/<domain>Slice.ts + <domain>Selectors.ts`；文件名=导出名=DevTools 里的 name——排查线上问题时，三处同名省掉一半沟通。

## 三、lint / 边界
禁止组件内直接 setState（只经 action）；禁止把 Query 数据拷进 store（呼应 za-layers）；跨 slice 只经 get().action。

落地手段从弱到强：code review 口头约定 → eslint no-restricted-imports 限制 store.setState 直调 → 依赖边界工具（eslint-plugin-boundaries）按目录强制 ui/biz/server 三层。规范能被机器执行才算存在。

## 四、毕业检查清单
- [ ] create 用法与 v5 陷阱清楚（za-create）
- [ ] selector 稳定 + useShallow + 行级订阅（za-selectors-deep）
- [ ] 中间件顺序 + persist 迁移（L2）
- [ ] slices / 多实例 / 分层（L3）
- [ ] 并发安全 / Transition / Suspense 边界（L4）
- [ ] SSR per-request + 水合（L5）
- [ ] 登录/表单/看板实战（L6）
- [ ] 纯 store 测试进 CI（za-testing-deep）

## 五、进阶路线

Valtio（proxy 可变路线）、Jotai（原子）、TanStack Query（服务端态）、React Compiler 优化。

三句预告帮你排优先级：**Valtio** 把「可变写法」推到极致——方法式 action 换 proxy 直改，理解 tradeoff 后回头看 immer 更清醒；**Jotai** 的原子派生图会颠覆你对「store 边界」的认知（见 18-jotai）；**React Compiler** 会自动做组件级 memo，但救不了粗粒度 selector——订阅粒度仍是你的责任（呼应 za-selectors-deep）。

## 六、把 21 关压成一张卡片

读：selector 订阅（渲染期）/ getState（事件期）。写：只经 action、函数式、单帧批量。组织：slice 内聚 + 工厂隔离 + 三层归属。演进：devtools 命名 → persist 版本化 → CI 测粒度。——面试被问「你们团队 Zustand 规范」，这十六个词就是提纲。

## 小结
把 21 关收敛成「封装 + 命名 + 边界 + 清单」四条团队规范，Zustand 学习形成闭环并指向下一步。

## 部署预告
用本关工厂重写 L6 看板的全部 store，跑一遍 eslint 边界规则与 CI 测试；这份「毕业项目」比任何证书都硬。
