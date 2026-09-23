# mp-component 面试题精选

> 共 15 题，覆盖 A 组件基础 / B properties 机制 / C 样式与查询 / D 跨框架对照与工程。

## 一、组件基础（A 类）

### 1. Page 和 Component 是什么关系？
官方口径：Page 构造器是"注册到页面栈的特殊 Component"——所以 Page 也能用 properties 之外的绝大多数能力（data/methods/生命周期），而 Component 不能当页面用（无 onLoad 等页面钩子，页面钩子要走 pageLifetimes）（呼应 mp-lifecycle、mp-component-lifecycle）。
**来源**：微信小程序官方文档《页面定义 > Component 构造器的关系》；社区机制解析

### 2. 组件四件套里 json 的 component:true 和 usingComponents 分别管什么？
component:true 声明"我是组件"（影响编译产物与隔离行为）；usingComponents 登记"我能用哪些自定义标签"——组件自己的 json 里也能再登记子组件（组件树递归）（呼应 mp-component 第一节）。
**来源**：微信小程序官方文档《组件间引用 usingComponents》

### 3. 一个组件文件能在多个页面复用吗？需要什么前提？
能，同一份代码；前提是每个使用方的 json 登记路径（或用 app.json 全局登记）。注意：登记路径解析以"使用方文件位置"为基准，分包页引用主包组件合法、跨分包引用非法（呼应 mp-subpackage）。
**来源**：微信小程序官方文档；分包最佳实践

## 二、properties 机制（B 类）

### 4. properties 与 data 的区别？各自何时用？
properties 是父传子的**入参接口**（组件内只读、带类型校验转换、有 observer）；data 是组件**私有状态**。呈现由外定 → properties；内部交互态 → data。写组件先画这条边界（呼应 vue-component-basics props/data 之分）。
**来源**：微信小程序官方文档《组件 properties》

### 5. properties 的完整定义五个字段是什么？
type、value（默认值）、optionalTypes（补充类型）、observer（变化回调）、（v 构造器层面的）读取入口 this.properties。type 必填；observer 新版推荐写在定义里、也可用 this.observers 统一写（呼应 mp-component-lifecycle）。
**来源**：微信小程序官方文档《properties 定义方式》

### 6. 父组件反复给 price 传相同值，observer 会重复触发吗？多字段联动观察者怎么写？
相同值不触发（框架做相等性浅判断，对象按引用比较——父每次造新对象引用就会"看起来没变也触发"，这是隐藏性能坑）。多字段联动用 `"a, b"` 形式的联合 observer 或 `observers: { 'a, b': fn }`，路径观察 `'obj.x': fn` 也支持（呼应 mp-component-lifecycle observer 一节）。
**来源**：微信小程序官方文档《数据观察者》

### 7. 组件内想给 properties 的值做二次加工（如分转元），几种做法？
① observer 里算好塞进自己的 data（首选，缓存语义）；② wxs 渲染时现算（无状态纯格式化，呼应 mp-wxml 第五节）；③ 让父级算好再传（最省，但组件复用场景把业务逻辑泄漏给了使用方）。选择依据：加工是否依赖组件内部其他状态。
**来源**：微信小程序官方文档；社区组件库源码实践（vant-weapp）

## 三、样式与查询（C 类）

### 8. options.styleIsolation 与 externalClasses、addGlobalClass 的关系？
styleIsolation 定"内外影响方向"（isolated/apply-shared/shared/page 四档）；addGlobalClass 等价于把组件当作 apply-shared 的简写开关（老代码常见）；externalClasses 是显式开的"样式注入口"——三者共同构成组件样式边界的全集（呼应 mp-wxss 第四节、mp-component 第五节）。
**来源**：微信小程序官方文档《组件样式隔离 / externalClasses》

### 9. 组件里能用到原生组件（canvas/map/video）有什么特别注意事项？
原生组件由 Native 直接渲染、层级最高（历史问题），组件化不改变这一点：覆盖弹层要用 `cover-view/cover-image`；同层渲染（cover-view 需求减少）已大面积支持但仍有机型差异；canvas 在组件内需注意 selector 作用域与 type="2d" 的新接口（呼应 mp-performance、mp-openapi）。
**来源**：微信小程序官方文档《原生组件说明 / 同层渲染》

