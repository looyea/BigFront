# Vue 起步：创建工程、Hello World 与项目结构

> 目标：这是 Vue 这门课的**第 0 步**。在你被 `ref`、`computed`、`<script setup>` 这些词淹没之前，先把手弄脏——**从零创建一个能跑起来的 Vue 工程，写出并跑通一个 Hello World**，然后认清"一个 Vue 项目到底长什么样"：`index.html`、`src/main.js`、`App.vue`、`components/`、`vite.config.js`、`package.json` 各自扮演什么角色，以及单文件组件（SFC）的 `template / script / style` 三段式是什么。最后给你一套**重要性分层**——哪些是天天必写的核心、哪些是次要、哪些可以先不管，让你知道劲儿该往哪儿使。（本项目 `frontend` 外壳就是 Vue3 + Vite，学完你能回头看懂它）

---

## 一、先建立心智：Vue 是"怎么跑起来"的

Vue **不是一个必须搭配某种后端、某种构建工具才能用的框架**——它是一个 JS 库。但现代 Vue 项目的标准姿势是**工程化**：用脚手架生成一套目录，用 **Vite**（本项目用的就是这个）做开发服务器和打包。你写的每个 `.vue` 文件叫**单文件组件（SFC, Single File Component）**，它被 Vite 的 `@vitejs/plugin-vue` 插件编译成浏览器能执行的 JS。

一句话流程：

```
你写 .vue 文件  →  Vite 编译(插件)  →  浏览器加载  →  Vue 运行时把组件渲染成 DOM
```

**前提**：装好 **Node.js**（建议 ≥ 18，本项目要求 ≥ 20）。`node -v` 能出版本号即可。npm 随 Node 一起装好。

---

## 二、创建工程：两条命令路线

### 路线 A：官方脚手架 create-vue（推荐，功能全）

```bash
npm create vue@latest
# 会交互式问你一串选项：是否加 TypeScript / JSX / Router / Pinia / Vitest / E2E / ESLint / Prettier
# 新手起步可全 No，或只留 Router；名称随意，如 my-vue-app

cd my-vue-app
npm install      # 装依赖（生成 node_modules 与 package-lock.json）
npm run dev      # 启动开发服务器，终端会打印 http://localhost:5173
```

浏览器打开那个地址，看到 Vue 的欢迎页，就说明**工程通了**。

### 路线 B：Vite 官方脚手架（更精简，只给最小 Vue）

```bash
npm create vite@latest my-vue-app -- --template vue
cd my-vue-app
npm install
npm run dev
```

> `--template vue` 直接选 Vue 模板（想上 TS 用 `vue-ts`）。这条路给你最干净的"一个 Vue 项目长什么样"，本课讲解以它为主。

**Windows 提示**：若 `npm` 脚本被执行策略拦截，可用 `npm.cmd` 替代。`Ctrl + C` 停掉开发服务器。

---

## 三、Hello World：改三行，跑一次

创建好后，先别管那些配置。**唯一需要你盯的是 `src/App.vue`**——它是应用的根组件。把它替换成最小 Hello World：

```vue
<!-- 目的：最小 Hello World —— 在 <script setup> 里声明一个字符串，用插值渲染到视图 -->
<script setup>
const msg = "Hello Vue!";   // 顶层绑定：一个普通字符串常量（在 <script setup> 顶层声明即自动暴露给模板）
</script>

<template>
  <h1>{{ msg }}</h1>        <!-- 插值：渲染出 "Hello Vue!" -->
  <p>{{ msg }}</p>          <!-- 同一绑定可复用：这里再次显示 "Hello Vue!" -->
</template>
```

保存，浏览器**热更新**立刻显示两遍 "Hello Vue!"。你刚刚完成：

- `<script setup>` 里声明的 `msg` 是**顶层绑定**；
- 模板里用 `{{ msg }}`（插值）把它显示出来——这就是 Vue 的"数据 → 视图"映射的第一步；
- `npm run dev` 下改文件自动刷新，叫 **HMR 热模块替换**（Vite 提供）。

> `<script setup>` 是什么、为什么变量不用 `return` 就能被模板用——这正是**下一课 vue-script-setup** 要讲透的语法糖。今天你先记住结论：**写在 `<script setup>` 顶层的变量/函数/组件，模板里直接用。**

