---
name: nestjs-api-contract
description: 统一响应信封、DTO 校验、HTTP 200 约定与 Swagger 标注规范。新增/修改 apps/backend 接口（controller、DTO）时使用。
---

# NestJS 接口契约规范（apps/backend）

## 统一响应信封

所有 JSON 接口返回扁平信封 `{ code, message, data, stack? }`：

- 成功：HTTP 200，`code = 0`，`message = ''`；成功不带 `stack`。
- 业务失败：HTTP 仍为 200，`code` 为业务码（不是 HTTP 状态码），`data = null`。
- `stack` 只有未预期异常（`code=10000`）且非生产环境才返回。
- 成功包装由 `TransformInterceptor` 完成，失败由 `HttpExceptionFilter` 完成，controller 不手工拼信封。
- SSE / 流式接口用 `@SkipResponseEnvelope()` 排除包装。

## HTTP 状态码

- 成功与业务失败统一 HTTP 200。**新增 POST 路由必须加 `@HttpCode(200)`**（Nest 默认 201）。
- Swagger 标注用 `@ApiOkResponse`，不用 `@ApiCreatedResponse`。

## DTO 校验

- DTO 用 `class-validator` + `@ApiProperty`（必填）/ `@ApiPropertyOptional`（可选），中文校验文案。
- 全局 `ValidationPipe`：`whitelist` + `transform` + `forbidNonWhitelisted`，**不开启 `enableImplicitConversion`**。
- query / 非JSON 来源的数字字段必须显式 `@Type(() => Number)`，布尔字段 `@Type(() => Boolean)`，
  否则 `@IsInt()` / `@IsBoolean()` 会对字符串校验失败：
  ```ts
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number
  ```
- body JSON 接口的数字/布尔字段天然是原生类型，不需要 `@Type`。

## Controller 纪律

- controller 只做协议转换：参数接入、调 service、返回数据；业务与 SQL 全在 service。
- 预期业务错误抛 `ApiException(code, message, httpStatus)`（`common/errors/api.exception.ts`），
  业务码从 `ApiCode`（`common/errors/api-code.ts`）取，按区间只追加不复用；
  通用场景也可用标准 `HttpException`，由过滤器按 HTTP 状态兜底映射。
- 不要 try/catch 后自己拼错误响应；新增业务码要同步 `docs/err-handing.md` §6.2。
- 每个路由标注 `@ApiOperation({ summary })`；响应头有自定义头时在 `main.ts` CORS `exposedHeaders` 暴露。

## 检查清单

- [ ] POST 路由是否加了 `@HttpCode(200)` + `@ApiOkResponse`
- [ ] DTO 数字字段（query）是否加了 `@Type(() => Number)`
- [ ] 是否复用了 `@Public()` / 全局守卫，而不是每个接口手工校验登录
- [ ] 返回结构是否只包含 `data` 内容（信封由拦截器负责）
- [ ] 失败是否抛 `ApiException` 并选用了正确的业务码区间（1xxxx 通用 / 2xxxx 认证 / 3xxxx 对话）
- [ ] Swagger 描述是否还在引用旧字段 `status.code`
