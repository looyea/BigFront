# kit-form-validation 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) "客户端校验是 UX、服务端校验是安全"——用攻击路径把前半句证伪成后半句。
**来源**：校验分工第一问的转述。

客户端校验的三道旁路：curl/Postman 直接 POST 到 action URL（根本不经过你的表单）；改本地 DOM 删掉 required/pattern；拦截改写请求体。所以裁决权只能在服务端——action 里对 `request.formData()` 的每次 parse 都是"不可信输入"的过堂。客户端层的收益只剩两条体验：失焦即时反馈、省一次失败往返。面试要能同时说出"为什么不能只靠客户端"与"为什么客户端层仍值得写"。

### 2. (A) FormData 进 zod 前的三个整形坑各是什么？
**来源**：双端管道细节题的转述。

①值全是字符串或 File——`z.number()` 遇 `'25'` 必挂，要 `z.coerce.number()`；②未勾选的 checkbox 不是 false 而是**键整个缺席**，schema 得按 optional 建模再 refine 真值；③同名多值（checkbox 组、`<select multiple>`）经 `Object.fromEntries` 只留**最后一个**，要 `getAll()` 手动收数组。附加口径：空字符串在筛选表单里常见，`z.literal('').optional()` 或 `.transform(v => v === '' ? undefined : v)` 二选一，别让 ' ' 冒充有效值进库。

### 3. (B) 用户报了个诡异现象：表单提交后偶发字段丢失，本地怎么都复现不了。排查方向里和 FormData 特性相关的一条是什么？
**来源**：疑难排错案例转述。

检查被"丢"的字段是否 **disabled**——禁用控件根本不进 FormData（与 readonly 相反，后者照常提交）；常见于 JS 动态禁用某下拉后值就悄悄消失，服务端拿到 undefined。相邻考点：`formmethod`/`formnovalidate` 按钮级覆盖、`<input type=submit>` 与 name 的提交差异（只有**按下那个按钮**的 name/value 进数据，靠 submitter 参数传给 `new FormData(form, submitter)`）。排查习惯：action 第一行 `console.log([...formData.entries()])` 看原料全景，先分清"浏览器没发"还是"服务端没收"。

### 4. (B) fail 的状态码选 400 还是 422？答出选型依据而不是站队。
**来源**：HTTP 语义小考转述。

两者都合法（fail 只限 400-599）。422 Unprocessable Content 语义更精确：语法没问题（能 parse）但内容过不了业务规则；400 是"请求本身发坏了"的粗粒度兜底。社区惯例与 superForms 文档示例多用 400，RFC 派偏爱 422——要点是**团队内一致**且别让前端按状态码猜错误类型（错误明细在 form 数据里，状态码只管粗分类）。能说出"Kit 不强制、语义自己挑"这层就及格。

### 5. (A) 校验失败回显为什么必须带 input？这个"半回显"（带 email 不带 password）的边界怎么划？
**来源**：错误回显设计题的转述。

带 input 是为了对抗 enhance 的"重置 form 元素"默认行为——模板用 `value={form?.input?.email ?? ''}` 把值填回，用户只改错字段。边界划线按官方示例的姿态：**任何凭据/密钥类字段永不回传**（password、card CVV），其余字段默认回传；改密码场景连旧密码的"长度提示"都不要给。追加一刀：错误消息本身可能泄密（"用户名存在但密码错"= 账号枚举漏洞），登录失败的对外文案应收敛成一句"邮箱或密码不正确"。

### 6. (B) 同一条 zod schema，客户端跑出的错误消息和服务端跑出的不一致，可能差在哪三处？
**来源**：双端一致性排坑题的转述。

①**locale/自定义消息**是函数或随运行环境变（服务端按请求头 Accept-Language 定制、客户端拿默认英文）；②**预处理分叉**——服务端从 FormData 拿 `'25'`、客户端 store 里已是数字 25，coerce/default 路径不同触发不同分支；③**版本分叉**——schema 文件被缓存（PWA/构建产物未刷新）或双端引了不同副本。治理思路：让"客户端校验"直接跑同一份编译产物的同一函数（superForms 的客户端适配家族走的就是 schema→client validator 编译路线），并把消息生成做成纯函数。

### 7. (C) sveltekit-superforms 替你收编了哪些重复劳动？什么时候"不引它"反而是对的？
**来源**：生态选型对比题的转述。

