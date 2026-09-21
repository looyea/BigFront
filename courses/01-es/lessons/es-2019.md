# ES2019：扁平化、容错与「体验修补」

> 目标：掌握 **`Array.prototype.flat` / `flatMap`**、**`Object.fromEntries`**、**可选 catch 绑定**、**`Symbol.description`**、**`trimStart/trimEnd`**、**`JSON` 良构（well-formed）**、**稳定的 `sort`**、**规范的 `Function.prototype.toString`**。这一年没有大语法，但几乎每一项都是「每天都在用」的质量改进。

---

## 一、ES2019 的定位

**"ES2019 是体验修补年"**：提案普遍来自**开发者日常吐槽**——`catch(err)` 里 err 用不上还得写、深数组没法拍平、`Map` 转不回对象……TC39 把一批**小而实用**的东西一次落地，共约 10 项。

---

## 二、`flat` / `flatMap`：数组扁平化

```js
[1, [2, [3, [4]]]].flat();        // [1, 2, [3, [4]]]   默认深度 1
[1, [2, [3, [4]]]].flat(Infinity); // [1, 2, 3, 4]       全拍平
[1, , 3].flat();                   // [1, 3]             ⚠️ 会剔除空洞
[[1,2],[3,4]].flatMap(x => x);     // [1, 2, 3, 4]       = flat(map(...), 1)
```

**`flatMap` 的杀手用例**——一个元素映射成多个 / 零个：
```js
// 分词：一句话 → 多个词
sentence.split(' ').flatMap(w => w.split(','));   // 逗号再拆
// 过滤式映射：返回 [] 就等于"丢弃这个"
items.flatMap(i => i.valid ? [i.value] : []);
```

**陷阱**：
- `flat` **不改变原数组**（返回新数组）；
- `flat(Infinity)` 遇到**自引用数组**（`a.push(a)`）会栈溢出；
- `flatMap` **只拍一层**，要更深得 `arr.flatMap(...).flat(2)`。

呼应 [es-array-api](es-array-api.md)：`map` 返回数组套数组时，`flatMap` 一步到位。

---

## 三、`Object.fromEntries`：entries 的逆运算

```js
const entries = [['a', 1], ['b', 2]];
Object.fromEntries(entries);            // { a: 1, b: 2 }

// 经典三连：Map → 改值 → 回对象
const map = new Map([['x', 1], ['y', 2]]);
const obj = Object.fromEntries(
  [...map].map(([k, v]) => [k, v * 10]) // { x: 10, y: 20 }
);

// 过滤对象属性
Object.fromEntries(
  Object.entries(user).filter(([k]) => k !== 'pwd')
);
```

`fromEntries` 让「对象 ↔ 键值对数组 ↔ Map」三态转换形成闭环（呼应 [es-map-set](es-map-set.md)、[es-object-api](es-object-api.md)）。

---

## 四、可选 catch 绑定

```js
try { risky(); }
catch {            // ✅ 不关心错误对象时，省掉形参
  fallback();
}
// 旧的 catch(e) 里若不用 e，ESLint no-unused-vars 会告警
```

纯粹为「不想要参数就别硬写个占位变量」的整洁性而生。

---

## 五、`Symbol.description`（只读）

```js
const s = Symbol('myToken');
s.description;      // 'myToken'（ES2019 前只能 String(s) === 'Symbol(myToken)'）
Symbol().description; // undefined
```

给日志/调试一个**干净的符号名**读取方式。呼应 [es-symbol](es-symbol.md)。

---

## 六、字符串修剪改名：`trimStart` / `trimEnd`

```js
'  hi  '.trimStart();  // 'hi  '（旧别名 trimLeft）
'  hi  '.trimEnd();    // '  hi'（旧别名 trimRight 保留兼容）
```
`trimLeft/trimRight` 仍可用，只是**规范首选新名**。

---

## 七、被忽略但重要的三项

### 1. `JSON` 良构（well-formed stringify）
`JSON.stringify` 现在能正确序列化**孤立代理对（lone surrogate）**，浏览器不再产出非法 JSON：
```js
JSON.stringify('\uD800');   // '"\\ud800"'（转义，不再输出破坏性字符）
```
### 2. `Array.prototype.sort` 必须稳定
ES2019 **规定** sort 稳定（相等元素保持原相对顺序）。此前 V8 对 >10 个元素用快排**不稳定**，坑过无数人。
### 3. `Function.prototype.toString` 规范化
现在**逐字符返回源码**（含注释、空格），此前引擎实现各异。

---

## 八、自检清单

- [ ] `[1,[2,[3]]].flat()` 与 `.flat(Infinity)` 分别得到什么？
- [ ] `flatMap` 等价于哪两步的组合？它默认拍几层？
- [ ] 如何一行把 `Map` 转成对象？把对象某属性剔除后转回对象？
- [ ] 可选 `catch {}` 省掉了什么、解决了哪类 lint 告警？
- [ ] ES2019 对 `sort` 稳定性做了什么强制规定？为什么以前会「翻车」？
- [ ] `Symbol('abc').description` 返回什么？

---

## 🚀 部署预告（本关点到，细节在 L10）

1. **`flat` / `flatMap` / `fromEntries` / `trimStart/End`** 全是**运行时方法**，降级需要 core-js polyfill；`flatMap` 依赖 `Symbol.species`，polyfill 体积略大（合计约 1KB gzipped）。
2. **稳定的 `sort`** 是**引擎行为**，polyfill 无法修复——老环境（IE、旧 Node）里相等元素顺序可能与新环境不同，**测试要覆盖运行环境**。
3. **`JSON` 良构**同样无法 polyfill，属于内部实现差异。
4. **可选 catch / Symbol.description / toString** 由 Babel **语法降级**即可，无运行时成本。
5. **Vite 现代 target**（es2020）下这些方法**原生支持、零 polyfill**；只有把 browserslist 拉到 IE/旧安卓时才需要 core-js。详见 [es-build](es-build.md)。

**你现在只需记住**：**ES2019 = 让「拍平、转 Map、写 catch、排序稳定」这些日常动作变得可预测**，工程价值远大于语法新奇度。
