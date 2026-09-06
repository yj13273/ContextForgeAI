import type { Tool, ToolCallIntent, ToolResult } from "../domain/tools.js";

export class FakeReadTool implements Tool {
  public readonly name: string;
  public readonly type = "read" as const;
  public readonly description: string;
  public executionCount = 0;
  public lastExecutedCall?: ToolCallIntent;

  constructor(name = "github:read_issue", description = "Reads issue comments from GitHub") {
    this.name = name;
    this.description = description;
  }

  async execute(call: ToolCallIntent): Promise<ToolResult> {
    this.executionCount++;
    this.lastExecutedCall = call;
    return {
      success: true,
      data: {
        comments: [
          { author: "sre-bot", text: "Alert fired: error rate > 5% on /auth endpoint." },
          { author: "alice", text: "Started seeing this after deploy #88." },
        ],
      },
    };
  }
}

export class FakeWriteTool implements Tool {
  public readonly name: string;
  public readonly type = "write" as const;
  public readonly description: string;
  public executionCount = 0;
  public lastExecutedCall?: ToolCallIntent;

  constructor(name = "linear:post_comment", description = "Posts a comment to a Linear ticket") {
    this.name = name;
    this.description = description;
  }

  async execute(call: ToolCallIntent): Promise<ToolResult> {
    this.executionCount++;
    this.lastExecutedCall = call;
    return {
      success: true,
      data: {
        commentId: "lin_comm_9981",
        issueId: call.parameters.issueId,
        posted: true,
      },
    };
  }
}