### 10. 组件销毁后，selectComponent 的引用还能用吗？
实例对象还在内存（你抓着引用），但已 detached——对它 setData 会告警/无效、查询节点为空。凡是"存了组件实例"的代码（如 selectComponent 缓存）必须在其 detached 时清引用，或改用事件通信（呼应 mp-component-lifecycle detached、mp-communication 总线解绑）。
**来源**：微信小程序官方文档《selectComponent》；社区内存泄漏案例

## 四、跨框架对照与工程（D 类）

### 11. 把同一个"商品卡片"用 Vue/React/原生小程序各写一遍，接口设计上有什么共性？
共性三条：① 入参显式声明（props/properties 类型校验≈propTypes/defineProps）；② 输出走事件（emit/triggerEvent/回调 props）；③ 外观可注入（class 透传/externalClasses/className prop）。差异在"样式隔离是默认还是可选"——小程序默认最严格（呼应 vue-component-basics、react-composition）。
**来源**：三框架官方组件文档对照

### 12. 组件库（如自研 UI kit）在小程序生态里分发，工程上要考虑什么？
npm 构建支持（工具"构建 npm"生成 miniprogram_npm）、组件 paths 与分包配合（组件也可进分包，随分包页走）、版本升级的多页面 usingComponents 维护（全局登记 vs 页面登记）、按需引入体积（mp-subpackage、mp-framework 的组件库方案，呼应 node-publish 的发布工程）。
**来源**：vant-weapp 官方使用文档；《小程序 npm 组件开发》指南

---

## 补充（新专题 13-15）

### 13.  properties 与 data 有什么区别？各自的更新方式、以及"组件内想加工父传来的值"该怎么做？

data 是组件私有状态，只能用 this.setData 改并触发本组件渲染；properties 是从父接收的"外部输入"，父通过标签属性驱动、子原则上不应直接改（改父传来的属性会打断单向数据流、父下次传值又覆盖）。加工父值（如分转元、格式化）三种正解：① 用 properties 的 observer，在值变化时算出派生结果写进组件自己的 data（priceYuan），模板显示派生字段，别改原 prop；② 用 wxs 在渲染层就地格式化，省一次 setData；③ properties 的 value + observer 组合做校验/兜底。切忌子里 `this.properties.x = ...` 或 setData 改 prop 当己用。这与 React"别 mutate props、派生用 useMemo/state"同构。

微信官方文档《自定义组件》；掘金《properties/data/observers 三件套设计笔记》

### 14.  options.styleIsolation、addGlobalClass、externalClasses 分别在管什么？组件样式隔离怎么破？

styleIsolation 控组件样式与页面/父样式的互相影响边界：isolated（默认，组件样式不外泄、外部（除 class 传递）也不侵入）、apply-shared（页面影响组件）、shared（互相）；addGlobalClass:true 允许 app.wxss 等全局类作用到组件内（牺牲隔离换公共样式复用，如全局原子类）；externalClasses 是"把某个内部节点 class 作为可配置插槽暴露给父"——父传一个自己在页面里定义的类名进来套到指定节点，既保持隔离又留了定制口（比放开 styleIsolation 更克制）。破隔离优先级：优先 externalClasses（点状定制）> addGlobalClass（复用全局工具类）> 最后才 shared（面状、易污染）。这与 Vue scoped + ::v-deep、CSS Modules 的"默认隔离 + 显式穿透"是同一治理哲学。

SegmentFault《组件外部样式类与样式穿透的正确姿势》；知乎《小程序组件与 Vue 组件 API 设计对照》

### 15.  页面 vs 组件是什么关系？把"商品卡片"用原生小程序/Vue/React 各写一遍，接口设计上哪些是共通的？

页面本质是一个特殊的、注册在 pages 路由里的"根组件"（有自己的生命周期与 WebView），Component() 造的才是可复用组件——Page 与 Component 共享数据/setData/查询等能力，差别在 Component 多了 properties/slots/observers/behaviors/externalClasses、生命周期是 created/attached/ready/detached。共通的部分（跨三家不变）：① 明确"向下数据"契约（props：入参、类型、默认值、只读）；② 明确"向上事件"契约（emit 什么事件、带什么载荷）；③ 可选"内容插槽/children"扩展点；④ 内部自管的派生与状态；⑤ 样式隔离策略。差异只在语法：小程序 properties+triggerEvent+slot，Vue props+emits+slot，React props+回调+children。能把同一卡片在三栈里对齐讲清，就是"组件思维"而非"框架思维"的证明。

CSDN《组件 slot 与多内容插入实战》；InfoQ《从业务组件库看小程序组件抽象边界》
