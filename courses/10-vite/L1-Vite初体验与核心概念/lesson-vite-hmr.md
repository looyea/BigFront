# Vite HMR：热模块替换原理与实战

> 目标：**理解 Vite HMR 完整链路**（文件变更 → chokidar 监听 → WebSocket 推送 → 客户端 accept/dispose → 模块替换）；掌握 `import.meta.hot` API；能为自定义模块类型编写 HMR 逻辑。

---

## 一、HMR 是什么

**Hot Module Replacement** = 修改代码后不刷新页面、只替换变更模块、**保留应用状态**。

对比：
| 方式 | 效果 |
| --- | --- |
| Full Reload | 整个页面刷新 → 状态丢失 |
| HMR | 只换改动的模块 → 组件 state/Redux store 保持 |
| 无 HMR | 必须手动 Ctrl+R |

---

## 二、Vite HMR 完整链路

```
1. 你在 Editor 保存 App.vue
2. Vite 内置 chokidar 监听到文件变更
3. 构建模块图（module graph）→ 找到直接 importer（父模块链）
4. 通过 WebSocket（ws://localhost:5173/__vite_hmr）发送 payload：
   { type: 'update', updates: [{ type: 'js-import', url: '/src/App.vue', timestamp: ... }] }
5. 客户端（@vite/client）收到 → 动态 import(url + '?t=timestamp') 获取新模块
6. 调用旧模块的 hot.dispose() → 新模块的 hot.accept() → 替换
7. 如果 accept 链断（没人 accept）→ full-reload
```

### 2.1 模块图

Vite 维护一张 **import 关系图**（`moduleGraph`）——每个模块记录 importers（被谁引用）和 importedModules（引用了谁）。HMR 边界查找 = 沿 importers 向上走直到找到有 `hot.accept()` 的模块。

### 2.2 三种 HMR 结果

| 结果 | 触发条件 |
| --- | --- |
| **HMR update** | 模块链上有人 accept → 精准替换 |
| **Full reload** | 没人 accept → 只能整体刷新 |
| **No-op** | 自己 accept 自己（自更新） |

---

## 三、import.meta.hot API

```js
// 目的：import.meta.hot API 全景—在模块内声明如何接收/清理热更新（仅 dev 存在）
// 被 Vite 转换后在浏览器执行
if (import.meta.hot) {                    // ✅ 先判空：生产构建下 import.meta.hot 为 undefined
  // 接受自身更新
  import.meta.hot.accept((newMod) => {
    render(newMod);                       // ✅ 拿到新模块→用新定义重绘 UI，页面不刷新
  });

  // 接受依赖更新（指定路径）
  import.meta.hot.accept('./child.js', (newChild) => {
    child = newChild;                     // ✅ 只关心某个子模块变化时回调
    invalidate();
  });

  // 旧模块被替换前清理
  import.meta.hot.dispose((data) => {
    observer.unobserve(el);               // ✅ 释放副作用（断开 MutationObserver/定时器/监听），防泄漏
  });

  // 持久化状态（跨 HMR 存活）
  import.meta.hot.data.count = (import.meta.hot.data.count || 0) + 1;   // ✅ data 对象在新旧模块间传递，保住 state

  // 向父模块广播自定义事件
  import.meta.hot.send({ type: 'custom', payload: 'hi' });

  // 监听服务端自定义事件
  import.meta.hot.on('my-event', (data) => { console.log(data); });

  // 声明只能被父级 accept（不自己处理）
  import.meta.hot.decline();               // ⚠️ 一调就不能同时 accept；声明本模块不可热更→强制父级或 full-reload
}
// ❌ accept 回调里忘清旧副作用（dispose 没写）→ 每次热更都新增一个监听器，越改越慢/重复触发
```

---

## 四、Vue/React 框架的 HMR 实现

### 4.1 Vue（@vitejs/plugin-vue）

SFC 编译器自动在 `<script setup>` 尾部注入：
```js
// 目的：Vue SFC 编译器自动注入的 HMR 代码—reload 新旧组件选项、复用实例从而保留 state
if (import.meta.hot) {
  _c = _s = __VUE_HMR_RUNTIME__.createRecord(_s, $props)   // ✅ 首建时登记组件记录
  import.meta.hot.accept(({ module }) => {
    __VUE_HMR_RUNTIME__.reload(module.default)                // ✅ 热更时用新组件定义替换，不重建实例
  })
}
```
`reload()` → Vue diff 新/旧组件选项 → 复用实例 → **保留 state**。

### 4.2 React（@vitejs/plugin-react）

react-refresh 的 Babel 转换 + 自定义 HMR accept → 找到组件引用 → 替换 render。同样保持 state。

---

