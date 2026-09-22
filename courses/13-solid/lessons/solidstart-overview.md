# SolidStart 上：框架总览与项目结构

> 目标：能说出 SolidStart 在 Solid 生态里的定位、`npm init solid` 之后项目里每个关键文件干什么、配置住在哪、以及"文件即路由"的世界观——为写路由与数据加载打好地基。呼应课业「会用 SolidStart 组织全栈应用」。

## 一、SolidStart 是什么

SolidStart 是 SolidJS 官方元框架（meta-framework）：在 Solid 的细粒度响应式之上，补齐**文件路由、SSR 与水合、按路由自动代码分割、服务端函数、API 路由、部署目标**这些"框架级"能力。本关以 **v2 文档**为底（SolidStart 2.x，要求 **Node.js 24+**）。

## 二、从零起项目

```bash
npm init solid     # 或 pnpm create solid / yarn create solid / bun create solid
```
脚手架会让你**选模板**（basic、bare、with-tailwindcss、with-auth、with-drizzle、with-prisma、with-mdx…）以及是否 SSR/TS；随后：
```bash
npm i
npm run dev        # v1 文档：默认跑在 3000 端口
```
模板已含完整骨架，新项目不要手搬目录。
> 细节备忘：v1 文档交代 `npm run dev` 默认跑在 **3000 端口**；脚手架还会追问是否用 SSR、是否 TypeScript——团队项目建议一次选齐，后续少改配置。

## 三、配置住在 vite.config.ts

v2 的配置入口是 Vite 配置里的 `solidStart()` 插件：
```ts
import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
export default defineConfig({ plugins: [solidStart()] });
```
- 已有中间件？`solidStart({ middleware: "./src/middleware/index.ts" })`；
- 开发期有个**检查错误与服务端函数调用的 toolbar**，不进生产包；想藏掉：`solidStart({ devOverlay: false })`；
- 生产 server 运行时与托管目标由 **Deployment 插件**配置（L8 见）。
> 版本注脚：v1 文档提到其下用 Vinxi（`vinxi dev`）驱动 dev/build；v2 的配置面则明确收敛到 `vite.config.ts`。

## 四、目录结构逐文件拆解

```
public/                 # 公共静态资源（图片、字体…）
src/
├── routes/             # 文件即路由（本关主角）
│   └── index.tsx
├── entry-client.tsx    # 客户端：加载并水合(hydrate)应用——一般不动
├── entry-server.tsx    # 服务端：处理服务端请求——一般不动
└── app.tsx             # HTML 根：客户端与服务端共同的"外壳"
```
- **`src/` 被别名到 `~/`**：`import { db } from "~/lib/db"` 直接解析到 `src/lib/db`，不用写相对路径爬楼；
- **app.tsx 是 shell**：内部挂 `<Router root={...}>` + `<FileRoutes />`，root 里要 **把 `props.children` 包进 `<Suspense />`**——因为**每个路由组件都会被自动 lazy 加载**，官方明说没有 Suspense 可能出现"意外的水合错误"；
- 两个 entry 文件把"客户端水合"与"服务端处理请求"分口，日常业务几乎不碰。

## 五、"文件即路由"的世界观

文件系统路由从 `src/routes` 读文件、生成路由表，两类产物：
- **UI 路由**：文件 **default export 一个组件** → 成为页面（`src/routes/about.tsx` → `/about`）；
- **API 路由**：文件 **导出 HTTP 方法名**（`GET`/`POST`…）→ 成为接口（`src/routes/api/ping.ts` → `/api/ping`）。

`<FileRoutes />` 只收录 UI 路由。具体命名约定下一关展开。

## 六、类型支持

环境类型随 `@solidjs/start/env` 提供，模板没配的话手动加进 tsconfig：
```json
{ "compilerOptions": { "types": ["@solidjs/start/env"] } }
```
这让你在代码里类型安全地读环境变量等运行时信息。

## 七、遇到旧教程时的三个版本对照

1. **配置入口**：看到 `vinxi.config` / `app.config.ts` / “vinxi dev”字样的教程是 v1 世界观，v2 配置在 `vite.config.ts`；
2. **数据层**：v1 时代常用 routeData/load + createResource 手拼，v2 文档的主推范式是 `query` + `createAsync`（下一关展开）；
3. **迁移通道**：官方专设“Migrating from v1”入口，存量项目升级按它走，不要边猜边改。

## 八、和纯 Solid 客户端应用的关系

前六关写的组件/信号/store/Resource **原样可用**——Start 只是多了：路由文件约定、服务端函数（`"use server"`）、query + createAsync 数据加载、SSR/水合与部署。心智：**你写的还是 Solid，Start 负责把它端到端跑起来**。

## 九、自检清单

- [ ] 能说出 `npm init solid` 的模板机制与 v2 对 Node 24+ 的要求
- [ ] 能解释 app.tsx / entry-client / entry-server 三者分工，及 root 里 Suspense 与水合错误的关系
- [ ] 知道配置在 vite.config.ts 的 solidStart()、devOverlay、middleware 选项
- [ ] 会用 `~/` 别名与 `@solidjs/start/env` 类型
- [ ] 能区分 UI 路由（default export）与 API 路由（导出 HTTP 方法名）

🚀 **下一站**：路由（solidstart-routing）——把 routes 目录里的文件名玩成完整的路由表：动态段、嵌套布局、route groups 与 preload。
