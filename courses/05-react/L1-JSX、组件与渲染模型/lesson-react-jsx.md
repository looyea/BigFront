# JSX 语法与编译

> 目标：JSX 是 React 的门面——看着像 HTML，其实是 **JavaScript 的表达式**，编译后被还原成 `createElement`/`jsx()` 函数调用。本课讲清：JSX 与 HTML 的差异（`className`/`htmlFor`/自闭合/单根）、`{}` 表达式插值（不是模板字符串、能放任意表达式）、`children` 与数组渲染、**自动转义防 XSS**、以及它到底被编译成什么（经典 `React.createElement` vs 新自动运行时 `jsx`）。（呼应 vue-template-syntax、react-render-model、10-vite/esbuild 的转换）

---

## 〇、先把 React 跑起来（本课的代码写在哪）

React 不像 Vue 那样有个开箱即用的“起步工程”讲——它需要一个工程把 JSX 编译、把依赖打包。起步最省事的姿势是用 Vite 的 React 模板（完整的创建与部署留到后面的关，这里只求“有个能跑的地方”）：

```bash
# 目的：三分钟起一个能跑 Hello World 的 React 工程（React 官方推荐用构建工具，不推荐裸 CDN）
npm create vite@latest my-react-app -- --template react-ts   # 想纯 JS 用 react（社区模板）
cd my-react-app
npm install        # 装依赖，生成 node_modules
npm run dev        # 起开发服务器，终端打印 http://localhost:5173
```

打开地址会看到 Vite+React 的欢迎页。之后本课所有 JSX 片段都写在 `src/App.jsx`（或 `.tsx`）里——那是根组件。它与 Vue 工程的对应关系：`main.jsx` ≈ `main.js`（里面 `createRoot(document.getElementById('root')).render(<App />)` 就是 React 的“挂载”）、`App.jsx` ≈ `App.vue`。挂载入口与 Vue 的 `createApp().mount('#app')` 不同，细节到 react-component / react-render-model 再讲。

> 概念课为讲清原理，下面的 JSX 代码块常写成脱离工程的片段——它们默认都发生在 `App.jsx` 的组件函数体内；改完回工程 `npm run dev` 会热更新（HMR，同 Vue 那关讲的机制）。

---

## 一、JSX 到底是什么

```jsx
// 目的：一行 JSX——看着像 HTML，实为 JS 表达式（name 是当前作用域变量）
const el = <h1 className="title">Hello {name}</h1>;
// ❌ 写 class="title" →  React 警告且样式可失效（class 是 JS 保留字，须 className）
```
它**不是** HTML 字符串，而是 JS 表达式，编译后是函数调用（旧写法）：
```js
const el = React.createElement('h1', { className: 'title' }, 'Hello ', name);
// 新 JSX 运行时（React 17+）：
const el = jsx('h1', { className: 'title', children: ['Hello ', name] });
```
`createElement`/`jsx` 返回的是一个**普通 JS 对象**（描述"该渲染什么"的 React Element），不是真实 DOM。真实 DOM 是 React 之后按这些对象"协调"出来的（呼应 react-render-model）。Vite 里由 `@vitejs/plugin-react`（esbuild/Babel）完成这层转换（呼应 10-vite 插件、vue-sfc-compiler-macros 的"编译期转译"心智）。

---

## 二、JSX vs HTML：必须记住的差异

| HTML | JSX | 为什么 |
|---|---|---|
| `class="x"` | `className="x"` | `class` 是 JS 保留字 |
| `for="id"` | `htmlFor="id"` | `for` 是关键字 |
| `<br>` `<input>` | `<br />` `<input />` | 必须**自闭合** |
| 多个根 | 单一根（或 `<>...</>` 片段） | 表达式只能有一个值 |
| `style="color:red"` | `style={{ color: 'red' }}` | style 是**对象** |
| `onclick` | `onClick` | 事件驼峰 |
| `<!-- -->` | `{/* */}` | 注释是 JS 表达式 |

多根用 **Fragment**：`<><A/><B/></>`，需要 key 时用 `<React.Fragment key=...>`。

---

## 三、`{}` 插值：是表达式不是语句

