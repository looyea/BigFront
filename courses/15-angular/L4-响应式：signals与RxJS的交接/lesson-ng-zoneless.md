# ng-zoneless：变更检测与 zoneless——zone.js 到底替你做了什么

> 目标：应用层视角理解 zone.js 拦截异步→触发变更检测→遍历组件树的工作原理（不挖源码）；v21 起 zoneless 默认后 signal 精确通知如何取代脏检查；provideZonelessChangeDetection/markForCheck 的兜底角色；effect 与 afterNextRender 的调度时机；性能与调试的实际变化（呼应 ng-signals、sig-perf、solid-internals）

## 一、zone.js 时代变更检测：一张工作流程图

```
用户操作 / setTimeout / HTTP 响应 / DOM 事件
          ↓
     zone.js 拦截（fork 出的 Zone 捕获异步完成）
          ↓
  Angular Zone 通知 ApplicationRef.tick()
          ↓
  从根组件开始【深度优先遍历整棵组件树】
     每个组件执行 ngDoCheck()
       OnPush 组件：只在 Input 引用变/内部事件/markForCheck 时检查
       Default 组件：每次全检查
          ↓
     发现绑定的表达式值变了 → 更新 DOM
```

zone.js 的价值：**全能捕获一切异步**——setTimeout/Promise/fetch/WebSocket/addEventListener/DOM 事件——只要有任何异步完成就触发一轮 CD。代价：① **粗粒度**——哪怕只有一个按钮的文本该更新，也遍历所有组件；② **性能天花板**——千级组件树一轮 CD 可能占 5-15ms；③ **调试困难**——zone 栈帧污染、console trace 看不出谁触发的。

## 二、zoneless 时代：signal 写→精确通知→只更新受影响的绑定

```
signal.set(newValue)
       ↓
  标记所有下游 computed 为 dirty（推标记）
       ↓
  调度变更检测到微任务队列
       ↓
  微任务 drain → 执行 effect 回调（若有）
       ↓
  模板绑定的 signal 订阅者收到通知 → 只重读该绑定 → 更新对应 DOM 节点
```

关键差异：**没有『遍历组件树』这一步**——signal 写→谁读了这个 signal 的绑定直接更新。这就是 zoneless 的『精确通知取代脏检查』。

onPush 策略在 zoneless 下：不写任何变更检测配置（默认就是精确的）、OnPush 变成**可选的文档性约束**——『这个组件只通过 input/signal 驱动』。

## 三、provideZonelessChangeDetection 与迁移路径

```ts
// app.config.ts（v18-20 手动 opt-in）
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),  // v21+ 默认不写这行也是 zoneless
    provideRouter(routes),
  ],
};
```

v18-v20 工程切 zoneless 的 checklist：① 所有状态迁移到 signal（不用 signal 管的值 zoneless 不知道变）；② 第三方库评估（RxJS Observable 用 toSignal 桥）；③ setTimeout 等非 signal 回调里手动写 signal（不写就不更新）；④ 测试切 `fixture.detectChanges()` → `await fixture.whenStable()`。**v21+ 新工程默认 zoneless 零配置**——你看到 ng new 产物 app.config 没有 zone provider 就对了。

## 四、非 signal 驱动的兜底：markForCheck 与 ChangeDetectorRef

zoneless 下仍有『值不是 signal 但视图需要更新』的场景：
- @HostListener 事件回调里改了普通 class 属性；
- 第三方库回调里改了组件字段。

兜底：
```ts
private cdr = inject(ChangeDetectorRef);

onThirdPartyEvent(data: any) {
  this.result = data;           // 普通属性——zoneless 不知道它变了
  this.cdr.markForCheck();      // 手动标脏→下一轮调度检查本组件
}
```

markForCheck 在 zoneless 下的语义：标记当前组件需要检查→ApplicationRef 调度一次增量 CD（只查标脏路径）。性能比旧时代好——不再遍历全树。最佳实践：**消灭非 signal 突变路径**（改成 signal 写）而非到处 markForCheck。

## 五、effect 与 afterNextRender 的调度时机

**effect**（v17+）：
- 注册时机：field initializer / constructor 里；
- 首次执行：**微任务**（不在注册同一栈，下一个 microtask drain 跑）；
- 重执行：依赖 signal 变化后，批处理（同一轮多个 set 只跑一次 effect）。

**afterNextRender**（v17+）：
- 注册组件渲染**到 DOM 后**执行一次的回调（替代旧 ngAfterViewInit 做 DOM 操作）；
- `phase: RenderPhase.EarlyRead / AfterRender`——控制与其他 afterRender 的执行顺序；
- SSR 阶段自动 skip（afterRender 只在 browser 执行）。

```ts
import { afterNextRender } from '@angular/core';

constructor() {
  afterNextRender({
    write: () => { this.chart = new Chart(this.el().nativeElement); },
    read: () => { /* 读布局尺寸 */ },
    mixedRead: () => { /* 先读后写 */ },
  });
}
```

## 六、性能与调试的实际变化

| 指标 | zone.js 时代 | zoneless + signal |
|------|-------------|-------------------|
| 变更检测触发面 | 任何异步完成→全树扫描 | signal 写→只更新受影响绑定 |
| 千组件应用典型 CD 耗时 | 5-15ms（全树遍历） | <1ms（单绑定更新） |
| dev mode 性能 | 双倍脏检查（防 ExpressionChanged） | 单通道无需二次验证 |
| 调试可读性 | Zone 栈帧→call trace 混乱 | 普通 JS 栈帧→清晰 |
| 内存 | zone.js runtime ~15KB | 零（无 zone polyfill） |

实际体感：dev 模式 HMR 不再触发全局 CD（signal 精确热替）；ng build 产物少了 zone.js 体积；Chrome DevTools Performance 面板里 call stack 终于不被 zone 切断了。

## 七、zoneless 不是『不需要变更检测』

常见误解：『zoneless = 不需要变更检测了』。正解：**变更检测仍需要**——signal 值变了→视图要更新→这本身就是变更检测。zoneless 改的是**触发机制与范围**：从『外部（zone）说"该检查了"→全树扫描』变成『内部（signal）说"我变了"→只通知订阅了的人』。ApplicationRef.tick() 仍然存在——只是触发频率从『每次异步完成』降到『微任务 drain 时有脏 signal 才跑』。

> 🚀 下一站：L5 表单与 HTTP——Reactive Forms 与 Signal Forms 两条表单路线的正面对比。
