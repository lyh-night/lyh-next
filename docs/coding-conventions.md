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

不要在组件中直接 `fetch()` 或 `axios()`。浏览器侧 JSON 请求统一走 `apps/frontend/src/utils/api.ts` 的 axios 封装：

- 用 `request<T>({ url, method, data })`，不要自己拼 baseURL、`JSON.stringify` 或判断 `response.status`。
- 后端响应为扁平信封 `{ code, message, data, stack? }`；成功判断看 `code === 0`，由拦截器完成；失败码是业务码（见 `docs/err-handing.md`）。
- 公开接口（登录、注册、登出、`/me`）必须传 `skipAuthRedirect: true`，避免业务失败（如密码错误 `20001`）触发全局跳登录。
- 后端 JSON 接口成功与业务失败都返回 HTTP 200；新增 `POST` 路由记得加 `@HttpCode(200)`，避免 Nest 默认 201。
- SSE / 流式接口不在该封装内处理，后续统一使用 `fetch-event-source`。

---

## 五、错误处理

所有异步操作必须：

- 使用 `try/catch`
- 不要吞掉异常
- 错误信息应明确

统一封装后：

- 错误提示由 axios 响应拦截器负责（归一化 `ApiError` + 默认 toast），页面不再重复 `toast.error`。
- 需要页面内联展示（如列表加载失败 + 重试）时传 `silent: true`，在 `catch` 中读取 `ApiError.message`。
- `catch` 只用于控制流（复位 loading、保持表单内容等），不要静默丢弃错误；静态分析仍需满足 `try/catch` 约定。
- 后端 `stack` 存在 `ApiError.serverStack`，仅供排查，不向用户展示。

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
