import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { LinearClient } from "../providers/linear/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const LinearListCommentsInputSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
});

export type LinearListCommentsInput = z.infer<typeof LinearListCommentsInputSchema>;

export class LinearListCommentsTool implements ContextForgeTool<LinearListCommentsInput> {
  readonly name = "linear:list_comments";
  readonly type = "read" as const;
  readonly description = "List comments on a Linear issue.";
  readonly requiredCapability = "linear:read";
  readonly inputSchema = LinearListCommentsInputSchema;

  constructor(private readonly client: LinearClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters);
      const data = await this.client.listComments(input.issueId);
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
