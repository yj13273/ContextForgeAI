import { z } from "zod";

export const LLMMessageRoleSchema = z.enum(["system", "user", "assistant"]);
export type LLMMessageRole = z.infer<typeof LLMMessageRoleSchema>;

export const LLMMessageSchema = z.object({
  role: LLMMessageRoleSchema,
  content: z.string(),
});
export type LLMMessage = z.infer<typeof LLMMessageSchema>;

export const LLMToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()).default({}),
});
export type LLMToolDefinition = z.infer<typeof LLMToolDefinitionSchema>;

export const LLMToolCallSchema = z.object({
  name: z.string(),
  input: z.record(z.unknown()).default({}),
});
export type LLMToolCall = z.infer<typeof LLMToolCallSchema>;

export const LLMRequestSchema = z.object({
  messages: z.array(LLMMessageSchema),
  tools: z.array(LLMToolDefinitionSchema).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});
export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export const LLMUsageSchema = z.object({
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  totalTokens: z.number().default(0),
});
export type LLMUsage = z.infer<typeof LLMUsageSchema>;

export const LLMResponseSchema = z.object({
  content: z.string(),
  toolCall: LLMToolCallSchema.optional(),
  usage: LLMUsageSchema.optional(),
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

/**
 * Vendor-neutral LLM abstraction interface.
 * Decoupled from specific providers (OpenAI, Gemini, GLM, Anthropic, local).
 */
export interface LLMProvider {
  readonly providerName: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
}