### ⚡ 顺带搞懂：为什么保存后不用手动刷新就变了？（HMR 原理）

上面第 3 条说的 **HMR（Hot Module Replacement，热模块替换）** 并不是“Vite 帮你自动按了F5”——它做的是**只替换你改动的那一个模块、不重载整页、保留当前页面运行时状态**。完整链路是：

1. `npm run dev` 启一个 **Vite 开发服务器**，浏览器与它之间保持一条 **WebSocket 长连接**；
2. 你保存 `App.vue`，Vite 监听到文件变化，用 `@vitejs/plugin-vue` 把它**重新编译成一个新的 JS 模块**；
3. 服务器通过那条 WebSocket 推一条“某模块更新了”的消息给浏览器；
4. 浏览器端的 HMR runtime 收到后，**动态 import 这个新模块、就地替换旧的**，Vue 再把新组件渲染进页面——**整页不重载，`count` 之类的运行时状态不丢**。

对比记住：**刷新（live reload）= 整个页面推倒重来、状态清空**；**HMR = 只换变更的那个模块、状态保留**。这也是为什么它只在 `npm run dev` 下生效——生产 `npm run build` 后没有这套机制，改代码必须重新部署刷新。更多细节归 **10-vite**，这里先把“它凭什么不刷新”的原理建立起来即可。

### 🔧 起步最常见的三个错（记住它们「会报什么」）

```vue
<!-- 目的：把新手第一次跑不起来时的三种典型错误集中演示，注释标出各自的真实后果 -->

<!-- ❌ 错误 1：模板用了「未声明」的变量（拼错 msg → mesg） -->
<script setup>
const msg = "Hello";
</script>
<template>
  <p>{{ mesg }}</p>   <!-- 后果：控制台告警 "Property 'mesg' ... not defined on ... setup bindings"，该处渲染为空白 -->
</template>
```

```bash
# ❌ 错误 2：跳过了 npm install 就直接 npm run dev
npm run dev
# 后果：报 "'vite' 不是内部或外部命令" 或 "Cannot find module 'vite'"——因为依赖还没装进 node_modules
# 正解：先 npm install（生成 node_modules/），再 npm run dev
```

```js
// ❌ 错误 3：main.js 挂载到一个 index.html 里不存在的选择器
import { createApp } from "vue";
import App from "./App.vue";
createApp(App).mount("#app2"); // 后果：控制台 "Failed to mount app: mount target selector returned null"，页面整片空白
// 正解：index.html 里必须存在 <div id="app"></div>，且此处 mount("#app") 与之一致
```

---

## 四、一个 Vue 项目的目录结构（以路线 B 为例）

```
my-vue-app/
├── index.html            ← 入口 HTML（Vite 把它当"主页面"，里面 <div id="app"> 挂载点 + <script src="/src/main.js">）
├── package.json          ← 项目清单：依赖、scripts(dev/build/preview)
├── vite.config.js        ← Vite 配置：注册 @vitejs/plugin-vue、别名、代理等
├── node_modules/         ← 装出来的依赖（不用改、不进 Git）
├── public/               ← 原样拷贝的静态资源（favicon.ico 等，不参与编译）
└── src/                  ← ★ 你的代码几乎全在这里
    ├── main.js           ← JS 入口：createApp(App).mount('#app')
    ├── App.vue           ← 根组件（Hello World 就改它）
    ├── components/       ← 可复用的子组件放这里（如 HelloWorld.vue）
    └── assets/           ← 需要被打包处理的资源（图片、CSS）
```

**两条主线认清楚**：

1. `index.html` 里的 `<div id="app"></div>` 是**挂载点**；
2. `src/main.js` 里 `createApp(App).mount('#app')` 把根组件 `App.vue` **挂**到那个 div 上。

