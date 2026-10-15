import { z } from "zod";

// limit 默认 20、最大 100 是与主后端 handoff 约定的列表安全边界；超限由 zod 直接拒绝返回 400。
export const memoryListQuerySchema = z.strictObject({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().min(1).optional()
});

// 跨团队约定的简化 5 字段 memory item；不暴露 confidence/subject 等内部字段，后续按需扩展。
export const memoryListItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  type: z.string().min(1),
  importance: z.number(),
  createdAt: z.string().min(1)
});

// 响应直接是 camelCase body（无 code/msg envelope），与 handoff §任务 2 的 Response 类型一致。
export const memoryListResponseSchema = z.object({
  items: z.array(memoryListItemSchema),
  nextCursor: z.string().nullable()
});

export type MemoryListQuery = z.infer<typeof memoryListQuerySchema>;
export type MemoryListItem = z.infer<typeof memoryListItemSchema>;
export type MemoryListResponse = z.infer<typeof memoryListResponseSchema>;
