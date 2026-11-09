import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { HttpExceptionFilter } from './filters/http-exception.filter.js'
import { LoggingInterceptor } from './interceptors/logging.interceptor.js'
import { TransformInterceptor } from './interceptors/transform.interceptor.js'

/**
 * 全局横切基础设施，统一以 DI token 注册（禁止在 main.ts 手工 new）。
 * 同类增强器的执行顺序 = providers 声明顺序：Logging 在外层，耗时统计才完整。
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class CommonModule {}
