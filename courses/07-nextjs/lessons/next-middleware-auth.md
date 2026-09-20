# Middleware 与鉴权

> 目标：请求进入渲染/接口**之前**的第一道闸口——`middleware.ts`。本课讲：执行时机与能力边界（只能 rewrite/redirect/改头，跑在 Edge）、matcher 配置、会话校验的正确姿势（验证而非解析），以及 Next 鉴权的**三层纵深模型**（middleware → 页面/段 → 数据层）。呼应 **exp-server**（中间件管线对照）、**exp-auth**（JWT/session）、**node-https-tls**（信任边界）。

---

## 一、形态与时机

```ts
// middleware.ts（根目录，或 src/ 同级）
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const sid = req.cookies.get('sid')?.value;
  if (!sid && req.nextUrl.pathname.startsWith('/admin')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(url);          // 3xx：到此为止
  }
  const res = NextResponse.next();              // 放行：继续正常管线
  res.headers.set('x-user-anon', sid ? '0' : '1');   // 可加头/改头
  return res;
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],  // 排除静态与接口（正则负向断言）
};
```

要点三条：
1. **每个匹配的请求**（页面、静态资源、API）先过它——位置等于 Express 应用级 `app.use` 的最前段；但它是**边缘运行时**：无 Node API、CPU 时间片极小（毫秒级预算）；
2. **只能"改道"不能"接管"**：合法输出=rewrite（内部换源）、redirect（3xx）、改请求/响应头、自定义 Response——没有"读 DB、写业务"的位置；
3. matcher 是**运行时正则**：写宽了每个图标请求都进你的函数（账单与延迟都涨），写窄了漏防——负向断言模板是标准起手式（呼应 09 包 `path-to-regexp` 的坑位感，Express 5 裸通配符教训同款谨慎）。

---

## 二、鉴权纵深：middleware 排雷，页面/数据层拆弹

**middleware 验证的是"带没带会话"，不是"能不能看这条数据"**——因为边缘环境不方便查库，且权限粒度在业务侧。三层模型：

```text
第1层 middleware：粗筛 —— 无 token 直接 redirect/401；AB/i18n 也放这层
第2层 段/页面    ：layout/page 用 cookies()+session 解析 → 无权则 redirect/notFound
第3层 数据层     ：Action/Handler 内 owner 校验 + 行级条件（最终防线，永远不能省）
```

经典误区："middleware 里判了 `/admin`，里面所有操作都安全了"——攻击者绕过 UI 直接打 Action 端点（L5 上关的"Action=公网端点"在此闭环：**middleware 管不到 Action 的内部语义**）。第 3 层永远在场（呼应 exp-auth 的 IDOR 防线、next-server-actions 防御模板）。

---

## 三、NextAuth/Auth.js：框架级方案的委托模型

```ts
// middleware 侧：只验证 session JWT 的签名与过期，不查库
import { auth } from '@/auth';                 // Auth.js v5 的 edge 安全封装
export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }
});
```

Auth.js 的架构=**把三层拆包**：provider 适配（OAuth/凭证）在 Node 侧回调交换、session 用 JWT（edge 可无库验签）或 database session（需适配器）、回调里做**权限映射**（token 回调把 role 塞进 session）。选型判断：中小团队标准登录=直接用；强定制权限体系=拿它的 provider 生态、自建 session 层（呼应 exp-auth 手搓 JWT 那课——你已懂它内部发生什么）。

---

## 四、middleware 的看家本领清单（鉴权之外）

| 场景 | 手法 |
|---|---|
| i18n 前缀协商 | 读 Accept-Language/cookie → rewrite 到 `/[locale]/...` |
| AB 分流 | cookie 分桶 → rewrite 到变体路由（L2 面试 9 的实现处） |
| 旧 URL 301 | redirect（配合 next.config redirects 静态表分工） |
| 移动端/PDF 爬虫特判 | UA 判断 + rewrite 到专用渲染 |
| 安全头注入 | 响应头 set：CSP、X-Frame-Options、HSTS（呼应 exp-security） |

边界提醒：这些判断都必须是**纯函数级**（无库、轻计算）——一旦发现需要 await 上游接口才能决策，就该挪到第 2 层或改客户端方案。

---

## 五、会话与登出的完整回路

```text
登录页 → Action/Route Handler 校验凭证 → Set-Cookie(httpOnly+sameSite+lax+secure) → redirect 回 from
后续请求 → 浏览器自动携带 → middleware 验存在/验签 → 页面层解出 user → 数据层按 uid 行权限
登出 → Action 清 cookie（maxAge:0）→ redirect('/')  → 敏感页另配 no-store 防缓存回看（L2 面试 9 落地）
```

Cookie 四件套参数一字值千金：httpOnly 防 JS 窃取（XSS 面）、sameSite 防 CSRF 面、secure 防明文链路、path/domain 决定爆炸半径——09 包 exp-auth 的老知识在边缘时代的参数不变（呼应 exp-auth、mp-login 的 token 不下端原则同构）。

---

## 六、自检清单

- [ ] middleware 运行在哪个运行时？三条能力边界？
- [ ] 画三层鉴权纵深，说出每层的输入与失守后果；
- [ ] "middleware 判过 /admin"为什么救不了越权 Action？
- [ ] matcher 为什么标配负向断言？写宽的代价？
- [ ] 登出后防"回退看缓存页"的完整组合拳？

---

## 🚀 部署预告

- L5 收官，鉴权全栈打通：Action 内纵深 + middleware 闸门 + Auth.js 委托。进入 **L6** 体验层——**next-css** 先看样式管线：全局 CSS/CSS Modules/Tailwind 在 RSC 世界的规则没有变化，但 `global.css` 进根 layout 的位置学问不少；
- 本课"会话 JWT edge 验签"在 L8 部署课会碰到密钥管理的尾巴（env 注入 vs 平台 secret）。
