# SolidStart 路由：文件名就是路由表

> 目标：能手写任意形态的 routes 目录——基本映射、动态/可选/catch-all 段、嵌套布局、index 改名、转义与路由分组、route config——并说清每种文件名约定对应哪个 URL。呼应课业「会用 SolidStart 组织全栈应用」的路由半。

## 一、基本映射：目录树 = URL 树

`FileRoutes`（来自 `@solidjs/start/router`）把 `src/routes` 下的文件映射成路径：

| 文件 | URL |
| --- | --- |
| `src/routes/index.tsx` | `/` |
| `src/routes/about.tsx` | `/about` |
| `src/routes/blog/index.tsx` | `/blog` |
| `src/routes/blog/post.tsx` | `/blog/post` |

规则朴素：**目录=路径段、文件=末段、`index`=该目录本身**。`.mdx` 文件放进步 routes 也按页面路由处理。要成为页面，文件必须 **default export 一个组件**。

## 二、动态段、可选段、catch-all

方括号是参数语法（v2 文档原样）：

| 文件 | URL 形态 | 读取 |
| --- | --- | --- |
| `users/[id].tsx` | `/users/:id` | `useParams().id` |
| `users/[[id]].tsx` | `/users/:id?`（带不带都匹配：`/users`、`/users/abc`） | 同上，可能 undefined |
| `docs/[...slug].tsx` | `/docs/*slug`（任意多段） | `params.slug` 是**剩余段拼成的斜杠字符串**（`foo/baz`） |

```tsx
import { useParams } from "@solidjs/router";
export default function UserPage() {
  const params = useParams();
  return <h1>User {params.id}</h1>;
}
```

## 三、嵌套布局：与目录同名的 .tsx

想让 `/blog/*` 共享一个布局？在 routes 里放一个**与博客目录同名的文件**：
```
routes/
├── blog.tsx              // 布局：渲染 <BlogLayout>{props.children}</BlogLayout>
└── blog/
    ├── article-1.tsx     // /blog/article-1
    └── article-2.tsx     // /blog/article-2
```
布局组件用 `props.children` 落子内容（类型 `RouteSectionProps`）。注意官方提醒：**`blog/index.tsx` 不是布局**——它只服务 `/blog` 这个索引路由本身。整站的"根布局"则挂在 `<Router root={...}>` 的 root 组件上（并记得 Suspense 包 children，因组件自动 lazy）。

## 四、index 改名：别再面对一堆 index.tsx

多个目录各有一个 `index.tsx`，全局搜索时很痛苦。约定：**把 index 文件改名成"所在目录名加圆括号"**——`(socials)/` 目录里的 `routes/socials/(socials).tsx` 仍被当作该路由的默认导出，但文件名可辨识。

## 五、转义与路由分组：组织结构不服从 URL 时

- **转义嵌套**（逃出上一层布局）：想有 `/users/1` 这种嵌套 URL、却**不要** users 布局套下来？把"带名字"的段用括号转义：`routes/users(details)/[id].tsx` → `/users/1`，`users(details)` 是独立路由、不在 `users` 之下（还可以给它自己配 `users(details).tsx` 布局）。
- **路由分组**（组织不影响 URL）：纯目录整理用括号命名夹一层——`routes/(static)/about-us/index.tsx` 仍是 `/about-us`，分组名不进 URL。

两者都是"**文件系统长得像组织结构，URL 长得像产品需求**"的解法。

## 六、route config：路由文件也能导出行为

路由文件除了 default export UI，还能导出 `route` 对象挂**路由级行为**（v2 文档重点）：
```ts
import { type RouteDefinition } from "@solidjs/router";
export const route = {
  preload() { /* 进路由前先热一切 */ },
} satisfies RouteDefinition;
```
`preload` 最典型的用法是把本页数据查询提前发出去（下一关 data 见完整例子）。

## 七、API 路由：同一个目录里的另一半

`src/routes/api/ping.ts` **导出 HTTP 方法名**（`GET`/`POST`…）就成为 `/api/ping` 接口；`<FileRoutes />` 只收 UI 路由、不会把 API 文件塞进页面路由表。UI 之外的 REST/GraphQL/tRPC 端点都住这里（细节 L8 展开）。

## 八、命名速查表

| 想要的效果 | 写法 |
| --- | --- |
| `/`、`/about` | `index.tsx`、`about.tsx` |
| 参数 `/users/:id` | `users/[id].tsx` |
| 可选参数 | `users/[[id]].tsx` |
| 任意后缀 `/docs/*` | `docs/[...slug].tsx` |
| 子树共享布局 | 与目录同名 `blog.tsx` + props.children |
| index 可读命名 | `socials/(socials).tsx` |
| 嵌套 URL 但不套上层布局 | `users(details)/[id].tsx` |
| 目录分组不改 URL | `(static)/about-us/index.tsx` |
| 后端接口 | `api/ping.ts` 导出 `GET`/`POST` |

## 九、自检清单

- [ ] 能不看资料把上表九行默写出来（这是本关的核心肌肉记忆）
- [ ] 能区分 blog.tsx（布局）与 blog/index.tsx（索引页）
- [ ] 会用 useParams 读动态段，知道 catch-all 参数是斜杠拼好的字符串
- [ ] 知道转义 (details) 与分组 (static) 各解决什么组织问题
- [ ] 能写出带 preload 的 route config，并说清 API 路由的识别方式

🚀 **下一站**：数据加载（solidstart-data）——query + createAsync + "use server"，让路由文件自带服务端数据。
