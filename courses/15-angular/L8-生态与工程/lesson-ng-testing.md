# ng-testing：测试——Vitest 默认时代的应用层测试地图

> 目标：v21 起 Karma→Vitest/ng test 新默认；TestBed 的 configureTestingModule 写法、standalone 组件测试免 NgModule 的便利；service（signal store）纯单测、HttpClient 测试 provideHttpClientTesting；快照的慎用与 E2E 留给 Playwright 的分工——为 17 测试专题包打个薄基座（呼应 vite-vitest、solid 测试经验）

## 一、v21+ 默认测试栈：Vitest

v21（2025.11）起 `ng new` 默认生成 Vitest 配置替代 Karma+Jasmine：
- `ng test` → 运行 Vitest（浏览器模式可选）
- 不再需要 Karma 和 phantomjs/Chrome Headless 配置
- 与 Vite 共享 transform 管道 → 构建与测试同一套 TS/模板编译

```ts
// 目的：v21+ 默认测试配置——Vitest 与 Vite 共享 transform，模板/TS 同一套编译
// vitest.config.ts（自动生成）
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],          // 编译 Angular 模板/TS，ng test 走 Vitest 而非 Karma
  test: {
    globals: true,               // describe/it/expect 免 import 全局可用
    environment: 'jsdom',        // 组件测试需 DOM 环境
  },
});
// ✅ ng test 直接拉起 Vitest，与构建共用缓存、启动快
// ❌ 新旧配置混用又残留 karma.conf→两套跑器冲突，ng test 行为混乱
```

## 二、组件测试：TestBed 的 standalone 简化

standalone 组件测试**不再需要声明 imports 里的 NgModule**——直接在 TestBed 配 component：

```ts
// 目的：standalone 组件测试——不需 declaration/SharedModule，组件直接放 imports
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserCardComponent } from './user-card.component';

describe('UserCardComponent', () => {
  let fixture: ComponentFixture<UserCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent],  // standalone 组件直接放 imports（无需 declarations）
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
  });

  it('should display user name', () => {
    fixture.componentRef.setInput('user', { name: 'Alice', age: 30 });   // 用 setInput 写 input()
    fixture.detectChanges();                        // 触发变更检测，模板才反映新值
    expect(fixture.nativeElement.querySelector('.name').textContent).toBe('Alice');
  });
});
// ✅ setInput 后必调 detectChanges，断言才能拿到更新后的 DOM
// ❌ 忘 detectChanges→模板还是初始值，textContent 拿到空串、断言失败
```

对比旧（NgModule 组件）：需要 `declarations: [UserCardComponent]` + 导入整个 SharedModule。

## 三、Signal Store 单测：最简单的一层

service（signal store）是纯 class + signal——**不需要 TestBed**：

```ts
// 目的：signal store 单测——纯 class+signal，不 inject 东西就直接 new，最轻一层
import { TodoStore } from './todo.store';
import { signal, computed } from '@angular/core';
import { TestBed, runInInjectionContext } from '@angular/core/testing';

describe('TodoStore', () => {
  let store: TodoStore;

  beforeEach(() => {
    // 只有 store 内部用了 inject() 才需包在注入上下文里创建
    TestBed.runInInjectionContext(() => {
      store = new TodoStore();
    });
  });

  it('should add todo', () => {
    store.add('Buy milk');
    expect(store.todos().length).toBe(1);              // 读 signal 用函数调用 todos()
    expect(store.todos()[0].title).toBe('Buy milk');
  });

  it('should compute remaining', () => {
    store.add('A'); store.add('B');
    store.toggle(0); // A done
    expect(store.remaining()).toBe(1);                 // computed 自动重算未完成数
  });
});
// ✅ store 无依赖时直接 new TodoStore() 即可，比 TestBed 更快
// ❌ store 里用了 inject() 却直接 new→NG0203 错误，须包 runInInjectionContext
```

如果 store 不 inject 任何东西 → 直接 `new TodoStore()` 即可。

## 四、HttpClient 测试：provideHttpClientTesting

```ts
// 目的：HttpClient 测试——用 provideHttpClientTesting 拦截请求，不发真实网络
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),          // 真实 HttpClient provider
        provideHttpClientTesting(),   // 测试拦截器接管它
      ],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());  // 确保无遗漏请求（未 expectOne 的残留会报错）

  it('should fetch user by id', () => {
    service.getUser(1).subscribe(user => {
      expect(user.name).toBe('Alice');
    });
    const req = httpMock.expectOne('/api/users/1');   // 断言确实发出了这个请求
    expect(req.request.method).toBe('GET');
    req.flush({ id: 1, name: 'Alice' });              // 手动喂回假响应
  });
});
// ✅ expectOne 捕获请求 + flush 返回模拟数据，全程无真实网络
// ❌ 忘 afterEach verify→测试发出却未断言的“漏网请求”被静悄悄吞掉，生产才暴雷
```

`provideHttpClientTesting()` 拦截所有 HttpClient 请求 → 手动 expect/flush → 不发真实网络。

## 五、路由守卫测试

```ts
// 目的：路由守卫测试——用假 AuthService + runInInjectionContext 直接调守卫函数
describe('authGuard', () => {
  it('should return true when logged in', () => {
    TestBed.configureTestingModule({
      providers: [
        // 用 useValue 桩一个登录态为 true 的假服务，避免真实依赖
        { provide: AuthService, useValue: { isLoggedIn: () => true } },
      ],
    });
    // 守卫内部用 inject()，须包在注入上下文里才能拿到 provider
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );
    expect(result).toBeTrue();
  });
});
// ✅ useValue 桩住依赖 + runInInjectionContext 创建注入环境，守卫可单独测
// ❌ 裸调 authGuard(...) 不进注入上下文→守卫里 inject() 报 NG0203
```

## 六、快照测试：慎用

Vitest 支持 `expect(element).toMatchSnapshot()` —— 但对 Angular 组件：
- 模板渲染依赖变更检测时机 → 不稳定
- signal/computed 的值取决于执行顺序
- 推荐**只用于纯展示组件**（无逻辑无副作用）

替代：写**明确断言**（textContent / classList / attribute）比快照更可维护。

## 七、E2E 分工：Playwright

Angular 项目的 E2E 留给 **Playwright**（`ng add @angular/test` v20+ 或手动配置）：
- 测完整用户流程：登录 → 导航 → CRUD → 登出
- 不在 `ng test` 范围内——单独命令 `npx playwright test`
- Angular TestBed 做单元/集成；Playwright 做端到端

## 八、测试金字塔在 Angular 的实践

| 层 | 工具 | 占比 | 速度 |
|----|------|------|------|
| 单元（service/signal store/pipes） | Vitest（无 TestBed） | 70% | ms 级 |
| 组件集成 | Vitest + TestBed | 20% | 百 ms 级 |
| E2E（用户流程） | Playwright | 10% | 秒级 |

## 九、常见陷阱

1. **忘调 fixture.detectChanges()**：signal 设了 input 但模板不更新——需要触发变更检测（zoneless 下 `fixture.component.signalField.set(...)` 后 detectChanges 或直接 `await fixture.whenStable()`）。
2. **HttpTestingController 没 verify**：漏网请求不在测试里报错 → 生产才暴雷。
3. **在测试里用真实 Router**：导航异步→断言时机不稳 → 用 RouterTestingHarness 或 mock。
4. **zoneless 测试配置不一致**：项目 zoneless 但测试没配 `provideZonelessChangeDetection` → 行为不匹配。
