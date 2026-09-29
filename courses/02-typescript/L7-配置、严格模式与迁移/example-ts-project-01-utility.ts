// 目的：演示三个最常用的工具类型——Pick 挑字段、Omit 丢字段、Partial 全可选
// 运行：node courses/02-typescript/L7-配置、严格模式与迁移/example-ts-project-01-utility.ts
interface User { id: number; name: string; email: string }

type Preview = Pick<User, 'id' | 'name'>;   // 结果: { id: number; name: string }（只留这两个）
type Form = Omit<User, 'id'>;                // 结果: { name: string; email: string }（去掉 id）
type Patch = Partial<User>;                  // 结果: { id?; name?; email? }（全部变可选）

// ✅ 应用：从同一个 User 派生出三种不同"形状"，各自只约束自己该有什么
const p: Preview = { id: 1, name: "k" };         // 只要求 id/name，多写 email 反而报过剩属性
const f: Form = { name: "k", email: "k@x.com" }; // 不能有 id（已被 Omit 掉）
const patch: Patch = { name: "newName" };        // Partial 允许只传部分字段
// const bad1: Preview = { id: 1 };    // ❌ Property 'name' is missing in type '{ id: number; }'
// const bad2: Form = { id: 1, name: "k" }; // ❌ 'id' does not exist in type 'Form'（过剩属性检查）

console.log(p, f, patch);   // => { id: 1, name: 'k' } { name: 'k', email: 'k@x.com' } { name: 'newName' }
