import { z } from "zod";
import type { Task } from "./task.js";
import type { AICoworker } from "./entities.js";

export const ContextArtifactSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["github", "linear", "repository", "documentation", "memory"]),
  type: z.enum(["issue", "pull_request", "code_snippet", "log", "memory_item"]),
  title: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()).default({}),
});

export type ContextArtifact = z.infer<typeof ContextArtifactSchema>;

export const ContextBundleSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  gatheredAt: z.date().default(() => new Date()),
  artifacts: z.array(ContextArtifactSchema).default([]),
});

export type ContextBundle = z.infer<typeof ContextBundleSchema>;

/**
 * ContextEngine is a first-class subsystem responsible for identifying,
 * gathering, and assembling relevant organization context for a task.
 */
export interface ContextEngine {
  gatherContext(task: Task, coworker: AICoworker): Promise<ContextBundle>;
}
