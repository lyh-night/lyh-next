import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ConversationsService } from './conversations.service.js'
import { ChatHistoryDto } from './dto/chat-history.dto.js'
import { CreateConversationDto } from './dto/create-conversation.dto.js'
import { ListConversationsDto } from './dto/list-conversations.dto.js'
import { UpdateConversationDto } from './dto/update-conversation.dto.js'

@ApiTags('chat')
@Controller('chat')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post('conversations')
  @ApiOperation({ summary: '新建会话' })
  @ApiCreatedResponse({ description: '返回会话元信息' })
  create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto)
  }

  @Get('conversations')
  @ApiOperation({ summary: '会话列表（按最近更新倒序）' })
  @ApiOkResponse({ description: '分页返回会话，含消息数与最后一条消息预览' })
  list(@Query() dto: ListConversationsDto) {
    return this.conversationsService.list(dto)
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: '会话详情（不含消息）' })
  detail(@Param('id') id: string) {
    return this.conversationsService.detail(id)
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: '更新会话标题 / 模型 / 系统提示词' })
  update(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationsService.update(id, dto)
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: '删除会话（级联删除消息）' })
  remove(@Param('id') id: string) {
    return this.conversationsService.remove(id)
  }

  @Get('history')
  @ApiOperation({ summary: '历史消息（参数式分页：?conversationId=&limit=&messageId=）' })
  @ApiOkResponse({ description: '按时间升序返回一页消息，hasMore 表示是否还有更旧的消息' })
  history(@Query() dto: ChatHistoryDto) {
    return this.conversationsService.history(dto)
  }
}
