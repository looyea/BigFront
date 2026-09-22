# solid-stores 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) createStore 靠什么机制把响应性延伸到嵌套属性和数组元素？
**来源**：store 底层机制题的转述。

Proxy。创建时对对象/数组包一层代理，get 拦截记录"哪个路径被哪个作用域读了"、set（经 setter）拦截触发对应路径的通知。于是能"只更新真正变化的属性"，而非整体替换。这也是 store 相比 signal 在深层结构上更细粒度的根源。

### 2. (B) 组件顶层 `console.log(store.users.at(-1))` 加完人不打印，为什么？怎么修？
**来源**：懒建 signal 排坑题的转述。

store 的 signal 是**惰性建立**的——只有当某路径在**追踪作用域**（JSX return、createEffect、memo）里被读到，才为它建订阅。顶层裸读不在追踪作用域，没建依赖，当然不更新。修：放进 `createEffect(()=>console.log(store.users.at(-1)))`。

### 3. (A) 读取 store 为什么不用像 signal 那样加 `()`？
**来源**：store 读法语义题的转述。

因为 store 值本身是 Proxy 对象，读 `store.x` 这个动作就会被 get 拦截、自动登记依赖；而 signal 是函数，必须调用 `x()` 才触发 getter 拦截。所以 store "读起来像普通对象"，signal "读要显式调用"——这是两者 API 手感最大的差别。

### 4. (C) signal 和 store 分别适合什么状态？给判断口诀。
**来源**：状态原语选型题的转述。

标量、或"每次整体替换一个新值"→ signal；深层嵌套对象/数组、要"按字段/索引局部更新"→ store。口诀：**改谁就订阅谁的最小粒度**——signal 粒度是"整个值"，store 粒度能细到"某个路径"。二者可混用（signal 里放 store、store 里放 signal 都合法）。

### 5. (B) `setStore('users',0,{id:109})` 只传一个字段，其它字段会丢吗？为什么？
**来源**：对象浅合并题的转述。

不会丢。当新值是对象时，store setter 把它与现有值**浅合并**（等价 `u=>({...u,id:109})`），未提及的字段保持。这是 store 相比"整体替换的 signal"少写 spread 的直接便利。

### 6. (A) 数组追加：spread 写法和"length 当索引"的路径写法，失效范围有何不同？
**来源**：数组更新粒度题的转述。

spread `[...cur,item]` 造新数组整体替换 → 依赖整个数组或其任意属性的 effect 全部失效；`setStore('users', len, item)` 直接在末尾索引赋值、改的是原数组 → 只有依赖"新索引 / length"的订阅被通知。后者更新更局部高效。

### 7. (A) 一次 setter 改多个索引/范围，Solid 做了什么优化？
**来源**：批量更新题的转述。

单次 setter 调用（多索引数组 `[2,7,10]`、范围 `{from,to,by}`、过滤函数）会**自动包进 batch**——所有目标元素一次性改完，再统一触发下游 effect，避免逐个改造成的中间态反复通知。这也是它比"for 循环逐个 setStore"更高效的原因。

### 8. (C) produce、reconcile、unwrap 各解决什么问题？
**来源**：store 三工具辨析题的转述。

produce：以"可变草稿"方式一次改多个字段（`u=>{u.a=1;u.b=2}`），内部仍产出不可变更新；只支持普通对象/数组，Set/Map 不行。reconcile：把外部整份新数据和现有 store **做 diff**，只更新真正变了的（服务端整表刷新只变一行→只那一行触发）。unwrap：取出 store 背后的**裸对象**，用于对接期待普通对象的第三方库、或做非响应式快照。

### 9. (D) 一个 store 分支你想有独立 setter 但共享底层数据，怎么做？
**来源**：嵌套 store 技巧题的转述。

`const [users,setUsers]=createStore(store.users)`——在已存在的 `store.users` 上派生一个 store。通过 `setUsers` 的改动会回写到 `store.users`，读也保持同步。适合把某个大数组/子对象的局部操作拆出独立 setter，但仍与主 store 同一数据源。

### 10. (B) 面试官问"我 setStore 改了值，界面上某个用到它的地方没更新"，你的排查顺序？
**来源**：store 更新失效排障题的转述。

①那处读取是否发生在追踪作用域里（顶层裸读/异步回调里读=不建依赖）；②路径是否写对（键名/索引是否命中同一对象，别中途 spread 换了引用却没接上）；③是不是被 memo/早返回挡在依赖外；④是不是 setter 传了新对象但下游订阅的是旧引用。核心仍是"读要在追踪作用域、且路径一致"。

### 11. (C) 和 Redux/Vuex 那种"集中式 store + 纯 reducer"相比，Solid 的 createStore 是不是一个东西？
**来源**：命名撞车澄清题的转述。

不是。Solid 的 store 是**局部/可组合的细粒度响应式数据结构**，没有强制全局单一 store、没有 action/dispatch/reducer 流水线；它就是"能按路径订阅的 reactive 对象"。集中式状态管理在 Solid 里通常靠 context + 若干 signal/store 自由组合，而非一套约定流（呼应 solid-context-composition）。

### 12. (D) 场景：表格 5000 行、每行有几个可编辑字段，用户高频改单个字段。用 signal 还是 store？怎么组织更新？
**来源**：细粒度更新设计题的转述。

用 store（`createStore(rows)`）。改单个字段走路径 `setStore('rows', i, 'field', v)`，只通知订阅了 `rows[i].field` 的那个单元格，其余 4999 行不动。若用 signal 存整个 rows 数组，任一字段改都整体替换→全表重渲染。配合 `<For>`（keyed）让每行 DOM 稳定，达到"改一格只刷一格"。

🚀 实操请去做 L2 作业：复现懒建 signal 坑、浅合并、spread vs 路径追加、reconcile 只更新变化行。
