import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { GitHubClient } from "../providers/github/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const GitHubListCommitsInputSchema = z.object({
  owner: z.string().min(1, "Owner is required"),
  repo: z.string().min(1, "Repo is required"),
  sha: z.string().optional(),
  path: z.string().optional(),
  perPage: z.number().int().min(1).max(100).default(10),
});

export type GitHubListCommitsInput = z.infer<typeof GitHubListCommitsInputSchema>;

export class GitHubListCommitsTool implements ContextForgeTool {
  readonly name = "github:list_commits";
  readonly type = "read" as const;
  readonly description = "List commits in a GitHub repository, optionally filtered by file path or branch/commit sha.";
  readonly requiredCapability = "github:read";
  readonly inputSchema = GitHubListCommitsInputSchema;

  constructor(private readonly client: GitHubClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters) as GitHubListCommitsInput;
      const data = await this.client.listCommits(input.owner, input.repo, {
        sha: input.sha,
        path: input.path,
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
