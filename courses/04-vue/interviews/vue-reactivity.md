# 面试题 · Vue 3 响应式与组件模型

1. **Vue 2 与 Vue 3 响应式的差异？**
   - Vue2：`Object.defineProperty`，无法侦测**新增属性 / 数组下标**，必须 `Vue.set`。
   - Vue3：`Proxy` + `Reflect`，能侦测增删、数组变更、Map/Set。

2. **reactive 和 ref 的区别？各自适用场景？**
   - ref：包装单个值（`.value`），可以在模板中自动解包；适合基本类型与需要重新赋值的对象。
   - reactive：整体代理一个对象；不能重新赋值整体（会脱离响应式）。
   经验：值类型 / 需要整体替换 → ref；对象/表单模型 → reactive。

3. **为什么 setup 里顶层 return 的函数才能被模板访问？**
   script setup 编译时会把顶层绑定注入到 `render` 闭包中；`return {}` 的对象才是组件的**渲染上下文**。

4. **watch 和 watchEffect 的取舍？**
   - watch：明确指定源、可拿到旧值、支持懒执行。
   - watchEffect：自动追踪依赖，立即执行；不便精细控制。

5. **computed 与 watch 的区别？**
   computed 是**有返回值的派生状态**，缓存直到依赖变化；watch 是**副作用**，不返回值。

6. **nextTick 的用途？底层如何实现？**
   DOM 更新异步批量；nextTick 返回 Promise，在微任务队列 flush 后解析。旧环境用 MutationObserver/setTimeout 降级。

7. **key 在 v-for 里为什么重要？**
   diff 算法用 key 判定节点是否可复用；无 key 会退化为「就地复用」，涉及输入框/动画时有 bug 与性能问题。

8. **如何写一个可双向绑定的自定义 v-model 组件？**
   ```vue
   <script setup>
   const props = defineProps<{ modelValue: string }>();
   const emit = defineEmits<{ (e:'update:modelValue', v:string):void }>();
   </script>
   <input :value="props.modelValue" @input="emit('update:modelValue', $event.target.value)"/>
   ```
