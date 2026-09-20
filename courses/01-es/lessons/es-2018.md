# ES2018：异步补票与对象展开

> 目标：掌握 **对象 rest/spread**、**异步迭代**（`for-await-of`）、**`Promise.prototype.finally`**、**正则四项升级**（命名捕获组、`s` 标志、lookbehind、unicode property escape）；理解这一年为什么被称为「**为 async/await 补票**」。

---

## 一、ES2018 的定位

**"ES2018 是 async/await 的补票年"**：
- 2017 带来了 async/await，但**没有 for-await-of**、**没有 finally**——异步循环和清理还得手写；
- 2018 把**异步生态**补齐；
- 同时**对象 spread** 正式入规范（此前是 babel 插件）——把 React/Redux 里的 `{...obj}` 从实验变成标准。

**ES2018 一共只有 15 项提案**——但每一项都命中痛点。

---

## 二、对象 rest / spread

### 语法
```js
const user = { id: 1, name: 'Ann', email: 'a@x.com', pwd: 'secret' };
const { pwd, ...publicUser } = user;    // **rest**：把剩下的收进 publicUser
const updated = { ...user, name: 'Bob' };  // **spread**：浅拷贝 + 覆盖
const merged = { ...defaults, ...opts };   // 后者胜
```

### 三大用途
1. **不可变更新**（Redux reducer）：`{ ...state, todos: [...state.todos, newTodo] }`；
2. **属性剔除**：`const { pwd, ...safe } = user;`——比 `delete obj.pwd` 更纯；
3. **默认值合并**：`const cfg = { ...DEFAULTS, ...userOpts }`。

### 与 `Object.assign` 的差异
| 维度 | `{ ...obj }` | `Object.assign(target, obj)` |
| --- | --- | --- |
| 目标 | **新建对象** | 修改 target（可传 `{}` 变新建） |
| 原型链上的 getter | **触发并拷贝值** | 同样触发 |
| Symbol 键 | ✅ 拷贝 | ✅ 拷贝 |
| 可打断 | 语法，无法拦截 | 可被 Proxy set trap 拦截 |
| 数组 | ❌ spread 只拷**可枚举自有键**，得 `{...[1,2]}` = `{0:1, 1:2}` | 同 |

### ⚠️ 陷阱
- **只处理自有可枚举属性 + Symbol**——**没有 getter 复制**（读一次求值）；
- **数组展开进对象**得到**索引对象**，不是数组拷贝；
- **浅拷贝**——嵌套对象引用同一份。

---

## 三、异步迭代：`for-await-of`

```js
// 一个 AsyncIterable（每次 yield 一个 Promise）
async function* fetchPages() {
  for (let i = 1; i <= 3; i++) {
    yield await fetch(`/api/page/${i}`).then(r => r.json());
  }
}

for await (const page of fetchPages()) {
  console.log(page.title);
}
```

**规则**：每次 `next()` 返回 `Promise<{ value, done }>`——`for await` 会**自动 await**再进入循环体。

**典型来源**：
- **Node 12+ Readable streams**：`for await (const chunk of fs.createReadStream('big.txt'))`；
- **fetch body**（`response.body` 是 `ReadableStream` → AsyncIterable）；
- **GraphQL subscription / SSE / WebSocket**：库会包成 AsyncIterable；
- **手写 async generator**。

**⚠️ 陷阱**：`for await` **不并发**——一次拿一个，前一个没完成不 next。要并发得手动 `.next()` 或用 `stream` 事件。

---

## 四、`Promise.prototype.finally`

```js
showLoading();
fetch(url)
  .then(r => r.json())
  .then(render)
  .catch(showError)
  .finally(() => hideLoading());   // 无论成败都跑
```

**规则**：
- **不接参数**——上游的 value/reason 会**原样穿透**；
- **finally 里 throw**：覆盖上游状态；
- **finally 里返回 Promise**：**等它 settle** 才继续（不影响结果）；
- **finally 里 return**：**不吞**上游的值或错误。

**用途**：关 loading、清 timer、释放资源、`AbortController.abort()` 之后收尾。

---

## 五、正则四项升级

### 1. **命名捕获组**（`(?<name>...)`）
```js
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const m = re.exec('2026-09-20');
console.log(m.groups.year);        // '2026'
const { year, month, day } = m.groups;   // 直接解构
```
**取代**：`m[1], m[2], m[3]`——可读性飞跃。

