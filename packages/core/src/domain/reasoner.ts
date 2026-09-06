import { z } from "zod";
import type { Task } from "./task.js";
import type { AICoworker } from "./entities.js";
import type { ContextBundle } from "./context.js";
import { ToolCallIntentSchema, type ToolResult, type ToolCallIntent } from "./tools.js";

export const ReasoningResultSchema = z.object({
  analysis: z.string().min(1),
  diagnosis: z.string().optional(),
  recommendations: z.array(z.string()).default([]),
  toolIntent: ToolCallIntentSchema.optional(),
  isComplete: z.boolean().default(false),
  summary: z.string().optional(),
});

export type ReasoningResult = z.infer<typeof ReasoningResultSchema>;

/**
 * Pluggable Reasoner interface.
 * Decouples the reasoning provider (GLM, OpenAI, local models, heuristics)
 * from the deterministic pipeline orchestrator.
 */
export interface Reasoner {
  reason(
    task: Task,
    coworker: AICoworker,
    context: ContextBundle,
    previousToolResult?: ToolResult
  ): Promise<ReasoningResult>;
}
