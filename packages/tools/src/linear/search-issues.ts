import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { LinearClient } from "../providers/linear/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const LinearSearchIssuesInputSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().min(1).max(50).default(10),
});

export type LinearSearchIssuesInput = z.infer<typeof LinearSearchIssuesInputSchema>;

export class LinearSearchIssuesTool implements ContextForgeTool {
  readonly name = "linear:search_issues";
  readonly type = "read" as const;
  readonly description = "Search Linear issues across the workspace by query string.";
  readonly requiredCapability = "linear:read";
  readonly inputSchema = LinearSearchIssuesInputSchema;

  constructor(private readonly client: LinearClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters) as LinearSearchIssuesInput;
      const data = await this.client.searchIssues(input.query, {
        limit: input.limit,
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
