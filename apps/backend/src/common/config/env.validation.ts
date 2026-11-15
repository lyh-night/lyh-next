import { plainToInstance, Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { validateSync } from 'class-validator'

/**
 * 环境变量校验：唯一声明处。
 * - 必填项缺失 / 格式非法 → 应用启动直接失败；
 * - 可选项的默认值也集中在这里，使用处禁止再写 `?? '硬编码默认'`。
 */
export class EnvVariables {
  @IsOptional()
  @IsString()
  NODE_ENV: string = 'development'

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'PORT 必须是数字' })
  @Min(1, { message: 'PORT 必须大于 0' })
  PORT: number = 3001

  @IsString({ message: '缺少必需的环境变量 DATABASE_URL' })
  @IsNotEmpty({ message: '缺少必需的环境变量 DATABASE_URL' })
  DATABASE_URL!: string

  @IsString({ message: '缺少必需的环境变量 AUTH_SECRET，请在 apps/backend/.env 中配置' })
  @IsNotEmpty({ message: '缺少必需的环境变量 AUTH_SECRET，请在 apps/backend/.env 中配置' })
  @MinLength(8, { message: 'AUTH_SECRET 太短，请使用 openssl rand -base64 32 生成' })
  AUTH_SECRET!: string

  @IsOptional()
  @IsString()
  AUTH_TOKEN_TTL: string = '7d'

  @IsOptional()
  @IsString()
  AUTH_COOKIE_NAME: string = 'auth_token'

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = 'http://localhost:3000'

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'THROTTLE_LIMIT 必须是数字' })
  @Min(1, { message: 'THROTTLE_LIMIT 必须大于 0' })
  THROTTLE_LIMIT: number = 300

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'THROTTLE_TTL_SECONDS 必须是数字' })
  @Min(1, { message: 'THROTTLE_TTL_SECONDS 必须大于 0' })
  THROTTLE_TTL_SECONDS: number = 60

  @IsOptional()
  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace'], {
    message: 'LOG_LEVEL 必须是 fatal/error/warn/info/debug/trace 之一',
  })
  LOG_LEVEL: string = 'info'

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'SLOW_REQUEST_MS 必须是数字' })
  @Min(1, { message: 'SLOW_REQUEST_MS 必须大于 0' })
  SLOW_REQUEST_MS: number = 1000

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'CHAT_UPSTREAM_CONNECT_TIMEOUT_MS 必须是数字' })
  @Min(100, { message: 'CHAT_UPSTREAM_CONNECT_TIMEOUT_MS 不能低于 100' })
  CHAT_UPSTREAM_CONNECT_TIMEOUT_MS: number = 15_000

  @IsOptional()
  @IsString()
  /** 多实例部署时必填（限流计数共享），单实例留空走内存存储 */
  REDIS_URL: string = ''
}

/**
 * ConfigModule 的 validate 钩子。
 * 不剥离未知键（运行时会注入其它变量），只校验已声明字段。
 */
export function validateEnv(config: Record<string, unknown>): EnvVariables {
  const validated = plainToInstance(EnvVariables, config, {
    enableImplicitConversion: true,
  })

  const errors = validateSync(validated)
  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('；')

    throw new Error(`环境变量校验失败：${details}`)
  }

  return validated
}
