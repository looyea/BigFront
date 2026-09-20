// 运行：node courses/02-typescript/examples/ts-project/01-utility.ts
interface User { id: number; name: string; email: string }
type Preview = Pick<User, 'id' | 'name'>;   // { id; name }
type Form = Omit<User, 'id'>;                // { name; email }
type Patch = Partial<User>;                  // 全部可选
const p: Preview = { id: 1, name: "k" };
const f: Form = { name: "k", email: "k@x.com" };
const patch: Patch = { name: "newName" };    // 可只传部分
console.log(p, f, patch);