```jsx
// 目的：{} 里只能放表达式（有返回值的），不能放 if/for/var 语句
<p>结果：{a + b}</p>            {/* ✅ 表达式 */}
<p>{isLoggedIn ? 'Hi' : '登录'}</p>
<p>{list.length}</p>
<p>{user.name}</p>              {/* 点取值 */}
<p>{data?.count ?? 0}</p>       {/* 可选链 + 空值合并（呼应 ES 包）*/}
{/* ❌ <p>{if (x) 'a'}</p> → 编译报错（if 是语句无返回值，要逻辑就用三元/&&/.map()）*/}
{/* ⚠️ {count && <X/>} 当 count=0 会渲染出 "0"（false/null/undefined 才渲染为空，0 会显）*/}
```
- `{}` 里放**表达式**，不能放 `if`/`for`/`var` 等**语句**（语句无返回值）；要逻辑就三元、`&&`、`.map()`；
- 值渲染规则：`false`/`null`/`undefined` 渲染为**空**（这就是 `{ok && <X/>}` 条件渲染的原理），但 **`0` 会被渲染出来**（`{count && ...}` 当 count=0 会显示 0 的经典坑）。

---

## 四、children 与数组渲染

```jsx
// 目的：标签之间的内容成为 props.children；数组自动展开，每个元素必须给 key
<Card>
  <p>两个标签之间的内容成为 props.children</p>
</Card>

<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}   // ✅ 稳定唯一 id 作 key
  {/* ❌ 不写 key → 控制台警告 "Each child in a list should have a unique key"，列表重排会错乱复用 */}
</ul>
```
- 标签之间的东西是 `props.children`（呼应 react-component）；
- JSX 里放**数组**会自动展开渲染，所以 `{list.map(...)}` 是列表标准写法；
- 数组元素**必须给 `key`**——React 靠 key 判断"哪个是哪个"来复用节点（详见 react-lists-keys、react-render-model diff）。

---

## 五、自动转义与 XSS

JSX 里 `{}` 插入的字符串会被 React **自动转义**，天然防注入：
```jsx
// 目的：{} 插入的字符串被 React 自动转义，天然防注入
<p>{userInput}</p>   {/* ✅ "<script>" 会被转成文本，不执行 */}
{/* ❌ 直接 dangerouslySetInnerHTML={{ __html: userInput }} 且未清洗 → XSS */}
```
要渲染可信 HTML 富文本才用 `dangerouslySetInnerHTML={{ __html: clean }}`——**这是逃生舱**，未经清洗的用户内容绝对不能进（否则 XSS，呼应 vue-template-syntax 的 v-html XSS、exp-security/OWASP）。

---

## 六、JSX 两种编译：经典 vs 自动运行时

- **经典**：`React.createElement`，文件必须 `import React`；
- **自动（React 17+，推荐）**：编译到 `react/jsx-runtime` 的 `jsx/jsxs/Fragment`，**无需 import React**，产物更小、tree-shaking 更好。
新项目默认自动运行时；Vite 的 `@vitejs/plugin-react`、Babel `@babel/preset-react`、TS 的 `"jsx": "react-jsx"` 都配置这层（呼应 ts-project、02-ts）。

---

## 七、自检清单

- [ ] JSX 编译后是什么？返回的是 DOM 还是对象？
- [ ] 为什么 JSX 里 `class`→`className`、`style` 要传对象？
- [ ] `{}` 里能放 `if` 吗？为什么？`0` 和 `false` 渲染有何不同？
- [ ] 列表 `map` 为什么必须给 key？
- [ ] JSX 默认怎么防 XSS？`dangerouslySetInnerHTML` 何时用、风险？

---

## 🚀 部署预告

- JSX 里的 `key` 是理解 **react-render-model（L1 下一段）** 协调算法的钥匙；
- `props.children` 是组件组合的基础，进入 **react-component** 详解函数组件与 props；
- JSX 只是"另一种写 JS 的方式"，Vue 也支持 JSX（呼应 vue-template-syntax 用的是模板编译，两条路殊途同归到 render 函数）。

下一关进入 **react-component**：函数组件、props 只读、children、组合，以及"组件是函数、每次渲染重新执行"这一 React 核心心智。
