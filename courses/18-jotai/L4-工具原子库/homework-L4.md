# L4 作业：工具原子库

## 一、知识回顾
1. atomWithStorage/Reducer/Default 各自定位与 SSR 注意。
2. v2 为何移除 atomFamily、现代替代方案。
3. selectAtom / focusAtom / splitAtom 的分工。

## 二、代码实操
1. 用 atomWithStorage 持久化用户偏好，并写自定义 storage 处理 version 迁移。
2. 用 Map 手写一个可失效的 atomFamily 管理动态 Tab，关闭即回收。
3. 用 focusAtom + splitAtom 把一个嵌套表单对象拆成字段级/行级订阅组件。

## 三、思考题
1. 单原子持久化缺少 version/migrate 会带来什么运维问题？
2. splitAtom 相比手写参数化原子，生命周期上好在哪？

## 四、延伸阅读
- Jotai utils：storage / select / focus / split / family
- React 性能：细粒度订阅

## 五、自查清单
- [ ] 持久化敏感值未入库、含迁移
- [ ] 参数 atom 有显式回收
- [ ] 大对象用 focus/split 降低重渲
- [ ] 派生读用 selectAtom
