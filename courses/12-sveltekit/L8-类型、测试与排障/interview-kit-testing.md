# kit-testing 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 为什么说 SvelteKit 的 load/action/handle "天生好测"？
**来源**：可测性红利开场题的转述。

它们都是"吃一个类 event 对象、吐一个返回值"的导出函数：`load(event)→数据`、`action(event)→返回/fail`、`handle({event,resolve})→Response`，不依赖组件实例也不依赖 DOM。单测里直接 import、手工构造 event 桩调用断言返回即可，无需渲染。

### 2. (A) 用 Vitest 做单测和做组件测，配置上有何不同？
**来源**：Vitest 配置题的转述。

纯逻辑单测 Node 环境即可。组件测要模拟 DOM：装 `jsdom`、`test.environment:'jsdom'`，并配 `resolve.conditions:['browser']` 让 Vitest 在 Node 里走包的 browser 入口；用 `mount`/`unmount` 或 `@testing-library/svelte` 的 `render`。接入可用 `npx sv add vitest`。

### 3. (B) 测试文件里用 $state/$derived 报编译错，为什么？
**来源**：runes 测试坑题的转述。

Vitest 按源码规则处理测试文件，runes 只在文件名含 `.svelte` 时才被编译支持。把文件改成 `xxx.svelte.test.ts` 即可用 runes。

### 4. (A) `$app/environment`/`$app/server` 这类模块在裸 Vitest 里为什么会挂？怎么测依赖它们的代码？
**来源**：虚拟模块 mock 题的转述。

它们是 Kit 运行期注入的虚拟模块，纯 Node/裸 Vitest 解析不到或其行为依赖真实导航/请求上下文。用 `vi.mock('$app/environment', () => ({ browser:true, ... }))` 顶替。原则：能经被测函数的 event 参数拿到的优先传桩，别 mock——更贴合纯函数红利；只有硬 import 了 `$app/*` 的既有代码才 mock。

### 5. (C) 为什么 `$env/dynamic/*` 比 `$env/static/*` 更适合在测试里喂假值？
**来源**：env 可测性对比题的转述。

`$env/static/*` 在构建期被静态替换成字面量（可 DCE），值锁定为构建时环境，测试改 `process.env` 无效；`$env/dynamic/*` 运行期读取，可临时改 `process.env` 或 mock 该模块注入假值。追求可测的配置项宜走 dynamic 或经参数注入。

### 6. (D) 给一个"依赖数据库的用户查询 server load"设计单测（不落真库）。
**来源**：单测设计题的转述。

把 db 依赖做成可注入：server load 里 `import { db } from '$lib/server/db'`，测试用 `vi.mock('$lib/server/db', () => ({ db: { findUser: vi.fn(async()=>({id:'1',name:'A'})) } }))`，再 `const data = await load({ params:{id:'1'}, locals:{user:{...}}, cookies:桩, fetch:桩, depends:桩 })`，断言 `data.user.name==='A'` 且 `db.findUser` 被以 1 调用。核心：桩掉外部 I/O、只验本函数逻辑。

### 7. (A) e2e（Playwright）测的是单测/组件测测不到的什么？
**来源**：测试分层价值题的转述。

e2e 从用户视角跑完整应用：SSR 出 HTML→浏览器水合→交互→客户端导航，这条**跨端链路**是单测/组件测看不到的。水合不一致（hydration mismatch）、导航后状态、action 提交后重渲染、cookie/重定向全流程、真实错误页——只有 e2e 能覆盖。

### 8. (B) Playwright 的 webServer 为什么配 `build && preview` 而不是 `dev`？
**来源**：e2e 环境题的转述。

要测生产渲染路径：`vite dev` 的模块图/水合行为与打包产物不同，会掩盖只在生产暴露的水合与产物问题。`command: 'npm run build && npm run preview', port: 4173` 让 e2e 跑在真实构建产物上。spec 里 `page.goto('/')`、`expect(page.locator('h1')).toBeVisible()`。

### 9. (C) 组件测试：直接 mount 断言 innerHTML vs Testing Library 按角色查询，取舍？
**来源**：组件测风格题的转述。

`mount` 到 `document.body` 断言 `innerHTML` 快但脆（绑定实现细节）。`@testing-library/svelte` 的 `render`+`screen.getByRole('button')` 从可访问性/用户视角查，抗重构；交互用 `userEvent`。官方还提醒：若其实想测组件内逻辑，优先把逻辑抽成纯函数单测，省掉渲染开销。绑定/上下文/snippet 用 wrapper 组件承载。

### 10. (B) 一个 load 用了 `browser ? 'A' : 'B'` 决定首帧，e2e 报水合错乱——怎么定位与修？
**来源**：测试抓出水合问题的排障题的转述。

e2e 在 build+preview 下暴露：SSR 渲 B（browser=false）、水合渲 A，HTML 不一致。修法：首帧两端渲同一结构（如占位），把浏览器专属内容放进 `$effect`/`onMount` 后填充，或用 `$app/environment` 的 `browser` 只在副作用里判、不切首帧标记。

### 11. (D) 为一个带登录+表单+流式列表的页面规划三层测试。
**来源**：测试金字塔设计题的转述。

单测：server load（桩 cookies 判未登录→redirect）、action（校验失败→fail 回显、成功→返回形状）、handle（织入 locals）。组件测：表单错误文案渲染、按钮禁用态（jsdom+userEvent）。e2e：黄金路径——错误密码停登录页、正确密码跳 dashboard、列表流式逐段出现、提交后新项出现。e2e 只留少数关键旅程，别用它测格式化函数。

### 12. (C) 服务端钩子/`$lib/server` 代码的测试环境为什么用 Node 而非 jsdom？
**来源**：环境选择原理题的转述。

`handle`/`handleError`/`init`、db、鉴权本就是纯服务端代码，不在浏览器跑，也就无需 DOM 垫片；用 Vitest 的 Node 环境直接测最快、最贴近真实运行环境。`$lib/server` 的 server-only 属性只在 Kit 构建期强制，单测里它是普通模块，正常 import。要隔离外部依赖用 `vi.mock` 或依赖注入。

🚀 **下一组**：kit-debug-playbook 面试题——500 白屏读法、水合失配、load 死循环与密钥泄露的高频考法。

---

## 补充（新专题 13-15）

### 13.  给登录+表单+流式列表页面规划三层测试，你的分配与理由？ 

 单测覆盖 load/action 纯函数（校验分支、错误回显），组件测覆盖回显与无障碍，e2e 只跑金路径与渐进增强（禁 JS 提交）各一条；金字塔比例防慢测试拖垮 CI。 

**来源**： https://svelte.dev/docs/kit/testing

### 14.  e2e 里 webServer 用 npm run dev 被质疑不稳定，你怎么定 CI 启动口径？ 

 dev 是未优化路径且 HMR 干扰计时；CI 用 build+preview（生产等价物）或独立 test 环境常驻服务，webServer 配 reuseExistingServer 与 healthCheck 防端口竞争。 

**来源**： https://playwright.dev/docs/api/class-webserver 

### 15.  $lib/server 里依赖 DB 的 service 如何做可测接缝？ 

 service 接收注入的 client/repository 而非模块级单例，单测传内存桩（如 better-sqlite3 :memory: 或 fake repo）；真实 DB 归集成层，容器化一次性实例跑迁移后即焚。 

**来源**： https://svelte.dev/docs/kit/testing#Unit-testing 
