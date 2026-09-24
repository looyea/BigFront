# 面试题：工具原子库（jo-storage）

### 1. (实战类) 用 atomWithStorage 做主题持久化并避免 SSR 闪烁？
**来源**：https://jotai.org/docs/utilities/storage

themeAtom=atomWithStorage(...)，SSR 用 getOnInit/或 Provider 水合 + 首帧一致渲染（呼应 jo-ssr）。

### 2. (对比类) atomWithStorage 与 Zustand persist 粒度差异？
**来源**：https://jotai.org/docs/utilities/storage

前者单 atom、后者整 store；Zustand 自带 version/migrate，Jotai 需自处理迁移。

### 3. (设计类) 给 Jotai 持久化加版本迁移怎么做？
**来源**：https://jotai.org/docs/

自定义 storage 的 getItem 里读旧格式并转换，或包一层带 version 的 JSON 读写。

### 4. (坑类) 敏感值用 atomWithStorage 存 localStorage 风险？
**来源**：https://owasp.org/www-project-front-end-security/

易被 XSS 读；敏感数据不落 localStorage（呼应 za-auth 安全建议）。

### 5. (实战类) atomWithReducer 迁移已有 reducer 的步骤？
**来源**：https://jotai.org/docs/utilities/reducer

把 reducer 函数与初始态传入，组件用 useSetAtom 得到 dispatch 直发 action。

### 6. (TS类) atomWithStorage 泛型怎么标？
**来源**：https://jotai.org/docs/typescript/typescript

atomWithStorage<T>(key, initial, storage?) 由初值推断 T，自定义 storage 对齐类型。

### 7. (对比类) atomWithDefault 与 const atom=atom(默认) 区别？
**来源**：https://jotai.org/docs/utilities/default

default 支持“未写时用动态默认、写后覆盖、可 reset”，普通 atom 无此语义。

### 8. (综合类) 给登录态选存储原子的理由。
**来源**：https://jotai.org/docs/

token 走 httpOnly cookie 不进存储，userIsLogged 布尔用 atomWithStorage 记住登录选择。

### 9. (实战类) 跨 tab 同步 atomWithStorage 靠什么？
**来源**：https://jotai.org/docs/utilities/storage

localStorage 版内置 storage 事件同步，多 tab 一致（呼应 za-hydration）。

### 10. (性能类) 高频写持久化 atom 的隐患？
**来源**：https://jotai.org/docs/

每写序列化落盘频繁；应节流或让持久 atom 只存最终态。

### 11. (设计类) 为什么持久化粒度到 atom 更需小心目录混乱？
**来源**：https://jotai.org/docs/advanced/atom-patterns

一堆各自为政的存储 key 难维护，按域集中并命名规范。

### 12. (坑类) getOnInit=false 会造成什么？
**来源**：https://jotai.org/docs/utilities/ssr

客户端首帧未读存储值可能短暂渲染默认再切换，需 loading 处理。

### 13. (对比类) async storage(如 AsyncStorage)如何适配？
**来源**：https://jotai.org/docs/utilities/storage

提供 async getItem 返回 Promise 的 StateStorage 即可。

### 14. (趋势类) 这些 util 会被标准 signal 生命周期取代吗？
**来源**：https://github.com/tc39/proposal-signals

effect scope 可能接管副作用生命周期，但存储语义仍需专门实现。

### 15. (综合类) 为持久化制定团队规范。
**来源**：https://jotai.org/docs/utilities/storage

① 敏感值不入库 ② 自定义 storage 带 version ③ SSR 处理水合 ④ 按域集中 key 命名。
