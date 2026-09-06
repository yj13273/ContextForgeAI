import type { ContextForgeTool } from "../types.js";
import type { Tool } from "@contextforge/core";
import { GitHubClient } from "../providers/github/client.js";
import { LinearClient } from "../providers/linear/client.js";
import {
  GitHubGetIssueTool,
  GitHubSearchCodeTool,
  GitHubGetFileTool,
  GitHubListCommitsTool,
  GitHubGetPullRequestTool,
} from "../github/index.js";
import {
  LinearGetIssueTool,
  LinearSearchIssuesTool,
  LinearListCommentsTool,
  LinearUpdateIssueTool,
} from "../linear/index.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ContextForgeTool>();

  register(tool: ContextForgeTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ContextForgeTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(): ContextForgeTool[] {
    return Array.from(this.tools.values());
  }

  listByCapability(capability: string): ContextForgeTool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.requiredCapability === capability
    );
  }

  toMap(): Map<string, Tool> {
    const map = new Map<string, Tool>();
    for (const [name, tool] of this.tools.entries()) {
      map.set(name, tool);
    }
    return map;
  }
}

export function createDefaultToolRegistry(
  githubClient: GitHubClient,
  linearClient: LinearClient
): ToolRegistry {
  const registry = new ToolRegistry();

  // GitHub READ tools
  registry.register(new GitHubGetIssueTool(githubClient));
  registry.register(new GitHubSearchCodeTool(githubClient));
  registry.register(new GitHubGetFileTool(githubClient));
  registry.register(new GitHubListCommitsTool(githubClient));
  registry.register(new GitHubGetPullRequestTool(githubClient));

  // Linear READ tools
  registry.register(new LinearGetIssueTool(linearClient));
  registry.register(new LinearSearchIssuesTool(linearClient));
  registry.register(new LinearListCommentsTool(linearClient));

  // Linear WRITE tool (requires human approval)
  registry.register(new LinearUpdateIssueTool(linearClient));

  return registry;
}
