import { z } from "zod";

export const isoDateTimeStringSchema = z.string().datetime({ offset: true });

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const jsonValueSchema: z.ZodType<
  string | number | boolean | null | readonly unknown[] | { readonly [key: string]: unknown }
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

export const recordLifecycleSchema = z.object({
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema
});

export const tagRecordSchema = recordLifecycleSchema.extend({
  id: z.number().int().positive(),
  category: z.string().min(1).max(30),
  langMetadata: z.record(z.string().min(1), z.string().min(1)),
  sortOrder: z.number().int(),
  deletedAt: isoDateTimeStringSchema.optional()
});

export const userTagRecordSchema = recordLifecycleSchema.extend({
  id: z.number().int().positive(),
  userId: z.string().min(1).max(100),
  tagId: z.number().int().positive(),
  desc: z.string(),
  deletedAt: isoDateTimeStringSchema.optional()
});

export const tweetTagMatchRecordSchema = recordLifecycleSchema.extend({
  id: z.number().int().positive(),
  traceId: z.string().min(1),
  tweetId: z.string(),
  tagId: z.number().int().positive(),
  tagCategory: z.string().min(1).max(30),
  tagLangMetadata: z.record(z.string().min(1), z.string().min(1)),
  tweetPayload: jsonObjectSchema,
  llmResult: jsonObjectSchema,
  pushedAt: isoDateTimeStringSchema.optional()
});

export const conversationRecordSchema = recordLifecycleSchema.extend({
  id: z.number().int().positive(),
  conversationId: z.string().min(1).max(200),
  userId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  deletedAt: isoDateTimeStringSchema.optional()
});

export const conversationDetailRecordSchema = recordLifecycleSchema.extend({
  id: z.number().int().positive(),
  conversationId: z.string().min(1).max(200),
  msgId: z.string().min(1).max(200),
  userId: z.string().min(1).max(100),
  direction: z.union([z.literal(0), z.literal(1)]),
  message: z.string(),
  deletedAt: isoDateTimeStringSchema.optional()
});

export type JsonValue = z.infer<typeof jsonValueSchema>;
export type TagRecord = z.infer<typeof tagRecordSchema>;
export type TweetTagMatchRecord = z.infer<typeof tweetTagMatchRecordSchema>;
export type UserTagRecord = z.infer<typeof userTagRecordSchema>;
export type ConversationRecord = z.infer<typeof conversationRecordSchema>;
export type ConversationDetailRecord = z.infer<typeof conversationDetailRecordSchema>;
