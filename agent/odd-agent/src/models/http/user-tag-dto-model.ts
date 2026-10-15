import { z } from "zod";

export const internalTagResponseSchema = <T extends z.ZodType>(
  dataSchema: T
): z.ZodObject<{
  code: z.ZodNumber;
  msg: z.ZodString;
  data: T;
}> =>
  z.object({
    code: z.number().int(),
    msg: z.string(),
    data: dataSchema
  });

export const tagCategorySchema = z.string().min(1).max(30);

export const tagLangMetadataSchema = z
  .record(z.string().min(1), z.string().min(1))
  .refine((value) => value.en !== undefined && value.en.trim().length > 0, {
    message: "lang_metadata.en is required"
  });

export const tagDtoSchema = z.object({
  id: z.number().int().positive(),
  category: tagCategorySchema,
  lang_metadata: tagLangMetadataSchema,
  sort_order: z.number().int(),
  deleted_at: z.string().datetime({ offset: true }).nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional()
});

export const batchCreateTagsRequestSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        category: tagCategorySchema,
        lang_metadata: tagLangMetadataSchema,
        sort_order: z.number().int().default(0)
      })
    )
    .min(1)
});

export const batchUpdateTagsRequestSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.number().int().positive(),
        category: tagCategorySchema.optional(),
        lang_metadata: tagLangMetadataSchema.optional(),
        sort_order: z.number().int().optional()
      })
    )
    .min(1)
});

export const batchDeleteTagsRequestSchema = z.strictObject({
  ids: z.array(z.number().int().positive()).min(1)
});

export const listTagsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(200).default(50),
  category: tagCategorySchema.optional(),
  include_deleted: z.coerce.boolean().default(false)
});

export const userIdParamsSchema = z.strictObject({
  userId: z.string().min(1).max(100)
});

export const userTagsRequestSchema = z.strictObject({
  tag_ids: z.array(z.number().int().positive()).min(1),
  desc: z.string().default("")
});

export const userTagsQuerySchema = z.strictObject({
  include_deleted: z.coerce.boolean().default(false)
});

export const userMatchedTweetsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20)
});

export const tagRuleGroupSchema = z.strictObject({
  operator: z.enum(["and", "or"]),
  tag_ids: z.array(z.number().int().positive()).min(1)
});

export const tagRulesSchema = z.strictObject({
  operator: z.enum(["and", "or"]),
  groups: z.array(tagRuleGroupSchema).min(1)
});

export const matchTextRequestSchema = z.strictObject({
  text: z.string().min(1),
  rules: tagRulesSchema,
  locale: z.enum(["en", "zh-CN"]).default("en")
});

export const llmTagMatchResultSchema = z.strictObject({
  code: z.number().int(),
  msg: z.string().min(1),
  data: z.array(z.string().min(1)).default([])
});

export const matchedTagDtoSchema = tagDtoSchema.pick({
  id: true,
  category: true,
  lang_metadata: true
});

export const tagListDataSchema = z.object({
  items: z.array(tagDtoSchema),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().min(0)
});

export const batchTagDataSchema = z.object({
  items: z.array(tagDtoSchema),
  failed: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        index: z.number().int().min(0).optional(),
        code: z.number().int(),
        msg: z.string()
      })
    )
    .default([])
});

export const userTagsDataSchema = z.object({
  user_id: z.string().min(1),
  tags: z.array(
    tagDtoSchema
      .pick({
        id: true,
        category: true,
        lang_metadata: true,
        sort_order: true,
        created_at: true
      })
      .extend({
        desc: z.string()
      })
  )
});

export const matchTextDataSchema = z.object({
  matched: z.boolean(),
  matched_tags: z.array(matchedTagDtoSchema),
  llm_result: llmTagMatchResultSchema
});

export const userMatchedTweetDtoSchema = z.object({
  tweet_id: z.string().min(1),
  tweet: z.object({
    raw: z.record(z.string(), z.unknown())
  }),
  matched_tags: z.array(matchedTagDtoSchema),
  llm_result: z.record(z.string(), z.unknown()),
  matched_at: z.string().datetime({ offset: true }),
  pushed_at: z.string().datetime({ offset: true }).nullable()
});

export const userMatchedTweetsDataSchema = z.object({
  items: z.array(userMatchedTweetDtoSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().min(0)
});

export type BatchCreateTagsRequest = z.infer<typeof batchCreateTagsRequestSchema>;
export type BatchUpdateTagsRequest = z.infer<typeof batchUpdateTagsRequestSchema>;
export type BatchDeleteTagsRequest = z.infer<typeof batchDeleteTagsRequestSchema>;
export type ListTagsQuery = z.infer<typeof listTagsQuerySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type UserTagsRequest = z.infer<typeof userTagsRequestSchema>;
export type UserTagsQuery = z.infer<typeof userTagsQuerySchema>;
export type UserMatchedTweetsQuery = z.infer<typeof userMatchedTweetsQuerySchema>;
export type TagRules = z.infer<typeof tagRulesSchema>;
export type MatchTextRequest = z.infer<typeof matchTextRequestSchema>;
export type LlmTagMatchResult = z.infer<typeof llmTagMatchResultSchema>;
export type TagDto = z.infer<typeof tagDtoSchema>;
export type MatchTextData = z.infer<typeof matchTextDataSchema>;
