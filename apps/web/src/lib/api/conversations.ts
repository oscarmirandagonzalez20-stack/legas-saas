import type { Conversation, Message } from './types';
import { apiFetch } from '../api-client';

export async function listConversations(token: string | null): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/conversations', { token });
}

export async function getConversation(id: string, token: string | null): Promise<Conversation> {
  return apiFetch<Conversation>(`/conversations/${id}`, { token });
}

export async function listMessages(conversationId: string, token: string | null): Promise<Message[]> {
  return apiFetch<Message[]>(`/conversations/${conversationId}/messages`, { token });
}
