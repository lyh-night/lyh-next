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

### 全局样式的层（layer）

自定义基础样式必须写在 `@layer base` 里：

```css
@layer base {
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}
```

原因：Tailwind v4 把工具类放在 `@layer utilities`，而**未分层（unlayered）的声明优先级高于任何 layer**。在 `index.css` 里直接写 `div { color: ... }` 会盖掉 `text-*` 工具类（曾导致 Tooltip 文字颜色失效）。

约定：

- 默认文字色 / 背景色挂在 `body` 上，靠继承生效，不要写死在 `div` 上
- 未指定颜色的边框用 `*, ::after, ::before { border-color: var(--color-border) }` 兜底
- 主题变量只由 `@lyh-next/components` 的 `styles.css` 提供，app 内不重复定义

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
