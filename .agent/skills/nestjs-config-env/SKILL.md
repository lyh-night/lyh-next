---
name: nestjs-config-env
description: apps/backend 环境变量校验与 ConfigService 使用规范。新增环境变量、修改配置读取或启动校验时使用。
---

# NestJS 配置与环境变量规范（apps/backend）

## 唯一入口

- 所有配置通过 `ConfigService` 读取；**禁止**在 service/controller 里直接 `process.env.XXX`
  （例外：与 Nest 无关的构建期变量，如 `npm_package_version`）。
- 新增环境变量必须先在 `src/common/config/env.validation.ts` 的校验类里声明：
  必填项加 `@IsString() @IsNotEmpty()`，可选项用 `@IsOptional()` 并把默认值定义在类字段上，
  全仓库共享同一份默认值，禁止在使用处再写 `config.get('X') ?? '默认'`。

## 启动期校验

- `ConfigModule.forRoot({ validate })` 在应用初始化时运行校验；缺少必填变量（`AUTH_SECRET`、`DATABASE_URL`）
  或格式非法时启动直接失败，错误信息要能让人立刻知道缺了什么。
- 校验不得使用 whitelist 剥离未知键（会丢掉运行时注入的其他变量），只校验已声明的字段。
- 数字型 env（如 `PORT`）在校验类里转成 number，使用方 `config.get<number>('PORT')`。

## 读取方式

```ts
constructor(config: ConfigService) {
  this.secret = config.getOrThrow<string>('AUTH_SECRET')
  this.port = config.get<number>('PORT')
}
```

- 必填或带校验默认值（校验后必然存在）的配置用 `getOrThrow` 表达意图；仅在确实允许缺省时用 `get(key, fallback)`。
- 聚合解析（如 `CORS_ORIGINS` 拆数组）属于组装层，放在使用处并注明来源格式。

## 检查清单

- [ ] 新变量是否进了 env.validation.ts（含默认值）
- [ ] 是否消灭了 `config.get('X') ?? '硬编码默认'` 的重复兜底
- [ ] 是否还有残留的 `process.env` 直读
- [ ] 缺少必填变量时启动是否直接失败且提示明确