```js
// src/main.js —— 整个应用的启动按钮
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

其余目录（router、pinia、stores）是**加了功能才会出现**的，起步阶段没有它们完全正常。

### 📁 public/ 与 src/assets/ 到底差在哪（小测爱考）

上面目录树里两个都能“放图片”，但走的是**两条完全不同的通道**，这是起步最容易混的点：

| | `public/` | `src/assets/` |
|---|---|---|
| 处理方式 | **原样拷贝**到 `dist/` 根，一个字节都不动 | 交给 Vite 走**打包管线**（编译、压缩、hash、tree-shaking） |
| 怎么引用 | 用**绝对路径**字符串：`<img src="/logo.png">` | 用 **import / 相对路径**：`import logo from './assets/logo.png'` 或 `src="./assets/logo.png"` |
| 文件名 | 保持不变（`logo.png` 永远是 `logo.png`） | 构建后带 **hash**（`logo-a1b2c3.png`），内容变才变名 |
| 能否被依赖分析 | 不能——Vite 不知道里面引用了什么，写错也不报错 | 能——路径写错构建直接报错，且小图可内联成 base64 |
| 适合放什么 | `favicon.ico`、`robots.txt`、不参与构建的第三方静态文件 | 组件里用到的图片、CSS、需要 hash 长缓存的资源 |

**一句话记法**：`public/` 是“直接透传的静态目录，用 `/xxx` 绝对路径点名”；`src/assets/` 是“进入构建图、会被处理和 hash 的资源，用 import/相对路径引”。**绝大多数随组件用的图片/样式放 `src/assets/`；只有那些“必须保持原文件名、或本就不该被打包”的东西才进 `public/`。**

（回到 §六：这里给的是主干认知——`public` vs `assets` 的本质区别现在你就该答得上来；至于 base 路径、public 里引用相对路径的坑等“边角细节”，仍可日后回 10-vite 深挖。）

---

## 五、SFC 三段式：一个 `.vue` 文件里有什么

一个 `.vue` 文件 = 三块，各司其职：

```vue
<!-- 目的：一个标准 SFC —— 逻辑/视图/样式三段各司其职，渲染出可点击自增的计数器 -->
<script setup>
// 逻辑：数据、方法、引入了哪些子组件
import { ref } from "vue";
const count = ref(0);        // 响应式数字，初始值 0（模板里自动解包，读写不用写 .value）
</script>

<template>
  <!-- 视图：长什么样，用 {{ }} 插值、@click 绑事件、:class 绑属性 -->
  <button @click="count++">{{ count }}</button>  <!-- 初始显示 0；每点一次 count 自增 1，视图自动更新 -->
</template>

