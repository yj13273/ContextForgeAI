import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { LinearClient } from "../providers/linear/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const LinearUpdateIssueInputSchema = z
  .object({
    issueId: z.string().min(1, "Issue ID is required"),
    title: z.string().min(1, "Title cannot be empty").optional(),
    description: z.string().optional(),
    stateId: z.string().min(1, "State ID cannot be empty").optional(),
    priority: z.number().int().min(0).max(4, "Priority must be between 0 and 4").optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.stateId !== undefined ||
      data.priority !== undefined,
    {
      message: "At least one field to update (title, description, stateId, priority) must be specified.",
    }
  );

export type LinearUpdateIssueToolInput = z.infer<typeof LinearUpdateIssueInputSchema>;

export class LinearUpdateIssueTool implements ContextForgeTool {
  readonly name = "linear:update_issue";
  readonly type = "write" as const;
  readonly description = "Update a Linear issue title, description, state, or priority. Requires explicit human approval.";
  readonly requiredCapability = "linear:write";
  readonly inputSchema = LinearUpdateIssueInputSchema;

  constructor(private readonly client: LinearClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters) as LinearUpdateIssueToolInput;
      const data = await this.client.updateIssue(input.issueId, {
        title: input.title,
        description: input.description,
        stateId: input.stateId,
        priority: input.priority,
      });
      return {
        success: true,
        data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: sanitizeErrorMessage(message),
      };
    }
  }
}
