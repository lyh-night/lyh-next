import { Injectable } from '@nestjs/common'

export interface ServiceInfo {
  name: string
  version: string
  environment: string
}

@Injectable()
export class AppService {
  getInfo(): ServiceInfo {
    return {
      name: 'lyh-next-backend',
      version: process.env.npm_package_version ?? '0.0.0',
      environment: process.env.NODE_ENV ?? 'development',
    }
  }
}
