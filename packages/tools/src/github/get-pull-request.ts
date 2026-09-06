import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { GitHubClient } from "../providers/github/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const GitHubGetPullRequestInputSchema = z.object({
  owner: z.string().min(1, "Owner is required"),
  repo: z.string().min(1, "Repo is required"),
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
});

export type GitHubGetPullRequestInput = z.infer<typeof GitHubGetPullRequestInputSchema>;

export class GitHubGetPullRequestTool implements ContextForgeTool<GitHubGetPullRequestInput> {
  readonly name = "github:get_pull_request";
  readonly type = "read" as const;
  readonly description = "Fetch details, branch refs, and status for a GitHub pull request.";
  readonly requiredCapability = "github:read";
  readonly inputSchema = GitHubGetPullRequestInputSchema;

  constructor(private readonly client: GitHubClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters);
      const data = await this.client.getPullRequest(input.owner, input.repo, input.pullNumber);
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
