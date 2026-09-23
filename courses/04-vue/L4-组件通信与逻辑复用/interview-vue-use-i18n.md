# vue-use-i18n 面试题精选

> 共 15 题，覆盖 VueUse 认知 / 契约与源码 / 自写 composable / vue-i18n 机制 / 国际化工程 五类。

---

## 一、VueUse 认知

### 1. VueUse 是什么？为什么面试官喜欢问"你读过它的源码吗"？

500+ 组合式函数的准官方 stdlib（useLocalStorage、useDebounceFn、onClickOutside、useDark…）。它的每个函数都严格遵循同一套契约（toValue 参数归一、返回 refs、自带清理），**读一个函数 = 复习整个 Composition API 纪律**，所以是检验"会不会用 Vue 3"的低成本探针（呼应 vue-use-i18n 第一、二节）。

**来源**：VueUse — "What is VueUse"

### 2. useLocalStorage 和直接读写 localStorage 的区别？

三件事它全包了：①返回 ref，写 ref 自动同步回 storage（含 storage 事件跨标签页同步）；②序列化/反序列化 + 默认值/异常兜底；③SSR 安全（服务端返回默认值不炸）。手写版每处 `JSON.parse` 都要重复这套防御（呼应 vue-use-i18n 第一节）。

**来源**：VueUse — "useLocalStorage"

### 3. useDebounceFn 和一个手写的 lodash.debounce 放 setup 里，差在哪？

手写 debounce 函数活在 setup 闭包里，组件卸载没人 clearTimeout——尾部延迟执行时访问已卸载状态是经典报错。useDebounceFn 内部登记了作用域清理，卸载即作废。这题考的是"副作用生命周期意识"（呼应 vue-use-i18n 第一节、vue-composables 第四节）。

**来源**：VueUse — "useDebounceFn / onScopeDispose 实现"

---

## 二、契约与源码

### 4. VueUse 函数的参数为什么几乎都写成 MaybeRefOrGetter？给个例子说明红利。

`toValue(source)` 把 ref / getter / 裸值统一成可读值，于是 `useDebounceFn(fn, 300)` 与 `useDebounceFn(fn, delayRef)` 都合法；配合 computed 还能跟随响应（`useFetch(computedUrl)`）。一个类型约定换来"随处可传、响应不丢"（呼应 vue-use-i18n 第一节、vue-composables 第三节）。

**来源**：VueUse — "Custom Types / MaybeRefOrGetter"

### 5. VueUse 在 SSR（Nuxt）下为什么不炸？

依赖 window/document 的函数走 SSR 安全模式：服务端求值返回安全默认值（如 useElementSize 给 0），真实测量只在客户端 onMounted 后发生；Nuxt 模块还会自动把相关函数包 `.client` 后缀版本。答出"服务端没有 DOM 是环境事实，库要设计降级路径"即可（呼应 vue-use-i18n 第一节、vue-ssr-nuxt）。

**来源**：VueUse/Nuxt — "SSR 适配说明"

---

## 三、自写 composable

### 6. 现场设计 useQuerySync（URL query ↔ 响应式状态），说出你的检查清单。

五条纪律：use 前缀；参数容 ref 容值；**返回 refs**（解构安全）；watch 写回 router.replace 且 `onScopeDispose(stop)` 清理；不隐式依赖模块级单例。加分点：区分 replace（筛选）与 push（导航语义）、数组参数序列化策略（呼应 vue-use-i18n 第二节、vue-router-nested-dynamic 的 query）。

**来源**：Vue.js — "Composables 约定"；实践题常见于中高级面试

### 7. 组合式函数什么时候该升级成 Pinia store？

判据：状态是否**全局唯一且跨无关节点共享**。局部复用逻辑（每组件一套）留 composable；登录态、购物车这类"全应用一份、任意处读写"进 store（defineStore 本质也是一个受 devtools/SSR 管理的单例 composable）。模块级 ref 硬共享是第三条路但要自备 SSR 串数据风险防御（呼应 vue-use-i18n 第二节、vue-pinia-basics、vue-state-patterns）。

