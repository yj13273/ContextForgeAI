import { z } from "zod";

export const ToolTypeSchema = z.enum(["read", "write"]);
export type ToolType = z.infer<typeof ToolTypeSchema>;

export const ToolCallIntentSchema = z.object({
  toolName: z.string().min(1),
  action: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
});

export type ToolCallIntent = z.infer<typeof ToolCallIntentSchema>;

export const ToolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

export interface ToolExecutionContext {
  readonly organizationId: string;
  readonly taskId: string;
  readonly employeeId: string;
  readonly coworkerId: string;
}

export interface Tool {
  readonly name: string;
  readonly type: ToolType;
  readonly description: string;
  execute(call: ToolCallIntent, context?: ToolExecutionContext): Promise<ToolResult>;
}

export interface PermissionCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

/**
 * Evaluates permission for a tool invocation.
 * Enforces the core rule:
 * - Read tools are allowed automatically.
 * - Write tools require human employee approval before execution.
 */
export function evaluateToolPermission(tool: Tool): PermissionCheckResult {
  if (tool.type === "write") {
    return {
      allowed: true,
      requiresApproval: true,
      reason: `Tool '${tool.name}' performs write actions which require human approval.`,
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    reason: `Tool '${tool.name}' is read-only and permitted for automatic execution.`,
  };
}
