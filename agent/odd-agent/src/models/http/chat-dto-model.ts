import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(16_000),
  conversation_id: z.string().trim().min(1).max(200)
});

export const createConversationRequestSchema = z.object({
  name: z.string().trim().min(1).max(200)
});

export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const conversationDetailQuerySchema = z.object({
  conversation_id: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50)
});

export const createConversationDataSchema = z.object({
  conversation_id: z.string().min(1)
});

export const conversationListDataSchema = z.object({
  items: z.array(
    z.object({
      conversation_id: z.string().min(1),
      name: z.string().min(1),
      created_at: z.string().datetime({ offset: true }),
      updated_at: z.string().datetime({ offset: true })
    })
  ),
  page: z.number().int().min(1),
  page_size: z.number().int().min(1),
  total: z.number().int().min(0)
});

export const conversationDetailDataSchema = z.object({
  conversation_id: z.string().min(1),
  items: z.array(
    z.object({
      msg_id: z.string().min(1),
      direction: z.union([z.literal(0), z.literal(1)]),
      message: z.string(),
      created_at: z.string().datetime({ offset: true }),
      updated_at: z.string().datetime({ offset: true })
    })
  ),
  page: z.number().int().min(1),
  page_size: z.number().int().min(1),
  total: z.number().int().min(0)
});

export const chatApiResponseSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    code: z.literal(0),
    msg: z.literal(""),
    data
  });

export const chatMetaEventSchema = z.object({
  type: z.literal("meta"),
  trace_id: z.string().min(1),
  conversation_id: z.string().min(1)
});

export const chatTokenEventSchema = z.object({
  type: z.literal("token"),
  delta: z.string()
});

export const chatDoneEventSchema = z.object({
  type: z.literal("done"),
  trace_id: z.string().min(1),
  memory_write: z.literal("scheduled")
});

export const chatErrorEventSchema = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  message: z.string().min(1)
});

export const chatSseEventSchema = z.discriminatedUnion("type", [
  chatMetaEventSchema,
  chatTokenEventSchema,
  chatDoneEventSchema,
  chatErrorEventSchema
]);

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type CreateConversationRequest = z.infer<typeof createConversationRequestSchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type ConversationDetailQuery = z.infer<typeof conversationDetailQuerySchema>;
export type ChatMetaEvent = z.infer<typeof chatMetaEventSchema>;
export type ChatTokenEvent = z.infer<typeof chatTokenEventSchema>;
export type ChatDoneEvent = z.infer<typeof chatDoneEventSchema>;
export type ChatErrorEvent = z.infer<typeof chatErrorEventSchema>;
export type ChatSseEvent = z.infer<typeof chatSseEventSchema>;
