# L5 · tsconfig 与实用类型

> 🎯 目标：读懂 `tsconfig.json`，会用 TS 内置的"实用类型"改造已有类型，并了解如何把 JS 项目渐进式迁移到 TS。

## 一、tsconfig.json 关键项

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",            // 产出的 JS 版本
    "module": "ESNext",            // 模块系统
    "moduleResolution": "Bundler", // 解析方式（Vite/打包器场景）
    "strict": true,                // ⭐ 打开所有严格检查（强烈建议）
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**`strict: true`** 是 TS 的价值所在，它包含：

- `noImplicitAny`：不允许隐式 any；
- `strictNullChecks`：`null/undefined` 单列，逼你处理空值；
- 等一揽子开关。新手也务必打开，一开始疼，之后受益无穷。

## 二、内置实用类型（Utility Types）

它们都是泛型类型工具，用于"从已有类型派生新类型"：

| 实用类型 | 作用 |
| --- | --- |
| `Partial<T>` | 把所有属性变可选 |
| `Required<T>` | 把所有属性变必填 |
| `Readonly<T>` | 全部只读 |
| `Pick<T, K>` | 从 T 中挑出部分属性 |
| `Omit<T, K>` | 从 T 中剔除部分属性 |
| `Record<K, V>` | 构造键值对类型 |

```ts
interface User { id: number; name: string; email: string }

type UserPreview = Pick<User, 'id' | 'name'>;   // { id; name }
type UserForm = Omit<User, 'id'>;                // 表单里没有后端生成的 id
type Patch = Partial<User>;                      // 更新接口：可只传部分字段
```

## 三、编译与运行

```bash
# 类型检查（不产出文件）
npx tsc --noEmit
# 编译产出 JS
npx tsc
# 你的 Node 24 可直接跑纯类型（擦除）脚本，无需编译：
node courses/02-typescript/examples/ts-project/01-utility.ts
```

> ⚠️ `node xxx.ts`（原生类型擦除）不支持 `enum`、`namespace`、参数属性等需要"生成代码"的语法；教学示例都刻意避开了这些，确保你能直接跑。

## 四、渐进式迁移策略

1. 先加 `tsconfig.json` + `allowJs: true`，让 TS/JS 共存；
2. 从新文件开始写 `.ts`，老文件按需改后缀；
3. 打开 `strict`，用 `// @ts-ignore`（临时）→ 逐步消除 `any`；
4. 给第三方 JS 库补 `@types/xxx` 类型包。

## 五、动手示例

- `ts-project/01-utility.ts` —— Partial / Pick / Omit / Record 实战

🏆 完成「本关小测」+ `homework/L5.md`，你就通关 TypeScript 包，可以进入 **Node.js** 实战了！
