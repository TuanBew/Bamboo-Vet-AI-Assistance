import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { streamChat, listChats } from './ragflow-client.js'
import { logger } from './logger.js'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'ragflow-mcp',
    version: '1.0.0',
  })

  server.tool(
    'ragflow_chat',
    'Send a message to the RAGflow AI assistant and receive a response',
    {
      message: z.string().max(2000).describe('The user message to send to RAGflow'),
      chat_id: z.string().describe('The RAGflow chat ID (assistant) to use'),
      conversation_id: z
        .string()
        .optional()
        .describe('Optional conversation ID to maintain context across turns'),
    },
    async ({ message, chat_id, conversation_id }) => {
      logger.info('tool:ragflow_chat', { chat_id, has_conversation: !!conversation_id })

      let fullText = ''
      try {
        for await (const token of streamChat({
          message,
          chatId: chat_id,
          conversationId: conversation_id,
        })) {
          fullText += token
        }
      } catch (err) {
        logger.error('ragflow_chat: stream failed', { chat_id })
        throw new Error('RAGflow unavailable')
      }

      return { content: [{ type: 'text' as const, text: fullText }] }
    }
  )

  server.tool(
    'ragflow_list_chats',
    'List available RAGflow chat assistants',
    {},
    async () => {
      logger.info('tool:ragflow_list_chats')

      try {
        const chats = await listChats()
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(chats, null, 2) }],
        }
      } catch {
        logger.error('ragflow_list_chats: fetch failed')
        throw new Error('RAGflow unavailable')
      }
    }
  )

  return server
}
