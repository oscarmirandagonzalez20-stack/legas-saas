import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';

const CONVERSATION_SELECT = {
  id: true,
  leadId: true,
  socialAccountId: true,
  status: true,
  in24hWindow: true,
  humanOwned: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
  lead: { select: { displayName: true, areaLegal: true, stage: true } },
} as const satisfies Prisma.ConversationSelect;

const MESSAGE_SELECT = {
  id: true,
  direction: true,
  sender: true,
  body: true,
  deliveredAt: true,
  readAt: true,
  createdAt: true,
} as const satisfies Prisma.MessageSelect;

@Injectable()
export class ConversationsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listConversations() {
    return this.tenantPrisma.run((tx) =>
      tx.conversation.findMany({
        select: CONVERSATION_SELECT,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    );
  }

  async getConversation(id: string) {
    return this.tenantPrisma.run(async (tx) => {
      const conv = await tx.conversation.findUnique({
        select: CONVERSATION_SELECT,
        where: { id },
      });
      if (!conv) throw new NotFoundException(`Conversation ${id} not found`);
      return conv;
    });
  }

  listMessages(conversationId: string) {
    return this.tenantPrisma.run((tx) =>
      tx.message.findMany({
        select: MESSAGE_SELECT,
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }
}