**来源**：Vue.js / Pinia — "Composable vs Store"

---

## 四、vue-i18n 机制

### 8. vue-i18n 9 的 useI18n() 返回哪些核心成员？legacy 模式为什么要关？

`t`（翻译）、`locale`（可写 ref）、`n`/`d`（数字/日期格式化）、`tm`（消息原值取模板数据）。`legacy: false` 关掉 Options API 的 `this.$t` 老模式，统一走组合式：tree-shaking 更好、TS 推导完整、避免双 API 心智分裂（呼应 vue-use-i18n 第三节）。

**来源**：vue-i18n — "Composition API / legacy mode"

### 9. "{count} item | {count} items" 这种写法叫什么？中文怎么处理？日期和大数字呢？

管道复数机制，按 CLDR plural categories（zero/one/two/few/many/other）选择——阿拉伯语有六种形式。中文单形即可。日期数字**永不手拼**：`d(date, 'short')`/`n(num, 'currency')`，底层是 Intl.DateTimeFormat/NumberFormat（01-es 学过原语）（呼应 vue-use-i18n 第四节）。

**来源**：vue-i18n — "Pluralization / Date & Number Formatting"；Unicode CLDR

### 10. 缺键时线上显示 "nav.home" 字面量，工程上怎么在上线前拦住？

三层：①`fallbackLocale` 兜底到母语言；②CI 跑键对齐检查（vue-i18n CLI / 自写脚本对比 zh-CN 与 en-US 键集合，缺键 fail build）；③开发模式 `missing` 钩子上报监控。把翻译当**接口契约**管理而不是文案文件（呼应 vue-use-i18n 第三节）。

**来源**：vue-i18n — "Missing handler / CLI 工作流"

---

## 五、国际化工程

### 11. "请输入正确的邮箱地址" 要拆分组件渲染（邮箱输入框+提示），i18n 上有什么讲究？

整句原则：一个键承载整句 + `<i18n-t>` 具名插槽嵌组件——`請访问 <a>帮助页</a>` 是一个 message，不是 `t('please')+<a>+t('visit')` 的拼接。碎句拼装在德语/日语语序下必碎，且译者失去上下文（呼应 vue-use-i18n 第四、五节）。

**来源**：vue-i18n — "Interfacing Components (i18n-t)"；i18n 最佳实践通识

### 12. 切 locale 后表单错误文案不变，问题出在哪？怎么架构性根治？

错误文案在 schema 里写死（`z.string().min(2,'至少2字符')`），校验执行时已把字符串固化进 errors。根治：**错键不错文**——schema 只吐 `errors.nameShort` 键，模板 `t(errKey)` 渲染，locale 一变文案自动变；服务端 422 同理返回错误码。这是把错误通道设计成"可翻译协议"（呼应 vue-use-i18n 第五节、vue-forms-validation 第四、五节）。

**来源**：i18n + 表单校验整合实践（vee-validate 文档 "Server-side & i18n errors"）

---

## 补充（新专题 13-15）

### 13. 设计一套带组件的富文本国际化（句子里嵌链接/加粗），从 message 格式选型到类型安全给完整方案。

格 式 选 型：vue-i18n 富 文 本 消息 = 词 条 里 放 `<a>帮助页</a>` 片段 + `<i18n-t keypath="...">` 或 `t` 返回 AST 渲染（占 位 符 方案：把 句子 拆 成 `visit {link} for help` 再 拼 会 死 定——德语 动 词 置 尾/日语 语 序 不 同，**句子 必须 完 整 一 条**）。实现：`<i18n-t keypath="nav.help"><template #link><RouterLink to="/help">{t('nav.helpPage')}</RouterLink></template></i18n-t>`——结构 标 签 由 各 语 言 词 条 自 由 摆 位。类型 安全：词 条 文件 用 单 一 源（默 认 语 JSON）+ 生成 `.d.ts`（vue-i18n 的 `defineI18nConfig`/json 导入 声明），键 写 错 编译 期 爆（vite-plugin 校验）；插 值 参数 用 `MessageKeys`/`Params` 泛 型 约束 到 词条 形状（i18n.d.ts  augment）。约 定：占 位 符 命 名 不 用 `{0}`（翻 译 平 台 上 无 语 义 易 翻 错 位），`_missing` 钩 子 开发 环境 抛 错 生产 上 报（本关 缺 键 拦截 题 的 运行 时 保 险）。

