import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { LinearClient } from "../providers/linear/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const LinearGetIssueInputSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
});

export type LinearGetIssueInput = z.infer<typeof LinearGetIssueInputSchema>;

export class LinearGetIssueTool implements ContextForgeTool<LinearGetIssueInput> {
  readonly name = "linear:get_issue";
  readonly type = "read" as const;
  readonly description = "Fetch Linear issue details, status, priority, and assignees by issue ID or key.";
  readonly requiredCapability = "linear:read";
  readonly inputSchema = LinearGetIssueInputSchema;

  constructor(private readonly client: LinearClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters);
      const data = await this.client.getIssue(input.issueId);
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
