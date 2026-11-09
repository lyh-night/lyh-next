import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface ServiceInfo {
  name: string
  version: string
  environment: string
}

@Injectable()
export class AppService {
  // npm_package_version 是构建期注入的变量，不进 env 校验
  private readonly version = process.env.npm_package_version ?? '0.0.0'

  constructor(private readonly config: ConfigService) {}

  getInfo(): ServiceInfo {
    return {
      name: 'lyh-next-backend',
      version: this.version,
      environment: this.config.getOrThrow<string>('NODE_ENV'),
    }
  }
}
