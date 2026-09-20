# 路由组、私有目录与静态约定

> 目标：把目录名里剩下的"魔法字符"清完——路由组 `(marketing)`、私有目录 `_xxx`、扩展匹配 `@slot` 之外的 `(.)`，以及 `public/` 与 `app/` 内特殊文件（favicon/robots/sitemap）。这些不改变运行原理，但决定**目录如何既表达业务结构又不泄漏到 URL**——大型项目的组织生命线。呼应 **next-routing**（段文件全家桶）、**vite L1**（public 目录）、**mp-directory**（分包目录组织对照）。

---

## 一、路由组 (folder)：分组不改 URL

```text
app/
├── (marketing)/            # 官网系：共享营销壳
│   ├── layout.tsx
│   ├── page.tsx            →  /            ← URL 里没有 (marketing)！
│   └── pricing/page.tsx    →  /pricing
└── (shop)/                 # 商城系
    ├── layout.tsx
    └── products/page.tsx   →  /products
```

圆括号目录只做**代码组织与布局作用域**：`(marketing)` 下的页共用营销布局（大 banner+ Footer），`(shop)` 下共用商城布局，而 URL 上完全隐形。

关键规则：**同层不能出现解析为同一 URL 的两个 page**——`(a)/page.tsx` 与 `(b)/page.tsx` 同时存在会直接报错 "You cannot have two parallel pages that resolve to the same path"。这是路由组唯一的高频翻车点：分组是为了分**布局域**，不是分命名空间。

对照：Vue Router 用 `components: { default, sidebar }` 命名视图 + 手工 path 前缀解决"同一批页面不同壳"；Next 用目录括号，声明成本为零（呼应 vue-router-nested-dynamic）。

---

## 二、私有目录 _folder：彻底退出路由系统

```text
app/blog/
├── _components/            # 下划线开头：永远不参与路由解析
│   └── PostCard.tsx
├── _lib/format.ts
└── [slug]/page.tsx
```

`_` 前缀目录/文件**不占 URL、不被扫描**，用来放该路由域的局部组件与工具——相当于"这个文件夹的 private 作用域"。与前几课字符的全表：

| 前缀/包装 | 例 | 影响 URL？ | 用途 |
|---|---|---|---|
| `(group)` | `(auth)` | ❌ 透明 | 分组+布局作用域 |
| `_private` | `_components` | ❌ 不扫描 | 域内私有代码 |
| `[dyn]` | `[slug]` | ✅ 参数段 | 动态匹配 |
| `@slot` | `@modal` | ❌ 槽位 | 并行路由（L2 上关） |
| `(.)int` | `(.)posts` | ✅ 拦截 | 拦截路由 |
| `+api`/route.ts | — | ✅ 接口 | Route Handler（L4） |

面试一句话记忆法：**括号是"隐形或拦截"、下划线是"查无此人"、方括号是"参数"、at 是"插槽"**。

---

## 三、public/ 与 app/ 内的特殊文件

```text
public/robots.txt      →  https://site.com/robots.txt   原样伺服，零处理
public/banner.png      →  /banner.png
app/favicon.ico        →  自动挂 <link rel="icon">
app/robots.ts          →  动态生成 robots（代码写规则，L6 metadata）
app/sitemap.ts         →  动态生成 sitemap.xml
app/opengraph/image.tsx→  该路由分享时动态出 OG 图（真·图片即组件）
```

- `public/` 像 Vite 一样"原样拷贝+静态伺服"，**不参与任何构建优化**（hash、体积检查都没有，改引用不会报错——大坑，呼应 vite L1 对 public 的警告）；
- 页面里要用 public 图片请走 `next/image`（L6 讲它为什么要配 `remotePatterns`/本地 import 的区别）；
- `app/` 内的特殊文件是**路由级元数据**：favicon/robots/sitemap/manifest 都优先从 app 目录解析——把"站点的行政文件"也变成代码管理的对象（对照小程序 app.json 里手工声明 window/权限的思路，呼应 mp-directory）。

---

## 四、URL 规范化与大小写

- URL 全小写短横线是约定也是护栏：`app/UserProfile/` 与 `app/user-profile/` 在某些系统会被视作冲突或产生双 URL（重复内容伤 SEO，呼应 next-render-modes 的收录话题）；
- 尾斜杠：Next 默认 `/blog/` 与 `/blog` 视为同一路由（308 归一），可用 `trailingSlash` 配置全局取向——但**配置要和 CDN/Nginx 规则对齐**，否则来回重定向死循环（node-deploy-perf 的反向代理课回收此梗）；
- `next.config.ts` 的 `assetPrefix/basePath` 处理子路径部署（`/team-app/...`），内网/企业网关常见——改了它，public 与内部链接都要用 `withBasePath` 工具再过一遍。

---

## 五、大型目录组织示范

一个中台项目的 app/ 切法（路由组按**鉴权域**分，而不是按业务名词分）：

```text
app/
├── (public)/          # 无壳：登录、落地、找回密码
├── (console)/         # 带后台壳：layout 里挂侧栏+守卫
│   ├── orders/  ├── users/  ├── reports/
└── api/
    ├── orders/route.ts
    └── stats/route.ts
```

原则：**布局作用域 = 鉴权/体验边界**，同组共享壳与守卫，跨组互不相干——这与 09-express 的"路由按功能域拆 Router 挂载"、06-mp 的主包/分包切分是同一味药（呼应 exp-patterns、mp-subpackage）。

---

## 六、自检清单

- [ ] (group) 会出现在 URL 里吗？它存在的两个意义？
- [ ] 同层两个路由组各有一个 page.tsx 会发生什么？为什么？
- [ ] _components 与 @slot 都不进 URL，区别是什么？
- [ ] public 里的文件改名后，哪类引用不会报错从而埋雷？
- [ ] basePath 部署时要注意什么链接处理？

---

## 🚀 部署预告

- 至此 L2 收官，路由体系完整。进入 **L3**——本包灵魂：**next-server-client** 打开 RSC 黑盒，"这个组件到底在哪跑"从此成为你写每个文件前的第一反应；
- 目录魔法字符表建议贴工位：`( ) _ @ [ ] (.)`，见到没见过的目录名先查表再动手（全表在本课第二节）。
