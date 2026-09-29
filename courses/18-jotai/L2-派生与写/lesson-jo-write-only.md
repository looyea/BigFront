# Write-only Atom：封装副作用

## 一、只有 setter 的原子

```ts
// 目的：write-only 原子——atom(null, write)，读值 null 是占位，重点是 write 函数扮演 action
const increaseAtom = atom(null, (get, set, by: number) => {   // 读值 null，写逻辑在第二参 write
  set(countAtom, get(countAtom) + by);                        // get 读当前 count，set 写回 +by
});
// ✅ dispatch(5) 即“count += 5”，by: number 由 TS 约束调用方只能传数字
// ❌ 不标注参数类型→by 推断成 unknown/any，调用方失去“这个 action 该传什么”的类型校验
```
`atom(null, write)` 的读值是 null（占位），重点是 write 函数——它扮演「action」。

write 签名三件套 `get, set, arg`：get 读任意原子当前值、set 写任意原子、arg 是调用方传入的参数（可被 TS 泛型精确约束）。一个原子的「可传什么参数」就是它的公开接口。

## 二、用 useSetAtom 触发

```tsx
// 目的：useSetAtom 触发 write 原子——只拿 dispatch、不订阅读值，组件零额外重渲
const dispatch = useSetAtom(increaseAtom);          // 不订阅 increaseAtom 的读值（本就是 null）
button onClick = () => dispatch(5);                 // 点击即触发 write，等价于 count += 5
// ✅ useSetAtom 不订阅值→纯触发按钮不因子原子变化重渲，“只负责触发”被类型系统强制
// ❌ 想读当前 count 却去 useAtomValue(increaseAtom)→它读值恒为 null，拿到的是占位不是状态，应订阅 countAtom
```
write atom 就是 Jotai 的 action：集中对多个源 atom 的写、含校验、含异步编排（呼应 za-actions、sig-mutability）。

关键红利：useSetAtom **不订阅** increaseAtom 的读值（反正读值是 null），组件零额外重渲——「按钮只负责触发」在这里是类型系统强制的，想读值都得另用 useAtomValue 显式订阅源原子。

## 三、批量 set 的原子性
一个 write 里多次 set，React 18 会合并渲染；依赖该组 atom 的组件看到一致快照。

```ts
// 目的：一个 write 里多连 set——React 18 合并成一帧，订阅者看到一致快照、无半更新中间态
const logoutAtom = atom(null, (get, set) => {
  set(userAtom, null);
  set(tokenAtom, '');
  set(cartAtom, []);       // 三连写，订阅者只见到一次渲染帧
});
// ✅ 三字段原子性生效：不会出现“user 已清空、cart 还在”的中间帧
// ❌ 以为多写会各渲一次就去手动 unstable_batchedUpdates 包裹→18+ 已自动批，多余且可能踩 API 变更
```

对比 Zustand 的同款保证（za-transition 第二节）：外部 store + uSES 时代后，「多写一帧」已是 React 运行时兜底的通用福利，不再是某库卖点。

## 四、与 Zustand action 对应
Zustand 把 action 写在 store 里；Jotai 用 write-only atom 表达 action，逻辑与状态解耦、可组合、易单测（纯函数式）。

「可组合」是原子范式的精髓——write 里可以再触发别的 write：

```ts
// 目的：action 即原子可组合——write 里再触发别的 write，做依赖注入式编排
const purchaseAtom = atom(null, async (get, set, item) => {
  set(addToCartAtom, item);      // 复用另一 action 原子（set 一个 write-only atom 即触发它）
  await set(checkoutAtom);       // 编排异步 action，await 等其完成
});
// ✅ 组合原子纯函数式、可单测：store.vanilla 里直接 set(purchaseAtom, item) 验副作用
// ❌ set(addToCartAtom, item) 却 addToCartAtom 是只读派生→它没 write，set 落空/报错，action 必须是可写原子
```

action 即原子，天然可被依赖注入式拼装（store.vanilla 测试里直接 set 这个组合原子即可，见 jo-perf-test）。

## 五、异步 write
write 里可 await 再 set，做数据加载；配合 jotai-suspense/loadable 管理挂起（呼应 jo-async）。

```ts
// 目的：异步 write——await 后再 set 做数据加载，dispatch 返回 Promise 可直接 await
const loginAtom = atom(null, async (get, set, creds) => {
  set(loginStatusAtom, 'pending');                       // 先置 pending，订阅 status 的按钮转圈
  try {
    const user = await api.login(creds);                 // 发请求，write 整体是 async
    set(userAtom, user); set(loginStatusAtom, 'ok');     // await 之后的 set 才落到订阅者
  } catch (e) { set(loginStatusAtom, 'fail'); }          // 失败也只改 status，不吞异常
});
// ✅ 组件里 `await dispatch(creds)` 拿到完成时机，成功再跳转路由
// ❌ 不 await 就当同步用，紧跟着读 userAtom→此刻仍是旧值（请求还在飞），拿到 undefined 崩
```

注意：异步 write **await 之后的 set 才生效于订阅者**，write 自身返回的是 Promise——useSetAtom 拿到的 dispatch 可直接 await（表单提交组件里 `await dispatch(creds)` 做后续跳转）。

## 六、pending 感知：isPendingAtom 模式

异步 write 进行中，UI 怎么知道？两个套路：① status 字段进源原子（上例 loginStatusAtom，最直白）；② jotai/utils 的 `createJSONStorage` 不适用时，社区常用「把 Promise 本身 set 进一个状态原子 + loadable 消费」。别用 useSetAtom 的返回值自动 pending——write-only 的读值是占位 null，没有加载态语义。

## 小结
write-only atom = 封装副作用与多原子写的 action 单元：dispatch 触发、参数即接口、write 可编排 write、异步写 await 后续落；「逻辑与状态解耦」把 Redux 的 action 思想原子化了。

## 部署预告
本地把 counter 扩成 login/logout 双 action 原子：logout 三连写、login 异步带 status；组件里 await dispatch 做成功跳转，观察一次 write 多 set 只渲一帧。
