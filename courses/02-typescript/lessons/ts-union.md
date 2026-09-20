# L3 · 联合类型与类型收窄

> 🎯 目标：用联合类型表达"多种可能"，并用**类型收窄**让 TS 在每个分支里精确知道当前类型。这是写出既灵活又安全的 TS 的关键技能。

## 一、联合类型 `|`

```ts
let id: string | number;   // 可以是 string 也可以是 number
id = 'a';
id = 1;
// id = true;  // ❌
```

联合类型上只能访问**所有成员共有**的方法（如 `toString`），要访问特有方法必须先收窄。

## 二、类型收窄（Narrowing）

```ts
function printId(id: string | number) {
  if (typeof id === 'string') {
    console.log(id.toUpperCase());  // ✅ 此分支里 id 被认定 string
  } else {
    console.log(id.toFixed(2));     // ✅ 此分支里 id 被认定 number
  }
}
```

收窄手段：`typeof`、`instanceof`、`in`、`===` 判定、真值判断。

## 三、可辨识联合（Discriminated Union）—— 最强大的模式

用共同的字面量"标签字段"区分，React/Vue 的状态、reducer action 全靠它：

```ts
type Result =
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; code: number };

function handle(r: Result) {
  switch (r.status) {
    case 'loading': return '加载中';
    case 'success': return r.data;      // ✅ 只有这里能访问 data
    case 'error':   return '错误码' + r.code; // ✅ 只有这里能访问 code
  }
}
```

## 四、字面量类型与穷尽检查

```ts
type Direction = 'up' | 'down' | 'left' | 'right';
```

配合 `never` 做**穷尽性检查**：新增分支忘了处理时，编译器会报错：

```ts
function assertNever(x: never): never {
  throw new Error('未处理: ' + JSON.stringify(x));
}
```

## 五、类型断言 `as`（谨慎使用）

当你比编译器更清楚类型时，可"告诉"它：

```ts
const el = document.getElementById('app') as HTMLInputElement;
```

> ⚠️ 断言是"说服编译器"，不做任何运行时检查，用多了等于自废武功。优先用收窄，而不是到处 `as`。

## 六、动手示例

- `ts-union/01-narrow.ts` —— 可辨识联合 + switch 收窄

```bash
node courses/02-typescript/examples/ts-union/01-narrow.ts
```

完成「本关小测」+ `homework/L3.md` 进入泛型。
