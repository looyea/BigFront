# L1 · 为什么要 TS + 基础类型注解

> 🎯 目标：理解 TypeScript 到底解决什么问题，会给变量和函数加类型，分得清 `any` 与 `unknown`。

## 一、TS 是什么

**TypeScript = JavaScript + 静态类型检查**。它是微软出品，最终会被编译（更准确说"转译"）回普通 JS 再运行。类型只存在于**开发和编译阶段**，运行时会被全部擦除——TS 不会让程序变快，它让你在**写代码时**就发现错误。

```js
// JS：运行时才炸
function add(a, b) { return a + b; }
add('1', 2); // '12' —— 静默的错误

// TS：编译时就红线
function addT(a: number, b: number): number { return a + b; }
addT('1', 2); // ❌ 编辑器立刻报错，问题死在运行前
```

## 二、基础类型注解

```ts
let name: string = '小明';
let age: number = 18;
let ok: boolean = true;
let ids: number[] = [1, 2, 3];
let tuple: [string, number] = ['a', 1];   // 元组：定长且每位类型固定
```

## 三、类型推断：能省则省

TS 会自动推断，写多了反而啰嗦：

```ts
let city = '北京';   // 自动推断为 string
city = 123;          // ❌ 仍会报错，因为它知道 city 是 string
```

原则：**大多数局部变量不用手写类型**，在函数边界（参数、返回值）和复杂结构上再显式标注。

## 四、函数类型

```ts
function greet(name: string): string {
  return `Hi, ${name}`;
}
// 箭头函数同样
const double = (n: number): number => n * 2;
```

## 五、any vs unknown vs never（高频考点）

| 类型 | 含义 | 使用 |
| --- | --- | --- |
| `any` | 关闭类型检查，退回 JS | ❌ 尽量避免，它是"类型系统的黑洞" |
| `unknown` | 未知类型，用前必须先收窄 | ✅ 替代 any 的安全选择（如 `JSON.parse`、`catch`） |
| `never` | 永远不会有值（如总抛错的函数） | 用于穷尽性检查 |

```ts
let x: unknown = JSON.parse('...');
// x.foo;           // ❌ 不允许直接访问
if (typeof x === 'string') { x.toUpperCase(); } // ✅ 收窄后才能用
```

## 六、动手示例

- `ts-basics/01-types.ts`

你用的是 Node 24，可直接**免编译**运行 `.ts`（原生类型擦除）：

```bash
node courses/02-typescript/examples/ts-basics/01-types.ts
```

完成「本关小测」+ `homework/L1.md` 解锁 L2。
