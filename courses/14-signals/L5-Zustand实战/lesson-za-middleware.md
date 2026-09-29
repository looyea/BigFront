# za-middleware：日常三件套——persist / immer / devtools

> 目标：把 Zustand 的三个官方中间件用成肌肉记忆（持久化、可变语法写不可变更新、挂 Redux DevTools），搞懂中间件的组合顺序与『洋葱』机制，能手写一个小中间件看懂原理（呼应 mobx-core、za-core）

## 一、中间件是什么：给 create 包的三层外套

```js
// 目的：中间件是高阶函数 (config)=>config—包三层外套，顺序即洋葱
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(               // ✅ 最外：看到的已是最终快照
    persist(               // ✅ 居中：存的是 immer 产物
      immer((set, get, api) => ({
        // 你的 store 本体   // ✅ 最内：改数据
      })),
      { name: 'app-store' },
    ),
  ),
);
// ❌ TS 下漏了 curried 双括号 create<State>()(...)→ 中间件叠加后类型推断塌缩
```

Zustand 的中间件不是运行时插件系统，就是**高阶函数**：`(config) => config`——收一个 store 定义函数，返回一个加工过的定义函数（劫持 set、注入选项、包一层日志……）。所以顺序即洋葱：**写在外层的先处理 set、内层的后处理**。TS 下要写成 curried 形式 `create<State>()(devtools(persist(immer(...))))`（za-core 第 11 题的双括号在这里派上用场）。

## 二、persist：刷新不还原，一切都是白搭

```js
// 目的：persist—刷新不丢状态；partialize 白名单 + version/migrate 升结构
persist(immer((set) => ({
  theme: 'light',
  draft: '',
  setTheme: (t) => set((s) => { s.theme = t; }),   // ✅ immer 风格：直接"改"草稿
})), {
  name: 'app-store',            // ✅ localStorage 的 key，必填
  storage: persist.createJSONStorage(() => sessionStorage), // ✅ 换介质；默认 localStorage
  partialize: (s) => ({ theme: s.theme, draft: s.draft }),  // ✅ 白名单：只持久化这两项（action 函数进不了 JSON）
  version: 2,                   // ✅ schema 版本号
  migrate: (persisted, version) => {                        // ✅ 老数据升结构，逐级搬到新结构
    if (version < 2) persisted.draft = persisted.draft ?? '';
    return persisted;
  },
  skipHydration: true,          // ✅ SSR 场景手动控制注水时机（L8 sig-server）
})
// ❌ 不写 partialize 直接全量持久化→ action 函数被 JSON.stringify 悄悄丢成 undefined，且敏感 token 顺手进了 localStorage（安全账）
```

四个高频决策点：

1. **partialize 是安全阀**：action 函数进不了 JSON（存了也是 `undefined` 占位），不写 partialize 靠 JSON.stringify 悄悄丢函数——能跑，但等于裸奔。显式列白名单，顺便防把敏感 token 顺手存进 localStorage（安全账）；
2. **version + migrate 是还债机制**：字段改名/结构变化时，老用户本地存的是旧结构，直接读会 `undefined` 崩页面。bump version、在 migrate 里按旧版本号逐级搬到新结构——和数据库 migration 一个思想；
3. **rehydrate 时机**：默认同步读 localStorage，首屏即有值；storage 换成异步（如 IndexedDB 的 `createJSONStorage(() => indexedDBAdapter)`)后首帧是初始值、异步注入后触发 `onFinishHydration`——SSR 水合不一致的根源之一；
4. **别拿 persist 当数据库**：容量 5MB 级、同步读写、无过期机制。用户偏好可以，业务数据大列表不行（该归服务端缓存，呼应 sig-scenarios 的『谁是事实源』）。

## 三、immer：可变语法，不可变产物

```js
// 目的：immer—可变语法，不可变产物（结构共享，仍产生新引用）
// 不用 immer：三层嵌套手动展开
set((s) => ({ profile: { ...s.profile, address: { ...s.address, city: 'Hangzhou' } } }));   // ✅ 手动 spread，深了就写到手软

// 用 immer：直接"改"，产出仍是新引用
set((s) => { s.profile.address.city = 'Hangzhou'; });   // ✅ 改草稿，immer 生成结构共享新快照
// ❌ set 回调里既改草稿 s.x=1 又 return 新对象→ immer 报错（禁止语义混叠，二选一）
```

