# VueUse 与国际化生态

> 目标：把"逻辑复用"从手写走向站在库肩上——精读 VueUse 核心函数的实现契约并学会自写 `useXxx`；再用 vue-i18n 9 把文案、复数、日期数字全面板外化。国际化不是"翻译文件"，是**工程结构**（呼应 vue-composables 的契约、01-es 的 Intl 底层、vue-forms-validation 的错误文案；07-next/08-nuxt 各有 i18n 专课）。

---

## 一、VueUse：官方"stdlib"好在哪

VueUse 是 500+ 组合式函数的集合，价值不在"多"，在**每个函数都是一份最佳实践范本**：

```js
import { useLocalStorage, useDebounceFn, useEventListener, useElementSize } from '@vueuse/core'

const theme = useLocalStorage('theme', 'light')        // 响应式 ↔ localStorage 双向同步，序列化/反序列化内置
const onSearch = useDebounceFn(query => fetchResults(query), 300)  // 防抖且自动随作用域清理
useEventListener(window, 'resize', onResize)           // 挂了自动解挂，unmounted 不用操心
const { width } = useElementSize(cardEl)               // ResizeObserver 封装，SSR 安全
```

对照 vue-composables 学过的契约，每个函数都严格遵守：**参数接受 `MaybeRefOrGetter`（内部 `toValue` 归一）、返回一组 ref、生命周期钩子自带、`onScopeDispose` 清理**。读一个 VueUse 源码 = 复习一遍组合式函数全部纪律。

三条使用纪律：

1. **按需引入**（ESM tree-shaking 友好，别 `import * as VueUse`）；
2. 在服务端渲染的项目里留意文档标注的 SSR 行为（依赖 window 的函数返回安全默认值）；
3. **先搜再写**：写 `useClickOutside` 之前先确认 `@vueuse/core` 里已有 `onClickOutside`——重复造轮子是评审扣分项。

## 二、自写 useXxx：从"会用"到"会写"

VueUse 没有的（业务特化），按同一模板自写：

```js
// composables/useQuerySync.js —— 把 URL query 和响应式状态双向绑（列表页筛选神器）
import { watch, onScopeDispose } from 'vue'   // ref/route/router 按项目实际引入
export function useQuerySync(key, initial) {
  const state = ref(route.query[key] ?? initial)
  const stop = watch(state, v => router.replace({ query: { ...route.query, [key]: v } }))
  onScopeDispose(stop)                                    // ← 没有这行的 composable 不合格
  return { state }
}
```

检查清单：`use` 前缀✓ 参数容 ref 容值✓ 返回 refs（解构安全）✓ 副作用登记清理✓ 不隐式依赖全局单例状态✓。

## 三、vue-i18n 9：组合式 API 的正确打开方式

```js
// locales/zh-CN.js / en-US.js 按语言拆文件，键结构按"功能域"而非页面
export default { nav: { home: '首页' }, cart: { add: '加入购物车' } }
```

```vue
<script setup>
import { useI18n } from 'vue-i18n'
const { t, locale, n, d } = useI18n()          // 组合式 API；legacy: false 全局关掉旧模式
</script>
<template>
  <p>{{ t('nav.home') }}</p>
  <p>{{ n(price, 'currency') }}</p>            <!-- 数字格式化 -->
  <p>{{ d(new Date(), 'short') }}</p>          <!-- 日期格式化 -->
  <button @click="locale = locale === 'zh-CN' ? 'en-US' : 'zh-CN'">切换</button>
</template>
```

- **组件级 scope**：`useI18n({ messages })` 可给单组件带私有文案，防全局键爆炸；
- **fallbackLocale** 兜底缺键，配合 CI 里跑 `vue-i18n` 的 CLI 做**键对齐检查**（缺翻译在合并前暴露，而不是上线后满屏 `nav.home` 字面量）。

## 四、复数、插值与"翻译不动的坑"

```js
// zh：量词简单；en：规则复数 + 例外
cart: { items: '{n} 件商品' /* zh */, items: '{count} item | {count} items' /* en */ }
```

- 管道 `|` 复数（中文只写一形）、`{n}` 具名插值、`@:other.key` 引用复用；
- 特殊字符（`@` `{` `$`）要转义——`{'@'}`；
- **日期数字别手拼字符串**：`n()`/`d()` 底层就是 01-es Intl 学的 `Intl.NumberFormat`/`DateTimeFormat`，千分位、货币符号、农历日历全交给你；
- 含组件的文案（"请访问 <a>帮助页</a>"）用**插值组件**（`<i18n-t>`）——整句翻译原则：不要把句子拆成 `t('please') + link + t('visit')`，语序在不同语言里对不上（国际化事故第一名）。

## 五、和表单/路由的联动

- **表单错误文案**：vee-validate 的 zod schema 里 `z.string().min(2, i18n.t('form.nameShort'))` 只是起点——正解是错键不错文（schema 吐 `errors.form.nameShort`，模板层 `t()` 渲染），切 locale 后错误提示跟随（回扣 **vue-forms-validation**）；
- **locale 进 URL**（`/zh-CN/cart`）利于 SEO 与分享，需要路由中间件配合——本包不展开，**07-next 的 next-i18n** 与 **08-nuxt 的 @nuxtjs/i18n** 专课讲"带 SSR 与预渲染的完整方案"；
- RTL 语言（阿拉伯语）要翻 `dir` 属性 + CSS 逻辑属性（`margin-inline-start`）——面试聊 i18n 说出这条直接加一分。

## 六、自检清单

- [ ] 能说出 VueUse 函数共享的四条契约，并背出 `useLocalStorage` 相对 `JSON.parse(localStorage.x)` 的三个优势。
- [ ] 自写 composable 的五条检查清单说得全。
- [ ] `useI18n` 的 `t/n/d/locale` 四件套会用的同时，知道 `legacy: false` 开关。
- [ ] 复数管道语法与"整句翻译"原则能举例说明。
- [ ] 讲得清表单错误"错键不错文"与 locale 进 URL 两条联动线。

---

## 🚀 部署预告

- `n()/d()` 的底层是 **01-es Intl** 课的 `Intl.NumberFormat/DateTimeFormat`——库只是把按钮放到了 `useI18n()` 里；
- 本关"错键不错文"与 **vue-forms-validation** 的 `setFieldError` 通道合体，就是国际化表单的完整拼图；
- locale 感知路由与预渲染在 **07-next**、**08-nuxt** 各有一整关（next-i18n / nuxt-i18n），VueUse 的 `useHead` 类需求在 08-nuxt 由框架内置接管；
- composable 的可测性（纯函数 + 显式注入）将在 **vue-testing**（L7）用 Vitest 实锤。

下一关进入 **L5 vue-router-basics**：SPA 的灵魂组件——createRouter、RouterView/RouterLink 与两种 history 模式。
