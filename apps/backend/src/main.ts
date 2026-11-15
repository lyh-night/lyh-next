import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module.js'
import { PinoLoggerService } from './common/logging/pino-logger.service.js'
import { requestContextMiddleware } from './common/request-context/request-context.js'

async function bootstrap() {
  // bufferLogs：启动初期的 Nest 内部日志先缓存，切换 pino 后统一输出
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoLoggerService))
  const config = app.get(ConfigService)
  const logger = new Logger('Bootstrap')

  // 必填环境变量（AUTH_SECRET / DATABASE_URL 等）由 ConfigModule 的 validateEnv 启动期校验

  // 统一 API 前缀：业务路由、健康检查与文档都挂在 /api 下
  app.setGlobalPrefix('api')

  // 安全响应头：CSP 关闭（/api/docs 的 Swagger UI 需要内联脚本，API 本身不产出 HTML）
  app.use(helmet({ contentSecurityPolicy: false }))

  // 解析 cookie（登录守卫从 httpOnly cookie 读取会话）
  app.use(cookieParser())

  // 请求追踪：生成/透传 X-Request-Id（AsyncLocalStorage 串联日志，见 request-context.ts）
  app.use(requestContextMiddleware())

  // 对话接口的请求体可能较长，放宽 JSON 体积上限（默认 100kb）
  app.useBodyParser('json', { limit: '2mb' })

  // DTO 校验：剥离未声明字段；数字字段靠 DTO 上的 @Type 显式转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // 全局过滤器与拦截器在 CommonModule 以 APP_FILTER / APP_INTERCEPTOR 注册

  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    // SSE 接口通过自定义头回传会话与消息 id，浏览器侧需显式暴露
    exposedHeaders: ['X-Conversation-Id', 'X-Message-Id'],
  })

  // 允许容器收到 SIGTERM 后优雅关闭
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lyh Next API')
    .setDescription('Lyh Next 后端接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  const port = config.getOrThrow<number>('PORT')
  await app.listen(port)

  logger.log(`API 已启动: http://localhost:${port}/api`)
  logger.log(`接口文档: http://localhost:${port}/api/docs`)
}

await bootstrap()
