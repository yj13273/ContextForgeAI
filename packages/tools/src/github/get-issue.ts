import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { GitHubClient } from "../providers/github/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const GitHubGetIssueInputSchema = z.object({
  owner: z.string().min(1, "Owner is required"),
  repo: z.string().min(1, "Repo is required"),
  issueNumber: z.number().int().positive("Issue number must be a positive integer"),
});

export type GitHubGetIssueInput = z.infer<typeof GitHubGetIssueInputSchema>;

export class GitHubGetIssueTool implements ContextForgeTool<GitHubGetIssueInput> {
  readonly name = "github:get_issue";
  readonly type = "read" as const;
  readonly description = "Retrieve details of a GitHub issue including status, author, body, labels, and metadata.";
  readonly requiredCapability = "github:read";
  readonly inputSchema = GitHubGetIssueInputSchema;

  constructor(private readonly client: GitHubClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters);
      const data = await this.client.getIssue(input.owner, input.repo, input.issueNumber);
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
