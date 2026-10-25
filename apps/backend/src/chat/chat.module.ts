import { Module } from '@nestjs/common'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { ConversationsController } from './conversations.controller.js'
import { ConversationsService } from './conversations.service.js'
import { ModelsController } from './models.controller.js'
import { ModelsService } from './models.service.js'

@Module({
  controllers: [ModelsController, ConversationsController, ChatController],
  providers: [ModelsService, ConversationsService, ChatService],
})
export class ChatModule {}