机制一句话：immer 把 state 包成 Proxy，你的每次写操作被记账，最后**生成一份结构共享的新快照**（只复制到改动路径的根，其余节点复用旧引用）——所以 za-core 的铁律『必须产生新引用』依然成立，只是 immer 替你产生。三个边界要记清：

- set 回调里**只能二选一**：要么 immer 风格地改草稿，要么 return 新对象；改一半又 return 会报错（防止语义混叠）；
- 结构共享是性能红利也是订阅红利——没改到的分支引用不变，`useShallow` 比较直接过关；
- 与 MobX 的对照（L4 主菜预热）：MobX 是**真可变**+读时追踪，immer 是**假可变真不可变**+快照比较。语法长得一样，底下是两种世界观——这题 L6 sig-mutability 正面开庭，今天先记『语法趋同、机制分野』六个字。

## 四、devtools：把 store 挂进 Redux DevTools

```js
// 目的：devtools—把 store 挂进 Redux DevTools，看 action 序列与时间旅行
devtools(immer((set) => ({ ... })), {
  name: 'BearStore',            // ✅ 面板里显示实例名，多 store 必备
  enabled: process.env.NODE_ENV === 'development',   // ✅ 生产关，防 action 日志泄敏感数据
  trace: true,                  // ✅ 记录每次 set 的调用栈，定位"谁改的"利器
});
// ❌ 多 store 都给同一个 name（或不给）→ 面板里互相覆盖，分不清是哪条流
```

装浏览器扩展 Redux DevTools 后可以看到每次 set 的 action 序列、state 快照、时间旅行回放。两个实用细节：

1. **一个项目多个 store** 时每个都要 devtools 包一次并给不同 `name`，否则面板里互相覆盖；
2. **高频 set 会刷爆面板**（拖拽每帧一 set）——这种流要么不包 devtools，要么用 `api.setState(partial, true, 'drag:frame')` 第三参打标签后在面板里做过滤。devtools 里手动 dispatch 也能改状态——调试利器，但注意生产必须关（`enabled` 跟环境变量走）。

## 五、组合顺序：一个记法加一个实验

记法：**从内到外按『改数据 → 存数据 → 看数据』排**——immer 最内（改），persist 居中（存的是 immer 产物），devtools 最外（看到的已是最终快照）。

顺序错了什么症状？把 immer 放到 persist 外面：persist 记录 set 的时机晚于 immer 加工，部分实现下时间旅行恢复的快照绕过 immer 约束；把 devtools 放到最内：记录的是被 persist 拦截改写前的裸 set，日志与实际状态对不上。结论：**顺序不是玄学，是 set 被劫持的次序**——每个中间件都包一层 set，谁在外谁先拿到原始调用。

手写 30 行小中间件看懂机制（挑战题预演，homework-L5 见全题）：

```js
// 目的：手写 30 行小中间件—全部秘密就是"在 set 前后插代码"
const logger = (config) => (set, get, api) =>
  config(
    (partial, replace) => {
      const prev = get();                          // ✅ set 前：抓旧快照
      set(partial, replace);                       // ✅ 先正常更新
      console.log('[diff]', shallowDiff(prev, get())); // ✅ 再记账，打出这次改了哪些字段
    },
    get, api,
  );
// 用法：create(logger((set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) })))
// ❌ 中间件自己不当 set 传给 config（不包一层 set）→ 上层日志/持久化链路断裂
```

它就是『在 set 前后插代码』这一类中间件的全部秘密——persist 在 set 后插写入、devtools 在 set 前后插上报、immer 在 set 前插语法翻译，机制同构。

## 六、三件套之外：还想要什么？

官方家族还有 `subscribeWithSelector`（za-core 第四节的 selector 版 subscribe 就是它提供的）、`combine`（类型友好地分离初始值与 actions）。社区中间件（redux 系 migrate 等）不常用不展开——**日常主流应用三件套封顶**，这是 14 包『讲主流应用』的自律：先把 persist/immer/devtools 用对，比集十个中间件有价值。

> 🚀 部署预告：本关实验在 CodeSandbox 官方模板上做——改 theme → 刷新看 persist 还原 → DevTools 面板开时间旅行 → 调换中间件顺序观察日志差异，四步各留一分钟截图，比读十遍文章记得牢。
