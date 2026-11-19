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

| 类型    | 规范                                 | 示例              |
| ------- | ------------------------------------ | ----------------- |
| 组件    | 文件名 kebab-case，导出名 PascalCase | `user-card.tsx`   |
| Hook    | `use-` 前缀 + kebab-case             | `use-user.ts`     |
| Service | `.service.ts` 后缀                   | `user.service.ts` |
| Action  | `.action.ts` 后缀                    | `user.action.ts`  |
| Type    | `.types.ts` 后缀                     | `user.types.ts`   |

> 组件拆分、必须独立成件的约定见本文件 §七。

---

## 四、接口规范

所有接口遵循以下调用链：

```
Component → Hook → Service → API
```

不要在组件中直接 `fetch()` 或 `axios()`。浏览器侧 JSON 请求统一走 `apps/frontend/src/utils/api.ts` 的 axios 封装：

- 用 `request<T>({ url, method, data })`，不要自己拼 baseURL、`JSON.stringify` 或判断 `response.status`。
- 后端响应为扁平信封 `{ code, message, data, stack? }`；成功判断看 `code === 0`，由拦截器完成；失败码是业务码（见 `docs/features/err-handing.md`）。
- 公开接口（登录、注册、登出、`/me`）必须传 `skipAuthRedirect: true`，避免业务失败（如密码错误 `20001`）触发全局跳登录。
- 后端 JSON 接口成功与业务失败都返回 HTTP 200；新增 `POST` 路由记得加 `@HttpCode(200)`，避免 Nest 默认 201。
- SSE / 流式接口不在该封装内处理：对话流由 `apps/frontend/src/components/chat/stream.ts` 实现（`fetch` + `eventsource-parser/stream`，不做自动重连）；分帧在 `src/utils/sse.ts`，帧的协议语义在 `stream-protocol.ts`。

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

---

## 七、组件与代码拆分

拆分以职责与交互边界为准，**不以行数硬卡**：先判断是否职责混杂、能否独立复用或独立测试；行数只是提示信号，
职责单一时代码长一些也可以，避免为凑行数制造碎片组件。

### 目录按页面结构组织

- 功能组件放 `apps/frontend/src/components/<feature>/`，一级子目录对应页面结构单元（对话页为
  `sidebar/`、`messages/`、`composer/`、`markdown/`），交互与状态放 `hooks/`
- 功能根目录只保留 `index.tsx`（组合）、`types.ts`（共享类型）、`api.ts`（接口封装）、
  `stream.ts`（SSE 等特殊传输层）、`stream-protocol.ts`（对应协议语义）

### 组件粒度

- 一个组件对应一个用户可见单元；弹窗、确认框、列表项、气泡、工具条都独立成文件，不内联在父组件
- 组件只做渲染与局部 UI 状态（open / copied / hover），不请求接口、不读写 localStorage、不编排业务

### 交互逻辑与业务逻辑分离

- 请求、流式、定时器、localStorage、URL 同步等副作用只出现在 `hooks/` 或 `utils/`
- 一个领域一个 `use-*.ts`；`use-<feature>.ts` 只做组合与对外 controller，导出结构保持稳定
- 数据流固定：`Component → Hook → api.ts → utils/api.ts`

### 纯函数与公共组件去向

| 内容                                         | 去处                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 跨应用通用、无业务语义/产品文案              | `packages/utils/src/`（经 `@lyh-next/utils` 导出；含 `window`/`document` 须标注 client-only） |
| 应用语义（依赖业务类型、中文文案、接口约定） | `apps/frontend/src/utils/*.ts`（只允许 type-only 引用 app 类型，不 import 组件实现）          |
| 仅单一组件使用                               | 与该组件同文件（可留模块级函数）                                                              |
| 无业务耦合、可复用的 UI 组合                 | `packages/components/src/common/`，并在 `src/index.ts` re-export；依赖业务数据的留在应用内    |
