---
name: nestjs-architecture
description: NestJS 模块划分、依赖注入与全局增强器（APP_FILTER/APP_INTERCEPTOR/APP_GUARD）规范。新增/调整 apps/backend 模块、provider 或全局基础设施时使用。
---

# NestJS 架构规范（apps/backend）

## 模块划分

- 每个业务域一个目录 + 一个 Module：`auth/`、`chat/`、`health/`、`prisma/`。
- 模块内结构固定：`*.module.ts`、`*.controller.ts`、`*.service.ts`、`dto/`、跨 provider 共享的类型放 `*.types.ts`。
- 单模块注册超过 3 个 controller 且域之间无共享状态时，拆分为子模块。
- 横切基础设施（filter / interceptor / pipe / config 校验）放 `src/common/`，不要塞进业务模块。

## 依赖注入

- 全局增强器一律通过 DI token 注册（`APP_FILTER` / `APP_INTERCEPTOR` / `APP_GUARD` / `APP_PIPE`），
  在 `AppModule` 直接导入的 `CommonModule` 中声明；禁止在 `main.ts` 里 `new` 全局类。
  ```ts
  @Module({
    providers: [
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
      { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
      { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    ],
  })
  export class CommonModule {}
  ```
- 同类增强器的执行顺序 = providers 数组顺序（数组前者在外层）。`LoggingInterceptor` 必须排在 `TransformInterceptor` 之前，耗时统计才完整。
- 需要依赖（如 `Reflector`、`ConfigService`）的增强器靠构造函数注入，不要 `app.get()` 手动取。
- 共享 provider：数据库用 `@Global() PrismaModule` 导出 `PrismaService`，业务模块直接注入，禁止重复 import。

## 生命周期与 ESM

- 后端是 ESM：相对导入必须带 `.js` 后缀（`./foo.service.js`）。
- 资源初始化/清理用 `OnModuleInit` / `OnModuleDestroy`（参考 `PrismaService` 的 `$connect` / `$disconnect`）。
- 启动期就应失败的配置（如缺少密钥）在 provider 构造函数或 env 校验中抛错，禁止等到第一次请求。

## 类型组织

- 同一域内多个 provider 共享的接口（payload、request 扩展、DTO 派生类型）收敛到 `*.types.ts`，
  避免同一个概念在 service / guard / controller 各定义一份。
- 仅供单文件使用的类型留在原文件，不强行上移。

## 检查清单

- [ ] 新路由是否已确认鉴权语义（默认全局 `JwtAuthGuard`，公开接口必须 `@Public()`）
- [ ] 全局增强器是否走 APP_* token 而非 main.ts 手工注册
- [ ] 跨 provider 的类型是否已收敛到 types 文件
- [ ] 相对导入是否带 `.js`
