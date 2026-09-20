# 自动导入：Nuxt 最著名的糖，和它暗中的账单

layouts 里直接写 `useRoute()` 不用 import、组件模板里 `<BaseButton>` 凭空可用——这是 Nuxt 让新手尖叫、让老手皱眉的特性。本关拆开机制、划清边界、算清账单（组合式函数本体在 04 包讲透，呼应 vue-composables）。

## 1. 机制：扫描 → 生成虚拟模块 → 编译期注入

三步流水线（nuxt-directory 第 3 节的 .nuxt 生成物在这里全用上）：

1. 启动时扫描 `app/composables/`、`app/utils/`（以及模块通过 `addImports()` 注册的源），按"导出名"建索引进 `.nuxt/imports.d.ts`；
2. 所有可导入项聚合进虚拟模块 `#imports`；
3. 编译 SFC/TS 时（unimport 引擎挂在 Vite 插件上），发现裸标识符 `useX()` 命中索引，就在文件头**改写注入** `import { useX } from '#imports'`。

组件自动注册同理（扫描 components/ 生成 `components.d.ts`，模板里的标签编译期解析成异步组件）。关键认知：**自动导入是编译期代码补写，不是运行时的全局变量**——浏览器里跑的代码 import 一条不少，包体积与显式写法完全一致。

```ts
// 你写的 app/composables/useCounter.ts
export const useCounter = () => {
  const count = ref(0);            // ref 本身也被自动导入（vue 核心 API 内置清单）
  const inc = () => count.value++;
  return { count, inc };
};
// 任意组件里直接用 useCounter()/ref()，零 import
```

## 2. 边界清单：哪些东西不会自动来

| 会自动导入 | 不会 |
|-----------|------|
| app/composables、app/utils 的导出 | vue-router 除 useRoute/router 外的大多数 API（如 createRouter） |
| Nuxt 核心（useFetch、useState、navigateTo…） | 三方库（lodash、dayjs）——需模块或手动配 imports |
| Vue 运行时核心 API（ref、computed、watch） | 组件的 script 顶层自定义 import 的变量（那是作用域问题） |
| components/ 里的 SFC（模板位置） | `<script setup>` 里给 render 函数用的组件引用（需显式 import 或用 resolveComponent） |

命名铁律：composables 目录以 `use` 开头、utils 不带 use 也能进清单；**同名导出会互相覆盖且只有一条警告**——两个包里都有 `useUser()` 时，谁赢取决于扫描顺序，这是自动导入最阴的坑（自查法：全局搜导出名）。

## 3. 账单一：可读性与"函数从哪来"

新人读 `const { data } = useArticles()`，全局搜索无果（源码里确实没有定义与导入，只有生成物里有）。三条团队纪律：

1. Code Review 接受"核心 API 不 import 是惯例"，但**业务 composable 跨目录引用时写注释或保持显式 import**（自动导入允许显式，显式永远正确）；
2. IDE 设置里开启 unimport 支持（Volar 认 .nuxt 类型即绿）；
3. 排查"undefined is not a function"先查清单文件（第 2 节同名覆盖）。

## 4. 账单二：Tree-shaking 与摇不掉的恐惧

常见质疑："import 全部聚合进 #imports，会不会把没用的也打进去？"——不会：注入是**逐符号**的（每个文件只补它用到的名字的 import 语句），Vite/Rollup 按正常 ESM 树摇（呼应 vite-build 第 2 节）。真正会虚增包体的是**组件自动注册的目录过大**（扫描与类型体积）与误放 app/utils 的重依赖——utils 里 `import('heavy-lib')` 顶层静态引入，用它的页面就都背上了。纪律：app/utils 保持轻量纯函数，重活显式动态 import。

## 5. 显式导入的正当场景与全局开关

- SSR 库类型歧义、跨 monorepo 包、代码生成器产出——这些场景建议显式 `import { useX } from '#imports'`（合法且类型精准）；
- 想退回传统写法：`autoImports: false` / `components: false` 可整体关闭——但相当于放弃了 Nuxt 一半的开发体验红利，极少有人真关；
- 精确控制单目录：`imports: { dirs: [] }`、`components: { dirs: [] }` 做白名单裁剪。

对照 Next：Next 没有自动导入哲学（一切显式 import），两种流派没有对错——RSC 边界已经够烧脑，再加自动导入会把认知税叠满；Nuxt 概念面简单，用自动化换效率是合理补偿（呼应 nuxt-overview C2 的心智负担论述）。

## 6. 自检清单

- [ ] 能讲出"扫描→#imports→编译期逐符号注入"三步，并说明为什么包体积不变；
- [ ] 知道同名导出覆盖的风险与自查方法；
- [ ] app/composables 与 app/utils 的命名约定张口就来；
- [ ] 判断得出：三方库、router 高级 API 不在自动导入范围；
- [ ] 团队文档里写清"何时允许依赖自动导入、何时要求显式"。

## 7. 小结

自动导入 = 编译器帮你写 import。机制透明（生成物可查）、体积无罪（逐符号注入）、风险集中在**命名冲突与来源不可见**两件事上——用纪律驯服它，它就是纯生产力。

🚀 部署预告：地基三件套完毕，下一关正式进路由：pages/ 文件路由与 NuxtLink——看看 Vue 系的路由约定和 Next 的段模型有哪些手感差异。
