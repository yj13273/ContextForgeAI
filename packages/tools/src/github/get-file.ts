import { z } from "zod";
import type { ContextForgeTool } from "../types.js";
import type { ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { GitHubClient } from "../providers/github/client.js";
import { sanitizeErrorMessage } from "../errors.js";

export const GitHubGetFileInputSchema = z.object({
  owner: z.string().min(1, "Owner is required"),
  repo: z.string().min(1, "Repo is required"),
  path: z.string().min(1, "File path is required"),
  ref: z.string().optional(),
});

export type GitHubGetFileInput = z.infer<typeof GitHubGetFileInputSchema>;

export class GitHubGetFileTool implements ContextForgeTool<GitHubGetFileInput> {
  readonly name = "github:get_file";
  readonly type = "read" as const;
  readonly description = "Fetch content and metadata of a file from a GitHub repository at a specific branch or commit ref.";
  readonly requiredCapability = "github:read";
  readonly inputSchema = GitHubGetFileInputSchema;

  constructor(private readonly client: GitHubClient) {}

  async execute(call: ToolCallIntent, _context?: ToolExecutionContext): Promise<ToolResult> {
    try {
      const input = this.inputSchema.parse(call.parameters);
      const data = await this.client.getFile(input.owner, input.repo, input.path, input.ref);
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
