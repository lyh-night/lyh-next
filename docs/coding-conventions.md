# 编码规范

> TypeScript、样式、命名、接口、错误处理和性能方面的编码规范。

---

## 一、TypeScript 规范

禁止：`any`

优先使用：

- 类型推导
- 泛型
- `unknown`

Zod Schema 应作为类型来源。

---

## 二、样式规范

统一使用 Tailwind CSS。

禁止：

- 行内 style
- 重复样式

优先复用已有组件。

---

## 三、命名规范

| 类型    | 规范               | 示例              |
| ------- | ------------------ | ----------------- |
| 组件    | PascalCase         | `UserCard.tsx`    |
| Hook    | use 前缀           | `useUser.ts`      |
| Service | `.service.ts` 后缀 | `user.service.ts` |
| Action  | `.action.ts` 后缀  | `user.action.ts`  |
| Type    | `.types.ts` 后缀   | `user.types.ts`   |

---

## 四、接口规范

所有接口遵循以下调用链：

```
Component → Hook → Service → API
```

不要在组件中直接 `fetch()`。

---

## 五、错误处理

所有异步操作必须：

- 使用 `try/catch`
- 不要吞掉异常
- 错误信息应明确

---

## 六、性能要求

优先使用：

- Server Components
- Suspense
- Streaming
- Lazy Loading

避免：

- 无意义 `useEffect`
- 重复请求