收编清单：服务端 `superValidate` 一行完成 parse+错误整形+json() 封装；客户端 `superForm()` 托管 form/errors/constraints/submitting 状态与 action 返回值弥合；同 schema 客户端即时校验的编译通路；多表单同页 id 区分、文件字段、无限循环防护。不引的理由：小表单（三条规则）手写 fail 管道更透明、零依赖面；团队要深度定制错误协议（自有 code 体系）时库的约定反而是阻力；依赖升级节奏（zod 大版本切换期）要盯适配矩阵。答题落点："先理解手写管道，再决定用不用库"。

### 8. (D) 三步向导表单（填写→确认→完成），数据要跨步存活、每步服务端落库。用 actions + 校验体系落地，说清状态各放哪。
**来源**：多步流设计面试题的转述。

每步一个具名 action（step1/step2/...，default 让位避残留坑），服务端每步全量校验**本步新增字段 + 已从库中取回的前序数据**（别信客户端回传的旧步数据，防篡改；hidden input 只当"取回索引"不当"数据源"）。回显：fail 带 `{ step: 2, input, errors }`，模板按 step 分支渲染。跨步草稿若要暂存，放服务端会话（cookie→DB 行）而非 localStorage（一致性）。完成步成功走 redirect(303) 清掉一切参数。加分点：主动提"刷新页面回到哪一步"由服务端状态推导，而不是前端 router 记忆。

### 9. (D) 上传表单：一个文件 + 三个文本字段的 action 怎么写校验？文件类的坑列三个。
**来源**：文件上传场景题的转述。

`const file = data.get('avatar')` 拿到的是 **File**（FormDataEntryValue 的分支），先 `instanceof File` 守卫再校验：①大小——`file.size` 自己限（配 nginx client_max_body_size / 适配器请求上限，超限请求可能根本进不到 action）；②类型别只信 `file.type`（客户端可伪造），魔数嗅探或扩展名+MIME 双查；③未选择文件时**有的浏览器发空 File、有的发缺席键**，两条都要容。三个文本字段照常 zod。文件不进 fail 回显（不可序列化回浏览器表单），失败后让用户重选是正解——面试说出这条"回显协议对 File 失效"最加分。

### 10. (B) 上线后有人反馈"填完表单点提交没反应，也不报错"。你的前三步排查？
**来源**：静默失败排障复盘转述。

①DevTools Network 看有没有 POST 发出——没发出：enhance 回调里 cancel() 误触/前置函数抛异常吞了提交，或 HTML 原生校验拦截（隐藏字段带 required 却 display:none 是经典自杀写法，浏览器报"不可见控件不满足约束"然后什么都不显示）；②发出了但 pending 永不结束：action 里 await 了不 resolve 的东西；③返回 200 但 UI 不动：跨页提交不更新 form prop 的同页规则（applyAction 补），或 result.type 分支没接。口诀：先分"没发/没回/没接"三段，各对应一层。

### 11. (C) 拿 Kit 的 fail() 回显和 Vue 生态（vee-validate 类）、React 生态（useActionState 类）的错误托管比，"状态归谁"的分工差异在哪？
**来源**：跨框架表单体系对比题的转述。

Kit：错误与值都是**服务端 action 返回值**（form prop），客户端状态层几乎为零，字段级绑定与即时校验要么手写要么交给 superForms——库负责把"服务端真相"弥合进响应式字段。Vue/React 主流库相反：**控件状态与校验规则归库**（schema 编译成 validator 绑定在 field 上），服务端只回一句最终裁判。谱系是"服务端持有错误"到"客户端持有错误"的滑动条，Kit 官方层站在最左端，superForms 往右搬了一半。答这题考的是你有没有意识到错误对象的所有权才是表单架构的中心问题。

### 12. (A) 为什么说"HTML 约束验证是第一道、也是零成本的一道"？它和 zod 的口径差会害死哪种设计？
**来源**：原生校验价值题的转述。

required/type/minlength/pattern 无 JS 参与就生效（渐进增强第一层白送），且浏览器焦点管理（定位第一个无效控件）天生无障碍友好。但口径比 schema 松得多：`type="email"` 认 a@a.a 合法、数字输入框也能被 DevTools 改出任意文本。害死的设计是"**只写 HTML 校验、服务端信任它**"——表单看起来验证齐全、action 裸奔。正确姿势：HTML 属性当体验与无障碍资产保留，zod 当法槌；两边规则若同源生成（constraints→属性的自动注入，superForms 的 constraints 机制正是干这个的），才不会漂移成两套真相。

🚀 **下一组**：kit-error-boundaries 面试题——两套错误世界、边界几何与 fallback 链路。
