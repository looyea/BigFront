# vue-use-i18n 面试题精选

> 共 12 题，覆盖 VueUse 认知 / 契约与源码 / 自写 composable / vue-i18n 机制 / 国际化工程 五类。

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