## 五、自定义模块 HMR（插件侧）

Vite 插件可声明 `handleHotUpdate` 钩子（Vite 6 改名 `hotUpdate`）：

```ts
// vite.config.ts
// 目的：自定义模块 HMR—插件把 SVG 编译成组件并注入 accept，使改 .svg 不整页刷新
const svgHmrPlugin: Plugin = {
  name: 'svg-hmr',                     // ✅ 插件必须有唯一 name
  enforce: 'pre',                       // ✅ 在 Vue/默认转换前跑
  transform(code, id) {
    if (!id.endsWith('.svg')) return;   // ✅ 非 SVG 直接放行（return undefined 不干扰）
    // 编译 SVG → 组件 + 注入 HMR 代码
    return `
      const component = createSvgComponent(\`${code}\`);
      if (import.meta.hot) {
        import.meta.hot.accept((mod) => mod.update(component));   // ✅ 注入自接受声明
      }
      export default component;
    `;
  },
  handleHotUpdate({ file, server, modules }) {
    if (!file.endsWith('.svg')) return;
    // ✅ 只推送特定模块（控制 HMR 边界，避免多余模块重推）
    return modules;
  },
};
// ❌ transform 对所有文件都 return 新字符串（忘了 !id.endsWith 短路）→ 把 JS/Vue 也当 SVG 处理，全项目编译崩
```

---

## 六、HMR 边界与失效

### 6.1 什么导致 full-reload？

- 改 `index.html`；
- 改 `vite.config.js`；
- 改的模块**无人 accept**（如 `main.js` 的顶层 import）；
- 模块有 `import.meta.hot.decline()`；
- CSS 文件（默认走样式替换，但 `@import` 链复杂时退化为 reload）。

### 6.2 减少 reload 的方法

- 框架插件自动处理 accept（Vue/React 组件不会触发 reload）；
- 纯数据模块（constants/utils）→ `import.meta.hot.accept()` 自接受；
- 加 `server.hmr.overlay = true` 看错误浮层判断是哪一层触发 reload。

---

## 七、HMR 性能特征

- **恒定速度**：不管项目 100 还是 10000 模块——只推 1 个文件的变更（Webpack 需要重建整个 chunk）；
- **依赖预打包不影响 HMR**：node_modules 预打包后当作 **不可热更**（改 node_modules 触发 full-reload）；
- **WS 消息格式精简**：JSON payload <200B。

---

## 八、WebSocket 通信细节

Vite dev server 启动时开 WS 服务（默认和 HTTP 同端口，路径 `/__vite_hmr`）。消息类型：

| 方向 | type | 内容 |
| --- | --- | --- |
| Server → Client | `update` | 模块更新列表 |
| Server → Client | `full-reload` | 全刷新 |
| Server → Client | `custom` | 插件自定义 |
| Client → Server | `custom` | 客户端发事件给插件 |

---

## 九、实践：手写一个计数器 HMR 保留状态

```js
// counter.js
// 目的：手写保留状态的 HMR—旧模块 dispose 存 count，新模块初始化时从 hot.data 恢复
let count = 0;

export function increment() { count++; render(); }
export function getCount() { return count; }

function render() {
  document.getElementById('count').textContent = count;   // ✅ 把当前 count 画到页面
}

if (import.meta.hot) {
  import.meta.hot.accept();                          // ✅ 无参 accept：自接受，不触发 full-reload
  import.meta.hot.dispose((data) => {
    data.count = count;                               // ✅ 模块被替换前，把实时 count 交给新模块
  });
  // 新模块初始化时从 data 恢复
  if (import.meta.hot.data.count != null) {
    count = import.meta.hot.data.count;               // ✅ 恢复旧值→热更后计数不归零
    render();                                         // ✅ 用恢复的值重绘
  }
}
// ❌ 不写 dispose 存值也不从 hot.data 读 → 每次改代码后 count 回到 0，丢失应用状态（HMR 意义尽失）
```

---

## 十、自检清单

- [ ] Vite HMR 用什么协议推送变更？路径是什么？
- [ ] accept / dispose / decline 分别什么时候用？
- [ ] `import.meta.hot.data` 解决了什么问题？
- [ ] 什么情况下 HMR 退化为 full-reload？
- [ ] Vue 组件热更新为什么不丢 state？
- [ ] 改 vite.config.js 会触发什么？

---

## 🚀 部署预告

HMR **仅 dev 环境存在**——生产构建产物**完全不含**任何 HMR 代码（`import.meta.hot` 被 define 替换为 undefined → 死代码 → Tree Shake 删除）。这也是为什么 `npm run build` 产物不含 WS 连接。

下一关进入 L2 资源处理：图片/SVG/字体/Web Workers。
