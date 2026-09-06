import { z } from "zod";
import type { Task } from "./task.js";
import type { AICoworker } from "./entities.js";
import type { Memory } from "./memory.js";
import type { Knowledge } from "./knowledge.js";

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

// --- Milestone 4 Rich Context Domain Models ---

export interface EmployeeContext {
  id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
}

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
}

export interface RoleContext {
  id?: string;
  name: string;
  permissions: string[];
}

export interface CoworkerContext {
  id: string;
  name: string;
  persona: string;
  capabilities: string[];
  systemPrompt: string;
}

export interface TaskContext {
  id: string;
  title: string;
  description: string;
  workflow: string;
  status: string;
}

export interface ConversationStep {
  stepIndex: number;
  stepType: string;
  status: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface ConversationContext {
  taskId: string;
  steps: ConversationStep[];
}

export interface ToolContext {
  name: string;
  type: "read" | "write";
  description: string;
  requiredCapability: string;
}

export interface PermissionContext {
  allowedToolNames: string[];
  requiresApprovalToolNames: string[];
}

export type Context = {
  employee: EmployeeContext;
  organization: OrganizationContext;
  role: RoleContext;
  coworker: CoworkerContext;
  memories: Memory[];
  knowledge: Knowledge[];
  conversation: ConversationContext;
  task: TaskContext;
  tools: ToolContext[];
  permissions: PermissionContext;
};

export interface BuildContextParams {
  organizationId?: string;
  employeeId: string;
  coworkerId: string;
  taskId: string;
  query?: string;
  maxMemories?: number;
  maxKnowledge?: number;
}

/**
 * ContextEngine is a first-class subsystem responsible for identifying,
 * gathering, and assembling bounded, tenant-safe context for the reasoner.
 */
export interface ContextEngine {
  gatherContext(task: Task, coworker: AICoworker): Promise<ContextBundle>;
  buildContext?(params: BuildContextParams): Promise<Context>;
}
