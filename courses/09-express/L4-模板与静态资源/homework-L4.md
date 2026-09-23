# L4 作业：模板引擎 / 静态资源与缓存

> 覆盖：exp-view / exp-static

---

## 一、读代码（10 题）

### 1. 以下代码渲染 GET /user/1 时，模板里能拿到哪些变量？

```js
app.locals.siteName = 'BigFront';
app.use((req, res, next) => { res.locals.now = Date.now(); next(); });
app.get('/user/:id', (req, res) => {
  res.render('user', { id: req.params.id });
});
```

### 2. 这段 EJS 有 XSS 隐患吗？出问题的有哪行？

```html
<h1><%= post.title %></h1>
<div><%- post.htmlContent %></div>
<p>{{ user.comment }}</p>
<a href="<%= req.query.next %>">继续</a>
```

### 3. 为什么这个静态目录配置会让 API 请求变慢？如何优化？

```js
app.use(express.static('public'));   // 放在所有路由最前面，且 public 里文件极多
app.get('/api/heavy', handler);
```

### 4. 阅读响应头，第二次请求该资源浏览器会发起网络请求吗？

```
HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000, immutable
ETag: "a1b2c3"
```

### 5. 下面 `res.render` 和 `res.send` 哪个用错了？为什么？

```js
app.get('/data', (req, res) => {
  res.send(viewEngine.render('index', { list }));   // A
  res.render('index', { list });                     // B
});
```

### 6. 这个缓存配置对 index.html 会造成什么线上事故？

```js
app.use(express.static('dist', { maxAge: '365d' }));
```

### 7. Nunjucks 模板里 `{{ name }}` 和 `{{ name | safe }}` 区别是什么？后者有什么风险？

### 8. 阅读代码，请求 `/about`（无扩展名）能命中 about.html 吗？靠哪个选项？

```js
app.use(express.static('pages', { extensions: ['html'] }));
```

### 9. 集群 3 台机器部署，用户反馈"同一个 js 有时 304 有时 200"，看配置找原因：

```js
app.use(express.static('public', { etag: true }));   // 文件未加 content hash
```

### 10. `res.download('files/a.pdf', '报告.pdf')` 相比 `res.sendFile` 多了什么响应头？效果差异？

---

## 二、手写（5 题）

### 1. 用 EJS + express-ejs-layouts 搭一个最小多页站点：base layout（含 header/footer）+ 两个页面（首页、用户详情）通过 layout 复用。

### 2. 编写一段中间件：对 `/assets/` 下带 hash 的文件设一年 immutable 强缓存，对 `.html` 设 no-cache。

### 3. 用 Nunjucks 模板继承（extends/block）实现 base.html + page.html，页面覆盖 title 和 content 两个 block。

### 4. 写一个 `renderToHtml(view, data)` 工具函数（基于 res.render 回调 or 引擎直接 render），供 nodemailer 发送邮件 HTML 使用。

### 5. 为字体目录 `/fonts` 配置 express.static，带一年缓存 + 允许跨域（Access-Control-Allow-Origin）。

---

## 三、场景题（1 题）

### 1. 你的 SSR 电商站上线灰度后，部分用户反馈"结算页样式全乱、点了没反应"，硬刷新恢复正常，且问题在发版后 5 分钟内集中在某些地区。结合 CDN 缓存 index.html、content hash、Service Worker 更新，分析根因并给出修复方案。

---

## 四、简答题（3 题）

### 1. 简述浏览器一次资源请求从强缓存到协商缓存的完整决策流程。

### 2. 为什么"带 hash 的资源永久缓存 + index.html no-cache"是当前最佳实践？

### 3. EJS、Pug、Nunjucks 各自语法风格与适用场景？你会怎么选？

---

## 五、挑战题（1 题）

### 🏆 构建"模板 + 静态资源"一体化站点

用 Express 5 + EJS 搭建一个多页博客站点：
- 布局系统：统一 layout（导航/页脚/SEO meta），文章页与列表页复用
- 数据驱动：从 JSON 文件读文章列表，`res.render` 注入
- 静态资源：`/assets` 带 hash 资源一年 immutable，HTML no-cache
- 安全：所有用户内容转义输出，开启 CSP，杜绝 SSTI（不把输入拼进模板源码）
- 一个 `/api/rss` 端点用 res.render 回调把模板渲染成 XML 字符串返回
- 附一份"缓存策略说明"文档（哪些 no-cache、哪些一年、为什么）
