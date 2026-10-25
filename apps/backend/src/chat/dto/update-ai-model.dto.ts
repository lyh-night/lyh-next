import { PartialType } from '@nestjs/swagger'
import { CreateAiModelDto } from './create-ai-model.dto.js'

/**
 * 局部更新：所有字段可选。
 * `apiKey` 省略或传空串表示「保留原值」，因此前端编辑时不必回填密钥。
 */
export class UpdateAiModelDto extends PartialType(CreateAiModelDto) {}
