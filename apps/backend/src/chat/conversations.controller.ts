import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator.js'
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
  @HttpCode(200)
  @ApiOperation({ summary: '新建会话' })
  @ApiOkResponse({ description: '返回会话元信息' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(userId, dto)
  }

  @Get('conversations')
  @ApiOperation({ summary: '会话列表（当前用户的，按最近更新倒序）' })
  @ApiOkResponse({ description: '分页返回会话，含消息数与最后一条消息预览' })
  list(@CurrentUser('id') userId: string, @Query() dto: ListConversationsDto) {
    return this.conversationsService.list(userId, dto)
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: '会话详情（不含消息）' })
  detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.conversationsService.detail(userId, id)
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: '更新会话标题 / 模型 / 系统提示词' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(userId, id, dto)
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: '删除会话（级联删除消息）' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.conversationsService.remove(userId, id)
  }

  @Delete('conversations/:id/last-turn')
  @ApiOperation({ summary: '撤回最后一轮未完成的回合（重试前调用）' })
  @ApiOkResponse({ description: 'success 为 false 表示最后一轮已完成，不可撤回' })
  removeLastTurn(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.conversationsService.removeLastTurn(userId, id)
  }

  @Get('history')
  @ApiOperation({ summary: '历史消息（参数式分页：?conversationId=&limit=&messageId=）' })
  @ApiOkResponse({ description: '按时间升序返回一页消息，hasMore 表示是否还有更旧的消息' })
  history(@CurrentUser('id') userId: string, @Query() dto: ChatHistoryDto) {
    return this.conversationsService.history(userId, dto)
  }
}
