---
name: nestjs-api-contract
description: 统一响应信封、DTO 校验、HTTP 200 约定与 Swagger 标注规范。新增/修改 apps/backend 接口（controller、DTO）时使用。
---

# NestJS 接口契约规范（apps/backend）

## 统一响应信封

所有 JSON 接口返回 `{ status: { code, message }, data, stack }`：

- 成功：HTTP 200，`status.code = 0`，`message = ''`，`stack = []`。
- 业务失败：HTTP 仍为 200，`status.code` 表达错误（400/401/404/409/500…），`data = null`。
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
- 错误一律抛 `HttpException` 子类（`NotFoundException` / `ConflictException` / `UnauthorizedException`…），
  由全局过滤器统一落信封；不要 try/catch 后自己拼错误响应。
- 每个路由标注 `@ApiOperation({ summary })`；响应头有自定义头时在 `main.ts` CORS `exposedHeaders` 暴露。

## 检查清单

- [ ] POST 路由是否加了 `@HttpCode(200)` + `@ApiOkResponse`
- [ ] DTO 数字字段（query）是否加了 `@Type(() => Number)`
- [ ] 是否复用了 `@Public()` / 全局守卫，而不是每个接口手工校验登录
- [ ] 返回结构是否只包含 `data` 内容（信封由拦截器负责）
