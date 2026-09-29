# View Engine 与 EJS/Nunjucks

> 目标：**掌握 Express 模板引擎体系**——配置 view engine、布局（layout）、局部视图（partial）、`res.render()` 数据传递、缓存；理解 SSR 思维与现代前端模板（EJS / Pug / Nunjucks / Handlebars）选型。

---

## 一、什么是模板引擎

后端根据数据 + 模板字符串动态生成 HTML 的机制。请求进来 → 查数据 → 把数据"填"进模板 → 返回完整 HTML。这是 **SSR（服务端渲染）** 最原始的形态——在 SPA 出现之前，整个 Web 都靠它。

Express 本身不带模板引擎，通过统一的 `app.set('view engine', ...)` + `res.render()` 接口对接任意符合约定的引擎（consolidate.js 做了适配层）。

```bash
# 目的：安装模板引擎（任选其一）
npm i ejs            # 或 pug / nunjucks / handlebars
```

---

## 二、配置视图引擎

```js
// 目的：配置视图引擎与模板目录，然后 res.render 把数据填入模板并自动发送 HTML
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));   // ✅ ESM 下需手动还原 __dirname
const app = express();

app.set('view engine', 'ejs');              // ✅ 默认扩展名，render 时可省 .ejs
app.set('views', path.join(__dirname, 'views'));  // ✅ 模板目录（默认 ./views，拼 __dirname 防启动目录不同找错）

app.get('/', (req, res) => {
  res.render('index', { title: '首页', user: { name: 'Alice' } });
  // ✅ 查找 views/index.ejs → 用第二参作数据渲染 → 自动 res.send(html)
});
// ❌ 未装 ejs 或未 set('view engine') → render 时报 “Cannot find module 'ejs'” 或 “No engine (js) for file index”
```

`res.render` 第三参数是回调（拿渲染后的 HTML 字符串，用于邮件/拼接）：

```js
// 目的：第三参为回调时不自动发送，而是拿到渲染好的 HTML 字符串（邮件/拼接场景）
res.render('email', { name: 'Bob' }, (err, html) => {
  if (err) return next(err);   // ✅ 模板语法错会回调 err，必须转给错误中间件
  mailer.send(html);            // ✅ html 是已渲染的完整字符串，自行处理发送
});
// ❌ 传了回调却忘记在成功分支自己发送响应（如又调 res.send）→ 不回调时才会自动 end，传回调后需自己收尾
```

---

## 三、EJS 语法速成

EJS = Embedded JavaScript，模板里直接写 JS，最接近"HTML + `<% %>`"。

```html
<!-- 目的：EJS 模板——区分转义输出/原始输出/控制流；用户内容一律走 <%= %> 防 XSS -->
<!-- views/user.ejs -->
<!DOCTYPE html>
<html>
<head><title><%= title %></title></head>
<body>
  <!-- 输出（HTML 转义）-->
  <h1><%= user.name %></h1>
  <!-- 原始输出（不转义，慎用——XSS）-->
  <%- user.bio %>

  <!-- 逻辑控制（不输出）-->
  <% if (user.admin) { %>
    <span class="badge">管理员</span>
  <% } %>

  <!-- 循环 -->
  <ul>
    <% items.forEach(item => { %>
      <li><%= item.name %> - ¥<%= item.price %></li>
    <% }) %>
  </ul>

  <!-- 包含局部视图 partial -->
  <%- include('partials/header', { nav: menus }) %>
  <%- include('partials/footer') %>
</body>
</html>
```

- `<%= %>` 输出（转义）；`<%- %>` 输出原始（不转义）；`<% %>` 控制流不输出；`<%# %>` 注释。
- **XSS**：用户内容一律用 `<%= %>` 转义；`<%- %>` 只在渲染可信富文本（且已 sanitize）时用。
- ❌ 把用户输入的 `<script>...</script>` 用 `<%- user.bio %>` 直接输出 → 脚本原样注入页面，形成存储型 XSS；改用 `<%= user.bio %>` 会被转义为可见文本。

---

## 四、布局（Layout）

EJS 原生不支持 layout，靠 `express-ejs-layouts`：

```bash
# 目的：安装 EJS 布局插件（EJS 原生无 layout）
npm i express-ejs-layouts
```

```js
// 目的：启用布局中间件并指定主模板
import expressLayouts from 'express-ejs-layouts';
app.use(expressLayouts);              // ✅ 必须在 render 之前注册，否则页面不被包裹
app.set('layout', 'layouts/main');    // ✅ 指向 views/layouts/main.ejs
// ❌ 未 app.use(expressLayouts) 就 set('layout') → 布局不生效，页面直接裸输出
```

```html
<!-- 目的：布局主模板——用 <%- body %> 作为页面内容注入点 -->
<!-- layouts/main.ejs -->
<html>
  <head><title><%= typeof title !== 'undefined' ? title : '默认' %></title></head>
  <body>
    <header>...</header>
    <main><%- body %></main>          <!-- 页面内容注入点 -->
    <footer>...</footer>
  </body>
</html>
```

各页面只提供"内容区"，自动套进 layout。可用 `res.render('page', { layout: false })` 关闭，或 `renderToSection` 填 SEO meta 等。

---

## 五、Pug（旧 Jade）