**来源**：vue-i18n 富文本消息与 i18n-t 组件文档；intlify 类型增强（JSON 词条推导）方案。

### 14. 表单库错误文案、路由标题、toast 这三类「非模板文案」怎么纳入 i18n 且不把全局单例捅进组件树？

共同 难 点：这 三 类 都 在 **setup 之外** 生 成（zod schema 模 块 级 定 义、路 由 表 静 态 对 象、toast 工 具 函 数），拿 不 到 useI18n 的 组件 作用 域。解 法 统 一 姿势=**延 迟 求 值 + 全 局 composer 显 式 单 例**：`const { t } = i18n` （createI18n 返 回 的 实例 级 t）始 终 可 用，但 要 求 「文案 不 能 是 什 么」——schema 里 不 能 存 `t('...')` 的 **结果**（切 语 言 不 重 生 效，本关 表 单 联动 题 的 根 因），要 存 **键 名/函数**，消 费 时 刻（渲 染 错 误/toast 弹 出/路 由 meta 被 读）才 `t(key)`。路 由 标题：`meta: { titleKey }` + documentTitle 组合 函数 里 `watch(route)` 翻 译；toast：`toast.error(t(key), params)` 参 数 透 传。architect 判 据：「跨 界 面 的 文案 生 产 者 只 负 责 键 和 参 数，渲 染 者 负 责 语 言」——这 条 划 完，三 类 问 题 是 同 一 个 问 题。

**来源**：vue-i18n 非组件环境（i18n.global）文档；vee-validate+zod 错误信息本地化官方配方（键名/延迟翻译）。

### 15. 多语言站点的 SEO 与运行时 locale 协商：hreflang、URL 策略、首屏语言判定三件套怎么定？

URL 策 略 优先 `/zh/` 路径 前 缀（子 域 名 割 裂 权 重、域 名 TLD 不 可 靠），每 个 页 面 输 出 全 语 种 `hreflang` + `x-default`；**不 要 靠 302 按 Accept-Language 强跳**（爬 虫 视 角 只 看 到 一 个 语 种 + 用户 手 动 切 语 言 后 被 弹 回，正 解=首 访 协 商 一 次 写 cookie/localStorage，之 后 尊 重 选 择）。SSR 侧：语 言 决 定 **响应 头/HTML lang/词 条 服 务 端 选 择** 三 处 一致（否 则 hydration 文 案 不 匹 配 警 告，本包 SSR 关 的 i18n 变 体）；Nuxt i18n 模 块 把 i18n 变 量 融 进 路 由（i18n 开 关 + 屏 蔽 i18n 路 由 注 册 的 细 节 值 得 了 解）。日 期/数字 的 本 地 化 **不 进 i18n 词 条 库**，直 用 Intl（`Intl.DateTimeFormat(locale)`），注 意 SSR 的 Node ICU 完整 度（node 13+ 默 认 full-icu，更 老 环境/极 端 瘦 身 镜像 会 静默 退 化 成 en 格 式——同 构 两 端 日 期 格 式 不 一 致 的 冷 知 来 源，本包 部 署 关 镜像 题 的 功 能 面）。

**来源**：Google hreflang 规范与本地化 SEO 指南；MDN Intl 与 Node full-icu 变更说明；Nuxt i18n 模块文档。