<style scoped>
/* 样式：scoped 表示只作用于本组件，不污染全局 */
button { padding: 8px 16px; }
</style>
```

- **`<script>`**：组件的逻辑与状态（本课起统一用 `<script setup>`）；
- **`<template>`**：HTML 加上 Vue 的模板语法（指令、插值），描述 UI；
- **`<style scoped>`**：这个组件的 CSS，`scoped` 让样式"只影响自己"。

三段顺序无所谓，但**都必须写在这一个文件里**（这就是"单文件组件"的含义：把 UI、逻辑、样式收拢到一处）。

---

## 六、重要性分层：该往哪儿使劲 🎯

新手最大的坑是"想一次全学会"。给你一个红绿灯：

**🔴 核心中的核心（每天都在写，必须烂熟）**
- `.vue` 三段式（template/script/style）；
- `<script setup>` + `ref / reactive / computed`（响应式，下一关开始）；
- **组件组合**：`import` 一个组件、在模板里当标签用、用 `props` 传数据、`emits` 传事件；
- 模板语法：`{{ }}` 插值、`v-if / v-for / v-on(@) / v-bind(:) / v-model`。

**🟡 次要（理解"流程"即可，用到再深挖）**
- `main.js` 的 `createApp().mount()` 挂载机制；
- `vite.config.js` 改别名、配代理时才碰；
- Vue Router（路由，L5）、Pinia（状态管理，L6）——它们是**插件生态**，不是 Vue 本体；
- `package.json` 的 scripts、`npm install / run / build` 日常命令。

**🟢 可暂缓（工程成熟后再回来学）**
- SSR / Nuxt、编译器宏的编译产物、性能优化（虚拟滚动、patchFlag）、插件机制、测试脚手架、`public` vs `assets` 的边角细节。

> 学习顺序建议：先 🔴 把"组件 + 响应式 + 模板语法"跑顺，再 🟡 加路由和状态，最后 🟢 谈优化与全栈。**别一上来就啃 vite.config 和 SSR**。

### 📖 术语速查：本课扫过、但没展开的词，先混个脸熟

下面这些词课文里顺手写过、却没解释，初学者容易卡壳。这里**只给一句话大意**（不用记、更不用现在懂），知道“它大致干嘛 + 后面哪一关细讲”即可：

| 词 | 一句话大意（在哪关细讲） |
|---|---|
| 脚手架 | 帮你一键生成项目初始目录与配置的工具（如 `npm create vue@latest`）——就是“搭开工前的架子”。 |
| 响应式 | 数据一变，用到它的视图自动更新，不用你手动操作 DOM——Vue 的核心，L1 后续几关讲。 |
| 插值 `{{ }}` | 把表达式的值“嵌”进 HTML 文本里显示，就是模板里那对花括号。 |
| 指令 | Vue 加在 HTML 属性上的特殊记号（`v-if`、`v-for`、`@click`、`:class`），告诉 Vue“怎么渲染/绑事件”，L2 模板与渲染细讲。 |
| props / emits | 父传子用 `props`、子报事给父用 `emits`——组件之间递数据的两个口子，L3/L4 讲。 |
| import / export | ES 模块语法：`import` 拿别人导出的东西、`export` 把自己的东西给别人用——一个文件当一个模块拼图。 |
| 编译 / 打包 | 编译=把浏览器看不懂的（`.vue`/TS/JSX）翻译回能跑的 JS；打包=把零散模块合并压缩成上线用的产物（归 10-vite）。 |
| 别名 / 代理 | 别名=给长路径起短名（如 `@` 指 `src`）；代理=开发时把 `/api` 请求转发到后端——都在 `vite.config.js` 配，用到再查。 |
| tree-shaking | 打包时把“写了却没人用”的代码摇掉、减小体积。 |
| hash（资源指纹） | 构建时给文件名加一段内容指纹（`logo-a1b2c3.js`），内容变名字才变——为了缓存得准。 |
| base64 内联 | 把小图片直接编成一段字符串塞进 JS/CSS，省一个单独文件请求。 |
| CDN | 把静态资源分发到就近节点加速下载的“内容分发网络”，部署时概念，L8/部署关讲。 |
| WebSocket | 浏览器与服务器之间一条“双向长连接”，服务端能主动推消息给浏览器——HMR 就是靠它通知“模块更新了”。 |
| 编译器宏 | 编译时才展开、长得像函数但不用 import 的语法糖（如 `defineProps`），下一关 `<script setup>` 就碰到。 |
| patchFlag | Vue 编译模板时打的“哪块会变”标记，更新时只比对带标记的地方，一种性能优化，🟢 阶段再讲。 |
| 虚拟滚动 | 列表极长时只渲染“屏幕看得见那几条”，省 DOM、提性能，🟢 阶段再讲。 |
| SSR / Nuxt | SSR=在服务端先把页面渲染成 HTML 再发（首屏更快/利于 SEO）；Nuxt 是基于 Vue 的成套全栈框架，L8 入门。 |
| `scoped` | `<style scoped>` 让这个组件的 CSS 只作用于自己、不污染别的组件（本课第五节已用过）。 |

---

## 七、自检清单

- [ ] 用 create-vue 或 Vite 脚手架，从零到浏览器看到页面，你需要哪几条命令？
- [ ] `index.html` 里的 `<div id="app">` 和 `src/main.js` 里的 `mount("#app")` 是什么关系？
- [ ] 一个 `.vue` 文件的三段分别负责什么？`scoped` 有什么用？
- [ ] 为什么改了 `App.vue` 保存后浏览器不用手动刷新就变了？（HMR）
- [ ] 起步阶段，router / pinia / vite.config 属于"必懂"还是"可暂缓"？
- [ ] `public/` 和 `src/assets/` 的资源有什么本质区别？

---

## 🚀 部署预告

- 你现在用的开发命令 `npm run dev` 与最终上线的 `npm run build`，都归 **Vite**（10-vite 包）管，本课不展开；
- `createApp(App).mount("#app")` 这句"启动按钮"，会在 **vue-project-architecture**（L8）里和大型项目结构一起回顾；
- 本项目外壳 `web/src`（`App.vue`、`main.js`、`components/*.vue`）就是一个真实 Vue3+Vite 工程，**通关本课后可直接打开它对号入座**；
- 下一课 **vue-script-setup**：把今天先"囫囵接受"的 `<script setup>` 彻底讲清楚——它为什么是后续每一课的默认写法。

下一关进入 **vue-script-setup**：拆解 `<script setup>` 语法糖。
