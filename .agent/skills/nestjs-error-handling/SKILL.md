---
name: nestjs-error-handling
description: 全局异常过滤器、错误分类、日志与 SSE 错误处理规范。修改 apps/backend 错误响应、过滤器或日志行为时使用。
---

# NestJS 错误处理规范（apps/backend）

## 错误分类

- 预期业务错误：抛 `ApiException(code, message, httpStatus)`，`code` 是业务码而不是 HTTP 状态码。
- 没有显式业务码的 `HttpException` 由过滤器按 HTTP 状态兜底映射（400→10001、401→10002、404→10004、409→10005、413→10007、429→10006、5xx→10000）。
- 非预期错误：不抛裸 `Error` 给客户端；过滤器按 `10000` 处理并记录完整堆栈。
- Prisma `P2002` → `10005`、`P2025` → `10004`；body-parser 413 → `10007`；未知路由 → `10004`。
- message 数组（ValidationPipe）在过滤器里用「；」join 成单条字符串。

## 统一过滤器（HttpExceptionFilter）

- 输出扁平信封 `{ code, message, data: null, stack? }`，HTTP 状态强制 200。
- `stack` 只在 `code=10000` 且 `NODE_ENV !== 'production'` 时输出；其它情况**不输出该字段**（不是空数组）。
- **必须保留 `headersSent || writableEnded || destroyed` 守卫**：SSE 等已开始/已结束的响应不能再写 JSON，只记日志。
- 只有 `code=10000` 记录 `logger.error(method + url + code, stack)`；预期业务错误不打堆栈日志。

## 日志

- 请求访问日志由 `LoggingInterceptor` 统一输出：`METHOD path http=200 code=... 耗时ms`；业务代码不要重复打请求日志。
- 因为 JSON 接口 HTTP 恒为 200，监控与告警必须按 `code` 聚合，不能依赖 HTTP 状态。
- 关键业务事件（注册、登录失败等）可在 service 用 `Logger` 记一行，不得打印密码、token、apiKey。
- 日志上下文用类名：`new Logger(AuthService.name)`。

## SSE 特殊处理

- 流开始前出错：controller 把异常重新抛给全局过滤器（`headersSent === false`），返回统一 JSON 信封。
- 流开始后出错：写 SSE 错误帧（`backend_stream_error`）+ `data: [DONE]` 收尾，不要中途换成 JSON。
- 客户端断开（`close`）按 aborted 收尾，不再向已关闭连接写帧。

## 检查清单

- [ ] 新错误是否复用了 `HttpException` 子类而非自定义响应体
- [ ] 过滤器的 headersSent 守卫是否未被移除
- [ ] 敏感信息（密码/token/apiKey）是否确认不进日志
- [ ] stack 只在失败信封中出现，前端不展示
