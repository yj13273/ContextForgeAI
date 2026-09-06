import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { GitHubClient } from "../providers/github/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const GitHubSearchCodeInputSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  owner: z.string().optional(),
  repo: z.string().optional(),
  perPage: z.number().int().min(1).max(100).default(10),
});

export type GitHubSearchCodeInput = z.infer<typeof GitHubSearchCodeInputSchema>;

export class GitHubSearchCodeTool implements ContextForgeTool {
  readonly name = "github:search_code";
  readonly type = "read" as const;
  readonly description = "Search code across a GitHub repository or organization to locate references, definitions, or symbols.";
  readonly requiredCapability = "github:read";
  readonly inputSchema = GitHubSearchCodeInputSchema;

  constructor(private readonly client: GitHubClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters) as GitHubSearchCodeInput;
      const data = await this.client.searchCode(input.query, {
        owner: input.owner,
        repo: input.repo,
        perPage: input.perPage,
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