缩进式模板，简洁但"非 HTML"手感：

```pug
//- 目的：Pug 缩进式模板——靠缩进表层级，= 输出转义值
//- views/index.pug
doctype html
html
  head
    title= title
  body
    h1= user.name
    if user.admin
      span.badge 管理员
    ul
      each item in items
        li= item.name
```

```js
// 目的：切换视图引擎为 pug（render 时自动找 .pug）
app.set('view engine', 'pug');
// ❌ 装了 pug 但没 set('view engine','pug') → render('index') 仍按 ejs 找 index.ejs 而报错
```

优点：简洁、无闭合标签、结构清晰；缺点：缩进敏感、设计稿难直接迁移、报错信息有时不直观。适合追求极简、且团队接受非 HTML 语法的项目。

---

## 六、Nunjucks（Jinja2 风格）

Mozilla 维护，语法接近 Python Jinja2，功能强大（继承、宏、过滤器、命名空间）：

```js
// 目的：把 Nunjucks 接进 Express 引擎链——用 .html 作扩展名
import { Environment } from 'nunjucks';
const env = new Environment(new nunjucks.FileSystemLoader('views'));   // ✅ 从 views 目录加载模板
app.set('view engine', 'html');                                          // ✅ 声明 .html 为默认视图类型
app.engine('html', nunjucks.render);                                     // ✅ 把 .html 绑到 nunjucks 渲染器
// ❌ 只 set('view engine','html') 却未 app.engine('html', ...) → render 时报 “No engine for file”
```

```jinja
{# views/base.html #}
<html>
  <head><title>{% block title %}Base{% endblock %}</title></head>
  <body>{% block content %}{% endblock %}</body>
</html>

{# views/page.html #}
{% extends "base.html" %}
{% block title %}用户详情{% endblock %}
{% block content %}
  <h1>{{ user.name | capitalize }}</h1>
  {% for item in items %}
    <li>{{ item.name }}</li>
  {% else %}
    <p>暂无数据</p>
  {% endfor %}
{% endblock %}
```

`{% extends %}` + `{% block %}` 模板继承（比 include 更 DRY），`{{ x | filter }}` 管道过滤器，是三者中表达能力最强的。适合内容/博客/复杂页面结构。

---

## 七、引擎选型对比

| 引擎 | 语法风格 | 学习曲线 | 适用 |
| --- | --- | --- | --- |
| **EJS** | HTML + `<% %>` | 低 | 快速上手 / 前端熟悉 HTML 的团队 |
| **Pug** | 缩进式 | 中 | 极简 / 讨厌标签闭合 |
| **Nunjucks** | Jinja2 风格 | 中 | 复杂继承 / Python 背景 |
| **Handlebars** | `{{ }}` 逻辑受限 | 低 | 明确要"无逻辑"模板 |

> 现代趋势：纯 API 后端 + 前端框架（Vue/React）SSR，模板引擎用于：邮件、简单多页站、SEO 落地页、admin 后台、非 JS 技术栈团队。

---

## 八、渲染缓存

```js
// 目的：渲染缓存——生产开启避免每次重编模板，开发关闭改了立即生效
app.set('view cache', true);   // ✅ 生产默认开启（NODE_ENV=production）
// ❌ 开发环境手动开 view cache → 改了 .ejs 刷新仍是旧内容，易误判“修改没生效”
```

生产环境把编译后的模板函数缓存，避免每次请求重新 parse 模板。开发关闭（改了立刻生效）。表达式结果、局部数据可在应用层用 LRU cache 再缓存一层。

---

## 九、res.locals 与全局变量

```js
// 目的：把每页都要用的变量挂进渲染上下文—res.locals 请求级、app.locals 应用级
// 每个请求都想传给模板的变量（如当前用户、站点配置）
app.use((req, res, next) => {
  res.locals.user = req.user;               // ✅ 请求级：仅本次响应可见（无串号）
  res.locals.csrfToken = req.csrfToken?.();  // ✅ 可选链：未装 csrf 时为 undefined 不报错
  next();
});
app.locals.siteName = '大前端学院';          // ✅ 应用级：所有渲染共享
// ❌ 把 req.user 等用户数据挂到 app.locals（全局共享）→ 不同请求串号，A 看到 B 的信息
```

模板里直接用 `user` / `siteName`，无需每次 render 手动传。呼应 L3 的 res.locals。

---

## 十、自检清单

- [ ] `res.render` 和 `res.send` 的区别？
- [ ] `<%= %>` 和 `<%- %>` 哪个会导致 XSS 风险？
- [ ] EJS 如何实现布局？靠原生还是插件？
- [ ] Nunjucks 的 extends/block 比 include 好在哪？
- [ ] view cache 为什么生产开、开发关？
- [ ] 什么场景今天还该用模板引擎而非 SPA？

---

## 🚀 部署预告

- **模板编译进容器**：views/ 目录随应用打包进 Docker 镜像（别运行时依赖外部路径）；
- **view cache**：生产 `NODE_ENV=production` 自动开启，务必在部署时正确设置环境变量；
- **CDN 与 HTML**：SSR HTML 通常 `no-cache`（个性化），静态资源走 CDN——为下一关 exp-static 铺垫。

下一关 **exp-static** 详解静态资源服务与缓存策略。
