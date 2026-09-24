# vi.fn 与 vi.spyOn

## 一、vi.fn：造一个「带记忆」的假函数

```ts
const cb = vi.fn();
cb('a');
expect(cb).toHaveBeenCalled();
expect(cb).toHaveBeenCalledWith('a');
```

`vi.fn()` 返回一个可编程又自带调用记录的函数。**给回调、事件处理、被依赖函数喂一个「我不管它干嘛，我只关心它被怎么调用」的替身**，是单元隔离的核心手段。传参可直接写实现：`vi.fn((x) => x * 2)`。

## 二、控制返回值

- `mockReturnValue(v)`：同步返回固定值。
- `mockResolvedValue(v)`：返回 `Promise<v>`（测异步依赖常用）。
- `mockImplementation(fn)`：完全自定义每次调用行为。
- `mockReturnValueOnce/mockImplementationOnce`：只影响下一次，测「第一次失败第二次成功」极有用。

## 三、vi.spyOn：监听既有对象的方法

不想整个替换、只想**观察或临时改一个已存在对象上的方法**：`const s = vi.spyOn(obj, 'get')`。它默认仍调原实现，可 `mockReturnValueOnce` 覆盖。**用完 `s.mockRestore()`**（或 config `restoreMocks`）把方法还回去，否则污染后续用例。

## 四、清理与那个坑

- `mockClear()`：只清调用记录（`mock.calls`）。
- `mockReset()`：清记录 + 去掉自定义实现。
- `mockRestore()`：彻底恢复被 spy 的原方法。

把 `clearAllMocks` 配进 setup 看似省事，但若你在**模块级**（describe 外）建的 mock，清理时机可能把你辛苦设的 `mockReturnValue` 一起抹掉。**别盲抄 `resetAllMocks: true`**，多数场景 `clearMocks` 或每用例自建更稳。

## 五、什么时候根本不该 mock

被测的是**纯逻辑、无外部副作用**的函数——直接调它断言返回值，别 mock，mock 反而让测试与实现细节耦合、失去意义。**mock 是为了隔离「你这次不想真跑的部分」**（网络、系统时间、随机、昂贵依赖），不是万能。

## 小结
vi.fn 造带调用记录的假函数（toHaveBeenCalledWith/toHaveBeenCalledTimes 断言）；mockReturnValue/mockResolvedValue/mockImplementation(Once) 控制返回；vi.spyOn 监听既有方法、用完 mockRestore；clear 清记录、reset 去实现、restore 复原，别盲配 resetAllMocks；纯逻辑无副作用就不该 mock——mock 为隔离「不想真跑的部分」。

## 部署预告
给一个接收回调的函数（如 `fetchUser(id, onOk)`）写测试：用 `vi.fn()` 传入 onOk，断言成功路径它被以预期参数调用一次；再用 `mockRejectedValueOnce` 让依赖失败，断言错误分支。体会「只验证交互、不碰真实网络」。