### 2. **`s` 标志**（dotAll）
```js
/a.b/s.test('a\nb');   // true
/a.b/.test('a\nb');    // false（. 默认不匹配 \n）
```
**用途**：多行文本匹配——终于不用写 `[\s\S]`。

### 3. **Lookbehind**（`(?<=...)` / `(?<!...)`）
```js
'abc123'.match(/(?<=b)\d+/);       // ['123'] — 前面必须是 b
'1.50 2.00'.match(/(?!\.)(\d+)/);  // 负向先行
'12USD'.match(/(?<=\d)USD/);       // 前面必须是数字
```
**⚠️ 兼容性**：Safari 16.4 才支持（此前 WebKit 有安全担忧）；配 babel-plugin 转 ES5 会**炸**——因为正则语法降级不了。

### 4. **Unicode Property Escape**（`\p{...}` / `\P{...}`）
```js
const emoji = /\p{Emoji_Presentation}/gu;
'🎉 hello'.match(emoji);   // ['🎉']
const han = /\p{Script=Han}+/u;
'Héllo 世界'.match(han);   // ['世界']
```
—— 终于**不用手写 Unicode 范围**判断字符类别。

---

## 六、其它小项

- **`parseInt` / `Number` 行为微调**（无关痛痒）；
- **Template Literal 允许 `\8` `\9`**（此前是 octal escape 冲突）；
- **RegExp `exec` groups 属性**：命名捕获组的容器；
- **Spread properties in object literals**：已在第二节讲；
- **Asynchronous Iteration** 协议：Symbol.asyncIterator。

---

## 七、真实工程写法

### 场景 1：**Redux reducer 的不可变更新**
```js
function reducer(state = initial, action) {
  switch (action.type) {
    case 'ADD': return { ...state, items: [...state.items, action.item] };
    case 'SET_NAME': return { ...state, user: { ...state.user, name: action.name } };
    case 'REMOVE': {
      const { [action.idx]: _, ...rest } = state.items;
      return { ...state, items: rest };
    }
    default: return state;
  }
}
```

### 场景 2：**Node 流式处理**
```js
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

await pipeline(
  createReadStream('big.log'),
  zlib.createGzip(),
  createWriteStream('big.log.gz'),
);
```
—— 内部就是 `for await` + `Symbol.asyncIterator`。

### 场景 3：**日期字符串解析**
```js
const re = /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})(?:[T\s](?<time>.*))?$/;
const { groups: { y, m, d } } = re.exec('2026-09-20T10:00') ?? {};
```
—— 命名捕获组 + nullish coalescing + 解构，**三件套合体**。

---

## 八、自检清单

- [ ] 对象 spread 与 `Object.assign` 有何差别？
- [ ] `const { pwd, ...rest } = user` 是浅拷贝还是深拷贝？pwd 会被拷贝吗？
- [ ] `for await...of` 与普通 `for...of` 的核心差别是什么？给一个 Node stream 例子。
- [ ] `Promise.finally` 里 return 会吞上游错误吗？
- [ ] `s` 标志、`\p{...}`、lookbehind 分别解决什么问题？
- [ ] 命名捕获组的值挂在匹配结果的哪个字段上？

---

## 🚀 部署预告（本关点到，细节在 L10）

**ES2018 与构建/部署：**

1. **对象 spread** 曾长期是 babel 插件（`@babel/plugin-proposal-object-rest-spread`）——2018 标准化后可以直接降级为 `Object.assign({}, obj)` 或 `_extends`；现代 target（Chrome 60+）不转。
2. **`for await-of`** 转 es5 需要 regenerator + Symbol.asyncIterator polyfill——**约 2KB**；Vite target es2015 起原生支持。
3. **命名捕获组**：**babel 不能降级**（正则语法引擎级）；含 IE 或 Safari <16.4 时避免使用。
4. **`\p{...}`** 也**不能降级**——用 `unicode-match-property-*` 手写正则；ESLint 有 `regexp/no-unsupported-features` 检查。
5. **polyfill 成本**：ES2018 大部分是**语法**（不需要 polyfill），只有 `Promise.prototype.finally` 需要**运行时补丁**（core-js 约 200B gzipped）。
6. **Terser 与 minify**：spread 与 for-await 都会被压缩工具正常处理；lookbehind 因**Safari 兼容**在生产上常被 ESLint 禁用。

细节 L10 展开。**你现在只需要记住**：**ES2018 让对象操作和异步迭代进入「语法舒适区」，同时**给正则现代化**——但**注意 Safari 兼容性。**
