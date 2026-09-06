import { z } from "zod";
import type { Task } from "./task.js";
import type { AICoworker } from "./entities.js";
import type { ContextBundle, Context } from "./context.js";
import { ToolCallIntentSchema, type ToolResult, type ToolCallIntent } from "./tools.js";

export const FinalReasoningResultSchema = z.object({
  type: z.literal("final").default("final"),
  content: z.string(),
  reasoning: z.string().optional(),
  analysis: z.string().optional(),
  diagnosis: z.string().optional(),
  recommendations: z.array(z.string()).optional().default([]),
  isComplete: z.boolean().optional().default(true),
  summary: z.string().optional(),
  toolIntent: z.undefined().optional(),
});

export type FinalReasoningResult = z.infer<typeof FinalReasoningResultSchema>;

export const ToolCallReasoningResultSchema = z.object({
  type: z.literal("tool_call").default("tool_call"),
  toolName: z.string().min(1),
  input: z.record(z.unknown()).default({}),
  reasoning: z.string().optional(),
  analysis: z.string().optional(),
  diagnosis: z.string().optional(),
  recommendations: z.array(z.string()).optional().default([]),
  isComplete: z.boolean().optional().default(false),
  summary: z.string().optional(),
  toolIntent: ToolCallIntentSchema.optional(),
});

export type ToolCallReasoningResult = z.infer<typeof ToolCallReasoningResultSchema>;

export const LegacyReasoningResultSchema = z.object({
  analysis: z.string().min(1),
  diagnosis: z.string().optional(),
  recommendations: z.array(z.string()).optional().default([]),
  toolIntent: ToolCallIntentSchema.optional(),
  isComplete: z.boolean().optional().default(false),
  summary: z.string().optional(),
  type: z.enum(["final", "tool_call"]).optional(),
  content: z.string().optional(),
  toolName: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  reasoning: z.string().optional(),
});

export type LegacyReasoningResult = z.infer<typeof LegacyReasoningResultSchema>;

export type ReasoningResult =
  | FinalReasoningResult
  | ToolCallReasoningResult
  | LegacyReasoningResult;

/**
 * Pluggable Reasoner interface.
 * Consumes rich Context (or Task + ContextBundle for legacy compatibility)
 * and returns structured reasoning results (final answer OR tool call).
 *
 * INVARIANT: The Reasoner must NEVER execute tools directly.
 * It only REQUESTS a tool call.
 */
export interface Reasoner {
  reason(
    taskOrContext: Task | Context,
    coworker?: AICoworker,
    context?: ContextBundle,
    previousToolResult?: ToolResult
  ): Promise<ReasoningResult>;
}
