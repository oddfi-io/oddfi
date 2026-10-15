import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const personaSchema = z.object({
  tone: z.enum(["rational", "companion", "aggressive", "strict"]).optional(),
  risk: z.number().min(0).max(10).optional(),
  keywords: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export const intentSchema = z.enum(["free-chat", "match-analysis"]);

export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(20),
    persona: personaSchema.optional(),
    intent: intentSchema.optional().default("free-chat"),
    /**
     * DD-107 SSRF 防御：仅允许 1-12 位数字（SportMonks fixture_id 实测最大 11 位）。
     * 拒绝 "../" / 字母 / 特殊字符，避免被拼入下游 URL。
     */
    matchId: z
      .string()
      .regex(/^\d{1,12}$/, "matchId must be numeric (1-12 digits)")
      .optional(),
  })
  .refine((d) => d.intent !== "match-analysis" || !!d.matchId, {
    message: "matchId required when intent=match-analysis",
    path: ["matchId"],
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type Intent = z.infer<typeof intentSchema>;
