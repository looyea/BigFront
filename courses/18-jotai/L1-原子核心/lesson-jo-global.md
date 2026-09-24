# 全局原子与模块作用域

## 一、import 即用：默认全局 store

```ts
// store/theme.ts
export const themeAtom = atom('light');
// 任意组件
const [t, setT] = useAtom(themeAtom);
```
没有 Provider、没有 useContext——模块导出的 atom 就是全局可读写单例（呼应 za-context 的反面）。

「全局」的准确含义：atom 对象是模块单例，其值挂在默认 store 上；页面刷新即重置（持久化要显式上 atomWithStorage，见 jo-storage）。它替代的不是「所有状态」，而是「Redux/Context 那层跨组件共享状态」。

## 二、性能优势 vs Context
低频注入用 Context 够用；但 Context value 一变整棵子树重渲。Jotai 只有订阅该 atom 的组件更新，粒度细得多。

量化一下：主题 Context 挂在 App 根部，切主题 → Provider 下全部组件标记重渲（哪怕 memo 住也要走比较）；themeAtom 只让真正 useAtomValue(themeAtom) 的三个组件更新。消费点越少差距越小，页面越大差距越明显——Context 的债在规模里显形。

## 三、什么时候需要 Provider
当需要「隔离作用域」：多标签页编辑器、SSR 每请求、测试隔离——此时用 `createStore` + `<Provider store={...}>`（详见 jo-store）。

决策树背下来：默认全局 → 出现「同页多实例互不干扰」或「SSR/测试」→ Provider 升级。不要因为「听说 Provider 更正式」就全家桶式包裹——那是把 Zustand 的 useStore(vanilla) 弯路重走一遍（呼应 za-factory 第四节的实体原则）。

## 四、全局原子 + 持久化
导出 `atomWithStorage('theme','light')` 即得一个自动读写 localStorage 的全局原子（呼应 jo-storage），比手写 effect 干净。

```ts
// 手写 effect 版的对照组：
useEffect(() => localStorage.setItem('theme', t), [t]); // 首帧闪、双真相源
```

一行 atomWithStorage 替掉「初始读 + 变化写 + JSON 序列化」三件套，且仍然可派生、可被 Provider 隔离。

## 五、命名与组织
按域放 `store/xxx.ts`，导出一组相关 atom 与派生/写 atom，作为该域对外接口。

```
store/
  auth/    index.ts (导出 userAtom + loginAtom(write) + isLoggedAtom(derived))
  cart/    index.ts (itemsAtom + cartTotalAtom + addToCartAtom)
```

对外暴露「数据 atom + action atom + 派生 atom」三件套，组件永远只 import 域目录——atom 文件的自由拆分重组对调用方透明（呼应 za-slices 的 selector 黑盒思想）。

## 六、两个防坑清单

1. **模块副作用**：atom 文件里别写 `atom( await fetch() )` 之类的求值逻辑——初值必须是纯字面量或惰性 getter，否则 import 阶段就打网络/摸 window（SSR 直接崩）。
2. **热更新**：Vite/webpack HMR 下 atom 模块被重新执行会**重置该 atom 的值**（新对象新默认 store 记录）；开发期频繁「改了 store 值丢了」先查是否模块级副作用或 HMR 边界问题。

## 小结
模块作用域 atom 天然全局、零 Provider 开销；Context 输在广播粒度、Zustand 单例输在隔离，Jotai 用「默认全局 + 需要时 Provider」两头兼顾；命名按域导出三件套是工程基石。

## 部署预告
本地把一个小应用的 Context 主题方案改写为 themeAtom，用 Profiler 对比切换时的重渲组件数；再故意在 atom 文件顶层写 window 访问，在 SSR/测试环境看它爆炸。
