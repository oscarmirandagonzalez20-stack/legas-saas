import { Controller, Get, Param, ParseUUIDPipe, UseGuards, UseInterceptors } from '@nestjs/common';
import { DevTenantGuard } from '@/common/tenant-context/dev-tenant.guard';
import { TenantContextInterceptor } from '@/common/tenant-context/tenant-context.interceptor';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(DevTenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list() {
    return this.conversationsService.listConversations();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.getConversation(id);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.listMessages(id);
  }
}
